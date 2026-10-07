import random
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

# More real airports so the mock covers every continent: (IATA, ICAO, name, lat, lon).
_WORLD_AIRPORTS = [
    # North America
    ("ATL", "KATL", "Atlanta", 33.637, -84.428),
    ("ORD", "KORD", "Chicago O'Hare", 41.978, -87.905),
    ("LAX", "KLAX", "Los Angeles", 33.942, -118.408),
    ("SFO", "KSFO", "San Francisco", 37.619, -122.375),
    ("DFW", "KDFW", "Dallas Fort Worth", 32.897, -97.038),
    ("DEN", "KDEN", "Denver", 39.862, -104.673),
    ("MIA", "KMIA", "Miami", 25.793, -80.291),
    ("SEA", "KSEA", "Seattle Tacoma", 47.450, -122.309),
    ("YYZ", "CYYZ", "Toronto Pearson", 43.678, -79.625),
    ("YVR", "CYVR", "Vancouver", 49.195, -123.184),
    ("MEX", "MMMX", "Mexico City", 19.436, -99.072),
    ("HNL", "PHNL", "Honolulu", 21.319, -157.922),
    # South America
    ("GRU", "SBGR", "Sao Paulo Guarulhos", -23.435, -46.473),
    ("EZE", "SAEZ", "Buenos Aires Ezeiza", -34.822, -58.536),
    ("BOG", "SKBO", "Bogota", 4.702, -74.147),
    ("SCL", "SCEL", "Santiago", -33.393, -70.786),
    ("LIM", "SPJC", "Lima", -12.022, -77.114),
    # Africa
    ("JNB", "FAOR", "Johannesburg", -26.139, 28.246),
    ("CPT", "FACT", "Cape Town", -33.965, 18.602),
    ("CAI", "HECA", "Cairo", 30.122, 31.406),
    ("ADD", "HAAB", "Addis Ababa", 8.978, 38.799),
    ("CMN", "GMMN", "Casablanca", 33.367, -7.590),
    ("NBO", "HKJK", "Nairobi", -1.319, 36.927),
    ("LOS", "DNMM", "Lagos", 6.577, 3.321),
    # Middle East
    ("DOH", "OTHH", "Doha", 25.273, 51.608),
    ("AUH", "OMAA", "Abu Dhabi", 24.433, 54.651),
    ("TLV", "LLBG", "Tel Aviv", 32.011, 34.887),
    ("RUH", "OERK", "Riyadh", 24.958, 46.699),
    # Asia
    ("DEL", "VIDP", "Delhi", 28.556, 77.100),
    ("BOM", "VABB", "Mumbai", 19.089, 72.868),
    ("BKK", "VTBS", "Bangkok", 13.690, 100.750),
    ("KUL", "WMKK", "Kuala Lumpur", 2.746, 101.710),
    ("CGK", "WIII", "Jakarta", -6.126, 106.656),
    ("MNL", "RPLL", "Manila", 14.509, 121.020),
    ("HKG", "VHHH", "Hong Kong", 22.308, 113.915),
    ("PEK", "ZBAA", "Beijing Capital", 40.080, 116.585),
    ("PVG", "ZSPD", "Shanghai Pudong", 31.143, 121.805),
    ("ICN", "RKSI", "Seoul Incheon", 37.469, 126.451),
    ("NRT", "RJAA", "Tokyo Narita", 35.765, 140.386),
    ("HND", "RJTT", "Tokyo Haneda", 35.549, 139.780),
    # Oceania
    ("SYD", "YSSY", "Sydney", -33.946, 151.177),
    ("MEL", "YMML", "Melbourne", -37.673, 144.843),
    ("BNE", "YBBN", "Brisbane", -27.384, 153.118),
    ("PER", "YPPH", "Perth", -31.940, 115.967),
    ("AKL", "NZAA", "Auckland", -37.008, 174.792),
]
AIRPORTS.update(
    {
        iata: Airport(icao=icao, iata=iata, name=name, latitude=lat, longitude=lon)
        for iata, icao, name, lat, lon in _WORLD_AIRPORTS
    }
)


class MockFlight(NamedTuple):
    """Static description of one mock flight; its position is derived from the clock."""

    id: str
    callsign: str
    aircraft_type: str
    origin: str  # IATA code in AIRPORTS
    destination: str
    altitude_ft: int
    speed_kt: int  # average ground speed: lower on short hops, lower westbound (headwinds)
    start_progress: float  # fraction of the route already flown when the server starts


