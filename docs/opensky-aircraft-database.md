# OpenSky aircraft database (aircraft types for live flights)

Live flights have no aircraft type in OpenSky's state vectors, so the backend looks it up by
transponder address (`icao24`) in `backend/app/data/aircraft_types.csv.gz`: one line
`icao24,typecode` per aircraft (501,934 aircraft, 1.8 MB), built from OpenSky's aircraft database.
A plane that isn't in the file has no type.

## Rebuild the file

1. Download a snapshot (about 106 MB; don't put it in the repo). The newest one found on
   2026-10-04 was January 2025:
   `https://s3.opensky-network.org/data-samples/metadata/aircraft-database-complete-2025-01.csv`.
   Later months returned 404 when tried, so check
   <https://opensky-network.org/data/aircraft> for a newer file.
2. From `backend/`:

   ```powershell
   .venv\Scripts\python scripts/build_aircraft_types.py path\to\aircraft-database-complete-2025-01.csv
   ```

   The output is the same bytes every run, so git only shows real changes.

## Coverage (measured 2026-10-04 against the January 2025 snapshot)

- 83% of the 601,282 aircraft in the database have a type code.
- Against one live snapshot (10,811 airborne, usable planes), 82% had a type. Of the rest, 1,697
  were not in the database at all (mostly newer aircraft: airliners and US-registered planes) and
  271 were in it without a type code.

## Licence and citation

OpenSky's page says the database "is unlicensed and does not fall under our terms of use" and is
offered "as is", with no support or guarantees. It was assembled from official aircraft registries,
Basestation files, crowdsourced data, openflights.org and ICAO Doc 8643. If you use OpenSky data
in a publication (web pages included), it asks you to cite:

> Matthias Schäfer, Martin Strohmeier, Vincent Lenders, Ivan Martinovic and Matthias Wilhelm.
> "Bringing Up OpenSky: A Large-scale ADS-B Sensor Network for Research". In Proceedings of the
> 13th IEEE/ACM International Symposium on Information Processing in Sensor Networks (IPSN),
> pages 83-94, April 2014.

and optionally mention the OpenSky Network website. The app's credit line under the map covers
the mention; the citation is here.
