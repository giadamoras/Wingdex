# Aviation weather products: METAR, TAF and SIGMET

Why the app uses SIGMETs (the Aviation Weather Center's `isigmet` feed) for its map weather, and TAFs for the destination forecast on the flight card.

| | **METAR** | **TAF** | **SIGMET** |
|---|---|---|---|
| **What it is** | An observation: weather as it is now | A forecast: weather expected | A warning: a hazard that is occurring or expected |
| **Where** | One airport (a point) | One airport and its immediate vicinity | An area (a polygon) inside a Flight Information Region |
| **When** | Issued about every 30-60 min | Issued about every 6 h, covering about 24-30 h | Valid for about 4-6 h, issued when the hazard exists |
| **Content** | Wind, visibility, cloud, temperature, pressure | The same elements, by time period | One hazard (thunderstorm, severe turbulence, icing, volcanic ash, tropical cyclone) with altitude bounds and movement |
| **Aimed at** | Pilots at or near that airport | Flight planning to or from that airport | Aircraft en route, at any altitude |

## What they look like

- **METAR:** `EGLL 051150Z 24012KT 9999 FEW030 15/09 Q1012`: wind 240 degrees at 12 kt, good visibility, a few clouds at 3,000 ft, 15 C, dew point 9 C, pressure 1012 hPa.
- **SIGMET:** `SEV TURB FCST WI ... FL160/300 MOV E 30KT`: severe turbulence forecast within this polygon between flight levels 160 and 300, moving east at 30 kt.

## US convective SIGMETs are not the same as international SIGMETs

The AWC site says SIGMET bulletins are "issued hourly at Hour+55" with a forecast "valid for up to 2 hours". That describes the **US convective SIGMET**, a US-only product (the `airsigmet` endpoint, which this app does not use). The global `isigmet` feed that the app uses is issued by each country's weather office whenever needed, with its own validity window: one sample entry read `VALID 050835/051235`, which is 4 hours. I believe the ICAO rule is up to 4 hours, or 6 for volcanic ash and tropical cyclones (from memory, not checked). The app never assumes a duration: it reads each advisory's own start and end times.

## Why SIGMETs fit this app

The map shows weather as areas with altitude bands, and the game asks "is this plane inside a hazard?". That needs a polygon plus a floor and a ceiling, which is exactly what a SIGMET carries. METAR and TAF are point data at airports: they answer "what is the weather at this airport", which is a different feature.

PIREPs (pilot reports) were also considered for turbulence, but the AWC covers them "primarily US and North Atlantic" only. Global SIGMETs already include plenty of turbulence.

## TAFs on the flight card (2026-10-22)

The card shows the destination's TAF, because a forecast for the airport the plane is heading to is what a pilot reads before the flight, and it's a way to learn to read one. It comes from AWC's `taf` endpoint (`?ids=EGLL&format=json`), the same free service as the SIGMETs. That endpoint already splits each TAF into decoded periods (`fcstChange`: none for the opening forecast, `FM`, `BECMG`, `TEMPO` or `PROB`, plus `probability`, wind, visibility in statute miles with "6+" for 9999 or P6SM, `wxString` and cloud layers with a `CB` type), so the app never parses the raw code. Things learned from the live feed:

- An airport with no TAF answers 200 with an empty list, not a 404; `visib` can be an empty string; the wind direction can be `"VRB"`.
- A `BECMG` period carries the full conditions after the change, not just what changes; a `TEMPO` or `PROB` period lists only what changes.
- `PROB30 TEMPO` comes as `fcstChange: "TEMPO"` with `probability: 30`; a lone `PROB30` as `fcstChange: "PROB"`.
- A TAF also carries forecast temperatures (`TX`, `TN`), which the app doesn't show.

The backend caches each airport for 30 minutes (an hour for "none") and sends at most 60 TAF requests a minute, under AWC's 100 a minute for all requests. How the periods combine and are worded is in `frontend/src/card/taf.ts`.
