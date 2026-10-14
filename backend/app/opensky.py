"""Live flights from the OpenSky Network (https://openskynetwork.github.io/opensky-api/rest.html).

One shared snapshot of the world is fetched on demand and cached, so any number of browsers
cost one OpenSky request per TTL (a global request costs 4 of the 4,000 daily credits).
Between refreshes each plane is moved along its track ("dead reckoning") so the map keeps
gliding instead of jumping once per refresh.
"""

import logging
import time
import zlib
from collections import deque
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from typing import Any

import httpx

from app.aircraft_types import load_aircraft_types
from app.constants import NO_CALLSIGN
from app.geo import destination_point
from app.models import Flight
from app.providers import ProviderError, RateLimited
from app.snapshot import SnapshotCache

log = logging.getLogger(__name__)

TOKEN_URL = (
    "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token"
)
STATES_URL = "https://opensky-network.org/api/states/all"

M_TO_FT = 3.28084
MS_TO_KT = 1.94384
MS_TO_FPM = 196.85  # metres per second to feet per minute

# Credit guard defaults: the "normal" preset in docs/opensky-credit-guard.md.
DEFAULT_CACHE_TTL_S = 90.0  # usual time between refreshes
DEFAULT_MIN_TTL_S = 60.0  # refreshes never come closer together than this
DEFAULT_MAX_CREDITS_PER_HOUR = 200
DEFAULT_CREDIT_RESERVE = 400  # stop refreshing when OpenSky says this few credits are left
# Flights served at most. Only a safety ceiling: about 10,800 are airborne at once, so by
# default the whole world is sent. The frontend decides what to draw, and gzip keeps the
# poll small (measured in docs/history.md, step 3).
DEFAULT_MAX_FLIGHTS = 15000
HOUR_S = 3600
RESERVE_PROBE_S = 1800  # under the reserve, check again at most this often

MAX_EXTRAPOLATE_S = 600  # never move a plane further than 10 minutes past its last report
FAILURE_BACKOFF_S = 30  # wait this long after a failed request before trying again
TOKEN_MARGIN_S = 60  # renew the token this long before it expires


@dataclass(frozen=True)
class Tracked:
    """A mapped flight, its transponder address and when OpenSky last heard its position."""

    flight: Flight
    icao24: str
    position_time: float  # Unix seconds


def _num(value: Any) -> float | None:
    return float(value) if isinstance(value, int | float) else None


def map_state(row: list[Any], types: Mapping[str, str] | None = None) -> Tracked | None:
    """Turn one OpenSky state vector into a Flight, or None if it can't be a valid one.

    `types` maps icao24 to an ICAO type code; a plane it doesn't know has no type.
    Field indexes: 0 icao24, 1 callsign, 2 origin_country, 3 time_position, 4 last_contact,
    5 longitude, 6 latitude, 7 baro_altitude (m), 8 on_ground, 9 velocity (m/s),
    10 true_track, 11 vertical_rate (m/s), 13 geo_altitude (m).
    """
    if len(row) < 11 or row[8]:  # too short, or parked on the ground
        return None
    longitude, latitude = _num(row[5]), _num(row[6])
    altitude_m = _num(row[7])
    if altitude_m is None and len(row) > 13:
        altitude_m = _num(row[13])
    velocity, track = _num(row[9]), _num(row[10])
    position_time = _num(row[3]) or _num(row[4])
    if (
        longitude is None
        or latitude is None
        or altitude_m is None
        or velocity is None
        or track is None
        or position_time is None
    ):
        return None
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        return None
    speed_kt = round(velocity * MS_TO_KT)
    icao24 = str(row[0]).strip().lower()
    if speed_kt < 1 or not icao24:
        return None
    heading = track % 360
    if heading >= 360:  # a tiny negative track can round up to exactly 360
        heading = 0.0
    callsign = row[1].strip().upper() if isinstance(row[1], str) else ""
    # Rows can be short: the climb rate and country are nice to have, not required.
    rate = _num(row[11]) if len(row) > 11 else None
    country = row[2].strip() or None if isinstance(row[2], str) else None
    flight = Flight(
        # The callsign names the flight; the airframe address stands in when there is none.
        id=callsign or icao24,
        callsign=callsign or NO_CALLSIGN,
        aircraft_type=types.get(icao24) if types else None,
        latitude=latitude,
        longitude=longitude,
        altitude_ft=max(0, round(altitude_m * M_TO_FT)),
        heading=heading,
        speed_kt=speed_kt,
        vertical_rate_fpm=None if rate is None else round(rate * MS_TO_FPM),
        registered_country=country,
    )
    return Tracked(flight, icao24, position_time)


