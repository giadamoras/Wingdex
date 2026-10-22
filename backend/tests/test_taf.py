import copy
import json
import logging
from pathlib import Path
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient
from helpers import Clock

from app.awc import DEFAULT_USER_AGENT, AwcWeatherProvider
from app.awc_taf import (
    FAILURE_BACKOFF_S,
    MAX_AIRPORTS,
    MAX_REQUESTS_PER_MIN,
    NO_TAF_TTL_S,
    TAF_TTL_S,
    map_period,
    map_taf,
)
from app.main import app
from app.mock_flights import AIRPORTS
from app.mock_taf import HOUR, get_mock_taf, surface_hazards
from app.models import Taf
from app.providers import ProviderError

# A copy of the real feed (recorded 2026-10-22) for three airports chosen for their odd
# cases: EGLL (BECMG, PROB40 TEMPO, a CB cloud, gusts), KDEN (FM, a lone PROB30, VRB wind,
# P6SM) and WSSS (a plain short TAF with 8 km visibility).
SAMPLE: list[dict[str, Any]] = json.loads(
    (Path(__file__).parent / "data" / "taf_sample.json").read_text()
)
START = 1_800_000_000.0


def sample(icao: str) -> dict[str, Any]:
    return copy.deepcopy(next(t for t in SAMPLE if t["icaoId"] == icao))


# --- Mapping AWC's fields to ours -------------------------------------------------------


def test_the_recorded_feed_maps_every_period() -> None:
    for entry in SAMPLE:
        taf = map_taf(entry)
        assert taf.icao == entry["icaoId"] and taf.raw == entry["rawTAF"]
        assert len(taf.periods) == len(entry["fcsts"])
        assert taf.valid_from < taf.valid_to and taf.issued <= taf.valid_from + 3600


def test_change_groups_keep_their_kind_and_probability() -> None:
    egll = map_taf(sample("EGLL"))
    assert egll.periods[0].change == "base"
    becmg = next(p for p in egll.periods if p.change == "BECMG")
    assert becmg.becoming_by is not None and becmg.start < becmg.becoming_by <= becmg.end
    assert any(p.change == "TEMPO" and p.probability == 40 for p in egll.periods)
    kden = map_taf(sample("KDEN"))
    assert any(p.change == "FM" for p in kden.periods)
    assert any(p.change == "PROB" and p.probability == 30 for p in kden.periods)


def test_variable_wind_gusts_and_thunderclouds() -> None:
    kden = map_taf(sample("KDEN"))
    vrb = next(p for p in kden.periods if p.wind_variable)
    assert vrb.wind_dir is None and vrb.wind_kt == 15 and vrb.gust_kt == 25
    egll = map_taf(sample("EGLL"))
    assert any(c.cumulonimbus for p in egll.periods for c in p.clouds)


@pytest.mark.parametrize(
    ("visib", "metres", "or_more"),
    [
        ("6+", 10000, True),
        (4.35, 7000, False),
        (4.97, 8000, False),
        ("", None, False),
        (None, None, False),
    ],
)
def test_visibility_becomes_metres(visib: Any, metres: int | None, or_more: bool) -> None:
    period = map_period({"timeFrom": 1, "timeTo": 2, "fcstChange": None, "visib": visib})
    assert (period.visibility_m, period.visibility_or_more) == (metres, or_more)


def test_a_period_we_cannot_use_is_skipped(caplog: pytest.LogCaptureFixture) -> None:
    entry = sample("WSSS")
    entry["fcsts"].append({"timeFrom": 1, "timeTo": 2, "fcstChange": "INTER"})
    with caplog.at_level(logging.WARNING):
        taf = map_taf(entry)
    assert len(taf.periods) == 1
    assert "skipped a period" in caplog.text


# --- The per-airport cache --------------------------------------------------------------


class FakeAwc:
    """Stands in for aviationweather.gov's TAF endpoint and records the requests."""

    def __init__(self) -> None:
        self.requests: list[httpx.Request] = []
        self.statuses: list[int] = []
        self.headers: dict[str, str] = {}

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        status = self.statuses.pop(0) if self.statuses else 200
        if status != 200:
            return httpx.Response(status, headers=self.headers)
        icao = request.url.params["ids"]
        return httpx.Response(200, json=[t for t in SAMPLE if t["icaoId"] == icao])


def make_provider(fake: FakeAwc, clock: Clock) -> AwcWeatherProvider:
    return AwcWeatherProvider(http=httpx.Client(transport=httpx.MockTransport(fake)), clock=clock)


def test_asks_for_one_airport_with_our_user_agent() -> None:
    fake = FakeAwc()
    taf = make_provider(fake, Clock(START)).get_taf("EGLL")
    assert isinstance(taf, Taf) and taf.icao == "EGLL"
    assert dict(fake.requests[0].url.params) == {"ids": "EGLL", "format": "json"}
    assert fake.requests[0].headers["user-agent"] == DEFAULT_USER_AGENT


