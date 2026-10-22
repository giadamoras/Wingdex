"""The built-in mock flights: seeded routes between real airports, flown along great circles.

Airline flights connect the big airports; business jets fly between business airfields and
cities; light aircraft, helicopters and gliders make short, low, slow hops between small
airfields, without showing a route. Every flight climbs out, cruises and descends in, so
some report a climb rate.
"""

import random
import time
from typing import NamedTuple

from app.constants import GROUND_MIN
from app.geo import distance_nm, initial_bearing, interpolate
from app.models import Airport, Flight

# Airports airlines fly between: (IATA, ICAO, name, city, country, lat, lon).
_AIRLINE_AIRPORTS = [
    # Europe
    ("LHR", "EGLL", "London Heathrow", "London", "United Kingdom", 51.470, -0.454),
    ("LGW", "EGKK", "London Gatwick", "London", "United Kingdom", 51.148, -0.190),
    ("LTN", "EGGW", "London Luton", "London", "United Kingdom", 51.875, -0.368),
    ("EMA", "EGNX", "East Midlands", "Nottingham", "United Kingdom", 52.831, -1.328),
    ("EDI", "EGPH", "Edinburgh", "Edinburgh", "United Kingdom", 55.950, -3.373),
    ("DUB", "EIDW", "Dublin", "Dublin", "Ireland", 53.426, -6.250),
    ("CDG", "LFPG", "Paris Charles de Gaulle", "Paris", "France", 49.010, 2.548),
    ("NCE", "LFMN", "Nice Cote d'Azur", "Nice", "France", 43.658, 7.216),
    ("BRU", "EBBR", "Brussels", "Brussels", "Belgium", 50.901, 4.484),
    ("AMS", "EHAM", "Amsterdam Schiphol", "Amsterdam", "Netherlands", 52.311, 4.768),
    ("LUX", "ELLX", "Luxembourg", "Luxembourg", "Luxembourg", 49.626, 6.212),
    ("FRA", "EDDF", "Frankfurt", "Frankfurt", "Germany", 50.038, 8.562),
    ("MUC", "EDDM", "Munich", "Munich", "Germany", 48.354, 11.786),
    ("DUS", "EDDL", "Dusseldorf", "Dusseldorf", "Germany", 51.289, 6.767),
    ("LEJ", "EDDP", "Leipzig/Halle", "Leipzig", "Germany", 51.424, 12.236),
    ("ZRH", "LSZH", "Zurich", "Zurich", "Switzerland", 47.458, 8.548),
    ("GVA", "LSGG", "Geneva", "Geneva", "Switzerland", 46.238, 6.109),
    ("VIE", "LOWW", "Vienna", "Vienna", "Austria", 48.110, 16.570),
    ("MAD", "LEMD", "Madrid Barajas", "Madrid", "Spain", 40.498, -3.568),
    ("BCN", "LEBL", "Barcelona El Prat", "Barcelona", "Spain", 41.297, 2.083),
    ("LIS", "LPPT", "Lisbon", "Lisbon", "Portugal", 38.781, -9.136),
    ("FCO", "LIRF", "Rome Fiumicino", "Rome", "Italy", 41.800, 12.239),
    ("MXP", "LIMC", "Milan Malpensa", "Milan", "Italy", 45.630, 8.723),
    ("VCE", "LIPZ", "Venice Marco Polo", "Venice", "Italy", 45.505, 12.352),
    ("MLA", "LMML", "Malta", "Valletta", "Malta", 35.857, 14.477),
    ("ATH", "LGAV", "Athens", "Athens", "Greece", 37.936, 23.945),
    ("IST", "LTFM", "Istanbul", "Istanbul", "Turkey", 41.275, 28.752),
    ("SAW", "LTFJ", "Istanbul Sabiha Gokcen", "Istanbul", "Turkey", 40.898, 29.309),
    ("AYT", "LTAI", "Antalya", "Antalya", "Turkey", 36.899, 30.800),
    ("CPH", "EKCH", "Copenhagen", "Copenhagen", "Denmark", 55.618, 12.656),
    ("ARN", "ESSA", "Stockholm Arlanda", "Stockholm", "Sweden", 59.650, 17.924),
    ("OSL", "ENGM", "Oslo Gardermoen", "Oslo", "Norway", 60.198, 11.100),
    ("HEL", "EFHK", "Helsinki", "Helsinki", "Finland", 60.317, 24.963),
    ("WAW", "EPWA", "Warsaw Chopin", "Warsaw", "Poland", 52.166, 20.967),
    ("BUD", "LHBP", "Budapest", "Budapest", "Hungary", 47.439, 19.262),
    ("KEF", "BIKF", "Keflavik", "Reykjavik", "Iceland", 63.985, -22.606),
    # North America
    ("JFK", "KJFK", "New York JFK", "New York", "United States", 40.641, -73.778),
    ("BOS", "KBOS", "Boston Logan", "Boston", "United States", 42.366, -71.010),
    ("ATL", "KATL", "Atlanta", "Atlanta", "United States", 33.637, -84.428),
    ("ORD", "KORD", "Chicago O'Hare", "Chicago", "United States", 41.978, -87.905),
    ("MDW", "KMDW", "Chicago Midway", "Chicago", "United States", 41.786, -87.752),
    ("LAX", "KLAX", "Los Angeles", "Los Angeles", "United States", 33.942, -118.408),
    ("SFO", "KSFO", "San Francisco", "San Francisco", "United States", 37.619, -122.375),
    ("LAS", "KLAS", "Las Vegas", "Las Vegas", "United States", 36.084, -115.154),
    ("DFW", "KDFW", "Dallas Fort Worth", "Dallas", "United States", 32.897, -97.038),
    ("DAL", "KDAL", "Dallas Love Field", "Dallas", "United States", 32.847, -96.852),
    ("DEN", "KDEN", "Denver", "Denver", "United States", 39.862, -104.673),
    ("MIA", "KMIA", "Miami", "Miami", "United States", 25.793, -80.291),
    ("SEA", "KSEA", "Seattle Tacoma", "Seattle", "United States", 47.450, -122.309),
    ("MEM", "KMEM", "Memphis", "Memphis", "United States", 35.042, -89.977),  # FedEx's hub
    ("SDF", "KSDF", "Louisville", "Louisville", "United States", 38.174, -85.736),  # UPS's hub
    ("CVG", "KCVG", "Cincinnati", "Cincinnati", "United States", 39.049, -84.668),
    ("HNL", "PHNL", "Honolulu", "Honolulu", "United States", 21.319, -157.922),
    ("YYZ", "CYYZ", "Toronto Pearson", "Toronto", "Canada", 43.678, -79.625),
    ("YVR", "CYVR", "Vancouver", "Vancouver", "Canada", 49.195, -123.184),
    ("MEX", "MMMX", "Mexico City", "Mexico City", "Mexico", 19.436, -99.072),
    # South America
    ("GRU", "SBGR", "Sao Paulo Guarulhos", "Sao Paulo", "Brazil", -23.435, -46.473),
    ("EZE", "SAEZ", "Buenos Aires Ezeiza", "Buenos Aires", "Argentina", -34.822, -58.536),
    ("BOG", "SKBO", "Bogota", "Bogota", "Colombia", 4.702, -74.147),
    ("SCL", "SCEL", "Santiago", "Santiago", "Chile", -33.393, -70.786),
    ("LIM", "SPJC", "Lima", "Lima", "Peru", -12.022, -77.114),
    # Africa
    ("JNB", "FAOR", "Johannesburg", "Johannesburg", "South Africa", -26.139, 28.246),
    ("CPT", "FACT", "Cape Town", "Cape Town", "South Africa", -33.965, 18.602),
    ("CAI", "HECA", "Cairo", "Cairo", "Egypt", 30.122, 31.406),
    ("ADD", "HAAB", "Addis Ababa", "Addis Ababa", "Ethiopia", 8.978, 38.799),
    ("CMN", "GMMN", "Casablanca", "Casablanca", "Morocco", 33.367, -7.590),
    ("NBO", "HKJK", "Nairobi", "Nairobi", "Kenya", -1.319, 36.927),
    ("LOS", "DNMM", "Lagos", "Lagos", "Nigeria", 6.577, 3.321),
    # Middle East
    ("DXB", "OMDB", "Dubai", "Dubai", "United Arab Emirates", 25.253, 55.366),
    ("AUH", "OMAA", "Abu Dhabi", "Abu Dhabi", "United Arab Emirates", 24.433, 54.651),
    ("DOH", "OTHH", "Doha", "Doha", "Qatar", 25.273, 51.608),
    ("TLV", "LLBG", "Tel Aviv", "Tel Aviv", "Israel", 32.011, 34.887),
    ("RUH", "OERK", "Riyadh", "Riyadh", "Saudi Arabia", 24.958, 46.699),
    ("JED", "OEJN", "Jeddah", "Jeddah", "Saudi Arabia", 21.680, 39.157),
    # Asia
    ("DEL", "VIDP", "Delhi", "Delhi", "India", 28.556, 77.100),
    ("BOM", "VABB", "Mumbai", "Mumbai", "India", 19.089, 72.868),
    ("BLR", "VOBL", "Bengaluru", "Bengaluru", "India", 13.198, 77.706),
    ("BKK", "VTBS", "Bangkok", "Bangkok", "Thailand", 13.690, 100.750),
    ("KUL", "WMKK", "Kuala Lumpur", "Kuala Lumpur", "Malaysia", 2.746, 101.710),
    ("SIN", "WSSS", "Singapore Changi", "Singapore", "Singapore", 1.364, 103.992),
    ("CGK", "WIII", "Jakarta", "Jakarta", "Indonesia", -6.126, 106.656),
    ("MNL", "RPLL", "Manila", "Manila", "Philippines", 14.509, 121.020),
    ("HKG", "VHHH", "Hong Kong", "Hong Kong", "Hong Kong", 22.308, 113.915),
    ("CAN", "ZGGG", "Guangzhou Baiyun", "Guangzhou", "China", 23.392, 113.299),
    ("PEK", "ZBAA", "Beijing Capital", "Beijing", "China", 40.080, 116.585),
    ("PVG", "ZSPD", "Shanghai Pudong", "Shanghai", "China", 31.143, 121.805),
    ("ICN", "RKSI", "Seoul Incheon", "Seoul", "South Korea", 37.469, 126.451),
    ("NRT", "RJAA", "Tokyo Narita", "Tokyo", "Japan", 35.765, 140.386),
    ("HND", "RJTT", "Tokyo Haneda", "Tokyo", "Japan", 35.549, 139.780),
    # Oceania
    ("SYD", "YSSY", "Sydney", "Sydney", "Australia", -33.946, 151.177),
    ("MEL", "YMML", "Melbourne", "Melbourne", "Australia", -37.673, 144.843),
    ("BNE", "YBBN", "Brisbane", "Brisbane", "Australia", -27.384, 153.118),
    ("PER", "YPPH", "Perth", "Perth", "Australia", -31.940, 115.967),
    ("AKL", "NZAA", "Auckland", "Auckland", "New Zealand", -37.008, 174.792),
]

