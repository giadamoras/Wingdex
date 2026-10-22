"""Invented airport forecasts (TAFs) for the mock's airports, served when WEATHER_SOURCE=mock.

Plausible rather than real: each airport gets an opening forecast with a sky of the day
(clear, partly cloudy, cloudy, low cloud in mist, rain, or fog that lifts later) and a few
change groups (rain spells, a wind shift, a chance of thunderstorms, a new forecast from
a set hour), the same for a given airport and 6-hour issue. An airport under one of the
mock hazard areas that reach the ground gets that weather too, so the map and the
forecast agree. The raw code is written from
the same periods, so the two always agree, like a real TAF and AWC's decoding of it.
"""

import random
import time
from datetime import UTC, datetime
from typing import Any

from app.mock_flights import AIRPORTS
from app.mock_weather import MOCK_AREAS
from app.models import Airport, CloudCover, Hazard, Taf, TafCloud, TafPeriod

ISSUE_EVERY_S = 6 * 3600  # real TAFs are issued about every 6 h
VALID_FOR_S = 30 * 3600  # and cover about 24-30 h
ISSUED_BEFORE_S = 40 * 60  # issued a little before the period starts
HOUR = 3600

MOCK_ICAOS = {airport.icao: airport for airport in AIRPORTS.values()}

# The opening sky and how often each comes up, so the forecast shows every kind of flight
# rules: clear to cloudy is VFR, low cloud and rain marginal VFR or IFR, fog low IFR.
SKIES = {"clear": 25, "partly": 25, "cloudy": 20, "low": 15, "fog": 10, "rain": 5}


def _sky(rng: random.Random, kind: str) -> dict[str, Any]:
    """The visibility, weather and cloud of one kind of sky, as TafPeriod fields."""
    good = {"visibility_m": 10000, "visibility_or_more": True}
    if kind == "clear":
        return {**good, "clouds": [TafCloud(cover="NSC")]}
    if kind == "partly":
        cover: CloudCover = rng.choice(["FEW", "SCT"])
        return {**good, "clouds": [TafCloud(cover=cover, base_ft=rng.randrange(20, 50, 5) * 100)]}
    if kind == "cloudy":  # a ceiling, but high enough for VFR
        ceiling = rng.randrange(35, 61, 5) * 100
        return {
            **good,
            "clouds": [TafCloud(cover="SCT", base_ft=2500), TafCloud(cover="BKN", base_ft=ceiling)],
        }
    if kind == "low":  # grey and misty: marginal VFR, or IFR under 1,000 ft
        return {
            "visibility_m": rng.choice([5000, 6000, 8000]),
            "weather": "BR",
            "clouds": [TafCloud(cover="OVC", base_ft=rng.randrange(6, 26) * 100)],
        }
    if kind == "rain":
        return {
            "visibility_m": rng.choice([5000, 6000, 8000]),
            "weather": rng.choice(["-RA", "RA"]),
            "clouds": [TafCloud(cover="BKN", base_ft=rng.randrange(12, 26) * 100)],
        }
    # Fog: the sky is hidden, seen only a few hundred feet up.
    return {
        "visibility_m": rng.choice([200, 300, 500, 800]),
        "weather": "FG",
        "vertical_visibility_ft": rng.choice([100, 200, 300]),
    }


def surface_hazards(airport: Airport) -> set[Hazard]:
    """The mock hazard areas over this airport that reach the ground (thunderstorms, ash,
    cyclones). Turbulence, icing and mountain waves sit higher up, where a TAF says nothing."""
    return {
        a.hazard
        for a in MOCK_AREAS
        if a.altitude_min_ft == 0
        and a.south <= airport.latitude <= a.north
        and a.west <= airport.longitude <= a.east
    }


def _ddhh(t: int) -> str:
    """A TAF time: day of month and hour, UTC ("1912" is the 19th at 12:00)."""
    d = datetime.fromtimestamp(t, UTC)
    return f"{d.day:02d}{d.hour:02d}"


def _conditions(p: TafPeriod) -> list[str]:
    """A period's wind, visibility, weather and cloud as TAF code."""
    parts = []
    if p.wind_kt is not None:
        direction = "VRB" if p.wind_variable else f"{p.wind_dir:03d}"
        gust = f"G{p.gust_kt:02d}" if p.gust_kt else ""
        parts.append(f"{direction}{p.wind_kt:02d}{gust}KT")
    if p.visibility_m is not None:
        parts.append("9999" if p.visibility_or_more else f"{p.visibility_m:04d}")
    if p.weather:
        parts.append(p.weather)
    for c in p.clouds:
        base = f"{c.base_ft // 100:03d}" if c.base_ft is not None else ""
        parts.append(f"{c.cover}{base}{'CB' if c.cumulonimbus else ''}")
    if p.vertical_visibility_ft is not None:
        parts.append(f"VV{p.vertical_visibility_ft // 100:03d}")
    return parts


def raw_taf(
    icao: str, issued: int, valid_from: int, valid_to: int, periods: list[TafPeriod]
) -> str:
    """The TAF code for these periods."""
    issued_at = datetime.fromtimestamp(issued, UTC)
    words = [
        "TAF",
        icao,
        f"{issued_at.day:02d}{issued_at.hour:02d}{issued_at.minute:02d}Z",
        f"{_ddhh(valid_from)}/{_ddhh(valid_to)}",
    ]
    for p in periods:
        span = f"{_ddhh(p.start)}/{_ddhh(p.end)}"
        if p.change == "FM":
            words.append(f"FM{_ddhh(p.start)}00")
        elif p.change == "BECMG":
            words += ["BECMG", f"{_ddhh(p.start)}/{_ddhh(p.becoming_by or p.end)}"]
        elif p.change == "TEMPO":
            words += [f"PROB{p.probability}"] if p.probability else []
            words += ["TEMPO", span]
        elif p.change == "PROB":
            words += [f"PROB{p.probability}", span]
        words += _conditions(p)
    return " ".join(words)


