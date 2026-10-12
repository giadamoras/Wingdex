import copy
import json
import logging
from pathlib import Path
from typing import Any

import httpx
import pytest
from helpers import Clock

from app.awc import (
    DEFAULT_USER_AGENT,
    FAILURE_BACKOFF_S,
    MIN_TTL_S,
    AwcWeatherProvider,
    map_entries,
    map_entry,
)
from app.mock_providers import MockWeatherProvider
from app.models import WeatherArea
from app.providers import ProviderError, create_weather_provider

# A trimmed copy of the real feed (recorded 2026-10-05), one entry per odd case.
SAMPLE: list[dict[str, Any]] = json.loads(
    (Path(__file__).parent / "data" / "isigmet_sample.json").read_text()
)

START = 1_800_000_000.0


def entry(**fields: Any) -> dict[str, Any]:
    """A plain valid thunderstorm entry, with some fields replaced."""
    base: dict[str, Any] = {
        "icaoId": "AAAA",
        "firId": "BBBB",
        "firName": "BBBB TESTLAND",
        "validTimeFrom": 1_800_000_000,
        "validTimeTo": 1_800_014_400,
        "seriesId": "1",
        "hazard": "TS",
        "qualifier": "EMBD",
        "base": 2000,
        "top": 40000,
        "geom": "AREA",
        "coords": [
            {"lat": 10, "lon": 20},
            {"lat": 10, "lon": 22},
            {"lat": 12, "lon": 22},
            {"lat": 10, "lon": 20},
        ],
        "dir": "NE",
        "spd": "10",
        "chng": "NC",
    }
    return {**base, **fields}


def find(areas: list[WeatherArea], series: str) -> WeatherArea:
    return next(a for a in areas if f"-{series}-" in a.id)


def test_the_recorded_feed_maps_to_valid_areas() -> None:
    areas = map_entries(SAMPLE)
    assert len(areas) == 13  # 11 entries, the AREAS one split into its 3 rings
    assert len({a.id for a in areas}) == len(areas)
    for area in areas:
        assert area.polygon[0] == area.polygon[-1]
        assert area.altitude_min_ft < area.altitude_max_ft
        WeatherArea.model_validate(area.model_dump())


def test_mountain_wave_is_its_own_hazard() -> None:
    area = find(map_entries(SAMPLE), "04")
    assert area.hazard == "mountain_wave"
    assert (area.altitude_min_ft, area.altitude_max_ft) == (4000, 22000)
    assert area.severity == "Severe"
    assert area.movement_dir is None and area.movement_speed_kt is None  # "-" and 0: stationary


def test_plain_turbulence_stays_turbulence() -> None:
    assert find(map_entries(SAMPLE), "6").hazard == "turbulence"


def test_volcano_and_storm_names_are_kept() -> None:
    areas = map_entries(SAMPLE)
    volcano, storm = find(areas, "07"), find(areas, "VICTOR 2")
    assert (volcano.hazard, volcano.name, volcano.severity) == ("volcanic_ash", "Mt Dukono", None)
    assert (storm.hazard, storm.name, storm.severity) == ("tropical_cyclone", "Koguma", None)


def test_severity_label_comes_from_the_qualifier() -> None:
    area = map_entry(entry(qualifier="EMBD"))[0]
    assert area.severity == "Embedded" and area.name is None
    assert map_entry(entry(qualifier="SOMETHING NEW"))[0].severity is None


def test_missing_bounds_get_our_own() -> None:
    area = map_entry(entry(base=None, top=None))[0]
    assert (area.altitude_min_ft, area.altitude_max_ft) == (0, 60000)


def test_inverted_bounds_are_malformed() -> None:
    with pytest.raises(ValueError):
        map_entry(entry(base=30000, top=20000))


def test_open_ring_is_closed() -> None:
    ring = [{"lat": 0, "lon": 0}, {"lat": 0, "lon": 2}, {"lat": 2, "lon": 2}]
    polygon = map_entry(entry(coords=ring))[0].polygon
    assert len(polygon) == 4 and polygon[0] == polygon[-1]