# Small airfields and heliports for business jets and general aviation; airlines never
# route to them. Same layout as above.
_AIRFIELDS = [
    # England, the Channel and northern France
    ("BQH", "EGKB", "London Biggin Hill", "London", "United Kingdom", 51.331, 0.033),
    ("FAB", "EGLF", "Farnborough", "Farnborough", "United Kingdom", 51.276, -0.776),
    ("OXF", "EGTK", "Oxford Kidlington", "Oxford", "United Kingdom", 51.837, -1.320),
    ("CBG", "EGSC", "Cambridge", "Cambridge", "United Kingdom", 52.205, 0.175),
    ("ESH", "EGKA", "Shoreham", "Brighton", "United Kingdom", 50.836, -0.297),
    ("LYX", "EGMD", "Lydd", "Lydd", "United Kingdom", 50.956, 0.939),
    ("JER", "EGJJ", "Jersey", "Saint Helier", "Jersey", 49.208, -2.196),
    ("GCI", "EGJB", "Guernsey", "Saint Peter Port", "Guernsey", 49.435, -2.602),
    ("LTQ", "LFAT", "Le Touquet", "Le Touquet", "France", 50.515, 1.628),
    ("LBG", "LFPB", "Paris Le Bourget", "Paris", "France", 48.969, 2.441),
    # Riviera and the Alps
    ("CEQ", "LFMD", "Cannes Mandelieu", "Cannes", "France", 43.542, 6.953),
    ("MCM", "LNMC", "Monaco Heliport", "Monaco", "Monaco", 43.725, 7.420),
    ("LUG", "LSZA", "Lugano", "Lugano", "Switzerland", 46.004, 8.911),
    # United States
    ("TEB", "KTEB", "Teterboro", "New York", "United States", 40.850, -74.061),
    ("JRB", "KJRB", "Downtown Manhattan Heliport", "New York", "United States", 40.701, -74.009),
    ("VNY", "KVNY", "Van Nuys", "Los Angeles", "United States", 34.210, -118.490),
    ("TOA", "KTOA", "Torrance", "Torrance", "United States", 33.803, -118.340),
    ("CLD", "KCRQ", "Carlsbad McClellan-Palomar", "Carlsbad", "United States", 33.128, -117.280),
    ("PAO", "KPAO", "Palo Alto", "Palo Alto", "United States", 37.461, -122.115),
    ("SQL", "KSQL", "San Carlos", "San Carlos", "United States", 37.512, -122.250),
    ("HAF", "KHAF", "Half Moon Bay", "Half Moon Bay", "United States", 37.513, -122.501),
    ("LVK", "KLVK", "Livermore", "Livermore", "United States", 37.693, -121.820),
    ("MEV", "KMEV", "Minden-Tahoe", "Minden", "United States", 39.000, -119.751),
    ("TKF", "KTRK", "Truckee Tahoe", "Truckee", "United States", 39.320, -120.140),
    # Australia
    ("BWU", "YSBK", "Bankstown", "Sydney", "Australia", -33.924, 150.988),
    ("CDU", "YSCN", "Camden", "Camden", "Australia", -34.040, 150.687),
    ("JAD", "YPJT", "Jandakot", "Perth", "Australia", -32.098, 115.881),
    ("RTS", "YRTI", "Rottnest Island", "Rottnest Island", "Australia", -32.007, 115.540),
]

