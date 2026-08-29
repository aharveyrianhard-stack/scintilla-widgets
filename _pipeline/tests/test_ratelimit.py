"""Request spacing, breaker, single-flight, deadline, backoff.

Every clock and sleep is injected: the suite asserts on scheduling decisions
without spending wall time.
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from youtube_transcripts.ratelimit import (  # noqa: E402
    AlreadyRunning,
    CircuitBreaker,
    CircuitOpen,
    Deadline,
    DeadlineExceeded,
    RateLimiter,
    SingleFlight,
    retry_with_backoff,
)


class Clock(object):
    def __init__(self, now=0.0):
        self.now = now

    def __call__(self):
        return self.now

    def advance(self, seconds):
        self.now += seconds


class TestRateLimiter(unittest.TestCase):
    def setUp(self):
        self.clock = Clock()
        self.slept = []

    def limiter(self, interval=1.0, jitter=0.0):
        return RateLimiter(
            min_interval=interval,
            jitter=jitter,
            clock=self.clock,
            sleeper=self.slept.append,
        )

    def test_first_call_is_immediate(self):
        self.assertEqual(self.limiter().acquire(), 0.0)
        self.assertEqual(self.slept, [])

    def test_second_call_waits_the_remaining_interval(self):
        limiter = self.limiter(interval=1.0)
        limiter.acquire()
        self.clock.advance(0.25)
        self.assertAlmostEqual(limiter.acquire(), 0.75)
        self.assertAlmostEqual(self.slept[0], 0.75)

    def test_no_wait_once_the_interval_has_elapsed(self):
        limiter = self.limiter(interval=1.0)
        limiter.acquire()
        self.clock.advance(5.0)
        self.assertEqual(limiter.acquire(), 0.0)

    def test_idle_time_is_not_banked_as_burst_credit(self):
        """Spacing is between starts, so idle time buys exactly one free call.

        A worker parked behind a slow download must not come back and fire a
        run of requests to "catch up" -- that is the shape that gets an IP
        soft-banned.
        """
        limiter = self.limiter(interval=2.0)
        limiter.acquire()
        self.clock.advance(30.0)
        self.assertEqual(limiter.acquire(), 0.0, "one call after a long idle is free")
        self.assertAlmostEqual(
            limiter.acquire(), 2.0, msg="the next still pays the full interval"
        )

    def test_zero_interval_never_waits(self):
        limiter = self.limiter(interval=0.0)
        for _ in range(10):
            self.assertEqual(limiter.acquire(), 0.0)

    def test_rejects_negative_configuration(self):
        with self.assertRaises(ValueError):
            RateLimiter(min_interval=-1)
        with self.assertRaises(ValueError):
            RateLimiter(min_interval=1, jitter=-1)


class TestCircuitBreaker(unittest.TestCase):
    def setUp(self):
        self.clock = Clock()
        self.breaker = CircuitBreaker(
            failure_threshold=3, reset_timeout=60, clock=self.clock
        )

    def boom(self):
        raise ValueError("upstream said no")

    def test_closed_while_under_threshold(self):
        for _ in range(2):
            with self.assertRaises(ValueError):
                self.breaker.call(self.boom)
        self.assertEqual(self.breaker.state, CircuitBreaker.CLOSED)

    def test_opens_at_threshold_and_stops_calling(self):
        for _ in range(3):
            with self.assertRaises(ValueError):
                self.breaker.call(self.boom)
        self.assertEqual(self.breaker.state, CircuitBreaker.OPEN)

        called = []
        with self.assertRaises(CircuitOpen):
            self.breaker.call(lambda: called.append(1))
        self.assertEqual(called, [], "open breaker must not invoke the callable")

    def test_success_resets_the_failure_run(self):
        for _ in range(2):
            with self.assertRaises(ValueError):
                self.breaker.call(self.boom)
        self.breaker.call(lambda: "ok")
        with self.assertRaises(ValueError):
            self.breaker.call(self.boom)
        self.assertEqual(self.breaker.state, CircuitBreaker.CLOSED)

    def test_half_opens_after_cooldown_then_closes_on_success(self):
        for _ in range(3):
            with self.assertRaises(ValueError):
                self.breaker.call(self.boom)
        self.clock.advance(60)
        self.assertEqual(self.breaker.state, CircuitBreaker.HALF_OPEN)
        self.assertEqual(self.breaker.call(lambda: "recovered"), "recovered")
        self.assertEqual(self.breaker.state, CircuitBreaker.CLOSED)

    def test_half_open_probe_failure_reopens(self):
        for _ in range(3):
            with self.assertRaises(ValueError):
                self.breaker.call(self.boom)
        self.clock.advance(60)
        with self.assertRaises(ValueError):
            self.breaker.call(self.boom)
        self.assertEqual(self.breaker.state, CircuitBreaker.OPEN)

    def test_rejects_bad_threshold(self):
        with self.assertRaises(ValueError):
            CircuitBreaker(failure_threshold=0)


class TestSingleFlight(unittest.TestCase):
    """Overlap prevention: must-fix #1 from the 2026-08-06 saturation incident."""

    def setUp(self):
        self.clock = Clock()
        self.store = {}

    def lease(self, seconds=900.0):
        return SingleFlight(
            "extraction", lease_seconds=seconds, store=self.store, clock=self.clock
        )

    def test_second_invocation_is_refused(self):
        with self.lease():
            with self.assertRaises(AlreadyRunning):
                with self.lease():
                    self.fail("a second invocation must not start")

    def test_lease_is_released_on_exit(self):
        with self.lease():
            pass
        with self.lease():
            pass

    def test_lease_is_released_even_when_the_body_raises(self):
        with self.assertRaises(RuntimeError):
            with self.lease():
                raise RuntimeError("worker died mid-run")
        self.assertEqual(self.store, {}, "a crash must not wedge the lease")

    def test_expired_lease_from_a_dead_worker_is_reclaimed(self):
        """A killed worker leaves a stale key; the TTL must free it."""
        self.store["extraction"] = self.clock()
        self.clock.advance(901)
        with self.lease(seconds=900):
            pass

    def test_unexpired_lease_from_another_worker_blocks(self):
        self.store["extraction"] = self.clock()
        self.clock.advance(100)
        with self.assertRaises(AlreadyRunning):
            with self.lease(seconds=900):
                self.fail("must not run while another lease is live")


