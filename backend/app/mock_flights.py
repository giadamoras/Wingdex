import random

from app.models import Flight

# Max random offset (degrees) applied to each flight's position per call.
JITTER_DEG = 0.5

# Fixed mock flights over Europe and the North Atlantic (altitudes mix above/below 30,000 ft).
BASE_FLIGHTS: list[Flight] = [
    Flight(
        id="f01",
        callsign="BAW117",
        aircraft_type="A320",
        latitude=51.5,
        longitude=-0.5,
        altitude_ft=36000,
        heading=90,
        duration_min=95,
    ),
    Flight(
        id="f02",
        callsign="AFR1234",
        aircraft_type="A321",
        latitude=48.9,
        longitude=2.5,
        altitude_ft=34000,
        heading=135,
        duration_min=130,
    ),
    Flight(
        id="f03",
        callsign="DLH400",
        aircraft_type="B748",
        latitude=50.0,
        longitude=8.5,
        altitude_ft=38000,
        heading=270,
        duration_min=540,
    ),
    Flight(
        id="f04",
        callsign="KLM641",
        aircraft_type="B77W",
        latitude=52.3,
        longitude=4.8,
        altitude_ft=41000,
        heading=110,
        duration_min=600,
    ),
    Flight(
        id="f05",
        callsign="RYR8821",
        aircraft_type="B738",
        latitude=45.5,
        longitude=9.2,
        altitude_ft=28000,
        heading=200,
        duration_min=120,
    ),
    Flight(
        id="f06",
        callsign="IBE3170",
        aircraft_type="A359",
        latitude=40.4,
        longitude=-3.7,
        altitude_ft=33000,
        heading=300,
        duration_min=480,
    ),
    Flight(
        id="f07",
        callsign="EZY45AB",
        aircraft_type="A319",
        latitude=47.0,
        longitude=11.0,
        altitude_ft=12000,
        heading=45,
        duration_min=100,
    ),
    Flight(
        id="f08",
        callsign="VIR9",
        aircraft_type="A333",
        latitude=53.0,
        longitude=-20.0,
        altitude_ft=37000,
        heading=280,
        duration_min=500,
    ),  # over open ocean
    Flight(
        id="f09",
        callsign="SAS1590",
        aircraft_type="E190",
        latitude=59.6,
        longitude=17.9,
        altitude_ft=24000,
        heading=180,
        duration_min=75,
    ),
    Flight(
        id="f10",
        callsign="THY1",
        aircraft_type="A388",
        latitude=41.0,
        longitude=28.9,
        altitude_ft=39000,
        heading=315,
        duration_min=270,
    ),
]


def get_mock_flights() -> list[Flight]:
    """Return the mock flights with slightly randomized positions (fresh on every call)."""
    return [
        flight.model_copy(
            update={
                "latitude": flight.latitude + random.uniform(-JITTER_DEG, JITTER_DEG),
                "longitude": flight.longitude + random.uniform(-JITTER_DEG, JITTER_DEG),
            }
        )
        for flight in BASE_FLIGHTS
    ]