# Every mock airport, keyed by IATA code.
AIRPORTS: dict[str, Airport] = {
    iata: Airport(
        icao=icao, iata=iata, name=name, city=city, country=country, latitude=lat, longitude=lon
    )
    for iata, icao, name, city, country, lat, lon in _AIRLINE_AIRPORTS + _AIRFIELDS
}
AIRLINE_AIRPORTS = [a[0] for a in _AIRLINE_AIRPORTS]

# Field elevation (ft) of the mock airports that sit high; the rest count as sea level.
# Planes take off from and land at this height, so none flies below its airfield.
ELEVATION_FT = {
    "MEX": 7316, "BOG": 8361, "ADD": 7656, "TKF": 5900, "JNB": 5558, "DEN": 5434,
    "NBO": 5330, "MEV": 4722, "BLR": 3000, "GRU": 2459, "LAS": 2181,
    "SCL": 1555, "MUC": 1487, "ZRH": 1416, "GVA": 1411, "LUG": 915,
}  # fmt: skip


class Airline(NamedTuple):
    """An airline the generator picks from. The airline quests match on the callsign
    prefix, and the airline-kind quests on its kind in the frontend's airline catalog."""

    prefix: str
    hubs: list[str]
    weight: int  # how often it is picked (Europe is the busiest, as in the real feed)
    country: str  # where its planes are registered
    # Its fleet: the types it flies under 2,400 nm, and on long-haul (none: it flies no
    # long-haul, like the low-cost and regional airlines).
    short: tuple[str, ...]
    long: tuple[str, ...]


