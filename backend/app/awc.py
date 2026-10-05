"""Live weather from the Aviation Weather Center's international SIGMET feed.

https://aviationweather.gov/data/api/ (free, no key; 100 requests/min, at most 400 entries
per query, a custom User-Agent is asked for). One shared snapshot is fetched on demand and
cached, so any number of browsers cost one request per TTL. Why SIGMETs rather than METAR or
TAF: docs/aviation-weather-products.md.
"""

import logging
import threading
import time
from collections.abc import Callable, Mapping
from typing import Any

import httpx
from pydantic import ValidationError

from app.models import Hazard, LatLon, WeatherArea
from app.providers import ProviderError

log = logging.getLogger(__name__)

ISIGMET_URL = "https://aviationweather.gov/api/data/isigmet"
DEFAULT_USER_AGENT = "AirspaceExplorer/0.1"
DEFAULT_CACHE_TTL_S = 300.0  # advisories change slowly; the feed itself refreshes each minute
MIN_TTL_S = 60.0  # refreshes never come closer together than this
FAILURE_BACKOFF_S = 60  # wait this long after a failed request before trying again
ENTRY_CAP = 400  # the API returns at most this many entries per query
NO_CEILING_FT = 60000  # our own top for an advisory that gives none
# Longitude jump that means a polygon straddles the date line (we drop it, see map_entry).
DATE_LINE_SPAN_DEG = 180

# SIGMET hazard codes we model. Mountain wave is a turbulence entry; see map_entry.
HAZARDS: dict[str, Hazard] = {
    "TS": "thunderstorm",
    "TURB": "turbulence",
    "ICE": "icing",
    "VA": "volcanic_ash",
    "TC": "tropical_cyclone",
}

# The feed gives the movement direction as a compass word ("-" or null: no movement).
COMPASS = {
    "N": 0.0,
    "NNE": 22.5,
    "NE": 45.0,
    "ENE": 67.5,
    "E": 90.0,
    "ESE": 112.5,
    "SE": 135.0,
    "SSE": 157.5,
    "S": 180.0,
    "SSW": 202.5,
    "SW": 225.0,
    "WSW": 247.5,
    "W": 270.0,
    "WNW": 292.5,
    "NW": 315.0,
    "NNW": 337.5,
}

# Qualifier words seen in the feed for thunderstorms, turbulence and icing.
SEVERITY = {"SEV": "Severe", "EMBD": "Embedded", "FRQ": "Frequent", "OCNL": "Occasional"}


def _num(value: Any) -> float | None:
    """A number, also from the digit strings the feed uses for speeds ("15")."""
    if isinstance(value, int | float):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value)
        except ValueError:
            return None
    return None


def _rings(coords: Any) -> list[list[tuple[float, float]]]:
    """The (lat, lon) point lists of an entry: one ring, or several for geom "AREAS"."""
    if not isinstance(coords, list) or not coords:
        return []
    if all(isinstance(c, dict) for c in coords):
        parts = [coords]
    elif all(isinstance(c, list) for c in coords):
        parts = coords
    else:
        return []
    return [[(float(c["lat"]), float(c["lon"])) for c in part] for part in parts]


def _polygon(points: list[tuple[float, float]]) -> list[LatLon] | None:
    """A closed ring from the points, or None when they can't make a usable area."""
    if len(points) > 1 and points[0] == points[-1]:
        points = points[:-1]  # re-closed below, so open and closed rings are treated alike
    if len(set(points)) < 3:
        return None
    longitudes = [lon for _, lon in points]
    if max(longitudes) - min(longitudes) > DATE_LINE_SPAN_DEG:
        return None  # straddles the date line; drawn as is it would span the whole map
    ring = [*points, points[0]]
    return [LatLon(latitude=lat, longitude=lon) for lat, lon in ring]


def _hazard(code: str, qualifier: str) -> Hazard:
    hazard = HAZARDS[code]
    # Mountain wave is reported as turbulence with the qualifier "SEV MTW".
    return "mountain_wave" if hazard == "turbulence" and "MTW" in qualifier.split() else hazard


def _severity(qualifier: str) -> str | None:
    for word in qualifier.split():
        if word in SEVERITY:
            return SEVERITY[word]
    return None


def _name(code: str, qualifier: str) -> str | None:
    """The volcano or storm name, which is what a VA or TC qualifier holds."""
    if code not in ("VA", "TC"):
        return None
    name = qualifier.removeprefix("ERUPTION").strip().title()
    return name or None


def map_entry(entry: dict[str, Any]) -> list[WeatherArea]:
    """Turn one SIGMET into weather areas (several for geom "AREAS", none if unusable).

    Raises KeyError, TypeError, ValueError or ValidationError for a malformed entry.
    """
    code = entry["hazard"]
    qualifier = str(entry.get("qualifier") or "").upper()
    fir_id = str(entry["firId"])
    base, top = _num(entry.get("base")), _num(entry.get("top"))
    altitude_min = 0 if base is None else max(0, round(base))  # no base: down to the surface
    altitude_max = NO_CEILING_FT if top is None else round(top)
    if altitude_max <= altitude_min:
        raise ValueError(f"altitude bounds {altitude_min}-{altitude_max} ft")
    direction = COMPASS.get(str(entry.get("dir") or "").strip().upper())
    speed = _num(entry.get("spd"))
    moving = direction is not None and speed is not None
    region = str(entry.get("firName") or "").removeprefix(fir_id).strip().title() or fir_id
    rings = _rings(entry.get("coords"))
    areas: list[WeatherArea] = []
    for index, ring in enumerate(rings):
        polygon = _polygon(ring)
        if polygon is None:
            continue
        area_id = f"{entry['icaoId']}-{fir_id}-{entry['seriesId']}-{code}"
        areas.append(
            WeatherArea(
                id=area_id if len(rings) == 1 else f"{area_id}-{index}",
                hazard=_hazard(code, qualifier),
                region=region,
                altitude_min_ft=altitude_min,
                altitude_max_ft=altitude_max,
                valid_from=int(entry["validTimeFrom"]),
                valid_to=int(entry["validTimeTo"]),
                polygon=polygon,
                movement_dir=direction if moving else None,
                movement_speed_kt=round(speed) if moving and speed is not None else None,
                severity=None if code in ("VA", "TC") else _severity(qualifier),
                name=_name(code, qualifier),
            )
        )
    return areas