# Airlines the generator picks from: callsign prefix, home airports and a weight (Europe is
# the busiest, as in the real feed). The airline quests match on these callsign prefixes.
AIRLINES: list[tuple[str, list[str], int]] = [
    ("BAW", ["LHR"], 4),
    ("DLH", ["FRA", "MUC"], 4),
    ("AFR", ["CDG"], 3),
    ("KLM", ["AMS"], 3),
    ("RYR", ["DUB", "MAD", "BCN", "FCO", "MXP", "LIS", "EDI"], 4),
    ("EZY", ["EDI", "LHR", "CDG", "MXP"], 2),
    ("IBE", ["MAD"], 2),
    ("TAP", ["LIS"], 2),
    ("THY", ["IST"], 3),
    ("SAS", ["CPH", "ARN", "OSL"], 2),
    ("AUA", ["VIE"], 1),
    ("ITY", ["FCO"], 1),
    ("VLG", ["BCN"], 1),
    ("AEE", ["ATH"], 1),
    ("UAE", ["DXB"], 3),
    ("QTR", ["DOH"], 2),
    ("ETD", ["AUH"], 1),
    ("ELY", ["TLV"], 1),
    ("AAL", ["DFW", "MIA", "ORD"], 2),
    ("UAL", ["ORD", "SFO", "DEN"], 2),
    ("DAL", ["ATL", "SEA", "LAX"], 2),
    ("ACA", ["YYZ", "YVR"], 1),
    ("AMX", ["MEX"], 1),
    ("LAN", ["SCL", "LIM", "GRU"], 1),
    ("AVA", ["BOG"], 1),
    ("SAA", ["JNB", "CPT"], 1),
    ("ETH", ["ADD"], 1),
    ("MSR", ["CAI"], 1),
    ("RAM", ["CMN"], 1),
    ("KQA", ["NBO"], 1),
    ("SIA", ["SIN"], 2),
    ("CPA", ["HKG"], 1),
    ("CCA", ["PEK", "PVG"], 2),
    ("AIC", ["DEL", "BOM"], 2),
    ("JAL", ["HND", "NRT"], 1),
    ("KAL", ["ICN"], 1),
    ("THA", ["BKK"], 1),
    ("MAS", ["KUL"], 1),
    ("GIA", ["CGK"], 1),
    ("QFA", ["SYD", "MEL", "BNE", "PER"], 2),
    ("ANZ", ["AKL"], 1),
]

# Route length classes in nautical miles. Long-haul is over ~6 hours gate to gate.
ROUTE_CLASSES = {"short": (150, 800), "medium": (800, 2400), "long": (3000, 9000)}
MOCK_FLIGHT_COUNT = 100
MOCK_SEED = 7

WIDE_TYPES = ["B77W", "B748", "A359", "A333", "A388"]
NARROW_TYPES = ["A321", "A320", "A319", "B738"]


def _distance(a: str, b: str) -> float:
    pa, pb = AIRPORTS[a], AIRPORTS[b]
    return distance_nm((pa.latitude, pa.longitude), (pb.latitude, pb.longitude))


def _plane_for(rng: random.Random, origin: str, dest: str, distance: float) -> tuple[str, int, int]:
    """Aircraft type, cruise altitude (ft) and average speed (kt) that suit a route's length."""
    if distance >= 2400:
        kind = rng.choice(WIDE_TYPES)
        altitude, speed = rng.randrange(35, 40) * 1000, rng.randrange(450, 491)
        # Westbound legs fight the jet stream, so they are slower over the ground.
        if AIRPORTS[dest].longitude < AIRPORTS[origin].longitude:
            speed -= 40
        return kind, altitude, speed
    if distance < 500 and rng.random() < 0.3:
        return "AT76", 17000, 260  # the only turboprop: short, low and slow
    if distance < 800:
        # Short hops spend most of the trip climbing or descending, so they stay lower.
        kind = rng.choice(["E190", *NARROW_TYPES])
        return kind, rng.randrange(22, 31) * 1000, rng.randrange(330, 411)
    return rng.choice(NARROW_TYPES), rng.randrange(33, 38) * 1000, rng.randrange(420, 461)


def build_mock_flights(seed: int = MOCK_SEED, count: int = MOCK_FLIGHT_COUNT) -> list[MockFlight]:
    """Generate `count` flights over the whole world. The same seed gives the same list."""
    rng = random.Random(seed)
    # 25% long-haul, 30% medium, the rest short, in random order.
    classes = ["long"] * (count // 4) + ["medium"] * (count * 3 // 10)
    classes += ["short"] * (count - len(classes))
    rng.shuffle(classes)
    weights = [w for _, _, w in AIRLINES]
    flights: list[MockFlight] = []
    callsigns: set[str] = set()
    for i, wanted in enumerate(classes, start=1):
        prefix, hubs, _ = rng.choices(AIRLINES, weights)[0]
        origin = rng.choice(hubs)
        # Some hubs have nothing in range for a class (Nairobi has no short hop), so fall
        # back to the other classes in turn.
        for route_class in [wanted, *(c for c in ROUTE_CLASSES if c != wanted)]:
            low, high = ROUTE_CLASSES[route_class]
            options = [a for a in AIRPORTS if low <= _distance(origin, a) <= high]
            if options:
                break
        dest = rng.choice(options)
        kind, altitude, speed = _plane_for(rng, origin, dest, _distance(origin, dest))
        callsign = f"{prefix}{rng.randrange(1, 9999)}"
        while callsign in callsigns:
            callsign = f"{prefix}{rng.randrange(1, 9999)}"
        callsigns.add(callsign)
        # Stop short of 1 so no flight is about to land and jump back to its origin at start.
        progress = rng.uniform(0, 0.9)
        flights.append(
            MockFlight(f"f{i:03d}", callsign, kind, origin, dest, altitude, speed, progress)
        )
    return flights


MOCK_FLIGHTS: list[MockFlight] = build_mock_flights()

# Taxi, take-off and landing time on top of the time in the air: schedules count
# gate to gate, so LHR->CDG is about an hour even though the flying takes ~35 min.
GROUND_MIN = 25

# Clock origin: at server start each flight is at its start_progress.
EPOCH = time.time()


def route_minutes(flight: MockFlight) -> float:
    """Exact airborne time (minutes) to fly the great-circle route at the flight's speed."""
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
        # Scheduled gate-to-gate time. The mock loop itself only covers the airborne part.
        duration_min=round(duration + GROUND_MIN),
        origin=origin,
        destination=dest,
    )


def get_mock_flights(now: float | None = None) -> list[Flight]:
    """Return every mock flight at its real-speed position at time `now` (default: now)."""
    elapsed_min = ((time.time() if now is None else now) - EPOCH) / 60
    return [_position_at(f, elapsed_min) for f in MOCK_FLIGHTS]
