from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.mock_flights import get_mock_flights
from app.mock_weather import get_mock_weather
from app.models import Flight, WeatherArea

app = FastAPI(title="Airspace Explorer API")

# Allow the Vite dev server to call the API from the browser.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/flights")
def flights() -> list[Flight]:
    return get_mock_flights()


@app.get("/weather")
def weather() -> list[WeatherArea]:
    return get_mock_weather()
