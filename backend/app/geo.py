"""Small great-circle helpers. Points are (latitude, longitude) in degrees."""

import math

LatLon = tuple[float, float]

EARTH_RADIUS_NM = 3440.065  # mean Earth radius in nautical miles


def _angular_distance(a: LatLon, b: LatLon) -> float:
    """Central angle between two points, in radians (haversine formula)."""
    lat1, lon1, lat2, lon2 = map(math.radians, (*a, *b))
    h = (
        math.sin((lat2 - lat1) / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    )
    return 2 * math.asin(min(1.0, math.sqrt(h)))


def distance_nm(a: LatLon, b: LatLon) -> float:
    """Shortest (great-circle) distance between two points, in nautical miles."""
    return _angular_distance(a, b) * EARTH_RADIUS_NM


def interpolate(a: LatLon, b: LatLon, fraction: float) -> LatLon:
    """Point `fraction` (0..1) of the way from a to b along the great circle."""
    d = _angular_distance(a, b)
    if d == 0:
        return a
    lat1, lon1, lat2, lon2 = map(math.radians, (*a, *b))
    # Weights of the two endpoints (spherical linear interpolation).
    wa = math.sin((1 - fraction) * d) / math.sin(d)
    wb = math.sin(fraction * d) / math.sin(d)
    x = wa * math.cos(lat1) * math.cos(lon1) + wb * math.cos(lat2) * math.cos(lon2)
    y = wa * math.cos(lat1) * math.sin(lon1) + wb * math.cos(lat2) * math.sin(lon2)
    z = wa * math.sin(lat1) + wb * math.sin(lat2)
    return math.degrees(math.atan2(z, math.hypot(x, y))), math.degrees(math.atan2(y, x))


def initial_bearing(a: LatLon, b: LatLon) -> float:
    """Direction to fly from a toward b, in degrees clockwise from north (0..360)."""
    lat1, lon1, lat2, lon2 = map(math.radians, (*a, *b))
    dlon = lon2 - lon1
    y = math.sin(dlon) * math.cos(lat2)
    x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    return (math.degrees(math.atan2(y, x)) + 360) % 360
