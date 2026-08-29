"""Request spacing, circuit breaking, and overlap prevention.

The prior R2 export outage on this spine (2026-08-06, "DB SATURATION —
coldstore export drain") was not caused by an upstream rate limit. It was
caused by a one-minute cron re-entering a job whose real runtime was ~37
minutes, so ~37 copies ran concurrently and exhausted the connection pool.
The recorded must-fix list led with "single-flight lock so invocations cannot
overlap" and "cron interval matched to real invocation duration". `SingleFlight`
and `Deadline` below exist for that, not for YouTube.

Clocks and sleeps are injected so the whole module is testable without wall
time.
"""

import random
import threading
from typing import Any, Callable, Optional

__all__ = [
    "RateLimiter",
    "CircuitBreaker",
    "CircuitOpen",
    "SingleFlight",
    "AlreadyRunning",
    "Deadline",
    "DeadlineExceeded",
    "retry_with_backoff",
]


class CircuitOpen(RuntimeError):
    """Raised when the breaker is open and the call was not attempted."""


class AlreadyRunning(RuntimeError):
    """Raised when a second invocation tries to take a held lease."""


class DeadlineExceeded(RuntimeError):
    """Raised when an invocation outruns its wall-clock budget."""


def _monotonic() -> float:
    import time

    return time.monotonic()


def _sleep(seconds: float) -> None:
    import time

    time.sleep(seconds)


class RateLimiter:
    """Minimum-interval spacing with optional jitter.

    Spacing is enforced between *starts*, so a slow call does not earn a burst
    of fast ones behind it.
    """

    def __init__(
        self,
        min_interval: float,
        jitter: float = 0.0,
        clock: Callable[[], float] = _monotonic,
        sleeper: Callable[[float], None] = _sleep,
        rng: Optional[random.Random] = None,
    ):
        if min_interval < 0:
            raise ValueError("min_interval must be >= 0")
        if jitter < 0:
            raise ValueError("jitter must be >= 0")
        self.min_interval = float(min_interval)
        self.jitter = float(jitter)
        self._clock = clock
        self._sleeper = sleeper
        self._rng = rng or random.Random()
        self._lock = threading.Lock()
        self._next_allowed: Optional[float] = None

    def acquire(self) -> float:
        """Block until the next call is permitted. Returns seconds waited."""
        with self._lock:
            now = self._clock()
            waited = 0.0
            if self._next_allowed is not None and now < self._next_allowed:
                waited = self._next_allowed - now
            gap = self.min_interval
            if self.jitter:
                gap += self._rng.uniform(0, self.jitter)
            self._next_allowed = now + waited + gap
        if waited > 0:
            self._sleeper(waited)
        return waited


class CircuitBreaker:
    """Consecutive-failure breaker with a half-open probe.

    A tripped breaker is what keeps a quota-exhausted or soft-banned worker
    from converting one 429 into thousands of them.
    """

    CLOSED = "CLOSED"
    OPEN = "OPEN"
    HALF_OPEN = "HALF_OPEN"

    def __init__(
        self,
        failure_threshold: int = 5,
        reset_timeout: float = 300.0,
        clock: Callable[[], float] = _monotonic,
    ):
        if failure_threshold < 1:
            raise ValueError("failure_threshold must be >= 1")
        self.failure_threshold = int(failure_threshold)
        self.reset_timeout = float(reset_timeout)
        self._clock = clock
        self._lock = threading.Lock()
        self._failures = 0
        self._opened_at: Optional[float] = None
        self._state = self.CLOSED

    @property
    def state(self) -> str:
        with self._lock:
            return self._peek_state()

    def _peek_state(self) -> str:
        if self._state == self.OPEN and self._opened_at is not None:
            if self._clock() - self._opened_at >= self.reset_timeout:
                self._state = self.HALF_OPEN
        return self._state

    def call(self, fn: Callable[..., Any], *args: Any, **kwargs: Any) -> Any:
        with self._lock:
            if self._peek_state() == self.OPEN:
                raise CircuitOpen(
                    "circuit open after {0} consecutive failures".format(self._failures)
                )
        try:
            result = fn(*args, **kwargs)
        except Exception:
            self.record_failure()
            raise
        self.record_success()
        return result

    def record_success(self) -> None:
        with self._lock:
            self._failures = 0
            self._opened_at = None
            self._state = self.CLOSED

    def record_failure(self) -> None:
        with self._lock:
            self._failures += 1
            if self._failures >= self.failure_threshold:
                self._state = self.OPEN
                self._opened_at = self._clock()


class SingleFlight:
    """A leased, self-expiring run lock.

    `store` is any mapping-like object with get/set; in production it is the
    shared config table the scheduler can also see, so a crashed worker's lease
    expires instead of wedging the pipeline forever. The existing yt-rss-sweep
    function uses the same shape (`yt_rss_running`, 180s).
    """

    def __init__(
        self,
        key: str,
        lease_seconds: float = 900.0,
        store: Optional[dict] = None,
        clock: Callable[[], float] = _monotonic,
    ):
        self.key = key
        self.lease_seconds = float(lease_seconds)
        self.store = store if store is not None else {}
        self._clock = clock
        self._held = False

    def held_by_other(self) -> bool:
        held_at = self.store.get(self.key)
        if held_at is None:
            return False
        return (self._clock() - float(held_at)) < self.lease_seconds

    def __enter__(self) -> "SingleFlight":
        if self.held_by_other():
            raise AlreadyRunning(
                "{0} is already held; refusing to run concurrently".format(self.key)
            )
        self.store[self.key] = self._clock()
        self._held = True
        return self

    def __exit__(self, exc_type, exc, tb) -> bool:
        if self._held:
            self.store.pop(self.key, None)
            self._held = False
        return False


class Deadline:
    """A wall-clock budget for one invocation."""

    def __init__(self, budget_seconds: float, clock: Callable[[], float] = _monotonic):
        self.budget_seconds = float(budget_seconds)
        self._clock = clock
        self._started = clock()

    def remaining(self) -> float:
        return self.budget_seconds - (self._clock() - self._started)

    def expired(self) -> bool:
        return self.remaining() <= 0

    def check(self) -> None:
        if self.expired():
            raise DeadlineExceeded(
                "invocation exceeded its {0}s budget".format(self.budget_seconds)
            )


def retry_with_backoff(
    fn: Callable[[], Any],
    attempts: int = 4,
    base_delay: float = 2.0,
    max_delay: float = 60.0,
    retry_on: tuple = (Exception,),
    give_up_on: tuple = (),
    sleeper: Callable[[float], None] = _sleep,
    rng: Optional[random.Random] = None,
) -> Any:
    """Exponential backoff with full jitter.

    `give_up_on` is checked first so a non-retryable error (bad video id,
    captions genuinely absent) fails immediately instead of burning the budget.
    """
    if attempts < 1:
        raise ValueError("attempts must be >= 1")
    rng = rng or random.Random()
    last: Optional[BaseException] = None
    for attempt in range(attempts):
        try:
            return fn()
        except give_up_on:
            raise
        except retry_on as exc:
            last = exc
            if attempt == attempts - 1:
                break
            delay = min(max_delay, base_delay * (2 ** attempt))
            sleeper(rng.uniform(0, delay))
    assert last is not None
    raise last
