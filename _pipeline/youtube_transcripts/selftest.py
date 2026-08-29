"""Autonomous capability checks and the self-validation suite.

The suite is fully offline. yt_dlp and boto3 are reported when present but
never required, so a sandbox with no network and no third-party packages still
gets a real pass/fail rather than a skipped run.
"""

import os
import sys
import unittest
from typing import Dict, Tuple

__all__ = ["dependency_report", "run_capability_checks", "load_suite"]

OPTIONAL_DEPENDENCIES = {
    "yt_dlp": ("yt-dlp", "live caption ingestion"),
    "boto3": ("boto3", "R2 cold-bucket uploads"),
    "psycopg2": ("psycopg2-binary", "isolated staging writes"),
}

_TESTS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "tests")


def dependency_report() -> Dict[str, Tuple[bool, str]]:
    """Which optional runtime dependencies are installed, and what they gate."""
    report = {}
    for module, (package, purpose) in OPTIONAL_DEPENDENCIES.items():
        try:
            __import__(module)
            report[package] = (True, purpose)
        except ImportError:
            report[package] = (False, purpose)
    return report


def load_suite() -> unittest.TestSuite:
    """Discover the offline unit suite."""
    root = os.path.dirname(_TESTS_DIR)
    if root not in sys.path:
        sys.path.insert(0, root)
    return unittest.TestLoader().discover(
        start_dir=_TESTS_DIR, pattern="test_*.py", top_level_dir=root
    )


def run_capability_checks(verbosity: int = 2) -> bool:
    """Report the environment, then run every unit test. True if all passed."""
    print("\n--- [START] Autonomous Capability & Self-Validation Checks ---")

    print("\n1. Environment:")
    print("   - python: {0}".format(sys.version.split()[0]))
    for package, (installed, purpose) in sorted(dependency_report().items()):
        state = "INSTALLED" if installed else "MISSING"
        note = "" if installed else " (offline tests still run)"
        print("   - {0}: {1} — needed for {2}{3}".format(package, state, purpose, note))

    print("\n2. Self-validation unit suite:")
    result = unittest.TextTestRunner(verbosity=verbosity).run(load_suite())

    passed = result.wasSuccessful()
    print(
        "\n   ran {0} · failures {1} · errors {2}".format(
            result.testsRun, len(result.failures), len(result.errors)
        )
    )
    print(
        "\n--- [RESULT] Autonomous Self-Validation: {0} ---\n".format(
            "SUCCESS" if passed else "FAILED"
        )
    )
    return passed
