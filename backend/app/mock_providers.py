"""The providers that serve the built-in mock data (the default when no live source is set)."""

from app.mock_flights import get_mock_flights
from app.mock_taf import get_mock_taf
from app.mock_weather import get_mock_weather
from app.models import Flight, Taf, WeatherArea


class MockFlightProvider:
    name = "mock"

    def get_flights(self) -> list[Flight]:
        return get_mock_flights()

    def find_flight(self, flight_id: str) -> tuple[Flight, str | None] | None:
        for flight in get_mock_flights():
            if flight.id == flight_id:
                return flight, None
        return None

    def status(self) -> dict[str, str | int | None]:
        return {}

    def close(self) -> None:
        pass


class MockWeatherProvider:
    name = "mock"

    def get_weather(self) -> list[WeatherArea]:
        return get_mock_weather()

    def get_taf(self, icao: str) -> Taf | None:
        return get_mock_taf(icao)

    def status(self) -> dict[str, str | int | None]:
        return {}

    def close(self) -> None:
        pass
