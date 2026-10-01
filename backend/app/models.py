from typing import Literal

from pydantic import BaseModel, Field


class Airport(BaseModel):
    """An airport a flight departs from or flies to."""

    icao: str  # four-letter code pilots use, e.g. "EGLL"
    iata: str  # three-letter code passengers see, e.g. "LHR"
    name: str
    latitude: float = Field(ge=-90, le=90)  # degrees
    longitude: float = Field(ge=-180, le=180)  # degrees


class Flight(BaseModel):
    """A single flat flight record: the stable contract served by GET /flights."""

    id: str
    callsign: str
    aircraft_type: str  # plain string for now, e.g. "A320"
    latitude: float = Field(ge=-90, le=90)  # degrees
    longitude: float = Field(ge=-180, le=180)  # degrees
    altitude_ft: int = Field(ge=0)  # feet above sea level
    heading: float = Field(ge=0, lt=360)  # degrees clockwise from north
    speed_kt: int = Field(gt=0)  # ground speed, knots
    duration_min: int = Field(gt=0)  # total scheduled flight duration, minutes
    # Route is optional: live position feeds (e.g. OpenSky state vectors) don't include it.
    origin: Airport | None = None
    destination: Airport | None = None


class LatLon(BaseModel):
    """A point on the map; a weather area's polygon is a list of these."""

    latitude: float = Field(ge=-90, le=90)  # degrees
    longitude: float = Field(ge=-180, le=180)  # degrees


Hazard = Literal["thunderstorm", "turbulence", "icing", "volcanic_ash", "tropical_cyclone"]


class WeatherArea(BaseModel):
    """A hazard area a pilot should know about: the stable contract served by GET /weather.

    Modelled on the Aviation Weather Center's global SIGMET feed (hazard, altitude
    bounds, validity times, polygon), but with our own field names.
    """

    id: str
    hazard: Hazard
    region: str  # the airspace it was issued for, e.g. "North Atlantic"
    altitude_min_ft: int = Field(ge=0)  # feet; the hazard only affects flights between the bounds
    altitude_max_ft: int = Field(gt=0)
    valid_from: int  # Unix seconds
    valid_to: int  # Unix seconds
    # Closed ring: the last point repeats the first, like the SIGMET coordinates.
    polygon: list[LatLon] = Field(min_length=4)
    # Optional: not every advisory says how the area is moving.
    movement_dir: float | None = Field(default=None, ge=0, lt=360)  # degrees towards
    movement_speed_kt: int | None = Field(default=None, ge=0)
