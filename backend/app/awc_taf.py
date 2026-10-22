"""Airport forecasts (TAFs) from the Aviation Weather Center, one airport at a time.

https://aviationweather.gov/data/api/ (free, no key; 100 requests/min). AWC already splits
a TAF into periods with decoded fields, so nothing here parses the raw code: it maps the
fields to our model and caches each airport's answer, so any number of open cards for
the same destination cost one request per TTL. Why TAFs: docs/aviation-weather-products.md.
"""

import logging
import threading
import time
from collections import deque
from collections.abc import Callable
from datetime import datetime
from typing import Any

import httpx
from pydantic import ValidationError

from app.models import Taf, TafChange, TafCloud, TafPeriod
from app.providers import ProviderError, RateLimited

log = logging.getLogger(__name__)

TAF_URL = "https://aviationweather.gov/api/data/taf"
TAF_TTL_S = 30 * 60  # TAFs are issued about every 6 h; this catches amendments
NO_TAF_TTL_S = 60 * 60  # an airport that issues none is asked again only this often
FAILURE_BACKOFF_S = 60  # after a failed request, no new one for this long
# AWC allows 100 requests a minute in all; this leaves room for the SIGMET feed and
# anything else, so a busy minute of new destinations can't reach the limit.
MAX_REQUESTS_PER_MIN = 60
MAX_AIRPORTS = 500  # cached answers kept; the oldest go first
METRES_PER_MILE = 1609.344  # AWC gives visibility in statute miles

# AWC's fcstChange, None for the opening forecast.
CHANGES: dict[str | None, TafChange] = {
    None: "base",
    "FM": "FM",
    "BECMG": "BECMG",
    "TEMPO": "TEMPO",
    "PROB": "PROB",
}


def _int(value: Any) -> int | None:
    """A whole number from the feed, which mixes numbers and digit strings."""
    if isinstance(value, bool):
        return None
    if isinstance(value, int | float):
        return round(value)
    if isinstance(value, str) and value.strip().lstrip("-").isdigit():
        return int(value)
    return None


def _visibility(value: Any) -> tuple[int | None, bool]:
    """Metres, and whether it is "or more". AWC writes "6+" for 6 miles or more, which
    is what an ICAO TAF's 9999 (10 km or more) becomes."""
    if value == "6+":
        return 10000, True
    if isinstance(value, int | float) and not isinstance(value, bool):
        return round(value * METRES_PER_MILE / 100) * 100, False  # 4.35 mi -> 7000 m
    return None, False  # missing, or "" when the group gives none


def map_period(fcst: dict[str, Any]) -> TafPeriod:
    """One AWC forecast period as ours. Raises on a period we cannot use."""
    change = CHANGES.get(fcst.get("fcstChange"))
    if change is None:
        raise ValueError(f"unknown change {fcst.get('fcstChange')!r}")
    wdir = fcst.get("wdir")
    visibility_m, or_more = _visibility(fcst.get("visib"))
    clouds = [
        TafCloud(
            cover=c.get("cover"),
            base_ft=_int(c.get("base")),
            cumulonimbus=c.get("type") == "CB",
        )
        for c in fcst.get("clouds") or []
    ]
    return TafPeriod(
        start=fcst["timeFrom"],
        end=fcst["timeTo"],
        change=change,
        becoming_by=_int(fcst.get("timeBec")),
        probability=_int(fcst.get("probability")),
        wind_dir=None if wdir == "VRB" else _int(wdir),
        wind_variable=wdir == "VRB",
        wind_kt=_int(fcst.get("wspd")),
        gust_kt=_int(fcst.get("wgst")),
        visibility_m=visibility_m,
        visibility_or_more=or_more,
        weather=fcst.get("wxString") or None,
        clouds=clouds,
        vertical_visibility_ft=_int(fcst.get("vertVis")),
    )