def map_states(
    rows: list[Any], max_flights: int, types: Mapping[str, str] | None = None
) -> list[Tracked]:
    """Map every row, keep the freshest report per id, and cap the total."""
    by_id: dict[str, Tracked] = {}
    on_ground = unusable = duplicates = 0
    for row in rows:
        if not isinstance(row, list):
            unusable += 1
            continue
        tracked = map_state(row, types)
        if tracked is None:
            if len(row) > 8 and row[8]:
                on_ground += 1
            else:
                unusable += 1
            continue
        seen = by_id.get(tracked.flight.id)
        if seen is not None:
            duplicates += 1
        if seen is None or tracked.position_time > seen.position_time:
            by_id[tracked.flight.id] = tracked
    kept = list(by_id.values())
    if len(kept) > max_flights:
        # Too many planes for the map: keep a sample picked by a hash of the id. It is
        # uniform (the mix of altitudes survives, so every quest can still match) and it
        # stays nearly the same between refreshes, so planes don't flicker in and out.
        kept = sorted(kept, key=lambda t: zlib.crc32(t.flight.id.encode()))[:max_flights]
    log.info(
        "OpenSky snapshot: %d rows, %d on ground, %d unusable, %d duplicate callsigns, "
        "%d flights kept (cap %d), %d with a known type",
        len(rows),
        on_ground,
        unusable,
        duplicates,
        len(kept),
        max_flights,
        sum(t.flight.aircraft_type is not None for t in kept),
    )
    return kept


def advance(tracked: Tracked, now: float) -> Flight:
    """The flight where it should be at `now`, flown on from its last reported position."""
    flight = tracked.flight
    age = min(max(now - tracked.position_time, 0.0), MAX_EXTRAPOLATE_S)
    latitude, longitude = destination_point(
        (flight.latitude, flight.longitude), flight.heading, flight.speed_kt * age / 3600
    )
    return flight.model_copy(update={"latitude": latitude, "longitude": longitude})


def parse_bbox(raw: str) -> tuple[float, float, float, float]:
    """OPENSKY_BBOX ("lamin,lomin,lamax,lomax", degrees) checked, or a ValueError saying how.

    A box across the date line (lomin > lomax) is refused: OpenSky cannot take one, and the
    cost estimate below would go negative.
    """
    usage = "OPENSKY_BBOX must be lamin,lomin,lamax,lomax in degrees, e.g. 45,5,48,11"
    try:
        lamin, lomin, lamax, lomax = (float(x) for x in raw.split(","))
    except ValueError:
        raise ValueError(usage) from None
    if not (-90 <= lamin < lamax <= 90):
        raise ValueError(f"{usage} (latitudes -90..90, lamin below lamax)")
    if not (-180 <= lomin < lomax <= 180):
        raise ValueError(
            f"{usage} (longitudes -180..180, lomin below lomax; a box across the date line "
            "is not supported)"
        )
    return lamin, lomin, lamax, lomax


def request_cost(bbox: tuple[float, float, float, float] | None) -> int:
    """Credits one /states/all request costs, by the area asked for (OpenSky's table)."""
    if bbox is None:
        return 4
    lamin, lomin, lamax, lomax = bbox
    area = (lamax - lamin) * (lomax - lomin)  # square degrees
    if area <= 25:
        return 1
    if area <= 100:
        return 2
    if area <= 400:
        return 3
    return 4