def map_entries(entries: list[Any]) -> list[WeatherArea]:
    """Map every SIGMET, skipping what we don't model or can't use, and log what was dropped."""
    by_id: dict[str, tuple[int, WeatherArea]] = {}  # newest issue wins when an id repeats
    unmodelled = no_polygon = malformed = 0
    for entry in entries:
        if not isinstance(entry, dict) or entry.get("hazard") not in HAZARDS:
            unmodelled += 1
            continue
        try:
            areas = map_entry(entry)
        except (KeyError, TypeError, ValueError, ValidationError) as error:
            malformed += 1
            log.warning("AWC: skipped a malformed SIGMET (%r)", error)
            continue
        if not areas:
            no_polygon += 1
        for area in areas:
            seen = by_id.get(area.id)
            if seen is None or area.valid_from >= seen[0]:
                by_id[area.id] = (area.valid_from, area)
    kept = [area for _, area in by_id.values()]
    log.info(
        "AWC snapshot: %d advisories, %d areas kept, dropped %d unmodelled hazard, "
        "%d without a usable polygon, %d malformed",
        len(entries),
        len(kept),
        unmodelled,
        no_polygon,
        malformed,
    )
    if len(entries) >= ENTRY_CAP - 20:
        log.warning(
            "AWC returned %d entries, near the %d cap: some may be missing", len(entries), ENTRY_CAP
        )
    return kept


class RateLimited(ProviderError):
    """AWC answered 429; `retry_after` is how long to wait (seconds)."""

    def __init__(self, retry_after: float) -> None:
        super().__init__(f"AWC rate limit reached, retry in {retry_after:.0f}s")
        self.retry_after = retry_after


class AwcWeatherProvider:
    name = "awc"

    def __init__(
        self,
        *,
        user_agent: str = DEFAULT_USER_AGENT,
        cache_ttl_s: float = DEFAULT_CACHE_TTL_S,
        http: httpx.Client | None = None,
        clock: Callable[[], float] = time.time,
    ) -> None:
        self._user_agent = user_agent
        self._ttl = max(cache_ttl_s, MIN_TTL_S)  # a bad setting can't hammer the API
        self._http = http or httpx.Client(timeout=20)
        self._clock = clock
        self._lock = threading.Lock()  # one refresh at a time, however many requests wait
        self._snapshot: list[WeatherArea] | None = None
        self._fetched_at = 0.0
        self._next_attempt = 0.0  # no request before this time (backoff after a failure)

    @classmethod
    def from_env(cls, env: Mapping[str, str]) -> "AwcWeatherProvider":
        return cls(
            user_agent=env.get("WEATHER_USER_AGENT", DEFAULT_USER_AGENT),
            cache_ttl_s=float(env.get("WEATHER_CACHE_TTL_S", DEFAULT_CACHE_TTL_S)),
        )

    def status(self) -> dict[str, str | int | None]:
        """What /health shows: how many areas are held and how old they are."""
        snapshot = self._snapshot
        return {
            "areas": None if snapshot is None else len(snapshot),
            "age_s": None if snapshot is None else round(self._clock() - self._fetched_at),
        }

    def get_weather(self) -> list[WeatherArea]:
        with self._lock:
            now = self._clock()
            if self._snapshot is None or now - self._fetched_at >= self._ttl:
                self._refresh(now)
            if self._snapshot is None:
                raise ProviderError("No AWC data yet")
            return list(self._snapshot)

    def _refresh(self, now: float) -> None:
        """Fetch a new snapshot; on failure keep serving the old one (if there is one)."""
        if now < self._next_attempt:
            return
        try:
            self._snapshot = self._fetch()
            self._fetched_at = now
        except (httpx.HTTPError, ProviderError, ValueError) as error:
            backoff = error.retry_after if isinstance(error, RateLimited) else FAILURE_BACKOFF_S
            self._next_attempt = now + backoff
            log.warning("AWC request failed (%s); retrying in %.0fs", error, backoff)
            if self._snapshot is None:
                raise ProviderError(f"AWC unavailable: {error}") from error

    def _fetch(self) -> list[WeatherArea]:
        # format=json is the only query parameter: undocumented ones are an error for AWC.
        response = self._http.get(
            ISIGMET_URL, params={"format": "json"}, headers={"User-Agent": self._user_agent}
        )
        if response.status_code == 204:  # no advisories at all
            return []
        if response.status_code == 429:
            header = response.headers.get("Retry-After", "")
            raise RateLimited(float(header) if header.isdigit() else FAILURE_BACKOFF_S)
        response.raise_for_status()
        body = response.json()
        if not isinstance(body, list):
            raise ProviderError("AWC answered with something other than a list")
        return map_entries(body)
