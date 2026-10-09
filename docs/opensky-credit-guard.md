# OpenSky credit guard

The live data source has a daily allowance of **4,000 credits** (standard account, checked
2026-10-04). A global `/states/all` request costs **4** credits, so refreshing every `T` seconds
costs `14,400 / T` credits an hour. The guard keeps testing and normal use well inside that.
Code: `backend/app/opensky.py`. Variables: `backend/.env.example`.

## The three settings

- **Refresh floor** (`OPENSKY_MIN_TTL_S`): the shortest allowed gap between refreshes. A shorter
  `OPENSKY_CACHE_TTL_S` is raised to it, so a bad value can't burn the quota.
- **Hourly cap** (`OPENSKY_MAX_CREDITS_PER_HOUR`): credits our requests may use in any rolling
  hour. Counted in memory, so it resets on a restart. Over the cap, refreshing pauses until older
  requests fall out of the hour.
- **Daily reserve** (`OPENSKY_CREDIT_RESERVE`): refreshing stops when OpenSky's own
  `X-Rate-Limit-Remaining` figure says fewer than this many credits are left. It survives
  restarts once one request has been made. While under the reserve, one probe request is allowed
  every 30 minutes (at most 8 credits an hour) to notice when credits have come back.

While paused, the backend keeps serving its last snapshot (planes keep moving for up to 10
minutes, then freeze). `/health` shows `guard` (`ok` or `paused (hourly cap)` /
`paused (reserve)`), `credits_remaining`, `credits_spent_last_hour` and `age_s` (seconds
since the served snapshot was fetched; null before the first one).

## Presets

| | Cautious | **Normal (current default)** | Risky |
|---|---|---|---|
| Refresh floor (`OPENSKY_MIN_TTL_S`) | 120 s | **60 s** | 30 s |
| Usual refresh (`OPENSKY_CACHE_TTL_S`) | 120 s | **90 s** | 45 s |
| Normal spend per hour | 120 | **160** | 320 |
| Hourly cap (`OPENSKY_MAX_CREDITS_PER_HOUR`) | 150 | **200** | 400 |
| Daily reserve (`OPENSKY_CREDIT_RESERVE`) | 1,000 | **400** | 100 |
| 10 h of use | ~1,200 credits | **~1,600** | ~3,200 |
| Left at the end of the day | ~2,800 | **~2,400** | ~800 |

- **Cautious:** the stalest motion, the most protection.
- **Normal:** covers a 10-hour day with a comfortable margin. The hourly cap sits just above
  normal spend (160), so it never trips in normal use but catches a runaway loop quickly.
- **Risky:** fresher planes, but the 400-an-hour cap can reach the whole 4,000 in 10 hours.

To switch preset, set the four variables in `backend/.env` to the column's values. Changing the
defaults in code means editing the `DEFAULT_*` constants in `opensky.py` and this table.

## Notes and unknowns

- Not known: whether OpenSky resets the allowance at midnight or over a rolling 24 hours (its
  docs only say "daily"), so the reserve is a rough safety margin either way.
- The cost per request depends on the area asked for: 1 credit up to 25 sq°, 2 up to 100, 3 up
  to 400, 4 above that or for the whole world (`request_cost`).
- Don't run the backend with `--reload` in live mode: each restart empties the cache and spends
  credits again, and resets the hourly count.
- Each backend instance has its own cache and count. Run one instance, or the guard is per
  instance.