def test_areas_entry_is_split_into_one_area_per_ring() -> None:
    rings = [
        [{"lat": 0, "lon": 0}, {"lat": 0, "lon": 2}, {"lat": 2, "lon": 2}],
        [{"lat": 5, "lon": 5}, {"lat": 5, "lon": 7}, {"lat": 7, "lon": 7}],
    ]
    areas = map_entry(entry(geom="AREAS", coords=rings))
    assert [a.id for a in areas] == ["AAAA-BBBB-1-TS-0", "AAAA-BBBB-1-TS-1"]


@pytest.mark.parametrize(
    "coords",
    [
        [],
        None,
        [{"lat": 0, "lon": 0}, {"lat": 1, "lon": 1}],  # a line, not an area
        [{"lat": 0, "lon": 0}, {"lat": 1, "lon": 1}, {"lat": 0, "lon": 0}],  # still two points
        [{"lat": 0, "lon": 170}, {"lat": 0, "lon": -170}, {"lat": 2, "lon": -170}],  # date line
    ],
)
def test_entries_without_a_usable_polygon_give_no_area(coords: Any) -> None:
    assert map_entry(entry(coords=coords)) == []


@pytest.mark.parametrize(
    ("direction", "degrees"), [("N", 0.0), ("NE", 45.0), ("WSW", 247.5), ("NNW", 337.5)]
)
def test_compass_movement_becomes_degrees(direction: str, degrees: float) -> None:
    area = map_entry(entry(dir=direction, spd="15"))[0]
    assert (area.movement_dir, area.movement_speed_kt) == (degrees, 15)


@pytest.mark.parametrize(("direction", "speed"), [("-", "0"), (None, None), ("NE", None)])
def test_no_movement_when_the_feed_gives_none(direction: str | None, speed: str | None) -> None:
    area = map_entry(entry(dir=direction, spd=speed))[0]
    assert area.movement_dir is None and area.movement_speed_kt is None


def test_region_drops_the_fir_code() -> None:
    assert map_entry(entry())[0].region == "Testland"
    assert map_entry(entry(firName=None))[0].region == "BBBB"


def test_unmodelled_and_malformed_entries_are_skipped(caplog: pytest.LogCaptureFixture) -> None:
    broken = entry()
    del broken["validTimeTo"]
    entries: list[Any] = [entry(hazard="MARSQUAKE"), "junk", broken, entry(seriesId="2")]
    with caplog.at_level(logging.INFO):
        areas = map_entries(entries)
    assert [a.id for a in areas] == ["AAAA-BBBB-2-TS"]
    assert "2 unmodelled" in caplog.text and "1 malformed" in caplog.text


def test_repeated_id_keeps_the_newest_issue() -> None:
    older, newer = entry(validTimeFrom=100), entry(validTimeFrom=200, top=30000)
    assert map_entries([newer, older])[0].altitude_max_ft == 30000
    assert map_entries([older, newer])[0].altitude_max_ft == 30000


def test_a_response_near_the_cap_is_logged(caplog: pytest.LogCaptureFixture) -> None:
    entries = [entry(seriesId=str(i)) for i in range(390)]
    with caplog.at_level(logging.WARNING):
        map_entries(entries)
    assert "near the 400 cap" in caplog.text


# --- the provider: cache, backoff and request ---------------------------------------


class FakeAwc:
    """Stands in for aviationweather.gov and records the requests."""

    def __init__(self) -> None:
        self.calls = 0
        self.last: httpx.Request | None = None
        self.statuses: list[int] = []
        self.headers: dict[str, str] = {}
        self.body: Any = SAMPLE

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.calls += 1
        self.last = request
        status = self.statuses.pop(0) if self.statuses else 200
        if status != 200:
            return httpx.Response(status, headers=self.headers)
        return httpx.Response(200, json=copy.deepcopy(self.body))