AIRLINES: list[Airline] = [
    # Europe, full service
    Airline("BAW", ["LHR"], 4, "United Kingdom", ("A319", "A320", "A321", "A20N", "A21N"),
            ("B772", "B77W", "B788", "B789", "B78X", "A35K", "A388")),
    Airline("DLH", ["FRA", "MUC"], 4, "Germany", ("A319", "A320", "A321", "A20N", "A21N"),
            ("B748", "A359", "A343", "A388", "B789")),
    Airline("AFR", ["CDG"], 3, "France", ("A318", "A319", "A320", "A321", "BCS3"),
            ("B772", "B77W", "A359", "B789", "B78X")),
    Airline("KLM", ["AMS"], 3, "Netherlands", ("B738", "B739", "E75L", "E190", "E295"),
            ("B772", "B77W", "B789", "B78X", "A333")),
    Airline("IBE", ["MAD"], 2, "Spain", ("A320", "A321", "A20N", "A21N"),
            ("A332", "A333", "A359")),
    Airline("AEA", ["MAD"], 1, "Spain", ("B738", "E195"), ("B788", "B789")),
    Airline("TAP", ["LIS"], 2, "Portugal", ("A320", "A321", "A20N", "A21N", "E195"),
            ("A339",)),
    Airline("ITY", ["FCO"], 1, "Italy", ("A319", "A320", "A20N", "A21N"), ("A339", "A359")),
    Airline("SWR", ["ZRH", "GVA"], 2, "Switzerland", ("BCS1", "BCS3", "A320", "A20N", "A21N"),
            ("B77W", "A333", "A343")),
    Airline("AUA", ["VIE"], 1, "Austria", ("A320", "A321", "E195"), ("B763", "B789")),
    Airline("BEL", ["BRU"], 1, "Belgium", ("A319", "A320"), ("A333",)),
    Airline("SAS", ["CPH", "ARN", "OSL"], 2, "Sweden", ("A20N", "A21N", "A320", "CRJ9"),
            ("A359", "A333")),
    Airline("FIN", ["HEL"], 1, "Finland", ("A319", "A320", "A321", "AT72", "E190"),
            ("A359", "A333")),
    Airline("ICE", ["KEF"], 1, "Iceland", ("B38M", "B39M", "B752", "DH8D"), ("B763",)),
    Airline("EIN", ["DUB"], 1, "Ireland", ("A320", "A20N", "A21N"), ("A332", "A333")),
    Airline("LOT", ["WAW"], 1, "Poland", ("B738", "B38M", "E75L", "E195", "DH8D"),
            ("B788", "B789")),
    Airline("AEE", ["ATH"], 1, "Greece", ("A320", "A321", "A20N", "A21N"), ()),
    Airline("THY", ["IST"], 3, "Turkey", ("A321", "A21N", "B738", "B38M"),
            ("B77W", "A333", "A359", "B789")),
    Airline("DLA", ["MUC", "FRA"], 1, "Italy", ("E190", "E195"), ()),
    # Europe, low-cost
    Airline("RYR", ["DUB", "MAD", "BCN", "FCO", "MXP", "LIS", "EDI"], 4, "Ireland",
            ("B738", "B38M"), ()),
    Airline("EZY", ["LGW", "LTN", "EDI"], 2, "United Kingdom",
            ("A319", "A320", "A20N", "A21N"), ()),
    Airline("EJU", ["CDG", "AMS", "MXP"], 1, "Austria", ("A320", "A20N"), ()),
    Airline("EZS", ["GVA"], 1, "Switzerland", ("A320", "A20N"), ()),
    Airline("WZZ", ["BUD", "WAW"], 2, "Hungary", ("A321", "A21N"), ()),
    Airline("WUK", ["LTN"], 1, "United Kingdom", ("A21N",), ()),
    Airline("WMT", ["FCO", "VCE"], 1, "Malta", ("A21N",), ()),
    Airline("VLG", ["BCN"], 1, "Spain", ("A320", "A321"), ()),
    Airline("VOE", ["VCE"], 1, "Spain", ("A319", "A320"), ()),
    Airline("NOZ", ["OSL"], 1, "Norway", ("B738", "B38M"), ()),
    Airline("NSZ", ["ARN"], 1, "Sweden", ("B738", "B38M"), ()),
    Airline("TRA", ["AMS"], 1, "Netherlands", ("B738", "A21N"), ()),
    Airline("EWG", ["DUS"], 1, "Germany", ("A319", "A320", "A20N"), ()),
    Airline("PGT", ["SAW"], 1, "Turkey", ("A20N", "A21N", "B38M"), ()),
    # Europe, holiday
    Airline("CFG", ["FRA"], 1, "Germany", ("A320", "A321", "A21N"), ("A339",)),
    Airline("NOS", ["MXP"], 1, "Italy", ("B738", "B38M"), ("B789",)),
    Airline("SXS", ["AYT"], 1, "Turkey", ("B738", "B38M"), ()),
    # Middle East
    Airline("UAE", ["DXB"], 3, "United Arab Emirates", ("B77W", "A388"), ("B77W", "A388")),
    Airline("FDB", ["DXB"], 1, "United Arab Emirates", ("B738", "B38M"), ()),
    Airline("QTR", ["DOH"], 2, "Qatar", ("A320", "B38M", "B788"),
            ("B77W", "A359", "A35K", "B789", "A388")),
    Airline("ETD", ["AUH"], 1, "United Arab Emirates", ("A21N", "B789"),
            ("B789", "B78X", "B77W", "A35K", "A388")),
    Airline("SVA", ["JED", "RUH"], 1, "Saudi Arabia", ("A320", "A20N", "A21N"),
            ("B77W", "B789", "B78X")),
    Airline("ELY", ["TLV"], 1, "Israel", ("B738", "B739"), ("B772", "B788", "B789")),
    # Americas
    Airline("AAL", ["DFW", "MIA", "ORD"], 2, "United States",
            ("A319", "A320", "A321", "A21N", "B738", "B38M"), ("B772", "B77W", "B788", "B789")),
    Airline("UAL", ["ORD", "SFO", "DEN"], 2, "United States",
            ("A319", "A320", "B738", "B739", "B38M", "B39M", "A21N"),
            ("B772", "B77W", "B789", "B78X", "B763", "B764")),
    Airline("DAL", ["ATL", "SEA", "LAX"], 2, "United States",
            ("A319", "A320", "A321", "A21N", "B739", "BCS1", "BCS3"),
            ("A339", "A359", "A332", "A333", "B763", "B764")),
    Airline("ASA", ["SEA"], 1, "United States", ("B738", "B739", "B39M"), ()),
    Airline("SWA", ["DAL", "MDW", "LAS"], 2, "United States", ("B737", "B738", "B38M"), ()),
    Airline("JBU", ["JFK", "BOS"], 1, "United States", ("A320", "A321", "A21N", "BCS3"), ()),
    Airline("ACA", ["YYZ", "YVR"], 1, "Canada", ("A320", "A321", "B38M", "BCS3"),
            ("B77W", "B788", "B789", "A333")),
    Airline("AMX", ["MEX"], 1, "Mexico", ("B738", "B38M", "B39M"), ("B788", "B789")),
    Airline("LAN", ["SCL", "LIM", "GRU"], 1, "Chile", ("A320", "A321", "A20N", "A21N"),
            ("B789", "B788", "B763")),
    Airline("AVA", ["BOG"], 1, "Colombia", ("A320", "A20N"), ("B788",)),
    # Africa
    Airline("SAA", ["JNB", "CPT"], 1, "South Africa", ("A320", "A20N"), ("A333", "A359")),
    Airline("ETH", ["ADD"], 1, "Ethiopia", ("B738", "B38M", "DH8D"),
            ("A359", "B788", "B789", "B77W")),
    Airline("MSR", ["CAI"], 1, "Egypt", ("A20N", "A21N", "B738"), ("B77W", "B789", "A333")),
    Airline("RAM", ["CMN"], 1, "Morocco", ("B738", "B38M", "E190", "AT76"), ("B788", "B789")),
    Airline("KQA", ["NBO"], 1, "Kenya", ("E190", "B738"), ("B788",)),
    # Asia and Oceania
    Airline("SIA", ["SIN"], 2, "Singapore", ("B38M", "A359"), ("A359", "B77W", "B78X", "A388")),
    Airline("CPA", ["HKG"], 1, "Hong Kong", ("A21N", "A333"), ("B77W", "A359", "A35K")),
    Airline("CCA", ["PEK", "PVG"], 2, "China", ("A320", "A321", "A20N", "B738", "B38M"),
            ("B77W", "A359", "B789", "A333", "B748")),
    Airline("CES", ["PVG"], 1, "China", ("A320", "A321", "A20N", "B738"),
            ("A359", "B77W", "B789", "A333")),
    Airline("CSN", ["CAN"], 1, "China", ("A320", "A321", "A20N", "A21N", "B738", "B38M"),
            ("B77W", "B789", "A359")),
    Airline("AIC", ["DEL", "BOM"], 2, "India", ("A320", "A20N", "A21N"),
            ("B77W", "B788", "A359")),
    Airline("AXB", ["DEL", "BLR"], 1, "India", ("B738", "B38M"), ()),
    Airline("IGO", ["DEL", "BOM", "BLR"], 2, "India", ("A20N", "A21N"), ()),
    Airline("JAL", ["HND", "NRT"], 1, "Japan", ("B738", "A359"),
            ("B77W", "B788", "B789", "A35K")),
    Airline("ANA", ["HND", "NRT"], 1, "Japan", ("B738", "A321", "A21N", "DH8D"),
            ("B77W", "B788", "B789", "B78X")),
    Airline("KAL", ["ICN"], 1, "South Korea", ("B738", "B739", "B38M", "A21N", "BCS3"),
            ("B77W", "B789", "B748", "A333", "A388")),
    Airline("THA", ["BKK"], 1, "Thailand", ("A20N", "A21N"), ("B77W", "A359", "B789", "B788")),
    Airline("MAS", ["KUL"], 1, "Malaysia", ("B738", "B38M"), ("A333", "A359")),
    Airline("GIA", ["CGK"], 1, "Indonesia", ("B738", "B38M"), ("B77W", "A333", "A339")),
    Airline("QFA", ["SYD", "MEL", "BNE", "PER"], 2, "Australia", ("B738", "A21N"),
            ("A333", "B789", "A388")),
    Airline("ANZ", ["AKL"], 1, "New Zealand", ("A20N", "A21N", "AT76"), ("B77W", "B789")),
    # Cargo: freighters on every route length
    Airline("FDX", ["MEM"], 1, "United States", ("B763", "B77L"), ("B77L",)),
    Airline("UPS", ["SDF"], 1, "United States", ("B763", "B744"), ("B744", "B748")),
    Airline("GTI", ["CVG", "MIA"], 1, "United States", ("B763",), ("B744",)),
    Airline("CLX", ["LUX"], 1, "Luxembourg", ("B744", "B748"), ("B744", "B748")),
    Airline("BOX", ["LEJ", "FRA"], 1, "Germany", ("B77L",), ("B77L",)),
    Airline("BCS", ["LEJ"], 1, "Germany", ("A306", "B752"), ("A306",)),
    Airline("DHK", ["EMA"], 1, "United Kingdom", ("B752", "B763"), ("B763",)),
]  # fmt: skip