class OpenSkyProvider:
    name = "opensky"

    def __init__(
        self,
        client_id: str,
        client_secret: str,
        *,
        bbox: tuple[float, float, float, float] | None = None,  # lamin, lomin, lamax, lomax
        cache_ttl_s: float = DEFAULT_CACHE_TTL_S,
        min_ttl_s: float = DEFAULT_MIN_TTL_S,
        max_credits_per_hour: int = DEFAULT_MAX_CREDITS_PER_HOUR,
        credit_reserve: int = DEFAULT_CREDIT_RESERVE,
        max_flights: int = DEFAULT_MAX_FLIGHTS,
        aircraft_types: Mapping[str, str] | None = None,  # None: the bundled type file
        http: httpx.Client | None = None,
        clock: Callable[[], float] = time.time,
    ) -> None:
        self._types = load_aircraft_types() if aircraft_types is None else aircraft_types
        self._client_id = client_id
        self._client_secret = client_secret
        self._bbox = bbox
        self._cost = request_cost(bbox)
        # Credit guard (presets and reasoning: docs/opensky-credit-guard.md). The refresh
        # interval can't be set below the floor, so a bad setting can't burn the quota.
        self._ttl = max(cache_ttl_s, min_ttl_s)
        self._max_per_hour = max_credits_per_hour
        self._reserve = credit_reserve
        self._spend: deque[tuple[float, int]] = deque()  # (time, credits) of recent requests
        self._remaining: int | None = None  # credits left, as last reported by OpenSky
        self._reserve_retry_at = 0.0  # while under the reserve, probe again only after this
        self._last_pause: str | None = None
        self._max_flights = max_flights
        self._owns_http = http is None  # close only a client made here, not one handed in
        self._http = http if http is not None else httpx.Client(timeout=20)
        self._clock = clock
        # The snapshot, its age and the back-off after a failure; the credit guard decides
        # whether a refresh may go ahead (see _may_refresh).
        self._cache: SnapshotCache[list[Tracked]] = SnapshotCache(
            "OpenSky",
            self._fetch,
            ttl_s=self._ttl,
            failure_backoff_s=FAILURE_BACKOFF_S,
            clock=clock,
            may_refresh=self._may_refresh,
        )
        self._token: str | None = None
        self._token_expires = 0.0

    @classmethod
    def from_env(cls, env: Mapping[str, str]) -> "OpenSkyProvider":
        client_id = env.get("OPENSKY_CLIENT_ID")
        client_secret = env.get("OPENSKY_CLIENT_SECRET")
        if not client_id or not client_secret:
            raise ValueError(
                "FLIGHT_SOURCE=opensky needs OPENSKY_CLIENT_ID and OPENSKY_CLIENT_SECRET "
                "(see backend/.env.example)"
            )
        bbox = None
        if raw := env.get("OPENSKY_BBOX"):
            bbox = parse_bbox(raw)
        return cls(
            client_id,
            client_secret,
            bbox=bbox,
            cache_ttl_s=float(env.get("OPENSKY_CACHE_TTL_S", DEFAULT_CACHE_TTL_S)),
            min_ttl_s=float(env.get("OPENSKY_MIN_TTL_S", DEFAULT_MIN_TTL_S)),
            max_credits_per_hour=int(
                env.get("OPENSKY_MAX_CREDITS_PER_HOUR", DEFAULT_MAX_CREDITS_PER_HOUR)
            ),
            credit_reserve=int(env.get("OPENSKY_CREDIT_RESERVE", DEFAULT_CREDIT_RESERVE)),
            max_flights=int(env.get("OPENSKY_MAX_FLIGHTS", str(DEFAULT_MAX_FLIGHTS))),
        )

    def close(self) -> None:
        """Release the HTTP connections (at shutdown)."""
        if self._owns_http:
            self._http.close()

    def status(self) -> dict[str, str | int | None]:
        """What /health shows: the credit guard's state and how old the served data is.

        Read without the refresh lock on purpose: a refresh holds it for the whole request
        (up to 20 s) and /health must not wait. At worst a number is one request (a few
        credits) out of date.
        """
        now = self._clock()
        reason = self._pause_reason(now)
        snapshot = self._cache.snapshot  # None until the first fetch worked
        return {
            "guard": "ok" if reason is None else f"paused ({reason})",
            "credits_remaining": self._remaining,
            "credits_spent_last_hour": self._spent_last_hour(now),
            "age_s": None if snapshot is None else round(now - self._cache.fetched_at),
        }

    def _spent_last_hour(self, now: float) -> int:
        return sum(credits for t, credits in list(self._spend) if now - t < HOUR_S)

    def _pause_reason(self, now: float) -> str | None:
        """Why the next refresh must wait ("hourly cap" or "reserve"), or None to go ahead."""
        if self._spent_last_hour(now) + self._cost > self._max_per_hour:
            return "hourly cap"
        # OpenSky's own count survives restarts. Under the reserve we only probe now and
        # then (a few credits) to notice when the allowance has come back.
        if (
            self._remaining is not None
            and self._remaining - self._cost < self._reserve
            and now < self._reserve_retry_at
        ):
            return "reserve"
        return None

    def find_flight(self, flight_id: str) -> tuple[Flight, str | None] | None:
        """The flight with this id as it is now, plus its icao24; None if it isn't in the feed.

        Raises ProviderError before the first snapshot has loaded."""
        snapshot = self._cache.snapshot  # read without the lock: a tap never waits for a refresh
        if snapshot is None:
            raise ProviderError("No flight data loaded yet")
        for tracked in snapshot:
            if tracked.flight.id == flight_id:
                return advance(tracked, self._clock()), tracked.icao24
        return None

    def get_flights(self) -> list[Flight]:
        snapshot, now = self._cache.get()
        return [advance(t, now) for t in snapshot]

    def _may_refresh(self, now: float) -> bool:
        """The credit guard: false while a refresh must wait (the last snapshot is served)."""
        reason = self._pause_reason(now)
        if reason != self._last_pause:  # log only when the guard switches on or off
            log.warning("OpenSky credit guard: %s", f"paused ({reason})" if reason else "resumed")
            self._last_pause = reason
        return reason is None

    def _fetch(self) -> list[Tracked]:
        response = self._get_states()
        if response.status_code == 401:  # token rejected: get a fresh one and try once more
            self._token = None
            response = self._get_states()
        self._note_remaining(response)
        if response.status_code == 429:
            header = response.headers.get("X-Rate-Limit-Retry-After-Seconds", "")
            # Header values are text; anything unreadable falls back to the default wait.
            retry = float(header) if header.isdigit() else FAILURE_BACKOFF_S
            raise RateLimited("OpenSky", retry)
        response.raise_for_status()
        body = response.json()
        rows = body.get("states") if isinstance(body, dict) else None
        return map_states(rows if isinstance(rows, list) else [], self._max_flights, self._types)

    def _note_remaining(self, response: httpx.Response) -> None:
        """Remember the credits OpenSky says are left, and when to probe if they're low."""
        header = response.headers.get("X-Rate-Limit-Remaining", "")
        if header.isdigit():
            self._remaining = int(header)
            log.info("OpenSky credits remaining: %d", self._remaining)
        self._reserve_retry_at = self._clock() + RESERVE_PROBE_S

    def _get_states(self) -> httpx.Response:
        params: dict[str, float] = {}
        if self._bbox:
            params = dict(zip(("lamin", "lomin", "lamax", "lomax"), self._bbox, strict=True))
        headers = {"Authorization": f"Bearer {self._bearer()}"}
        # Count every request against the hourly cap (a retried one costs again).
        now = self._clock()
        self._spend.append((now, self._cost))
        while self._spend and now - self._spend[0][0] >= HOUR_S:
            self._spend.popleft()
        return self._http.get(STATES_URL, params=params, headers=headers)

    def _bearer(self) -> str:
        """The OAuth2 access token, fetched when missing or about to expire (30 min life)."""
        now = self._clock()
        if self._token is None or now >= self._token_expires:
            response = self._http.post(
                TOKEN_URL,
                data={
                    "grant_type": "client_credentials",
                    "client_id": self._client_id,
                    "client_secret": self._client_secret,
                },
            )
            response.raise_for_status()
            body = response.json()
            token = body.get("access_token") if isinstance(body, dict) else None
            lifetime = _num(body.get("expires_in")) if isinstance(body, dict) else None
            if not isinstance(token, str):
                raise ProviderError("OpenSky token response had no access_token")
            self._token = token
            self._token_expires = now + (lifetime or 300) - TOKEN_MARGIN_S
        return self._token
