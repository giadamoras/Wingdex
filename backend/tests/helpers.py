"""Test doubles shared by several test files."""

from app.models import Flight
from app.providers import ProviderError


class Clock:
    """A clock the test moves by hand: `clock.now += 60`."""

    def __init__(self, now: float = 1_000_000.0) -> None:
        self.now = now

    def __call__(self) -> float:
        return self.now


class StubProvider:
    """A flight provider with no flights. `error` makes it fail like a feed that is down;
    `known` is the one flight (and its icao24) that `find_flight` can find."""

    name = "stub"
    looks_up_routes = True

    def __init__(self, error: bool = False, known: tuple[Flight, str | None] | None = None) -> None:
        self.error = error
        self.known = known

    def get_flights(self) -> list[Flight]:
        if self.error:
            raise ProviderError("down")
        return []

    def find_flight(self, flight_id: str) -> tuple[Flight, str | None] | None:
        if self.known is not None and flight_id == self.known[0].id:
            return self.known
        return None

    def status(self) -> dict[str, str | int | None]:
        return {"guard": "ok"}