def map_taf(entry: dict[str, Any]) -> Taf:
    """One AWC TAF entry as ours. A period we cannot use is skipped (and logged); a
    TAF without its times or raw text raises."""
    periods = []
    for fcst in entry.get("fcsts") or []:
        try:
            periods.append(map_period(fcst))
        except (KeyError, ValueError, ValidationError) as error:
            log.warning("AWC TAF %s: skipped a period (%r)", entry.get("icaoId"), error)
    issued = datetime.fromisoformat(str(entry["issueTime"]).replace("Z", "+00:00"))
    return Taf(
        icao=entry["icaoId"],
        name=entry.get("name") or None,
        issued=int(issued.timestamp()),
        valid_from=entry["validTimeFrom"],
        valid_to=entry["validTimeTo"],
        raw=entry["rawTAF"],
        periods=periods,
    )


class AwcTafService:
    """Each airport's latest TAF, fetched on demand and cached per airport.

    One request at a time, and at most MAX_REQUESTS_PER_MIN in any minute, well inside
    AWC's 100: requests are rare (a card opening on a new destination), but many
    players at once could open many. Past the cap, or after a failure (for a back-off,
    or the wait a 429 asks for), no request is sent: a cached answer is served
    meanwhile, even if old, and without one the call raises ProviderError.
    """

    def __init__(
        self,
        http: httpx.Client,
        user_agent: str,
        clock: Callable[[], float] = time.time,
    ) -> None:
        self._http = http
        self._user_agent = user_agent
        self._clock = clock
        self._lock = threading.Lock()
        self._cache: dict[str, tuple[float, Taf | None]] = {}  # icao -> (fetched at, TAF)
        self._blocked_until = 0.0
        self._sent: deque[float] = deque()  # when the requests of the last minute went

    @property
    def cached(self) -> int:
        return len(self._cache)

    def get(self, icao: str) -> Taf | None:
        """The airport's TAF, or None when it issues none."""
        with self._lock:
            now = self._clock()
            held = self._cache.get(icao)
            if held is not None:
                fetched_at, taf = held
                if now - fetched_at < (TAF_TTL_S if taf is not None else NO_TAF_TTL_S):
                    return taf
            if now < self._blocked_until:
                if held is not None:
                    return held[1]
                raise ProviderError("AWC TAFs are backing off after a failure")
            while self._sent and now - self._sent[0] >= 60:
                self._sent.popleft()
            if len(self._sent) >= MAX_REQUESTS_PER_MIN:
                log.warning("AWC TAF cap of %d a minute reached", MAX_REQUESTS_PER_MIN)
                if held is not None:
                    return held[1]
                raise ProviderError("AWC TAF request cap reached")
            self._sent.append(now)
            try:
                taf = self._fetch(icao)
            except (ProviderError, httpx.HTTPError, ValueError) as error:
                wait = error.retry_after if isinstance(error, RateLimited) else FAILURE_BACKOFF_S
                self._blocked_until = now + wait
                log.warning("AWC TAF for %s failed (%r); backing off %.0fs", icao, error, wait)
                if held is not None:
                    return held[1]
                if isinstance(error, ProviderError):
                    raise
                raise ProviderError(f"AWC TAF request failed: {error!r}") from error
            self._remember(icao, now, taf)
            return taf

    def _remember(self, icao: str, now: float, taf: Taf | None) -> None:
        self._cache[icao] = (now, taf)
        if len(self._cache) > MAX_AIRPORTS:
            oldest = min(self._cache, key=lambda key: self._cache[key][0])
            del self._cache[oldest]

    def _fetch(self, icao: str) -> Taf | None:
        response = self._http.get(
            TAF_URL,
            params={"ids": icao, "format": "json"},
            headers={"User-Agent": self._user_agent},
        )
        if response.status_code == 204:  # no TAF for this airport
            return None
        if response.status_code == 429:
            header = response.headers.get("Retry-After", "")
            raise RateLimited("AWC", float(header) if header.isdigit() else FAILURE_BACKOFF_S)
        response.raise_for_status()
        body = response.json()
        if not isinstance(body, list):
            raise ProviderError("AWC answered with something other than a list")
        # Only this airport's, newest issue first (AWC normally sends just the latest).
        entries = [e for e in body if isinstance(e, dict) and e.get("icaoId") == icao]
        entries.sort(key=lambda e: str(e.get("issueTime", "")), reverse=True)
        for entry in entries:
            try:
                return map_taf(entry)
            except (KeyError, TypeError, ValueError, ValidationError) as error:
                log.warning("AWC TAF %s: skipped a malformed TAF (%r)", icao, error)
        return None