# Business jets and general aviation.
BIZJET_TYPES = ["C68A", "C25B", "GLF6", "GL7T", "GLEX", "FA7X", "CL35", "LJ45", "PC24", "E55P"]
LIGHT_TYPES = ["C172", "C152", "P28A", "SR22", "DA40", "DA42", "BE36", "PA18", "DR40", "RV7"]
HELICOPTER_TYPES = ["R44", "R22", "EC35", "AS50", "A139", "B407", "A109"]
GLIDER_TYPES = ["GLID"]

# The category of every type above, as in the frontend's type catalog (a test checks).
CATEGORY: dict[str, str] = {
    **dict.fromkeys(["AT76", "AT72", "DH8D"], "turboprop"),
    **dict.fromkeys(["E75L", "E190", "E195", "E295", "CRJ9"], "regionalJet"),
    **dict.fromkeys(
        ["BCS1", "BCS3", "A318", "A319", "A320", "A321", "A20N", "A21N"]
        + ["B737", "B738", "B739", "B38M", "B39M", "B752"],
        "narrowBody",
    ),
    **dict.fromkeys(
        ["B772", "B77W", "B77L", "B788", "B789", "B78X", "B744", "B748", "B763", "B764"]
        + ["A306", "A332", "A333", "A339", "A343", "A359", "A35K", "A388"],
        "wideBody",
    ),
    **dict.fromkeys(BIZJET_TYPES, "bizJet"),
    **dict.fromkeys(LIGHT_TYPES, "light"),
    **dict.fromkeys(HELICOPTER_TYPES, "helicopter"),
    **dict.fromkeys(GLIDER_TYPES, "glider"),
}


