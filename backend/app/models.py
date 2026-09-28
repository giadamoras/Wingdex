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
