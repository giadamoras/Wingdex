import threading
from collections.abc import Callable

import httpx
import pytest
from helpers import Clock

from app.providers import ProviderError, RateLimited
from app.snapshot import SnapshotCache

TTL = 100.0
BACKOFF = 30.0

START = 1_000.0


class Source:
    """A fetch function whose answers are scripted: a value, or an exception to raise."""

    def __init__(self, *script: object) -> None:
        self.script = list(script)
        self.calls = 0

    def __call__(self) -> str:
        self.calls += 1
        item = self.script.pop(0) if len(self.script) > 1 else self.script[0]
        if isinstance(item, BaseException):
            raise item
        assert isinstance(item, str)
        return item


def cache(
    source: Source, clock: Clock, may_refresh: Callable[[float], bool] | None = None
) -> SnapshotCache[str]:
    return SnapshotCache(
        "Feed",
        source,
        ttl_s=TTL,
        failure_backoff_s=BACKOFF,
        clock=clock,
        may_refresh=may_refresh,
    )


def test_a_snapshot_is_served_until_it_is_ttl_old_then_fetched_again() -> None:
    clock, source = Clock(START), Source("one", "two")
    snapshots = cache(source, clock)
    assert snapshots.get() == ("one", clock.now)
    clock.now += TTL - 1
    assert snapshots.get()[0] == "one" and source.calls == 1
    clock.now += 1  # exactly the ttl: old enough
    assert snapshots.get()[0] == "two" and source.calls == 2


def test_nothing_is_fetched_until_the_first_get() -> None:
    source = Source("one")
    snapshots = cache(source, Clock(START))
    assert snapshots.snapshot is None and source.calls == 0
    snapshots.get()
    assert snapshots.snapshot == "one"


def test_a_failed_refresh_keeps_serving_the_old_snapshot_and_waits_before_retrying() -> None:
    clock = Clock(START)
    source = Source("one", httpx.ConnectError("down"), "two")
    snapshots = cache(source, clock)
    snapshots.get()
    clock.now += TTL
    assert snapshots.get()[0] == "one"  # the refresh failed: the old one is served
    assert source.calls == 2

    clock.now += BACKOFF - 1
    assert snapshots.get()[0] == "one" and source.calls == 2  # still backing off
    clock.now += 1
    assert snapshots.get()[0] == "two" and source.calls == 3  # tried again


def test_without_a_snapshot_a_failure_raises_then_backs_off() -> None:
    clock = Clock(START)
    source = Source(httpx.ConnectError("down"), "one")
    snapshots = cache(source, clock)
    with pytest.raises(ProviderError, match="Feed unavailable: down"):
        snapshots.get()
    with pytest.raises(ProviderError, match="No Feed data yet"):
        snapshots.get()  # backing off: no new request
    assert source.calls == 1
    clock.now += BACKOFF
    assert snapshots.get()[0] == "one"


def test_a_429_waits_as_long_as_the_feed_asked() -> None:
    clock = Clock(START)
    source = Source("one", RateLimited("Feed", 300), "two")
    snapshots = cache(source, clock)
    snapshots.get()
    clock.now += TTL
    snapshots.get()  # rate limited
    clock.now += BACKOFF  # longer than the usual back-off, but not what was asked
    assert snapshots.get()[0] == "one" and source.calls == 2
    clock.now += 300 - BACKOFF
    assert snapshots.get()[0] == "two"


def test_bad_data_counts_as_a_failure_too() -> None:
    source = Source("one", ValueError("not json"), ProviderError("odd"))
    clock = Clock(START)
    snapshots = cache(source, clock)
    snapshots.get()
    clock.now += TTL
    assert snapshots.get()[0] == "one"  # ValueError: old snapshot kept
    clock.now += BACKOFF
    assert snapshots.get()[0] == "one"  # ProviderError: old snapshot kept


def test_any_other_error_is_a_bug_and_propagates_without_a_back_off() -> None:
    clock = Clock(START)
    source = Source(RuntimeError("bug"), "one")
    snapshots = cache(source, clock)
    with pytest.raises(RuntimeError):
        snapshots.get()
    assert snapshots.get()[0] == "one"  # asked again at once; the lock was released


def test_the_hook_holds_a_refresh_back_and_the_old_snapshot_is_served() -> None:
    clock, source = Clock(START), Source("one", "two")
    allowed = [True]
    asked: list[float] = []

    def may_refresh(now: float) -> bool:
        asked.append(now)
        return allowed[0]

    snapshots = cache(source, clock, may_refresh)
    snapshots.get()
    clock.now += TTL
    allowed[0] = False
    assert snapshots.get()[0] == "one" and source.calls == 1  # held back
    assert asked[-1] == clock.now
    allowed[0] = True
    assert snapshots.get()[0] == "two"  # the guard let go


def test_with_nothing_yet_a_held_back_refresh_says_so() -> None:
    snapshots = cache(Source("one"), Clock(START), lambda now: False)
    with pytest.raises(ProviderError, match="No Feed data yet"):
        snapshots.get()


def test_the_hook_is_not_asked_while_backing_off() -> None:
    clock = Clock(START)
    source = Source("one", httpx.ConnectError("down"))
    asked: list[float] = []

    def may_refresh(now: float) -> bool:
        asked.append(now)
        return True

    snapshots = cache(source, clock, may_refresh)
    snapshots.get()
    clock.now += TTL
    snapshots.get()  # fails: a back-off starts
    asked.clear()
    clock.now += BACKOFF - 1
    snapshots.get()
    assert asked == []  # the back-off check comes first, so a held-back probe is not counted


def test_callers_arriving_together_share_one_refresh() -> None:
    clock = Clock(START)
    source = Source("one")
    snapshots = cache(source, clock)
    start = threading.Barrier(8)
    got: list[str] = []

    def ask() -> None:
        start.wait()
        got.append(snapshots.get()[0])

    threads = [threading.Thread(target=ask) for _ in range(8)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert source.calls == 1 and got == ["one"] * 8


def test_reading_the_snapshot_does_not_wait_for_a_refresh_in_progress() -> None:
    clock = Clock(START)
    refreshing, release = threading.Event(), threading.Event()
    calls = []

    def slow() -> str:
        calls.append(1)
        if len(calls) == 2:
            refreshing.set()
            release.wait(timeout=5)
            return "two"
        return "one"

    snapshots: SnapshotCache[str] = SnapshotCache(
        "Feed", slow, ttl_s=TTL, failure_backoff_s=BACKOFF, clock=clock
    )
    snapshots.get()
    clock.now += TTL
    worker = threading.Thread(target=snapshots.get)
    worker.start()
    assert refreshing.wait(timeout=5)
    assert snapshots.snapshot == "one"  # the lock is held by the refresh, yet this returns
    release.set()
    worker.join()
    assert snapshots.snapshot == "two"
