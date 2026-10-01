import time
from typing import NamedTuple

from app.models import Hazard, LatLon, WeatherArea

# How long each mock area counts as valid, either side of "now". The mock is a static
# snapshot, so the window moves with the clock and the areas never expire.
VALID_BEFORE_S = 3600
VALID_AFTER_S = 6 * 3600


class MockArea(NamedTuple):
    """Static description of one mock area, as a south-west to north-east box."""

    id: str
    hazard: Hazard
    region: str
    south: float
    west: float
    north: float
    east: float
    altitude_min_ft: int
    altitude_max_ft: int
    movement_dir: float | None = None
    movement_speed_kt: int | None = None


# Placed over the mock flights' routes (North Atlantic, Europe) and a few far-off
# spots (Bay of Bengal, Singapore) so the world map has weather in several places.
# Altitude bounds differ on purpose: storms and cyclones reach cruise level, icing sits
# lower, and turbulence mostly lives up where the jets fly.
MOCK_AREAS: list[MockArea] = [
    MockArea("w01", "thunderstorm", "North Atlantic", 46, -52, 51, -44, 0, 45000, 90, 15),
    MockArea("w02", "turbulence", "Alps", 45, 6, 48, 13, 20000, 38000),
    MockArea("w03", "icing", "North Sea", 55, -6, 59, 2, 5000, 25000, 70, 10),
    MockArea("w04", "volcanic_ash", "Sicily", 36.5, 14, 38.5, 16.5, 0, 30000, 45, 10),
    MockArea("w05", "tropical_cyclone", "Bay of Bengal", 10, 84, 18, 92, 0, 50000, 300, 8),
    MockArea("w06", "thunderstorm", "Singapore", -1, 100, 4, 106, 0, 50000),
    MockArea("w07", "turbulence", "Iceland", 60, -32, 66, -22, 25000, 40000),
    MockArea("w08", "thunderstorm", "Gulf of Lion", 41, 3, 44, 8, 0, 40000, 90, 20),
    MockArea("w09", "icing", "Greenland", 56, -48, 62, -38, 10000, 30000),
]


def _ring(area: MockArea) -> list[LatLon]:
    """The box as a closed ring of four corners plus the first corner again."""
    corners = [
        (area.south, area.west),
        (area.south, area.east),
        (area.north, area.east),
        (area.north, area.west),
    ]
    return [LatLon(latitude=lat, longitude=lon) for lat, lon in [*corners, corners[0]]]


def get_mock_weather(now: float | None = None) -> list[WeatherArea]:
    """Return every mock weather area, valid around time `now` (default: now)."""
    t = int(time.time() if now is None else now)
    return [
        WeatherArea(
            id=a.id,
            hazard=a.hazard,
            region=a.region,
            altitude_min_ft=a.altitude_min_ft,
            altitude_max_ft=a.altitude_max_ft,
            valid_from=t - VALID_BEFORE_S,
            valid_to=t + VALID_AFTER_S,
            polygon=_ring(a),
            movement_dir=a.movement_dir,
            movement_speed_kt=a.movement_speed_kt,
        )
        for a in MOCK_AREAS
    ]