class Performance(NamedTuple):
    """How a category of plane flies: cruise height and speed ranges, climb and descent."""

    altitude: tuple[int, int, int]  # lowest, highest and step, feet
    speed: tuple[int, int]  # average ground speed range, knots
    climb_fpm: int
    descent_fpm: int


PERFORMANCE: dict[str, Performance] = {
    "wideBody": Performance((35000, 40000, 1000), (450, 490), 1800, 1800),
    "narrowBody": Performance((33000, 37000, 1000), (420, 460), 2200, 1800),
    "regionalJet": Performance((30000, 37000, 1000), (400, 440), 2200, 1800),
    "turboprop": Performance((17000, 25000, 1000), (250, 290), 1400, 1200),
    "bizJet": Performance((39000, 45000, 1000), (430, 480), 3000, 2000),
    # Below the climbing quest's 1,000 fpm, as in real life.
    "light": Performance((2000, 8000, 500), (95, 150), 600, 500),
    "helicopter": Performance((800, 2500, 100), (90, 140), 800, 600),
    "glider": Performance((7000, 13000, 500), (45, 70), 400, 300),
}
JETS = {"wideBody", "narrowBody", "regionalJet"}
# Local flyers: they still fly from one airfield to another, but the feed shows no route or
# duration for them, as with most such planes in the live feed.
NO_ROUTE = {"light", "helicopter", "glider"}

# Route length classes for airline flights, in nautical miles. Long-haul is over ~6 hours.
ROUTE_CLASSES = {"short": (150, 800), "medium": (800, 2400), "long": (3000, 9000)}
BIZJET_RANGE_NM = (150, 3500)
LOCAL_HOP_NM = (5, 150)  # light aircraft, helicopters and gliders
MOCK_FLIGHT_COUNT = 200
MOCK_SEED = 7

# Small airfields per kind of local flight, and where business jets are based.
LIGHT_FIELDS = [
    "BQH", "FAB", "OXF", "CBG", "ESH", "LYX", "LTQ", "JER", "GCI",  # England and the Channel
    "VNY", "TOA", "CLD", "PAO", "SQL", "HAF", "LVK",  # California
    "BWU", "CDU", "JAD", "RTS",  # Sydney and Perth
]  # fmt: skip
HELICOPTER_FIELDS = [
    "BQH", "FAB", "OXF", "NCE", "CEQ", "MCM", "TEB", "JRB", "VNY", "TOA",
]  # fmt: skip
GLIDER_FIELDS = ["MEV", "TKF"]  # the Sierra Nevada wave and thermals
BIZJET_BASES = ["FAB", "LBG", "BQH", "TEB", "VNY", "CEQ", "LUG", "GVA", "NCE", "DXB", "LAS", "MIA"]

