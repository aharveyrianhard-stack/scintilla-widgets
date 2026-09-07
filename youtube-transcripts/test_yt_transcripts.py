"""Offline proof of the extraction logic.

Runs without touching YouTube: URL parsing is pure, and the fetch path is
exercised against a stand-in for YouTubeTranscriptApi that returns real
FetchedTranscript objects, so the library's TextFormatter (timestamp stripping)
is the genuine article. Run with:

    python3 -m unittest -v test_yt_transcripts
"""
import contextlib
import io
import json
import unittest

from youtube_transcript_api import (
    FetchedTranscript,
    FetchedTranscriptSnippet,
    IpBlocked,
    NoTranscriptFound,
    TranscriptList,
    TranscriptsDisabled,
)

import yt_transcripts as yt

VIDEO = "dQw4w9WgXcQ"
SHORT = "abcDEF12345"


def fetched(video_id, words, language_code="en", is_generated=False):
    snippets = [
        FetchedTranscriptSnippet(text=w, start=float(i), duration=1.0)
        for i, w in enumerate(words)
    ]
    return FetchedTranscript(
        snippets=snippets,
        video_id=video_id,
        language="English",
        language_code=language_code,
        is_generated=is_generated,
    )


class FakeApi:
    """Same fetch()/list() surface as YouTubeTranscriptApi, no network."""

    def __init__(self, outcomes):
        self.outcomes = outcomes
        self.calls = []

    def fetch(self, video_id, languages=("en",), preserve_formatting=False):
        self.calls.append(("fetch", video_id, tuple(languages)))
        outcome = self.outcomes[video_id]
        if isinstance(outcome, Exception):
            raise outcome
        return outcome

    def list(self, video_id):
        self.calls.append(("list", video_id))
        outcome = self.outcomes[("list", video_id)]
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


class ListedStub:
    """A transcript as yielded by TranscriptList — only fetch() matters here."""

    def __init__(self, transcript):
        self.transcript = transcript

    def fetch(self):
        return self.transcript


class ExtractVideoId(unittest.TestCase):
    def test_every_url_shape_resolves_to_the_same_id(self):
        cases = [
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "https://youtube.com/watch?v=dQw4w9WgXcQ&t=43s",
            "https://www.youtube.com/watch?feature=share&v=dQw4w9WgXcQ&list=PLx",
            "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
            "https://music.youtube.com/watch?v=dQw4w9WgXcQ",
            "https://www.youtube.com/shorts/dQw4w9WgXcQ",
            "https://youtube.com/shorts/dQw4w9WgXcQ?feature=share",
            "https://m.youtube.com/shorts/dQw4w9WgXcQ",
            "https://youtu.be/dQw4w9WgXcQ",
            "https://youtu.be/dQw4w9WgXcQ?si=XyZ123",
            "https://www.youtube.com/embed/dQw4w9WgXcQ",
            "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
            "https://www.youtube.com/live/dQw4w9WgXcQ",
            "www.youtube.com/watch?v=dQw4w9WgXcQ",
            "youtube.com/shorts/dQw4w9WgXcQ",
            "  https://www.youtube.com/shorts/dQw4w9WgXcQ \n",
            "dQw4w9WgXcQ",
        ]
        for url in cases:
            with self.subTest(url=url):
                self.assertEqual(yt.extract_video_id(url), VIDEO)

    def test_rejects_things_that_are_not_video_urls(self):
        bad = [
            "",
            "   ",
            "https://www.youtube.com/",
            "https://www.youtube.com/@somechannel",
            "https://www.youtube.com/watch?v=tooshort",
            "https://www.youtube.com/playlist?list=PLabc",
            "https://vimeo.com/12345",
            "https://notyoutube.com/watch?v=dQw4w9WgXcQ",
        ]
        for url in bad:
            with self.subTest(url=url), self.assertRaises(ValueError):
                yt.extract_video_id(url)

    def test_kind_label(self):
        self.assertEqual(yt.url_kind("https://www.youtube.com/shorts/x"), "short")
        self.assertEqual(yt.url_kind("https://www.youtube.com/watch?v=x"), "video")
        self.assertEqual(yt.url_kind("https://youtu.be/x"), "video")