def test_a_taf_is_cached_per_airport_until_its_ttl() -> None:
    fake, clock = FakeAwc(), Clock(START)
    provider = make_provider(fake, clock)
    provider.get_taf("EGLL")
    provider.get_taf("EGLL")
    provider.get_taf("WSSS")  # another airport is its own request
    assert len(fake.requests) == 2
    clock.now += TAF_TTL_S
    provider.get_taf("EGLL")
    assert len(fake.requests) == 3


def test_an_airport_without_a_taf_is_remembered_for_longer() -> None:
    fake, clock = FakeAwc(), Clock(START)
    provider = make_provider(fake, clock)
    assert provider.get_taf("XXXX") is None  # AWC answers an empty list
    clock.now += TAF_TTL_S  # past a TAF's TTL, still within "none"'s
    assert provider.get_taf("XXXX") is None
    assert len(fake.requests) == 1
    clock.now += NO_TAF_TTL_S
    provider.get_taf("XXXX")
    assert len(fake.requests) == 2


def test_no_content_means_no_taf() -> None:
    fake = FakeAwc()
    fake.statuses = [204]
    assert make_provider(fake, Clock(START)).get_taf("EGLL") is None


def test_a_failure_serves_the_old_taf_then_backs_off() -> None:
    fake, clock = FakeAwc(), Clock(START)
    provider = make_provider(fake, clock)
    first = provider.get_taf("EGLL")
    clock.now += TAF_TTL_S
    fake.statuses = [500]
    assert provider.get_taf("EGLL") == first  # old, but better than nothing
    with pytest.raises(ProviderError):  # backing off: no request, and nothing held for it
        provider.get_taf("WSSS")
    assert len(fake.requests) == 2
    clock.now += FAILURE_BACKOFF_S
    provider.get_taf("EGLL")
    assert len(fake.requests) == 3


def test_a_failure_with_nothing_cached_raises() -> None:
    fake, clock = FakeAwc(), Clock(START)
    fake.statuses = [500]
    provider = make_provider(fake, clock)
    with pytest.raises(ProviderError):
        provider.get_taf("EGLL")
    with pytest.raises(ProviderError):  # backing off: not asked again yet
        provider.get_taf("EGLL")
    assert len(fake.requests) == 1


def test_a_rate_limit_waits_as_long_as_asked() -> None:
    fake, clock = FakeAwc(), Clock(START)
    fake.statuses, fake.headers = [429], {"Retry-After": "300"}
    provider = make_provider(fake, clock)
    with pytest.raises(ProviderError):
        provider.get_taf("EGLL")
    clock.now += FAILURE_BACKOFF_S
    with pytest.raises(ProviderError):
        provider.get_taf("EGLL")
    clock.now += 300
    assert provider.get_taf("EGLL") is not None
    assert len(fake.requests) == 2


def test_no_more_than_so_many_requests_a_minute() -> None:
    fake, clock = FakeAwc(), Clock(START)
    provider = make_provider(fake, clock)
    provider.get_taf("EGLL")
    for n in range(MAX_REQUESTS_PER_MIN - 1):
        provider.get_taf(f"X{n:03d}")
    clock.now += 30  # all of them within the same minute
    with pytest.raises(ProviderError):  # a new airport: over the cap, nothing held
        provider.get_taf("WSSS")
    assert len(fake.requests) == MAX_REQUESTS_PER_MIN


def test_over_the_cap_an_old_taf_is_served_and_the_cap_frees_up() -> None:
    fake, clock = FakeAwc(), Clock(START)
    provider = make_provider(fake, clock)
    first = provider.get_taf("EGLL")
    clock.now += TAF_TTL_S  # EGLL is now old
    for n in range(MAX_REQUESTS_PER_MIN):
        provider.get_taf(f"X{n:03d}")
    assert provider.get_taf("EGLL") == first  # over the cap: the old one, no request
    assert len(fake.requests) == MAX_REQUESTS_PER_MIN + 1
    clock.now += 60
    provider.get_taf("EGLL")  # a minute on, asked again
    assert len(fake.requests) == MAX_REQUESTS_PER_MIN + 2


def test_the_cache_keeps_at_most_so_many_airports() -> None:
    fake, clock = FakeAwc(), Clock(START)
    provider = make_provider(fake, clock)
    for n in range(MAX_AIRPORTS + 5):
        clock.now += 2  # 30 a minute: under the request cap
        provider.get_taf(f"X{n:03d}")
    assert provider.status()["tafs"] == MAX_AIRPORTS


# --- Invented TAFs and the endpoint -----------------------------------------------------


def test_every_mock_airport_has_an_invented_taf_and_no_other_does() -> None:
    for airport in AIRPORTS.values():
        taf = get_mock_taf(airport.icao, now=START)
        assert taf is not None and taf.raw.startswith(f"TAF {airport.icao} ")
        assert taf.periods[0].change == "base"
        assert all(taf.valid_from <= p.start < p.end <= taf.valid_to for p in taf.periods)
    assert get_mock_taf("KPDX", now=START) is None


