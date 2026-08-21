"""Subtitle ingestion: path resolution, error classification, zero footprint.

www.youtube.com is not reachable from CI, so yt-dlp is injected as a fake.
The fake reproduces the behaviour that actually breaks callers: writing the
caption file under a language tag that is not the one requested.
"""

import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from youtube_transcripts.extractor import (  # noqa: E402
    NoCaptionsAvailable,
    SubtitleDownloadError,
    SubtitleExtractor,
    resolve_subtitle_path,
    watch_url,
)
from youtube_transcripts.ratelimit import CircuitBreaker, RateLimiter  # noqa: E402

VTT = "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nMacro liquidity is expanding\n"


class FakeYDL(object):
    """Stands in for yt_dlp.YoutubeDL."""

    def __init__(self, opts, written_tag="en", raises=None, video_id="vid1",
                 report_filepath=True, recorder=None):
        self.opts = opts
        self.written_tag = written_tag
        self.raises = raises
        self.video_id = video_id
        self.report_filepath = report_filepath
        if recorder is not None:
            recorder.append(self)

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    @property
    def outdir(self):
        return self.opts["paths"]["home"]

    def extract_info(self, url, download=True):
        if self.raises:
            raise self.raises
        info = {"id": self.video_id, "title": "Macro update",
                "channel_id": "UCabc", "subtitles": {},
                "automatic_captions": {self.written_tag: [{"ext": "vtt"}]}}
        if self.written_tag is None:
            return info
        path = os.path.join(
            self.outdir, "{0}.{1}.vtt".format(self.video_id, self.written_tag)
        )
        with open(path, "w", encoding="utf-8") as handle:
            handle.write(VTT)
        if self.report_filepath:
            info["requested_subtitles"] = {self.written_tag: {"filepath": path}}
        return info


def extractor(**fake_kwargs):
    recorder = fake_kwargs.pop("recorder", None)
    return (
        SubtitleExtractor(
            lang="en",
            rate_limiter=RateLimiter(min_interval=0, sleeper=lambda s: None),
            breaker=CircuitBreaker(failure_threshold=99),
            ydl_factory=lambda opts: FakeYDL(opts, recorder=recorder, **fake_kwargs),
        ),
        recorder,
    )