class ExtractPipeline(unittest.TestCase):
    def test_video_and_short_both_yield_clean_text(self):
        words = [f"word{i}" for i in range(200)]
        api = FakeApi({
            VIDEO: fetched(VIDEO, words),
            SHORT: fetched(SHORT, words, is_generated=True),
        })
        results = yt.extract_all(
            [f"https://www.youtube.com/watch?v={VIDEO}",
             f"https://www.youtube.com/shorts/{SHORT}"],
            api=api,
        )
        self.assertEqual([r.ok for r in results], [True, True])
        self.assertEqual([r.kind for r in results], ["video", "short"])
        self.assertEqual([r.video_id for r in results], [VIDEO, SHORT])
        for r in results:
            self.assertEqual(r.text, "\n".join(words))   # TextFormatter: text only
            self.assertNotRegex(r.text, r"\d+\.\d+")       # no start/duration leaked
            self.assertEqual(len(r.preview), 500)
            self.assertEqual(r.snippets, 200)
            self.assertEqual(r.language, "en")
        self.assertFalse(results[0].is_generated)
        self.assertTrue(results[1].is_generated)

    def test_disabled_captions_are_reported_not_raised(self):
        api = FakeApi({VIDEO: TranscriptsDisabled(VIDEO)})
        [r] = yt.extract_all([f"https://youtu.be/{VIDEO}"], api=api)
        self.assertFalse(r.ok)
        self.assertEqual(r.text, "")
        self.assertIn("no captions", r.error)

    def test_bot_check_falls_back_to_ytdlp(self):
        api = FakeApi({VIDEO: IpBlocked(VIDEO)})
        calls = []

        def fallback(video_id):
            calls.append(video_id)
            return fetched(video_id, ["via", "yt-dlp"], is_generated=True)

        [r] = yt.extract_all([VIDEO], api=api, fallback=fallback)
        self.assertTrue(r.ok)
        self.assertEqual(r.text, "via\nyt-dlp")
        self.assertEqual(r.backend, "yt-dlp")
        self.assertEqual(r.error, "")
        self.assertEqual(calls, [VIDEO])

    def test_ip_block_is_named_when_the_fallback_fails_too(self):
        api = FakeApi({VIDEO: IpBlocked(VIDEO)})

        def no_provider(video_id):
            raise RuntimeError("no PO-token provider")

        [r] = yt.extract_all([VIDEO], api=api, fallback=no_provider)
        self.assertFalse(r.ok)
        self.assertIn("IpBlocked", r.error)
        self.assertIn("bot check", r.error)
        self.assertIn("RuntimeError: no PO-token provider", r.error)

    def test_ip_block_without_a_fallback_is_still_named(self):
        api = FakeApi({VIDEO: IpBlocked(VIDEO)})
        [r] = yt.extract_all([VIDEO], api=api, fallback=None)
        self.assertFalse(r.ok)
        self.assertIn("IpBlocked", r.error)
        self.assertIn("no fallback", r.error)

    def test_primary_success_never_touches_the_fallback(self):
        api = FakeApi({VIDEO: fetched(VIDEO, ["ok"])})

        def boom(video_id):
            raise AssertionError("fallback must not run")

        [r] = yt.extract_all([VIDEO], api=api, fallback=boom)
        self.assertTrue(r.ok)
        self.assertEqual(r.backend, "youtube-transcript-api")

    def test_falls_back_to_any_language_when_preferred_is_missing(self):
        spanish = fetched(VIDEO, ["hola", "mundo"], language_code="es")
        api = FakeApi({
            VIDEO: NoTranscriptFound(VIDEO, ["en"], TranscriptList(VIDEO, {}, {}, [])),
            ("list", VIDEO): [ListedStub(spanish)],
        })
        [r] = yt.extract_all([VIDEO], api=api)
        self.assertTrue(r.ok)
        self.assertEqual(r.language, "es")
        self.assertEqual(r.text, "hola\nmundo")
        self.assertEqual(api.calls, [("fetch", VIDEO, ("en",)), ("list", VIDEO)])

    def test_no_transcript_anywhere_is_reported(self):
        api = FakeApi({
            VIDEO: NoTranscriptFound(VIDEO, ["en"], TranscriptList(VIDEO, {}, {}, [])),
            ("list", VIDEO): [],
        })
        [r] = yt.extract_all([VIDEO], api=api)
        self.assertFalse(r.ok)
        self.assertIn("no captions", r.error)

    def test_bad_url_does_not_stop_the_batch(self):
        api = FakeApi({VIDEO: fetched(VIDEO, ["ok"])})
        results = yt.extract_all(["https://vimeo.com/1", VIDEO], api=api)
        self.assertEqual([r.ok for r in results], [False, True])
        self.assertIn("bad URL", results[0].error)
        self.assertEqual(api.calls, [("fetch", VIDEO, ("en",))])

    def test_unexpected_errors_are_contained(self):
        api = FakeApi({VIDEO: ConnectionError("dns is down")})
        [r] = yt.extract_all([VIDEO], api=api)
        self.assertFalse(r.ok)
        self.assertIn("ConnectionError", r.error)
        self.assertIn("dns is down", r.error)