def make_provider(fake: FakeAwc, clock: Clock, **kwargs: Any) -> AwcWeatherProvider:
    return AwcWeatherProvider(
        http=httpx.Client(transport=httpx.MockTransport(fake)), clock=clock, **kwargs
    )


def test_provider_asks_with_format_json_and_our_user_agent() -> None:
    fake, clock = FakeAwc(), Clock(START)
    areas = make_provider(fake, clock).get_weather()
    assert len(areas) == 13
    assert fake.last is not None
    assert dict(fake.last.url.params) == {"format": "json"}  # no undocumented parameters
    assert fake.last.headers["user-agent"] == DEFAULT_USER_AGENT


def test_user_agent_can_be_changed() -> None:
    fake, clock = FakeAwc(), Clock(START)
    make_provider(fake, clock, user_agent="Other/2").get_weather()
    assert fake.last is not None and fake.last.headers["user-agent"] == "Other/2"


def test_cache_serves_within_ttl_then_refreshes() -> None:
    fake, clock = FakeAwc(), Clock(START)
    provider = make_provider(fake, clock, cache_ttl_s=300)
    provider.get_weather()
    clock.now += 299
    provider.get_weather()
    assert fake.calls == 1
    clock.now += 2
    provider.get_weather()
    assert fake.calls == 2


def test_refresh_interval_cannot_go_below_the_floor() -> None:
    fake, clock = FakeAwc(), Clock(START)
    provider = make_provider(fake, clock, cache_ttl_s=1)
    provider.get_weather()
    clock.now += MIN_TTL_S - 1
    provider.get_weather()
    assert fake.calls == 1


def test_an_empty_answer_means_no_weather() -> None:
    fake, clock = FakeAwc(), Clock(START)
    fake.statuses = [204]
    assert make_provider(fake, clock).get_weather() == []


def test_failure_serves_stale_data_then_backs_off() -> None:
    fake, clock = FakeAwc(), Clock(START)
    provider = make_provider(fake, clock, cache_ttl_s=300)
    first = provider.get_weather()
    clock.now += 301
    fake.statuses = [500]
    assert provider.get_weather() == first  # stale, but better than nothing
    assert fake.calls == 2
    clock.now += FAILURE_BACKOFF_S - 1
    provider.get_weather()
    assert fake.calls == 2  # still backing off
    clock.now += 2
    provider.get_weather()
    assert fake.calls == 3


def test_failure_with_no_data_raises() -> None:
    fake, clock = FakeAwc(), Clock(START)
    fake.statuses = [500]
    with pytest.raises(ProviderError):
        make_provider(fake, clock).get_weather()


def test_rate_limit_waits_as_long_as_asked() -> None:
    fake, clock = FakeAwc(), Clock(START)
    provider = make_provider(fake, clock, cache_ttl_s=300)
    provider.get_weather()
    clock.now += 301
    fake.statuses, fake.headers = [429], {"Retry-After": "600"}
    provider.get_weather()
    clock.now += 599
    provider.get_weather()
    assert fake.calls == 2
    clock.now += 2
    provider.get_weather()
    assert fake.calls == 3


def test_an_unexpected_body_is_a_failure() -> None:
    fake, clock = FakeAwc(), Clock(START)
    fake.body = {"error": "nope"}
    with pytest.raises(ProviderError):
        make_provider(fake, clock).get_weather()


def test_status_reports_what_is_held() -> None:
    fake, clock = FakeAwc(), Clock(START)
    provider = make_provider(fake, clock)
    assert provider.status() == {"areas": None, "age_s": None}
    provider.get_weather()
    clock.now += 42
    assert provider.status() == {"areas": 13, "age_s": 42}


def test_mock_weather_is_the_default_source() -> None:
    assert isinstance(create_weather_provider({}), MockWeatherProvider)
    assert create_weather_provider({"WEATHER_SOURCE": "awc"}).name == "awc"
    with pytest.raises(ValueError, match="WEATHER_SOURCE"):
        create_weather_provider({"WEATHER_SOURCE": "nope"})
