import logging
import os
import threading
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from typing import Annotated, Any, Generic, Protocol, TypeVar

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.models import Flight, FlightRoute, WeatherArea
from app.providers import (
    FlightProvider,
    ProviderError,
    WeatherProvider,
    create_provider,
    create_weather_provider,
)
from app.routes import LookupUnavailable, RouteService

log = logging.getLogger(__name__)

# The Vite dev server, used when CORS_ORIGINS is not set.
DEFAULT_CORS_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]


def cors_origins() -> list[str]:
    """Browser origins allowed to call the API: CORS_ORIGINS (comma-separated) or the dev server."""
    entries = os.environ.get("CORS_ORIGINS", "").split(",")
    # An origin has no trailing slash, so tolerate one in the setting.
    origins = [entry.strip().rstrip("/") for entry in entries if entry.strip()]
    return origins or DEFAULT_CORS_ORIGINS


T = TypeVar("T")


class Once(Generic[T]):
    """A service made on first use and then kept. The lock means two requests arriving
    together before it exists cannot each make one (two OpenSky providers would each
    spend credits)."""

    def __init__(self, make: Callable[[], T]) -> None:
        self._make = make
        self._lock = threading.Lock()
        self._value: T | None = None

    def __call__(self) -> T:
        with self._lock:
            if self._value is None:
                self._value = self._make()
            return self._value

    @property
    def made(self) -> bool:
        return self._value is not None

    def clear(self) -> None:
        """Forget the service, so the next call makes a new one."""
        with self._lock:
            self._value = None


class Closeable(Protocol):
    def close(self) -> None: ...


# The three services are made on first use, not when this module is imported, and each
# only once. Endpoints ask for them through Depends(), so a test swaps one with
# app.dependency_overrides instead of patching a global. The lifespan below makes them
# at startup, so a bad setting stops the server with a clear message. (The makers are
# looked up when called, so a test can replace create_provider.)
get_provider: Once[FlightProvider] = Once(
    lambda: create_provider()  # FLIGHT_SOURCE=mock (default) or opensky
)
get_weather_provider: Once[WeatherProvider] = Once(
    lambda: create_weather_provider()  # WEATHER_SOURCE=mock (default) or awc
)
get_route_service: Once[RouteService] = Once(lambda: RouteService())


Flights = Annotated[FlightProvider, Depends(get_provider)]
Weather = Annotated[WeatherProvider, Depends(get_weather_provider)]
Routes = Annotated[RouteService, Depends(get_route_service)]


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Make the services at startup and close their HTTP connections at shutdown."""
    factories: list[Once[Any]] = [get_provider, get_weather_provider, get_route_service]
    made: list[Closeable] = []
    try:
        for factory in factories:
            made.append(factory())
        yield
    finally:
        for service in made:
            try:
                service.close()
            except Exception:  # one failing close must not stop the others
                log.exception("Could not close %r", service)
        for factory in factories:
            factory.clear()


app = FastAPI(title="Airspace Explorer API", lifespan=lifespan)

# The flight list is large and repetitive JSON; gzip shrinks it about 8x.
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Allow the frontend's origin to call the API from the browser.
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/health")
def health(provider: Flights, weather_provider: Weather) -> dict[str, str | int | None]:
    return {
        "status": "ok",
        "source": provider.name,
        **provider.status(),
        "weather_source": weather_provider.name,
        **{f"weather_{key}": value for key, value in weather_provider.status().items()},
    }


@app.get("/flights")
def flights(provider: Flights) -> list[Flight]:
    try:
        return provider.get_flights()
    except ProviderError as error:
        # The frontend keeps its last good data when a poll fails.
        raise HTTPException(
            status_code=503, detail="Flight data temporarily unavailable"
        ) from error


@app.get("/flights/{flight_id}/route")
def flight_route(flight_id: str, provider: Flights, route_service: Routes) -> FlightRoute:
    """The route (and type) of one flight; 404 when unknown, 503 when the lookup is down."""
    found = provider.find_flight(flight_id)
    if found is None:
        raise HTTPException(status_code=404, detail="Unknown flight")
    flight, icao24 = found
    try:
        route = route_service.lookup(flight, icao24)
    except LookupUnavailable as error:
        raise HTTPException(status_code=503, detail="Route lookup unavailable") from error
    if route is None:
        raise HTTPException(status_code=404, detail="No route known")
    return route


@app.get("/weather")
def weather(weather_provider: Weather) -> list[WeatherArea]:
    try:
        return weather_provider.get_weather()
    except ProviderError as error:
        # The frontend treats a failed weather poll as "no weather".
        raise HTTPException(
            status_code=503, detail="Weather data temporarily unavailable"
        ) from error
