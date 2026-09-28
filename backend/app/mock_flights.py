import time
from typing import NamedTuple

from app.geo import distance_nm, initial_bearing, interpolate
from app.models import Airport, Flight

# Real airports used by the mock routes, keyed by IATA code.
AIRPORTS: dict[str, Airport] = {
    a.iata: a
    for a in [
        Airport(icao="EGLL", iata="LHR", name="London Heathrow", latitude=51.470, longitude=-0.454),
        Airport(
            icao="LFPG",
            iata="CDG",
            name="Paris Charles de Gaulle",
            latitude=49.010,
            longitude=2.548,
        ),
        Airport(icao="EDDF", iata="FRA", name="Frankfurt", latitude=50.038, longitude=8.562),
        Airport(
            icao="EHAM", iata="AMS", name="Amsterdam Schiphol", latitude=52.311, longitude=4.768
        ),
        Airport(icao="LEMD", iata="MAD", name="Madrid Barajas", latitude=40.498, longitude=-3.568),
        Airport(
            icao="LEBL", iata="BCN", name="Barcelona El Prat", latitude=41.297, longitude=2.083
        ),
        Airport(icao="LPPT", iata="LIS", name="Lisbon", latitude=38.781, longitude=-9.136),
        Airport(icao="LIRF", iata="FCO", name="Rome Fiumicino", latitude=41.800, longitude=12.239),
        Airport(icao="LIMC", iata="MXP", name="Milan Malpensa", latitude=45.630, longitude=8.723),
        Airport(icao="EDDM", iata="MUC", name="Munich", latitude=48.354, longitude=11.786),
        Airport(icao="LOWW", iata="VIE", name="Vienna", latitude=48.110, longitude=16.570),
        Airport(icao="LGAV", iata="ATH", name="Athens", latitude=37.936, longitude=23.945),
        Airport(icao="LTFM", iata="IST", name="Istanbul", latitude=41.275, longitude=28.752),
        Airport(icao="EKCH", iata="CPH", name="Copenhagen", latitude=55.618, longitude=12.656),
        Airport(
            icao="ESSA", iata="ARN", name="Stockholm Arlanda", latitude=59.650, longitude=17.924
        ),
        Airport(icao="ENGM", iata="OSL", name="Oslo Gardermoen", latitude=60.198, longitude=11.100),
        Airport(icao="EIDW", iata="DUB", name="Dublin", latitude=53.426, longitude=-6.250),
        Airport(icao="EGPH", iata="EDI", name="Edinburgh", latitude=55.950, longitude=-3.373),
        Airport(icao="BIKF", iata="KEF", name="Keflavik", latitude=63.985, longitude=-22.606),
        Airport(icao="KJFK", iata="JFK", name="New York JFK", latitude=40.641, longitude=-73.778),
        Airport(icao="KBOS", iata="BOS", name="Boston Logan", latitude=42.366, longitude=-71.010),
        Airport(icao="OMDB", iata="DXB", name="Dubai", latitude=25.253, longitude=55.366),
        Airport(
            icao="WSSS", iata="SIN", name="Singapore Changi", latitude=1.364, longitude=103.992
        ),
    ]
}


class MockFlight(NamedTuple):
    """Static description of one mock flight; its position is derived from the clock."""

    id: str
    callsign: str
    aircraft_type: str
    origin: str  # IATA code in AIRPORTS
    destination: str
    altitude_ft: int
    speed_kt: int
    start_progress: float  # fraction of the route already flown when the server starts


