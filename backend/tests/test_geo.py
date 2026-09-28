import pytest

from app.geo import distance_nm, initial_bearing, interpolate

LHR = (51.470, -0.454)
JFK = (40.641, -73.778)


def test_distance_london_new_york() -> None:
    # Published great-circle distance is about 2,990 nm.
    assert distance_nm(LHR, JFK) == pytest.approx(2990, abs=30)


def test_distance_to_self_is_zero() -> None:
    assert distance_nm(LHR, LHR) == 0


def test_interpolate_endpoints_and_midpoint() -> None:
    assert interpolate(LHR, JFK, 0) == pytest.approx(LHR)
    assert interpolate(LHR, JFK, 1) == pytest.approx(JFK)
    # Along the equator the midpoint is simply halfway.
    assert interpolate((0, 0), (0, 90), 0.5) == pytest.approx((0, 45))


def test_great_circle_bends_toward_the_pole() -> None:
    # Halfway to New York the route is further north than both airports.
    lat, _ = interpolate(LHR, JFK, 0.5)
    assert lat > LHR[0]


def test_initial_bearing() -> None:
    assert initial_bearing((0, 0), (0, 10)) == pytest.approx(90)  # due east
    assert initial_bearing((0, 0), (10, 0)) == pytest.approx(0)  # due north
    assert initial_bearing((0, 0), (0, -10)) == pytest.approx(270)  # due west
    # London to New York starts off west-northwest, not straight west.
    assert initial_bearing(LHR, JFK) == pytest.approx(288, abs=2)
