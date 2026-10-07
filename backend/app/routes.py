"""Route and aircraft type for one flight, looked up on demand from adsbdb (api.adsbdb.com).

Live position data has no route, so when a player taps a live flight the backend asks
adsbdb for it. Only tapped flights are looked up, and results are kept in memory only
(adsbdb's route data may not be copied into other databases), never written to disk.
Every failure ends as "unknown": the frontend just hides what it doesn't have.
"""

import logging
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

import httpx

from app.constants import GROUND_MIN
from app.geo import distance_nm
from app.models import Airport, Flight, FlightRoute
from app.providers import ProviderError

log = logging.getLogger(__name__)

BASE_URL = "https://api.adsbdb.com/v0"

HIT_TTL_S = 24 * 3600  # an answer found today is good for the day
MISS_TTL_S = 3600  # an unknown callsign is retried after an hour
MAX_CACHE_ENTRIES = 2000
DOWN_PAUSE_S = 15  # after a failed lookup, taps on uncached planes fail at once for this long
MAX_CONCURRENT_LOOKUPS = 8  # requests to adsbdb in progress at once (the thread pool has 40)
QUEUE_WAIT_S = 2  # how long a lookup waits for a free slot before giving up

CRUISE_KT = 440  # typical average speed: the mock's long-hauls use 450-490 (40 less westbound)
# The plane must be roughly on the way: going origin -> plane -> destination can't be much
# longer than going straight. The slack keeps short routes and small diversions valid.
MAX_DETOUR = 1.25
DETOUR_SLACK_NM = 40.0


class LookupUnavailable(ProviderError):
    """adsbdb could not be reached or answered with an error (not a plain "unknown")."""


@dataclass(frozen=True)
class Found:
    """What adsbdb said, before checking it against where the plane is."""

    aircraft_type: str | None
    origin: Airport | None  # origin and destination are both set, or both None
    destination: Airport | None
    # Extra detail for the card (airline, tail number, ...); see FlightRoute.
    details: dict[str, str] = field(default_factory=dict)


def estimate_duration_min(origin: Airport, destination: Airport) -> int:
    """Gate-to-gate minutes: great-circle distance at a typical speed plus ground time."""
    distance = distance_nm(
        (origin.latitude, origin.longitude), (destination.latitude, destination.longitude)
    )
    return round(distance / CRUISE_KT * 60 + GROUND_MIN)


def is_plausible(flight: Flight, origin: Airport, destination: Airport) -> bool:
    """Is the plane somewhere along origin -> destination? Callsigns get reused on other legs."""
    here = (flight.latitude, flight.longitude)
    a, b = (origin.latitude, origin.longitude), (destination.latitude, destination.longitude)
    direct = distance_nm(a, b)
    if direct < 1:  # same airport twice: not a route
        return False
    return distance_nm(a, here) + distance_nm(here, b) <= direct * MAX_DETOUR + DETOUR_SLACK_NM


def to_route(found: Found, flight: Flight) -> FlightRoute:
    """The answer for this plane now: the route only counts if the plane is on it.

    Checked on every lookup, not once when cached: a callsign can be flown on another leg
    later in the day, and the cached route would then be wrong for the new flight.
    """
    if (
        found.origin is None
        or found.destination is None
        or not is_plausible(flight, found.origin, found.destination)
    ):
        return FlightRoute(aircraft_type=found.aircraft_type).model_copy(update=found.details)
    minutes = estimate_duration_min(found.origin, found.destination)
    route = FlightRoute(
        aircraft_type=found.aircraft_type,
        origin=found.origin,
        destination=found.destination,
        duration_min=minutes,
        duration_estimated=True,
    )
    return route.model_copy(update=found.details)


def route_from_feed(flight: Flight) -> FlightRoute:
    """The route a feed already carries (the mock's): nothing to look up, nothing to check."""
    return FlightRoute(
        aircraft_type=flight.aircraft_type,
        origin=flight.origin,
        destination=flight.destination,
        duration_min=flight.duration_min,
        duration_estimated=flight.duration_estimated,
    )


def _text(data: Any, key: str) -> str | None:
    """A non-empty string field of an adsbdb object, or None."""
    value = data.get(key) if isinstance(data, dict) else None
    return value.strip() or None if isinstance(value, str) else None


def _details(aircraft: Any, flightroute: Any) -> dict[str, str]:
    """The card's extra detail, by FlightRoute field name; only what adsbdb told us.

    The airline comes from the callsign, so it still holds when the route itself was
    rejected as being for another leg.
    """
    airline = flightroute.get("airline") if isinstance(flightroute, dict) else None
    wanted = {
        "airline": _text(airline, "name"),
        "airline_country": _text(airline, "country"),
        "registration": _text(aircraft, "registration"),
        "manufacturer": _text(aircraft, "manufacturer"),
        "model": _text(aircraft, "type"),
        "operator": _text(aircraft, "registered_owner"),
    }
    return {k: v for k, v in wanted.items() if v is not None}


def _airport(data: Any) -> Airport | None:
    if not isinstance(data, dict):
        return None
    try:
        icao = str(data["icao_code"])
        return Airport(
            icao=icao,
            iata=str(data.get("iata_code") or icao),  # small airfields have no IATA code
            name=str(data["name"]),
            latitude=float(data["latitude"]),
            longitude=float(data["longitude"]),
            city=_text(data, "municipality"),
            country=_text(data, "country_name"),
        )
    except (KeyError, TypeError, ValueError):
        return None