# Mostly European routes (always on the map) plus a few long-hauls (over 6 hours)
# that are only on the map for part of their trip. Altitudes mix above/below 30,000 ft.
MOCK_FLIGHTS: list[MockFlight] = [
    MockFlight("f01", "BAW117", "B77W", "LHR", "JFK", 37000, 480, 0.10),
    MockFlight("f02", "AFR1234", "A321", "CDG", "FCO", 34000, 450, 0.30),
    MockFlight("f03", "DLH400", "B748", "FRA", "JFK", 38000, 490, 0.12),
    MockFlight("f04", "KLM835", "B77W", "AMS", "SIN", 41000, 490, 0.03),
    MockFlight("f05", "RYR8821", "B738", "MXP", "LIS", 28000, 440, 0.40),
    MockFlight("f06", "IBE6165", "A359", "MAD", "BOS", 33000, 470, 0.08),
    MockFlight("f07", "EZY45AB", "A319", "MXP", "VIE", 12000, 300, 0.20),
    MockFlight("f08", "VIR11", "A333", "LHR", "BOS", 37000, 480, 0.15),
    MockFlight("f09", "SAS1590", "E190", "ARN", "CPH", 24000, 400, 0.50),
    MockFlight("f10", "THY1", "B77W", "IST", "JFK", 35000, 480, 0.10),
    MockFlight("f11", "UAE5", "A388", "DXB", "LHR", 39000, 490, 0.72),
    MockFlight("f12", "EIN105", "A333", "DUB", "JFK", 36000, 480, 0.05),
    MockFlight("f13", "ICE204", "B738", "KEF", "CPH", 35000, 450, 0.40),
    MockFlight("f14", "BAW302", "A320", "LHR", "CDG", 24000, 380, 0.50),
    MockFlight("f15", "DLH1810", "A321", "MUC", "BCN", 36000, 450, 0.35),
    MockFlight("f16", "KLM1101", "E190", "AMS", "OSL", 33000, 420, 0.60),
    MockFlight("f17", "ITY304", "A320", "FCO", "LIS", 35000, 450, 0.45),
    MockFlight("f18", "AEE603", "A320", "ATH", "VIE", 34000, 450, 0.30),
    MockFlight("f19", "AUA371", "A320", "VIE", "AMS", 36000, 450, 0.55),
    MockFlight("f20", "NAX1234", "B738", "OSL", "MAD", 37000, 450, 0.25),
    MockFlight("f21", "TAP1350", "A321", "LIS", "LHR", 35000, 450, 0.65),
    MockFlight("f22", "EZY8765", "A320", "EDI", "ATH", 36000, 450, 0.20),
    MockFlight("f23", "VLG8302", "A320", "BCN", "AMS", 34000, 450, 0.70),
    MockFlight("f24", "RYR44", "B738", "DUB", "FCO", 26000, 430, 0.35),
    MockFlight("f25", "THY1633", "A359", "IST", "FRA", 39000, 470, 0.50),
    MockFlight("f26", "EWG9AB", "A319", "CPH", "MUC", 18000, 360, 0.30),
]

# Clock origin: at server start each flight is at its start_progress.
EPOCH = time.time()


def route_minutes(flight: MockFlight) -> float:
    """Exact time (minutes) to fly the great-circle route at the flight's speed."""
    origin, dest = AIRPORTS[flight.origin], AIRPORTS[flight.destination]
    distance = distance_nm((origin.latitude, origin.longitude), (dest.latitude, dest.longitude))
    return distance / flight.speed_kt * 60


def _position_at(flight: MockFlight, elapsed_min: float) -> Flight:
    """Where the flight is after `elapsed_min` minutes, looping back when it arrives."""
    origin, dest = AIRPORTS[flight.origin], AIRPORTS[flight.destination]
    a, b = (origin.latitude, origin.longitude), (dest.latitude, dest.longitude)
    duration = route_minutes(flight)
    progress = (flight.start_progress + elapsed_min / duration) % 1
    latitude, longitude = interpolate(a, b, progress)
    return Flight(
        id=flight.id,
        callsign=flight.callsign,
        aircraft_type=flight.aircraft_type,
        latitude=latitude,
        longitude=longitude,
        altitude_ft=flight.altitude_ft,
        # On a great circle the heading changes along the way, so aim at the destination.
        heading=initial_bearing((latitude, longitude), b),
        speed_kt=flight.speed_kt,
        duration_min=round(duration),
        origin=origin,
        destination=dest,
    )


def get_mock_flights(now: float | None = None) -> list[Flight]:
    """Return every mock flight at its real-speed position at time `now` (default: now)."""
    elapsed_min = ((time.time() if now is None else now) - EPOCH) / 60
    return [_position_at(f, elapsed_min) for f in MOCK_FLIGHTS]
