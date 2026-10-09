"""Where flights come from: a small interface plus the choice between mock and live data."""

import os
from collections.abc import Mapping
from typing import Protocol

from app.models import Flight, WeatherArea


class ProviderError(Exception):
    """The data source could not supply flights (and has nothing cached to fall back on)."""


class RateLimited(ProviderError):
    """A feed answered 429; `retry_after` is how long it asked us to wait (seconds)."""

    def __init__(self, source: str, retry_after: float) -> None:
        super().__init__(f"{source} rate limit reached, retry in {retry_after:.0f}s")
        self.retry_after = retry_after


class FlightProvider(Protocol):
    name: str  # shown by /health, e.g. "mock" or "opensky"

    def get_flights(self) -> list[Flight]: ...

    def find_flight(self, flight_id: str) -> tuple[Flight, str | None] | None:
        """The flight with this id as it is now, plus its icao24 if known (None: not in feed).

        Raises ProviderError while the feed has not delivered its first snapshot, so that
        "nothing loaded yet" is not mistaken for "no such flight".
        """
        ...

    def status(self) -> dict[str, str | int | None]:
        """Extra facts for /health (empty when there is nothing to report)."""
        ...

    def close(self) -> None:
        """Release connections and other resources (at shutdown)."""
        ...


class WeatherProvider(Protocol):
    name: str  # shown by /health, e.g. "mock" or "awc"

    def get_weather(self) -> list[WeatherArea]: ...

    def status(self) -> dict[str, str | int | None]:
        """Extra facts for /health (empty when there is nothing to report)."""
        ...

    def close(self) -> None:
        """Release connections and other resources (at shutdown)."""
        ...


def create_weather_provider(env: Mapping[str, str] | None = None) -> WeatherProvider:
    """Pick the provider from WEATHER_SOURCE (default "mock", like FLIGHT_SOURCE)."""
    env = os.environ if env is None else env
    source = env.get("WEATHER_SOURCE", "mock")
    if source == "mock":
        # Imported here, like the live ones: only the mock needs the mock data, which is built
        # when its module is imported.
        from app.mock_providers import MockWeatherProvider

        return MockWeatherProvider()
    if source == "awc":
        from app.awc import AwcWeatherProvider  # imported here: awc imports this module

        return AwcWeatherProvider.from_env(env)
    raise ValueError(f"Unknown WEATHER_SOURCE {source!r}: use 'mock' or 'awc'")


def create_provider(env: Mapping[str, str] | None = None) -> FlightProvider:
    """Pick the provider from FLIGHT_SOURCE (default "mock", so a missing secret can't break it)."""
    env = os.environ if env is None else env
    source = env.get("FLIGHT_SOURCE", "mock")
    if source == "mock":
        from app.mock_providers import MockFlightProvider

        return MockFlightProvider()
    if source == "opensky":
        from app.opensky import OpenSkyProvider  # imported here: opensky imports this module

        return OpenSkyProvider.from_env(env)
    raise ValueError(f"Unknown FLIGHT_SOURCE {source!r}: use 'mock' or 'opensky'")
