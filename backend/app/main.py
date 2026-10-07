import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.models import Flight, FlightRoute, WeatherArea
from app.providers import ProviderError, create_provider, create_weather_provider
from app.routes import LookupUnavailable, RouteService

# The Vite dev server, used when CORS_ORIGINS is not set.
DEFAULT_CORS_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]


def cors_origins() -> list[str]:
    """Browser origins allowed to call the API: CORS_ORIGINS (comma-separated) or the dev server."""
    entries = os.environ.get("CORS_ORIGINS", "").split(",")
    # An origin has no trailing slash, so tolerate one in the setting.
    origins = [entry.strip().rstrip("/") for entry in entries if entry.strip()]
    return origins or DEFAULT_CORS_ORIGINS


app = FastAPI(title="Airspace Explorer API")
provider = create_provider()  # FLIGHT_SOURCE=mock (default) or opensky
weather_provider = create_weather_provider()  # WEATHER_SOURCE=mock (default) or awc
route_service = RouteService()

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
def health() -> dict[str, str | int | None]:
    return {
        "status": "ok",
        "source": provider.name,
        **provider.status(),
        "weather_source": weather_provider.name,
        **{f"weather_{key}": value for key, value in weather_provider.status().items()},
    }


@app.get("/flights")
def flights() -> list[Flight]:
    try:
        return provider.get_flights()
    except ProviderError as error:
        # The frontend keeps its last good data when a poll fails.
        raise HTTPException(
            status_code=503, detail="Flight data temporarily unavailable"
        ) from error


@app.get("/flights/{flight_id}/route")
def flight_route(flight_id: str) -> FlightRoute:
    """The route (and type) of one flight; 404 when unknown, 503 when the lookup is down."""
    found = provider.find_flight(flight_id)
    if found is None:
        raise HTTPException(status_code=404, detail="Unknown flight")
    flight, icao24 = found
    if flight.origin is not None and flight.destination is not None:
        # The feed already has this route (the mock does): nothing to look up.
        return FlightRoute(
            aircraft_type=flight.aircraft_type,
            origin=flight.origin,
            destination=flight.destination,
            duration_min=flight.duration_min,
            duration_estimated=flight.duration_estimated,
        )
    try:
        route = route_service.lookup(flight, icao24)
    except LookupUnavailable as error:
        raise HTTPException(status_code=503, detail="Route lookup unavailable") from error
    if route is None:
        raise HTTPException(status_code=404, detail="No route known")
    return route


@app.get("/weather")
def weather() -> list[WeatherArea]:
    try:
        return weather_provider.get_weather()
    except ProviderError as error:
        # The frontend treats a failed weather poll as "no weather".
        raise HTTPException(
            status_code=503, detail="Weather data temporarily unavailable"
        ) from error
