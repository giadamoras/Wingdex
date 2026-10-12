"""The shapes the API sends: airports, flights, routes and weather areas."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class Airport(BaseModel):
    """An airport a flight departs from or flies to."""

    icao: str  # four-letter code pilots use, e.g. "EGLL"
    iata: str  # three-letter code passengers see, e.g. "LHR"
    name: str
    latitude: float = Field(ge=-90, le=90)  # degrees
    longitude: float = Field(ge=-180, le=180)  # degrees
    # Only a live route lookup knows these.
    city: str | None = None  # e.g. "London"
    country: str | None = None  # e.g. "United Kingdom"


class Flight(BaseModel):
    """A single flat flight record: the stable contract served by GET /flights."""

    id: str
    callsign: str
    # Type, duration and route are optional: live position feeds (e.g. OpenSky state
    # vectors) don't include them, and a plane missing from the type database has none.
    aircraft_type: str | None = None  # ICAO type code, e.g. "A320"
    latitude: float = Field(ge=-90, le=90)  # degrees
    longitude: float = Field(ge=-180, le=180)  # degrees
    altitude_ft: int = Field(ge=0)  # feet above sea level
    heading: float = Field(ge=0, lt=360)  # degrees clockwise from north
    speed_kt: int = Field(gt=0)  # ground speed, knots
    duration_min: int | None = Field(default=None, gt=0)  # total flight duration, minutes
    duration_estimated: bool = False  # True when worked out from the route, not scheduled
    origin: Airport | None = None
    destination: Airport | None = None
    # Live feed only (the mock has neither): feet per minute, + climbing / - descending,
    # and the country the plane is registered in.
    vertical_rate_fpm: int | None = None
    registered_country: str | None = None


class FlightRoute(BaseModel):
    """What a lookup learned about one flight: the stable contract of GET /flights/{id}/route.

    Every field is optional, because each part can be unknown on its own.
    """

    aircraft_type: str | None = None
    origin: Airport | None = None
    destination: Airport | None = None
    duration_min: int | None = Field(default=None, gt=0)
    duration_estimated: bool = False
    # The rest is shown as extra detail on the card, never used for gameplay.
    airline: str | None = None  # e.g. "Ryanair"
    airline_country: str | None = None
    registration: str | None = None  # the tail number, e.g. "EI-EJH"
    manufacturer: str | None = None  # e.g. "Airbus"
    model: str | None = None  # e.g. "A330 202"
    operator: str | None = None  # the registered owner, who may not be the airline


class LatLon(BaseModel):
    """A point on the map; a weather area's polygon is a list of these."""

    latitude: float = Field(ge=-90, le=90)  # degrees
    longitude: float = Field(ge=-180, le=180)  # degrees


Hazard = Literal[
    "thunderstorm", "turbulence", "mountain_wave", "icing", "volcanic_ash", "tropical_cyclone"
]


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
    # Display only, never used by quests or facts. Live data only (the mock has neither).
    severity: str | None = None  # e.g. "Severe", "Embedded"
    name: str | None = None  # the volcano or storm, e.g. "Mt Dukono", "Koguma"


class Health(BaseModel):
    """What /health reports.

    Each provider adds facts of its own (OpenSky's credit guard, the weather cache's age, ...),
    so keys beyond these three are kept, not rejected.
    """

    model_config = ConfigDict(extra="allow")

    status: Literal["ok"]
    source: str  # the flight provider's name, e.g. "mock"
    weather_source: str
