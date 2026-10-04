"""Build backend/app/data/aircraft_types.csv.gz from the OpenSky aircraft database.

The database is a ~100 MB CSV, so only the part we use is kept: `icao24,typecode` for every
aircraft that has a type code. Download the CSV first (see docs/opensky-aircraft-database.md),
then run from backend/:

    .venv\\Scripts\\python scripts/build_aircraft_types.py path/to/aircraft-database.csv
"""

import csv
import gzip
import sys
from pathlib import Path

OUTPUT = Path(__file__).resolve().parent.parent / "app" / "data" / "aircraft_types.csv.gz"


def build(source: Path, output: Path = OUTPUT) -> int:
    """Write the compact file and return how many aircraft it holds."""
    types: dict[str, str] = {}
    with source.open(newline="", encoding="utf-8") as f:
        # OpenSky quotes fields with single quotes.
        for row in csv.DictReader(f, quotechar="'"):
            icao24 = (row.get("icao24") or "").strip().lower()
            typecode = (row.get("typecode") or "").strip().upper()
            if icao24 and typecode:
                types[icao24] = typecode
    output.parent.mkdir(parents=True, exist_ok=True)
    lines = (f"{icao24},{types[icao24]}\n" for icao24 in sorted(types))
    # mtime=0 keeps the output identical between runs, so git only sees real changes.
    with gzip.GzipFile(output, "wb", mtime=0) as out:
        out.write("".join(lines).encode())
    return len(types)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    print(f"Wrote {build(Path(sys.argv[1]))} aircraft to {OUTPUT}")
