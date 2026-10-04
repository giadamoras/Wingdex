"""Where flights come from: a small interface plus the choice between mock and live data."""

import os
from collections.abc import Mapping
from typing import Protocol

from app.mock_flights import get_mock_flights
from app.models import Flight


class ProviderError(Exception):
    """The data source could not supply flights (and has nothing cached to fall back on)."""


class FlightProvider(Protocol):
    name: str  # shown by /health, e.g. "mock" or "opensky"

    def get_flights(self) -> list[Flight]: ...

    def find_flight(self, flight_id: str) -> tuple[Flight, str | None] | None:
        """The flight with this id as it is now, plus its icao24 if known (None: not in feed)."""
        ...

    def status(self) -> dict[str, str | int | None]:
        """Extra facts for /health (empty when there is nothing to report)."""
        ...


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


def create_provider(env: Mapping[str, str] | None = None) -> FlightProvider:
    """Pick the provider from FLIGHT_SOURCE (default "mock", so a missing secret can't break it)."""
    env = os.environ if env is None else env
    source = env.get("FLIGHT_SOURCE", "mock")
    if source == "mock":
        return MockFlightProvider()
    if source == "opensky":
        from app.opensky import OpenSkyProvider  # imported here: opensky imports this module

        return OpenSkyProvider.from_env(env)
    raise ValueError(f"Unknown FLIGHT_SOURCE {source!r}: use 'mock' or 'opensky'")