class YtDlpFallback(unittest.TestCase):
    """fetch_transcript_ytdlp against a stand-in for yt_dlp.YoutubeDL."""

    JSON3 = json.dumps({"events": [
        {"tStartMs": 0, "dDurationMs": 1500, "segs": [{"utf8": "hello"}, {"utf8": " world"}]},
        {"tStartMs": 1500, "aAppend": 1, "segs": [{"utf8": "\n"}]},
        {"tStartMs": 2000, "dDurationMs": 900, "segs": [{"utf8": "second"}]},
    ]}).encode()

    def _factory(self, info):
        test = self

        class FakeYdl:
            def __init__(self, options):
                test.options = options

            def __enter__(self):
                return self

            def __exit__(self, *exc):
                return False

            def extract_info(self, url, download=False):
                test.url = url
                test.download = download
                return info

            def urlopen(self, url):
                test.opened = url
                return io.BytesIO(test.JSON3)

        return FakeYdl

    def test_rebuilds_a_transcript_from_json3_preferring_the_spoken_language_track(self):
        info = {"subtitles": {}, "automatic_captions": {
            "en-orig": [{"ext": "vtt", "url": "v"},
                        {"ext": "json3", "url": "orig.json3", "name": "English (Original)"}],
            "en": [{"ext": "json3", "url": "translated.json3", "name": "English"}],
            "de": [{"ext": "json3", "url": "de.json3"}],
        }}
        t = yt.fetch_transcript_ytdlp(VIDEO, ydl_factory=self._factory(info))
        self.assertEqual(self.url, f"https://www.youtube.com/watch?v={VIDEO}")
        self.assertFalse(self.download)
        self.assertTrue(self.options["skip_download"])
        self.assertEqual(self.opened, "orig.json3")
        self.assertTrue(t.is_generated)
        self.assertEqual(t.language_code, "en")
        self.assertEqual(t.language, "English (Original)")
        self.assertEqual(
            [(s.text, s.start, s.duration) for s in t.snippets],
            [("hello world", 0.0, 1.5), ("second", 2.0, 0.9)],
        )
        self.assertEqual(yt.FORMATTER.format_transcript(t), "hello world\nsecond")

    def test_prefers_human_written_captions(self):
        info = {"subtitles": {"en": [{"ext": "json3", "url": "manual.json3", "name": "English"}]},
                "automatic_captions": {"en-orig": [{"ext": "json3", "url": "asr.json3"}]}}
        t = yt.fetch_transcript_ytdlp(VIDEO, ydl_factory=self._factory(info))
        self.assertFalse(t.is_generated)
        self.assertEqual(self.opened, "manual.json3")

    def test_takes_any_language_when_preferred_is_missing(self):
        info = {"subtitles": {}, "automatic_captions": {"es-orig": [{"ext": "json3", "url": "es.json3"}]}}
        t = yt.fetch_transcript_ytdlp(VIDEO, ydl_factory=self._factory(info))
        self.assertEqual(t.language_code, "es")
        self.assertTrue(t.is_generated)

    def test_no_captions_is_an_error(self):
        with self.assertRaises(LookupError):
            yt.fetch_transcript_ytdlp(VIDEO, ydl_factory=self._factory({"subtitles": {}, "automatic_captions": {}}))

    def test_missing_json3_format_is_an_error(self):
        info = {"subtitles": {"en": [{"ext": "vtt", "url": "only.vtt"}]}, "automatic_captions": {}}
        with self.assertRaises(LookupError):
            yt.fetch_transcript_ytdlp(VIDEO, ydl_factory=self._factory(info))

class Report(unittest.TestCase):
    def _run(self, urls, api):
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            code = yt.main(urls, api=api)
        return code, buf.getvalue()

    def test_prints_exactly_the_first_500_chars_and_a_tally(self):
        words = ["z" * 60] * 20                       # 1219 chars of text
        api = FakeApi({VIDEO: fetched(VIDEO, words)})
        code, out = self._run([VIDEO], api)
        self.assertEqual(code, 0)
        preview = "\n".join(words)[:500]
        self.assertIn(preview, out)
        self.assertEqual(out.count("z"), preview.count("z"))  # nothing past 500
        self.assertIn("chars=1219", out)
        self.assertIn("1/1 transcripts extracted", out)

    def test_exit_code_is_nonzero_when_any_url_fails(self):
        api = FakeApi({VIDEO: fetched(VIDEO, ["fine"]), SHORT: TranscriptsDisabled(SHORT)})
        code, out = self._run([VIDEO, f"https://www.youtube.com/shorts/{SHORT}"], api)
        self.assertEqual(code, 1)
        self.assertIn("1/2 transcripts extracted", out)
        self.assertIn("FAILED", out)
        self.assertIn("!! no captions", out)

    def test_default_list_has_a_video_and_a_short(self):
        kinds = {yt.url_kind(u) for u in yt.PROOF_URLS}
        self.assertEqual(kinds, {"video", "short"})
        for url in yt.PROOF_URLS:
            yt.extract_video_id(url)  # must parse


if __name__ == "__main__":
    unittest.main(verbosity=2)
