"""The last good snapshot of a slow, rate-limited feed (OpenSky, AWC), and when to refresh it."""

import logging
import threading
import time
from collections.abc import Callable
from typing import Generic, TypeVar

import httpx

from app.providers import ProviderError, RateLimited

log = logging.getLogger(__name__)

T = TypeVar("T")


class SnapshotCache(Generic[T]):
    """Fetches a snapshot, serves it until it is `ttl_s` old, then fetches again.

    - One refresh at a time: callers arriving meanwhile wait, then share its result.
    - A failed refresh keeps serving the old snapshot and is not retried before a
      back-off has passed (the wait a 429 asked for, else `failure_backoff_s`). It only
      raises when there is no snapshot at all.
    - `may_refresh(now)` lets the owner hold a refresh back (OpenSky's credit guard);
      the old snapshot is served meanwhile. It is asked after the back-off check.
    """

    def __init__(
        self,
        name: str,  # for messages: "OpenSky", "AWC"
        fetch: Callable[[], T],
        *,
        ttl_s: float,
        failure_backoff_s: float,
        clock: Callable[[], float] = time.time,
        may_refresh: Callable[[float], bool] | None = None,
    ) -> None:
        self._name = name
        self._fetch = fetch
        self._ttl = ttl_s
        self._failure_backoff = failure_backoff_s
        self._clock = clock
        self._may_refresh = may_refresh
        self._lock = threading.Lock()  # one refresh at a time, however many requests wait
        self._snapshot: T | None = None
        self._fetched_at = 0.0
        self._next_attempt = 0.0  # no request before this time (backoff after a failure)

    @property
    def snapshot(self) -> T | None:
        """The current snapshot, read without the lock so a reader never waits for a refresh."""
        return self._snapshot

    @property
    def fetched_at(self) -> float:
        return self._fetched_at

    def get(self) -> tuple[T, float]:
        """The snapshot (refreshed first if it is old) and the time it was served at."""
        with self._lock:
            now = self._clock()
            if self._snapshot is None or now - self._fetched_at >= self._ttl:
                self._refresh(now)
            if self._snapshot is None:
                raise ProviderError(f"No {self._name} data yet")
            return self._snapshot, now

    def _refresh(self, now: float) -> None:
        """Fetch a new snapshot; on failure keep serving the old one (if there is one)."""
        if now < self._next_attempt:
            return
        if self._may_refresh is not None and not self._may_refresh(now):
            return  # held back: keep serving the last snapshot
        try:
            self._snapshot = self._fetch()
            self._fetched_at = now
        except (httpx.HTTPError, ProviderError, ValueError) as error:
            backoff = error.retry_after if isinstance(error, RateLimited) else self._failure_backoff
            self._next_attempt = now + backoff
            log.warning("%s request failed (%s); retrying in %.0fs", self._name, error, backoff)
            if self._snapshot is None:
                raise ProviderError(f"{self._name} unavailable: {error}") from error
