"""Numbers shared by the mock data and the live code (kept apart so live code need not
import the mock modules, which build their data when imported)."""

# Taxi, take-off and landing time on top of the time in the air: schedules count
# gate to gate, so LHR->CDG is about an hour even though the flying takes ~35 min.
GROUND_MIN = 25

# The callsign shown for a live plane that sends none. The route lookup checks for
# it, so that it is never sent to adsbdb as if it were a real callsign.
NO_CALLSIGN = "Unknown"