# Registration for non-airline planes, by the country of the airfield they start from:
# the prefix, how many letters follow it and the country the plane is registered in.
REGISTRATIONS: dict[str, tuple[str, int, str]] = {
    "United Kingdom": ("G", 4, "United Kingdom"),
    "Jersey": ("G", 4, "United Kingdom"),
    "Guernsey": ("G", 4, "United Kingdom"),
    "France": ("F", 4, "France"),
    "Monaco": ("3A", 3, "Monaco"),
    "Switzerland": ("HB", 3, "Switzerland"),
    "United Arab Emirates": ("A6", 3, "United Arab Emirates"),
    "United States": ("N", 0, "United States"),  # N-numbers: digits then letters
    "Australia": ("VH", 3, "Australia"),
}
LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"


class MockFlight(NamedTuple):
    """Static description of one mock flight; its position is derived from the clock."""

    id: str
    callsign: str
    aircraft_type: str
    origin: str  # IATA code in AIRPORTS
    destination: str
    cruise_ft: int
    speed_kt: int  # average ground speed: lower on short hops, lower westbound (headwinds)
    climb_fpm: int
    descent_fpm: int
    registered_country: str
    start_progress: float  # fraction of the route already flown when the server starts


def _distance(a: str, b: str) -> float:
    pa, pb = AIRPORTS[a], AIRPORTS[b]
    return distance_nm((pa.latitude, pa.longitude), (pb.latitude, pb.longitude))


def _pairs(
    origins: list[str], destinations: list[str], low: float, high: float
) -> list[tuple[str, str]]:
    """Every (origin, destination) pair between `low` and `high` nautical miles apart."""
    return [
        (a, b) for a in origins for b in destinations if a != b and low <= _distance(a, b) <= high
    ]


def _airline_type(rng: random.Random, airline: Airline, distance: float) -> str:
    """An aircraft type from the airline's fleet that suits the route's length."""
    if distance >= 2400:
        return rng.choice(airline.long)
    # Turboprops only on the shortest hops.
    fleet = [t for t in airline.short if distance < 500 or CATEGORY[t] != "turboprop"]
    return rng.choice(fleet)


def _cruise(rng: random.Random, kind: str, origin: str, dest: str) -> tuple[int, int]:
    """Cruise altitude (ft) and average speed (kt) for this type on this route."""
    perf = PERFORMANCE[CATEGORY[kind]]
    distance = _distance(origin, dest)
    if CATEGORY[kind] in JETS and distance < 800:
        # Short hops spend most of the trip climbing or descending, so they stay lower.
        return rng.randrange(22, 31) * 1000, rng.randrange(330, 411)
    low, high, step = perf.altitude
    # At least 1,500 ft above the higher airfield (a glider out of Minden or Truckee).
    fields = max(ELEVATION_FT.get(origin, 0), ELEVATION_FT.get(dest, 0))
    altitude = max(rng.randrange(low, high + 1, step), fields + 1500)
    speed = rng.randrange(perf.speed[0], perf.speed[1] + 1)
    # Westbound long-hauls fight the jet stream, so they are slower over the ground.
    if distance >= 2400 and AIRPORTS[dest].longitude < AIRPORTS[origin].longitude:
        speed -= 40
    return altitude, speed


def _registration(rng: random.Random, origin: str) -> tuple[str, str]:
    """A made-up registration, used as the callsign as private planes do, and its country."""
    prefix, letters, registered = REGISTRATIONS[AIRPORTS[origin].country or ""]
    if prefix == "N":
        tail = f"{rng.randrange(100, 1000)}{''.join(rng.choices(LETTERS, k=2))}"
    else:
        tail = "".join(rng.choices(LETTERS, k=letters))
    return prefix + tail, registered


