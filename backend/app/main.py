from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.mock_weather import get_mock_weather
from app.models import Flight, WeatherArea
from app.providers import ProviderError, create_provider

app = FastAPI(title="Airspace Explorer API")
provider = create_provider()  # FLIGHT_SOURCE=mock (default) or opensky

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


@app.get("/weather")
def weather() -> list[WeatherArea]:
    return get_mock_weather()
