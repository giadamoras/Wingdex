"""Aircraft types for live flights: ICAO type code by transponder address (icao24).

The data comes from the OpenSky aircraft database, compacted by
scripts/build_aircraft_types.py. A plane missing from it simply has no type.
"""

import gzip
import logging
from functools import lru_cache
from pathlib import Path

log = logging.getLogger(__name__)

DEFAULT_PATH = Path(__file__).resolve().parent / "data" / "aircraft_types.csv.gz"


@lru_cache(maxsize=1)
def load_aircraft_types(path: Path = DEFAULT_PATH) -> dict[str, str]:
    """Read the compact file once: {"4ca7b5": "B738", ...}. Empty if the file is missing."""
    try:
        with gzip.open(path, "rt", encoding="utf-8") as f:
            pairs = (line.strip().split(",", 1) for line in f if "," in line)
            return {icao24: typecode for icao24, typecode in pairs}
    except OSError:
        log.warning("Aircraft type file %s not found; live flights will have no type", path)
        return {}
