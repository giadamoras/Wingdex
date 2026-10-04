from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.mock_weather import get_mock_weather
from app.models import Flight, FlightRoute, WeatherArea
from app.providers import ProviderError, create_provider
from app.routes import LookupUnavailable, RouteService

app = FastAPI(title="Airspace Explorer API")
provider = create_provider()  # FLIGHT_SOURCE=mock (default) or opensky
route_service = RouteService()

# The flight list is large and repetitive JSON; gzip shrinks it about 8x.
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Allow the Vite dev server to call the API from the browser.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str | int | None]:
    return {"status": "ok", "source": provider.name, **provider.status()}


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
    return get_mock_weather()