def build_mock_flights(seed: int = MOCK_SEED, count: int = MOCK_FLIGHT_COUNT) -> list[MockFlight]:
    """Generate `count` flights over the whole world. The same seed gives the same list."""
    rng = random.Random(seed)
    # About 18% are business jets and general aviation, the rest airline flights.
    others = ["bizJet"] * (count * 6 // 100) + ["light"] * (count * 6 // 100)
    others += ["helicopter"] * (count * 4 // 100) + ["glider"] * (count * 2 // 100)
    n_airline = count - len(others)
    # Every airline flies at least once (when there is room); the rest are picked by weight.
    airlines = AIRLINES[:n_airline]
    airlines += rng.choices(AIRLINES, [a.weight for a in AIRLINES], k=n_airline - len(airlines))
    # 25% long-haul, 30% medium, the rest short, in random order.
    classes = ["long"] * (n_airline // 4) + ["medium"] * (n_airline * 3 // 10)
    classes += ["short"] * (n_airline - len(classes))
    rng.shuffle(airlines)
    rng.shuffle(classes)

    flights: list[MockFlight] = []
    callsigns: set[str] = set()

    def add(kind: str, origin: str, dest: str, callsign: str, country: str) -> None:
        altitude, speed = _cruise(rng, kind, origin, dest)
        perf = PERFORMANCE[CATEGORY[kind]]
        callsigns.add(callsign)
        # Anywhere along the route, final descent included, but at least 2 minutes before
        # landing, so no flight jumps back to its origin right at start.
        minutes = _distance(origin, dest) / speed * 60
        progress = rng.uniform(0, 1 - 2 / minutes)
        flights.append(
            MockFlight(
                id=f"f{len(flights) + 1:03d}",
                callsign=callsign,
                aircraft_type=kind,
                origin=origin,
                destination=dest,
                cruise_ft=altitude,
                speed_kt=speed,
                climb_fpm=perf.climb_fpm,
                descent_fpm=perf.descent_fpm,
                registered_country=country,
                start_progress=progress,
            )
        )

    for airline, wanted in zip(airlines, classes, strict=True):
        origin = rng.choice(airline.hubs)
        # Low-cost and regional airlines fly no long-haul, and some hubs have nothing in
        # range for a class (Nairobi has no short hop), so fall back to the others in turn.
        allowed = [c for c in ROUTE_CLASSES if c != "long" or airline.long]
        for route_class in [wanted, *allowed]:
            low, high = ROUTE_CLASSES[route_class]
            options = [a for a in AIRLINE_AIRPORTS if low <= _distance(origin, a) <= high]
            if route_class in allowed and options:
                break
        dest = rng.choice(options)
        kind = _airline_type(rng, airline, _distance(origin, dest))
        callsign = f"{airline.prefix}{rng.randrange(1, 9999)}"
        while callsign in callsigns:
            callsign = f"{airline.prefix}{rng.randrange(1, 9999)}"
        add(kind, origin, dest, callsign, airline.country)

    # Business jets go anywhere in range; the others make local hops between small fields.
    routes = {
        "bizJet": _pairs(BIZJET_BASES, BIZJET_BASES + AIRLINE_AIRPORTS, *BIZJET_RANGE_NM),
        "light": _pairs(LIGHT_FIELDS, LIGHT_FIELDS, *LOCAL_HOP_NM),
        "helicopter": _pairs(HELICOPTER_FIELDS, HELICOPTER_FIELDS, *LOCAL_HOP_NM),
        "glider": _pairs(GLIDER_FIELDS, GLIDER_FIELDS, *LOCAL_HOP_NM),
    }
    types = {
        "bizJet": BIZJET_TYPES,
        "light": LIGHT_TYPES,
        "helicopter": HELICOPTER_TYPES,
        "glider": GLIDER_TYPES,
    }
    for category in others:
        origin, dest = rng.choice(routes[category])
        callsign, country = _registration(rng, origin)
        while callsign in callsigns:
            callsign, country = _registration(rng, origin)
        add(rng.choice(types[category]), origin, dest, callsign, country)
    return flights


MOCK_FLIGHTS: list[MockFlight] = build_mock_flights()

# Clock origin: at server start each flight is at its start_progress.
EPOCH = time.time()


def route_minutes(flight: MockFlight) -> float:
    """Exact airborne time (minutes) to fly the great-circle route at the flight's speed."""
    origin, dest = AIRPORTS[flight.origin], AIRPORTS[flight.destination]
    distance = distance_nm((origin.latitude, origin.longitude), (dest.latitude, dest.longitude))
    return distance / flight.speed_kt * 60


def altitude_profile(flight: MockFlight, flown_min: float, total_min: float) -> tuple[int, int]:
    """Altitude (ft) and climb rate (fpm) after `flown_min` of a `total_min` flight.

    The plane climbs at its climb rate from take-off, cruises, and descends at its
    descent rate so it touches down on arrival, both from the airfields' elevation. On a
    short hop the climb meets the descent before cruise height, so it climbs and then
    descends straight away.
    """
    # As high as it can be by climbing, and as high as it can be and still land.
    climbed = ELEVATION_FT.get(flight.origin, 0) + flight.climb_fpm * flown_min
    to_descend = ELEVATION_FT.get(flight.destination, 0) + flight.descent_fpm * (
        total_min - flown_min
    )
    altitude = min(flight.cruise_ft, climbed, to_descend)
    if climbed == altitude < flight.cruise_ft:
        rate = flight.climb_fpm
    elif to_descend == altitude < flight.cruise_ft:
        rate = -flight.descent_fpm
    else:
        rate = 0
    return round(altitude), rate


def _position_at(flight: MockFlight, elapsed_min: float) -> Flight:
    """Where the flight is after `elapsed_min` minutes, looping back when it arrives."""
    origin, dest = AIRPORTS[flight.origin], AIRPORTS[flight.destination]
    a, b = (origin.latitude, origin.longitude), (dest.latitude, dest.longitude)
    duration = route_minutes(flight)
    progress = (flight.start_progress + elapsed_min / duration) % 1
    latitude, longitude = interpolate(a, b, progress)
    altitude, rate = altitude_profile(flight, progress * duration, duration)
    shows_route = CATEGORY[flight.aircraft_type] not in NO_ROUTE
    return Flight(
        id=flight.id,
        callsign=flight.callsign,
        aircraft_type=flight.aircraft_type,
        latitude=latitude,
        longitude=longitude,
        altitude_ft=altitude,
        # On a great circle the heading changes along the way, so aim at the destination.
        heading=initial_bearing((latitude, longitude), b),
        speed_kt=flight.speed_kt,
        # Scheduled gate-to-gate time. The mock loop itself only covers the airborne part.
        duration_min=round(duration + GROUND_MIN) if shows_route else None,
        origin=origin if shows_route else None,
        destination=dest if shows_route else None,
        vertical_rate_fpm=rate,
        registered_country=flight.registered_country,
    )


def get_mock_flights(now: float | None = None) -> list[Flight]:
    """Return every mock flight at its real-speed position at time `now` (default: now)."""
    elapsed_min = ((time.time() if now is None else now) - EPOCH) / 60
    return [_position_at(f, elapsed_min) for f in MOCK_FLIGHTS]
