# Airspace Explorer

A kawaii "spot & collect" game built on flight traffic. Watch planes cross a world map, tap one
to open its flight passport, and catch it for your collection. It runs on mock data out of the box;
live flights are optional (see the data terms below).

![Airspace Explorer: a world map with a flight passport open](docs/images/screenshot.png)

- **Spot.** Planes move across the world map. Tap one for its route, type, altitude, speed and a
  "Did you know?" fact. Weather hazards (storms, turbulence, icing, volcanic ash) are drawn on the map.
- **Catch.** Catch one plane a day into your Journal, and replay its journey from the card.
- **Quests.** A daily quest ("catch a flight in a tropical cyclone area") with a short lesson when you complete it.
- **Badges.** Collect badges as your Journal grows.

Status: the app runs locally with mock or live data. Deployment is postponed: live OpenSky data
needs a written agreement for public use (see the data terms below), and hosting costs money.
`docs/plan.md` has the scope and roadmap, and `docs/history.md` how it was built.

- `backend/` — Python + FastAPI (flight and weather data API)
- `frontend/` — React + TypeScript + Vite. `src/` is grouped by feature (`map/`, `card/`, `collection/`,
  `quest/`, `onboarding/`, `data/`), with `shared-ui/` and `shared-lib/` for what several features use,
  and `styles/` for the stylesheets (`index.css` lists them in cascade order). Tests sit next to the code
  they test.

## Setup

```powershell
# backend (Python 3.11+)
cd backend
py -3.13 -m venv .venv
.venv\Scripts\python -m pip install -e ".[dev]"

# frontend (Node 20+)
cd frontend
npm install
```

## Run (two terminals)

```powershell
cd backend;  .venv\Scripts\uvicorn app.main:app --reload   # http://localhost:8000/health
cd frontend; npm run dev                                   # http://localhost:5173
```

The backend serves mock flights and weather by default, spread over the whole world, so the app
works without any account.

When the frontend and backend are hosted apart, set `VITE_API_URL` for the frontend (the backend's
URL) and `CORS_ORIGINS` for the backend (the frontend's URL). See `backend/.env.example`.

### Testing on a phone

<p align="center">
  <img src="docs/images/demo-mobile.gif" alt="Airspace Explorer on a phone: the mascot guides a first catch" width="280">
</p>

To open the app from a phone on the same Wi-Fi, bind both servers to the network and replace
`<pc-ip>` with your computer's address. Allow Python and Node through Windows Firewall (private
networks) the first time.

```powershell
cd backend;  $env:CORS_ORIGINS="http://<pc-ip>:5173"; .venv\Scripts\uvicorn app.main:app --host 0.0.0.0
cd frontend; $env:VITE_API_URL="http://<pc-ip>:8000"; npm run dev -- --host   # open http://<pc-ip>:5173
```

For live data, add `--env-file .env` to the backend command as described below.

### Live flights (optional)

OpenSky's terms limit how its API may be used (see "Data sources and terms" below). To use real
OpenSky traffic, create an API client on your own OpenSky account, copy
`backend/.env.example` to `backend/.env`, set `FLIGHT_SOURCE=opensky` and your credentials, then
start the backend with the env file:

```powershell
cd backend; .venv\Scripts\uvicorn app.main:app --env-file .env
```

A `FLIGHT_SOURCE` or `WEATHER_SOURCE` already set in your terminal wins over `.env`, and the
backend then quietly serves mock data. Check `/health`: it should say `opensky` (or `awc`).

Don't add `--reload` in live mode: every restart refetches and spends credits.

`/health` shows the active source and, for live data, the credit guard's state and remaining
credits. Live data is cached for 90 s, so the daily credits (4,000, 4 per global request) are
only spent while someone is using the app, and a guard pauses refreshing if spending runs high.
Presets and settings: `docs/opensky-credit-guard.md`.

### Live weather (optional)

Weather is mock by default. For real advisories from the Aviation Weather Center (free, no key),
set `WEATHER_SOURCE=awc` in `backend/.env` and start the backend the same way. It is independent
of `FLIGHT_SOURCE`. Why this source: `docs/aviation-weather-products.md`.

Live flights get their aircraft type from a bundled file built from OpenSky's aircraft database
(`docs/opensky-aircraft-database.md`, which also holds the citation OpenSky asks for), and their
route when you tap one, looked up from [adsbdb](https://github.com/mrjackwills/adsbdb) by the
backend (`GET /flights/{id}/route`). Both can be missing, and the card then hides what it doesn't
know.

## Known limits

- **One tab at a time.** The Journal is kept in your browser's local storage, and each tab saves
  its whole copy. Catches made in two tabs at once overwrite each other (the last tab to save
  wins), and a tab doesn't see the other's catches until it is reloaded.
- **Phones and live data.** The live feed is about 3 MB, so a weak connection makes the first load
  slow. Touch screens draw at most 300 planes in view (800 on desktop) and drop the planes' shadow,
  because an iPhone 13 crashed Safari with more. Zoomed out, or in a very busy area, some planes
  are hidden: zoom in to see them.

## Checks

```powershell
# backend (from backend/)
.venv\Scripts\python -m pytest
.venv\Scripts\ruff check .; .venv\Scripts\ruff format --check .
.venv\Scripts\mypy app tests

# frontend (from frontend/)
npm run typecheck; npm run lint; npm test; npm run format:check; npm run build
```

The frontend lints with [oxlint](https://oxc.rs) (not ESLint). `frontend/scripts/build-land.mjs`
and `build-countries.mjs` are one-off generators for the map data in `src/`; they are not part of
the build.

## Data sources and terms

The licence below covers this project's code only. Each data source stays under its own terms,
and the app is meant as a free, non-commercial personal project.

| Source                                                 | Used for                                          | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [OpenSky Network](https://opensky-network.org)         | Live flights, and the aircraft type of each plane | Needs your own account. The terms license the data only for non-profit research and education, and say the REST API "is provided for non-profit research and educational use only": operational use in a live product, service or automated system needs a written licence from OpenSky. The app ships no credentials and defaults to mock data. The bundled aircraft-type file comes from OpenSky's aircraft database, which it calls "unlicensed" and offered "as is". If you use OpenSky data in a publication, it asks you to cite Schäfer et al., "Bringing Up OpenSky", IPSN 2014 (`docs/opensky-aircraft-database.md`). |
| [adsbdb](https://github.com/mrjackwills/adsbdb)        | The route of a plane you tap                      | Its route data may not be copied or put into other databases, so the backend keeps it in memory only and never writes it to disk.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [Aviation Weather Center](https://aviationweather.gov) | Live weather advisories                           | A US government service. The backend sends its own User-Agent and stays well under the 100 requests a minute limit.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| [Natural Earth](https://www.naturalearthdata.com)      | The land outline and country shapes               | Public domain.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Fredoka and Nunito                                     | Fonts, through `@fontsource`                      | SIL Open Font License 1.1.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

Live OpenSky mode is optional and entirely your responsibility: read
[OpenSky's terms](https://opensky-network.org/about/terms-of-use) first, and do not run a public
deployment on live data without their written licence. Check each source's terms before anything beyond
personal use.

## Licence

[MIT](LICENSE). That covers the code, not the data above.