def get_mock_taf(icao: str, now: float | None = None) -> Taf | None:
    """The invented TAF for one of the mock's airports, None for any other airport."""
    airport = MOCK_ICAOS.get(icao)
    if airport is None:
        return None
    t = int(time.time() if now is None else now)
    valid_from = t - t % ISSUE_EVERY_S  # the current 6-hour issue
    valid_to = valid_from + VALID_FOR_S
    issued = valid_from - ISSUED_BEFORE_S
    rng = random.Random(f"{icao}-{valid_from}")  # the same TAF for the whole issue

    def at(hours: int) -> int:
        return valid_from + hours * HOUR

    # The opening forecast and the wind shift run until the new forecast ("FM") at hour 26.
    new_forecast_at = at(26)
    wind_dir = rng.randrange(1, 37) * 10
    wind_kt = rng.randint(4, 16)
    # No fog under a hazard area from the map: that weather goes on top of the sky below.
    hazards = surface_hazards(airport)
    skies = {k: w for k, w in SKIES.items() if not (hazards and k == "fog")}
    sky = rng.choices(list(skies), list(skies.values()))[0]
    # Fog lifts a few hours in: a new forecast ("FM") with a better sky from then on.
    fog_lifts_at = at(rng.randint(3, 7)) if sky == "fog" else None
    periods = [
        TafPeriod(
            start=valid_from,
            end=fog_lifts_at or new_forecast_at,
            change="base",
            wind_dir=wind_dir,
            wind_kt=wind_kt,
            **_sky(rng, sky),
        )
    ]
    if fog_lifts_at is not None:
        periods.append(
            TafPeriod(
                start=fog_lifts_at,
                end=new_forecast_at,
                change="FM",
                wind_dir=wind_dir,
                wind_kt=wind_kt + 4,
                **_sky(rng, rng.choice(["partly", "cloudy", "low"])),
            )
        )
    elif sky != "clear":
        # A spell of rain early on, with lower cloud.
        rain_from = rng.randint(1, 5)
        periods.append(
            TafPeriod(
                start=at(rain_from),
                end=at(rain_from + rng.randint(2, 4)),
                change="TEMPO",
                visibility_m=rng.choice([4000, 6000, 7000]),
                weather=rng.choice(["-RA", "RA", "-SHRA", "SHRA", "-DZ"]),
                clouds=[TafCloud(cover="BKN", base_ft=rng.randrange(8, 20) * 100)],
            )
        )
    # Later the wind backs or veers and picks up.
    shift_at = rng.randint(9, 13)
    shifted = (wind_dir + rng.choice([-60, -30, 30, 60]) - 1) % 360 + 1
    periods.append(
        TafPeriod(
            start=at(shift_at),
            end=new_forecast_at,
            change="BECMG",
            becoming_by=at(shift_at + 2),
            wind_dir=shifted,
            wind_kt=rng.randint(10, 22),
            gust_kt=rng.choice([None, None, 30, 35]),
        )
    )
    # Under a hazard area from the map: its weather from the start (the mock areas are
    # valid from an hour ago to six hours ahead, so this covers them).
    base = periods[0]
    if "volcanic_ash" in hazards:
        base.visibility_m, base.visibility_or_more, base.weather = 5000, False, "VA"
    if "tropical_cyclone" in hazards:
        base.wind_kt, base.gust_kt = 40, 60
        base.visibility_m, base.visibility_or_more, base.weather = 2000, False, "+RA"
        base.clouds = [TafCloud(cover="OVC", base_ft=800)]
    if hazards & {"thunderstorm", "tropical_cyclone"}:
        periods.append(
            TafPeriod(
                start=valid_from,
                end=at(12),
                change="TEMPO",
                visibility_m=2000,
                weather="+TSRA" if "tropical_cyclone" in hazards else "TSRA",
                clouds=[TafCloud(cover="BKN", base_ft=1500, cumulonimbus=True)],
            )
        )
    # Some airports get a chance of thunderstorms in the afternoon of the next day.
    elif rng.random() < 0.5:
        storm_at = rng.randint(16, 22)
        periods.append(
            TafPeriod(
                start=at(storm_at),
                end=at(storm_at + 3),
                change="TEMPO",
                probability=rng.choice([30, 40]),
                visibility_m=3000,
                weather="TSRA",
                clouds=[TafCloud(cover="BKN", base_ft=1500, cumulonimbus=True)],
            )
        )
    # And a whole new forecast towards the end.
    periods.append(
        TafPeriod(
            start=new_forecast_at,
            end=valid_to,
            change="FM",
            wind_dir=rng.randrange(1, 37) * 10,
            wind_kt=rng.randint(4, 14),
            visibility_m=10000,
            visibility_or_more=True,
            clouds=[TafCloud(cover="SCT", base_ft=rng.randrange(25, 45, 5) * 100)],
        )
    )
    periods.sort(key=lambda p: p.start)
    return Taf(
        icao=icao,
        name=airport.name,
        issued=issued,
        valid_from=valid_from,
        valid_to=valid_to,
        raw=raw_taf(icao, issued, valid_from, valid_to, periods),
        periods=periods,
    )