class TestWatchUrl(unittest.TestCase):
    def test_bare_id_becomes_a_watch_url(self):
        self.assertEqual(
            watch_url("dQw4w9WgXcQ"), "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        )

    def test_existing_url_passes_through(self):
        self.assertEqual(watch_url("https://youtu.be/abc"), "https://youtu.be/abc")

    def test_blank_is_refused(self):
        for bad in ("", "   ", None):
            with self.assertRaises(ValueError):
                watch_url(bad)


class TestPathResolution(unittest.TestCase):
    """The guessed filename "<id>.en.vtt" is the classic miss."""

    def setUp(self):
        self.dir = tempfile.mkdtemp()

    def test_exact_language_tag(self):
        path = os.path.join(self.dir, "vid1.en.vtt")
        open(path, "w").close()
        self.assertEqual(resolve_subtitle_path(self.dir, "vid1", "en", {}), path)

    def test_regional_variant_is_found_by_glob(self):
        for tag in ("en-orig", "en-US", "en-GB"):
            directory = tempfile.mkdtemp()
            path = os.path.join(directory, "vid1.{0}.vtt".format(tag))
            open(path, "w").close()
            self.assertEqual(
                resolve_subtitle_path(directory, "vid1", "en", {}), path, tag
            )

    def test_info_dict_filepath_wins(self):
        path = os.path.join(self.dir, "vid1.en-orig.vtt")
        open(path, "w").close()
        info = {"requested_subtitles": {"en-orig": {"filepath": path}}}
        self.assertEqual(resolve_subtitle_path(self.dir, "vid1", "en", info), path)

    def test_stale_info_path_falls_back_to_disk(self):
        real = os.path.join(self.dir, "vid1.en.vtt")
        open(real, "w").close()
        info = {"requested_subtitles": {"en": {"filepath": "/nonexistent/gone.vtt"}}}
        self.assertEqual(resolve_subtitle_path(self.dir, "vid1", "en", info), real)

    def test_nothing_written_returns_none(self):
        self.assertIsNone(resolve_subtitle_path(self.dir, "vid1", "en", {}))


class TestOptions(unittest.TestCase):
    def test_never_requests_a_media_stream(self):
        options = SubtitleExtractor().build_options("/tmp/out")
        self.assertTrue(options["skip_download"])
        self.assertNotIn("format", options)
        self.assertEqual(options["subtitlesformat"], "vtt")

    def test_requests_manual_and_automatic_captions(self):
        options = SubtitleExtractor().build_options("/tmp/out")
        self.assertTrue(options["writesubtitles"])
        self.assertTrue(options["writeautomaticsub"])

    def test_language_list_covers_regional_variants(self):
        options = SubtitleExtractor(lang="en").build_options("/tmp/out")
        self.assertIn("en", options["subtitleslangs"])
        self.assertIn("en.*", options["subtitleslangs"])


class TestFetch(unittest.TestCase):
    def test_returns_caption_text(self):
        extract, _ = extractor()
        raw, info = extract.fetch("vid1")
        self.assertIn("Macro liquidity is expanding", raw)
        self.assertEqual(info["id"], "vid1")

    def test_finds_captions_written_under_a_variant_tag(self):
        """yt-dlp writes .en-orig.vtt; a hardcoded .en.vtt guess reports
        'no captions' for a video that has them."""
        for tag in ("en-orig", "en-US"):
            extract, _ = extractor(written_tag=tag, report_filepath=False)
            raw, _ = extract.fetch("vid1")
            self.assertIn("Macro liquidity", raw, tag)

    def test_no_caption_track_raises_the_permanent_error(self):
        extract, _ = extractor(written_tag=None)
        with self.assertRaises(NoCaptionsAvailable):
            extract.fetch("vid1")

    def test_temp_directory_is_purged(self):
        """Zero footprint: nothing survives the call."""
        recorder = []
        extract, _ = extractor(recorder=recorder)
        extract.fetch("vid1")
        self.assertTrue(recorder)
        self.assertFalse(
            os.path.exists(recorder[0].outdir), "temp artifacts must be purged"
        )

    def test_temp_directory_is_purged_even_when_the_fetch_fails(self):
        recorder = []
        extract, _ = extractor(written_tag=None, recorder=recorder)
        with self.assertRaises(NoCaptionsAvailable):
            extract.fetch("vid1")
        self.assertFalse(os.path.exists(recorder[0].outdir))


class TestErrorClassification(unittest.TestCase):
    def test_permanent_conditions_are_not_retryable(self):
        for message in ("ERROR: Video unavailable", "Private video",
                        "This video has been removed", "members-only content",
                        "Sign in to confirm your age: age-restricted"):
            extract, _ = extractor(raises=Exception(message))
            with self.assertRaises(NoCaptionsAvailable, msg=message):
                extract.fetch("vid1")

    def test_transient_conditions_are_retryable(self):
        for message in ("HTTP Error 429: Too Many Requests",
                        "Unable to connect to proxy",
                        "The read operation timed out"):
            extract, _ = extractor(raises=Exception(message))
            with self.assertRaises(SubtitleDownloadError, msg=message):
                extract.fetch("vid1")

    def test_breaker_opens_after_repeated_transport_failures(self):
        from youtube_transcripts.ratelimit import CircuitOpen

        extract = SubtitleExtractor(
            lang="en",
            rate_limiter=RateLimiter(min_interval=0, sleeper=lambda s: None),
            breaker=CircuitBreaker(failure_threshold=2, reset_timeout=600),
            ydl_factory=lambda opts: FakeYDL(opts, raises=Exception("timed out")),
        )
        for _ in range(2):
            with self.assertRaises(SubtitleDownloadError):
                extract.fetch("vid1")
        with self.assertRaises(CircuitOpen):
            extract.fetch("vid1")

    def test_available_languages_lists_both_sources(self):
        extract, _ = extractor()
        info = {"subtitles": {"en": []}, "automatic_captions": {"es": [], "en": []}}
        self.assertEqual(extract.available_languages(info), ["en", "es"])


class TestRateLimiting(unittest.TestCase):
    def test_spacing_is_applied_before_each_fetch(self):
        waits = []
        clock = {"t": 0.0}
        extract = SubtitleExtractor(
            lang="en",
            rate_limiter=RateLimiter(
                min_interval=2.0, clock=lambda: clock["t"], sleeper=waits.append
            ),
            breaker=CircuitBreaker(failure_threshold=99),
            ydl_factory=lambda opts: FakeYDL(opts),
        )
        extract.fetch("vid1")
        extract.fetch("vid1")
        self.assertEqual(len(waits), 1)
        self.assertAlmostEqual(waits[0], 2.0)


if __name__ == "__main__":
    unittest.main()