def test_an_invented_taf_stays_the_same_for_its_issue() -> None:
    first = get_mock_taf("EGLL", now=START)
    assert get_mock_taf("EGLL", now=START + 600) == first
    assert first is not None
    later = get_mock_taf("EGLL", now=first.valid_from + 6 * 3600)
    assert later is not None and later.valid_from > first.valid_from


def test_the_invented_raw_code_matches_its_periods() -> None:
    taf = get_mock_taf("EGLL", now=START)
    assert taf is not None
    for period in taf.periods[1:]:
        keyword = {"TEMPO": "TEMPO", "BECMG": "BECMG", "FM": "FM", "PROB": "PROB"}[period.change]
        assert keyword in taf.raw
    assert "9999" in taf.raw  # the opening forecast's 10 km or more


def test_the_endpoint_serves_a_mock_taf() -> None:
    response = TestClient(app).get("/airports/egll/taf")  # any case
    assert response.status_code == 200
    body = response.json()
    assert body["icao"] == "EGLL" and body["raw"].startswith("TAF EGLL")


@pytest.mark.parametrize("icao", ["KPDX", "LHR", "EG-LL"])
def test_the_endpoint_answers_404_without_a_taf(icao: str) -> None:
    assert TestClient(app).get(f"/airports/{icao}/taf").status_code == 404


def test_an_airport_under_a_mock_hazard_area_forecasts_that_weather() -> None:
    # The map and the forecast agree: Singapore and Nice sit in mock thunderstorm areas,
    # Jakarta in the volcanic ash one.
    for icao in ["WSSS", "LFMN"]:
        taf = get_mock_taf(icao, now=START)
        assert taf is not None
        storm = [p for p in taf.periods if p.weather == "TSRA" and p.probability is None]
        assert storm and storm[0].start == taf.valid_from
        assert "TSRA" in taf.raw and "CB" in taf.raw
    jakarta = get_mock_taf("WIII", now=START)
    assert jakarta is not None and jakarta.periods[0].weather == "VA"


def test_hazards_only_count_where_they_reach_the_ground() -> None:
    assert surface_hazards(AIRPORTS["SIN"]) == {"thunderstorm"}
    assert surface_hazards(AIRPORTS["CGK"]) == {"volcanic_ash"}
    assert surface_hazards(AIRPORTS["LHR"]) == set()
    assert surface_hazards(AIRPORTS["EDI"]) == set()  # under icing, but only from 5,000 ft


def _opening_rules(taf: Taf) -> str:
    """The flight rules of the opening forecast, as the card works them out (tafTicket.ts)."""
    base = taf.periods[0]
    ceilings = [c.base_ft or 0 for c in base.clouds if c.cover in ("BKN", "OVC")]
    if base.vertical_visibility_ft is not None:
        ceilings.append(base.vertical_visibility_ft)
    ceiling = min(ceilings, default=100_000)
    miles = (base.visibility_m or 0) / 1609
    if ceiling < 500 or miles < 1:
        return "LIFR"
    if ceiling < 1000 or miles < 3:
        return "IFR"
    return "MVFR" if ceiling <= 3000 or miles <= 5 else "VFR"


def test_the_mock_forecasts_show_every_kind_of_sky_and_flight_rules() -> None:
    tafs = [get_mock_taf(a.icao, now=START) for a in AIRPORTS.values()]
    assert all(t is not None for t in tafs)
    rules = [_opening_rules(t) for t in tafs if t is not None]
    assert {"VFR", "MVFR", "IFR", "LIFR"} <= set(rules)
    assert rules.count("VFR") > len(rules) / 2  # still mostly fine weather
    raws = " ".join(t.raw for t in tafs if t is not None)
    for code in [" NSC", " BR ", " FG VV0", " BKN0"]:
        assert code in raws, code


def test_fog_lifts_with_a_new_forecast_a_few_hours_in() -> None:
    foggy = [
        taf
        for a in AIRPORTS.values()
        if (taf := get_mock_taf(a.icao, now=START)) and taf.periods[0].weather == "FG"
    ]
    assert foggy
    for taf in foggy:
        lifted = taf.periods[1]
        assert lifted.change == "FM" and lifted.start == taf.periods[0].end
        assert 3 * HOUR <= lifted.start - taf.valid_from <= 7 * HOUR
        assert lifted.vertical_visibility_ft is None and lifted.weather != "FG"


def test_no_fog_under_a_hazard_area() -> None:
    for icao in ["WSSS", "WMKK", "LFMN", "WIII"]:
        for issue in range(8):  # two days of forecasts
            taf = get_mock_taf(icao, now=START + issue * 6 * HOUR)
            assert taf is not None and taf.periods[0].weather != "FG"