class RouteService:
    def __init__(
        self,
        http: httpx.Client | None = None,
        clock: Callable[[], float] = time.time,
        max_entries: int = MAX_CACHE_ENTRIES,
        max_concurrent: int = MAX_CONCURRENT_LOOKUPS,
        queue_wait_s: float = QUEUE_WAIT_S,
    ) -> None:
        self._owns_http = http is None  # close only a client made here, not one handed in
        self._http = http if http is not None else httpx.Client(timeout=8)
        self._clock = clock
        self._max_entries = max_entries
        self._slots = threading.BoundedSemaphore(max_concurrent)
        self._queue_wait_s = queue_wait_s
        self._down_until = 0.0  # while adsbdb is down: no new requests before this time
        # Guards the cache and _down_until, never held during a request.
        self._lock = threading.Lock()
        self._cache: dict[str, tuple[float, Found | None]] = {}

    def lookup(self, flight: Flight, icao24: str | None) -> FlightRoute | None:
        """The route of this flight: the feed's own if it has one, else what adsbdb knows.
        None if nothing usable is known.

        Raises LookupUnavailable when adsbdb is down. The failure is not cached, but for
        DOWN_PAUSE_S seconds taps on uncached planes fail at once instead of each waiting for
        the request timeout. Cached answers are still served during the pause.
        """
        if flight.origin is not None and flight.destination is not None:
            return route_from_feed(flight)  # no request, no cache
        has_callsign = flight.callsign != "Unknown"
        key = f"{icao24 or ''}|{flight.callsign if has_callsign else ''}"
        now = self._clock()
        with self._lock:
            cached = self._cache.get(key)
            down_until = self._down_until
        if cached is not None and cached[0] > now:
            found = cached[1]
        else:
            if now < down_until:
                raise LookupUnavailable("adsbdb is down, not asking again yet")
            # At most a few requests to adsbdb at once, so a burst of taps cannot use up every
            # worker thread. Too busy is not "down": it does not start the pause.
            if not self._slots.acquire(timeout=self._queue_wait_s):
                raise LookupUnavailable("too many lookups in progress")
            try:
                found = self._fetch(icao24 or None, flight.callsign if has_callsign else None)
            except LookupUnavailable:
                with self._lock:
                    # Counted from when the failure arrived, not from when the request began:
                    # a timeout alone can take 8 s.
                    self._down_until = self._clock() + DOWN_PAUSE_S
                raise
            finally:
                self._slots.release()
            with self._lock:
                self._down_until = 0.0
                self._store(key, now, found)
        return to_route(found, flight) if found else None

    def close(self) -> None:
        """Release the HTTP connections (at shutdown)."""
        if self._owns_http:
            self._http.close()

    def _store(self, key: str, now: float, found: Found | None) -> None:
        """Cache an answer. When full: drop what has expired, then the entry closest to expiring."""
        if key not in self._cache and len(self._cache) >= self._max_entries:
            self._cache = {k: v for k, v in self._cache.items() if v[0] > now}
            if len(self._cache) >= self._max_entries:
                del self._cache[min(self._cache, key=lambda k: self._cache[k][0])]
        self._cache[key] = (now + (HIT_TTL_S if found else MISS_TTL_S), found)

    def _get(self, path: str) -> dict[str, Any] | None:
        """One adsbdb request: the "response" object, or None for a 404 (unknown)."""
        try:
            response = self._http.get(f"{BASE_URL}/{path}")
            if response.status_code == 404:
                return None
            response.raise_for_status()
            body = response.json()
        except (httpx.HTTPError, ValueError) as error:
            log.warning("adsbdb lookup failed (%s)", error)
            raise LookupUnavailable(str(error)) from error
        inner = body.get("response") if isinstance(body, dict) else None
        return inner if isinstance(inner, dict) else None

    def _fetch(self, icao24: str | None, callsign: str | None) -> Found | None:
        aircraft: Any = None
        flightroute: Any = None
        if icao24 and callsign:
            # One request for both. adsbdb answers 404 if either half is unknown, so on a
            # 404 ask for each half separately.
            both = self._get(f"aircraft/{icao24}?callsign={callsign}")
            if both is not None:
                aircraft, flightroute = both.get("aircraft"), both.get("flightroute")
        if aircraft is None and flightroute is None:
            if icao24:
                found = self._get(f"aircraft/{icao24}")
                aircraft = found.get("aircraft") if found else None
            if callsign:
                found = self._get(f"callsign/{callsign}")
                flightroute = found.get("flightroute") if found else None

        aircraft_type = None
        if isinstance(aircraft, dict) and aircraft.get("icao_type"):
            aircraft_type = str(aircraft["icao_type"]).strip().upper() or None
        origin = destination = None
        if isinstance(flightroute, dict):
            origin, destination = (
                _airport(flightroute.get("origin")),
                _airport(flightroute.get("destination")),
            )
            if origin is None or destination is None:
                origin = destination = None
        details = _details(aircraft, flightroute)
        if aircraft_type is None and origin is None and not details:
            return None
        return Found(aircraft_type, origin, destination, details)