class TestDeadline(unittest.TestCase):
    def test_reports_remaining_budget(self):
        clock = Clock()
        deadline = Deadline(100, clock=clock)
        clock.advance(30)
        self.assertAlmostEqual(deadline.remaining(), 70)
        self.assertFalse(deadline.expired())

    def test_expires_and_raises(self):
        clock = Clock()
        deadline = Deadline(10, clock=clock)
        clock.advance(11)
        self.assertTrue(deadline.expired())
        with self.assertRaises(DeadlineExceeded):
            deadline.check()


class TestBackoff(unittest.TestCase):
    def test_returns_first_success(self):
        self.assertEqual(retry_with_backoff(lambda: 42, sleeper=lambda s: None), 42)

    def test_retries_then_succeeds(self):
        state = {"n": 0}

        def flaky():
            state["n"] += 1
            if state["n"] < 3:
                raise ValueError("not yet")
            return "ok"

        self.assertEqual(
            retry_with_backoff(flaky, attempts=5, sleeper=lambda s: None), "ok"
        )
        self.assertEqual(state["n"], 3)

    def test_gives_up_and_reraises(self):
        state = {"n": 0}

        def always():
            state["n"] += 1
            raise ValueError("permanent")

        with self.assertRaises(ValueError):
            retry_with_backoff(always, attempts=3, sleeper=lambda s: None)
        self.assertEqual(state["n"], 3)

    def test_non_retryable_fails_immediately(self):
        state = {"n": 0}

        def hopeless():
            state["n"] += 1
            raise KeyError("no such video")

        with self.assertRaises(KeyError):
            retry_with_backoff(
                hopeless,
                attempts=5,
                retry_on=(ValueError,),
                give_up_on=(KeyError,),
                sleeper=lambda s: None,
            )
        self.assertEqual(state["n"], 1, "a permanent error must not be retried")

    def test_delays_grow_and_are_capped(self):
        delays = []

        def always():
            raise ValueError("x")

        class MaxRandom(object):
            def uniform(self, low, high):
                return high

        with self.assertRaises(ValueError):
            retry_with_backoff(
                always,
                attempts=6,
                base_delay=2.0,
                max_delay=10.0,
                sleeper=delays.append,
                rng=MaxRandom(),
            )
        self.assertEqual(delays, [2.0, 4.0, 8.0, 10.0, 10.0])


if __name__ == "__main__":
    unittest.main()
