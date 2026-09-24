from pydantic import BaseModel, Field


class Flight(BaseModel):
    """A single flat flight record: the stable contract served by GET /flights."""

    id: str
    callsign: str
    aircraft_type: str  # plain string for now, e.g. "A320"
    latitude: float = Field(ge=-90, le=90)  # degrees
    longitude: float = Field(ge=-180, le=180)  # degrees
    altitude_ft: int = Field(ge=0)  # feet above sea level
    heading: float = Field(ge=0, lt=360)  # degrees clockwise from north
    duration_min: int = Field(gt=0)  # total scheduled flight duration, minutes
