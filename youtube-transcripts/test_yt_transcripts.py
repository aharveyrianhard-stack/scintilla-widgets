"""Offline proof of the extraction logic.

Runs without touching YouTube: URL parsing is pure, and the fetch path is
exercised against a stand-in for YouTubeTranscriptApi that returns real
FetchedTranscript objects, so the library's TextFormatter (timestamp stripping)
is the genuine article. Run with:

    python3 -m unittest -v test_yt_transcripts
"""
import contextlib
import io
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

    def test_ip_block_is_named(self):
        api = FakeApi({VIDEO: IpBlocked(VIDEO)})
        [r] = yt.extract_all([VIDEO], api=api)
        self.assertFalse(r.ok)
        self.assertIn("blocked", r.error.lower())

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
