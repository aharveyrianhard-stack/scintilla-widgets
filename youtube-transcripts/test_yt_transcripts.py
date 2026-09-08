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
import os
import tempfile
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

        [r] = yt.extract_all([VIDEO], api=api, fallback=fallback, gemini=None)
        self.assertTrue(r.ok)
        self.assertEqual(r.text, "via\nyt-dlp")
        self.assertEqual(r.backend, "yt-dlp")
        self.assertEqual(r.error, "")
        self.assertEqual(calls, [VIDEO])

    def test_ip_block_is_named_when_the_fallback_fails_too(self):
        api = FakeApi({VIDEO: IpBlocked(VIDEO)})

        def no_provider(video_id):
            raise RuntimeError("no PO-token provider")

        [r] = yt.extract_all([VIDEO], api=api, fallback=no_provider, gemini=None)
        self.assertFalse(r.ok)
        self.assertIn("IpBlocked", r.error)
        self.assertIn("bot check", r.error)
        self.assertIn("yt-dlp fallback: RuntimeError: no PO-token provider", r.error)
        self.assertIn("gemini: not configured (GEMINI_API_KEY unset)", r.error)

    def test_chain_reaches_gemini_when_ytdlp_fails(self):
        api = FakeApi({VIDEO: IpBlocked(VIDEO)})

        def no_provider(video_id):
            raise RuntimeError("no PO-token provider")

        def gemini(video_id):
            return fetched(video_id, ["gemini", "text"], is_generated=True)

        [r] = yt.extract_all([VIDEO], api=api, fallback=no_provider, gemini=gemini)
        self.assertTrue(r.ok)
        self.assertEqual(r.backend, "gemini")
        self.assertEqual(r.text, "gemini\ntext")

    def test_chain_names_every_failed_backend(self):
        api = FakeApi({VIDEO: IpBlocked(VIDEO)})

        def no_provider(video_id):
            raise RuntimeError("no PO-token provider")

        def quota(video_id):
            raise RuntimeError("Gemini API HTTP 429: quota")

        [r] = yt.extract_all([VIDEO], api=api, fallback=no_provider, gemini=quota)
        self.assertFalse(r.ok)
        self.assertIn("yt-dlp fallback: RuntimeError: no PO-token provider", r.error)
        self.assertIn("gemini fallback: RuntimeError: Gemini API HTTP 429", r.error)

    def test_ip_block_without_any_fallback_is_still_named(self):
        api = FakeApi({VIDEO: IpBlocked(VIDEO)})
        [r] = yt.extract_all([VIDEO], api=api, fallback=None, gemini=None)
        self.assertFalse(r.ok)
        self.assertIn("IpBlocked", r.error)
        self.assertIn("yt-dlp: not configured", r.error)
        self.assertIn("gemini: not configured", r.error)

    def test_primary_success_never_touches_the_fallback(self):
        api = FakeApi({VIDEO: fetched(VIDEO, ["ok"])})

        def boom(video_id):
            raise AssertionError("fallback must not run")

        [r] = yt.extract_all([VIDEO], api=api, fallback=boom, gemini=boom)
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

    def test_cookies_and_proxy_come_from_the_environment(self):
        saved = dict(os.environ)
        try:
            os.environ["YT_COOKIES_FILE"] = "/tmp/cookies.txt"
            os.environ["YT_PROXY"] = "http://u:p@proxy.example:8080"
            opts = yt.ytdlp_options(("en",))
            self.assertEqual(opts["cookiefile"], "/tmp/cookies.txt")
            self.assertEqual(opts["proxy"], "http://u:p@proxy.example:8080")
            api = yt.build_api()
            self.assertEqual(api._fetcher._http_client.proxies["https"], "http://u:p@proxy.example:8080")
            os.environ.pop("YT_COOKIES_FILE")
            os.environ.pop("YT_PROXY")
            opts = yt.ytdlp_options(("en",))
            self.assertNotIn("cookiefile", opts)
            self.assertNotIn("proxy", opts)
        finally:
            os.environ.clear()
            os.environ.update(saved)


class GeminiFallback(unittest.TestCase):
    """fetch_transcript_gemini against a stand-in for requests.post."""

    REPLY = {"candidates": [{"content": {"parts": [{"text": json.dumps({
        "language_code": "en",
        "segments": [
            {"start": 0, "end": 2.5, "text": "hello there"},
            {"start": 2.5, "end": 4, "text": " general kenobi "},
            {"start": 4, "end": 4, "text": "   "},
        ],
    })}]}}]}

    class FakeResponse:
        def __init__(self, status, payload, text):
            self.status_code = status
            self._payload = payload
            self.text = text

        def json(self):
            return self._payload

    def _post(self, status=200, payload=None, text=""):
        calls = []
        reply = self.REPLY if payload is None else payload

        def post(url, headers=None, json=None, timeout=None):
            calls.append({"url": url, "headers": headers, "json": json, "timeout": timeout})
            return self.FakeResponse(status, reply, text)

        return post, calls

    def test_rebuilds_segments_and_sends_the_video_url(self):
        post, calls = self._post()
        t = yt.fetch_transcript_gemini(VIDEO, api_key="k", model="gemini-test", post=post)
        call = calls[0]
        self.assertEqual(call["url"], "https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent")
        self.assertEqual(call["headers"]["x-goog-api-key"], "k")
        parts = call["json"]["contents"][0]["parts"]
        self.assertEqual(parts[0]["fileData"]["fileUri"], f"https://www.youtube.com/watch?v={VIDEO}")
        self.assertIn("verbatim", parts[1]["text"])
        self.assertEqual(call["json"]["generationConfig"]["responseMimeType"], "application/json")
        self.assertEqual(
            [(s.text, s.start, s.duration) for s in t.snippets],
            [("hello there", 0.0, 2.5), ("general kenobi", 2.5, 1.5)],
        )
        self.assertTrue(t.is_generated)
        self.assertEqual(t.language_code, "en")
        self.assertEqual(t.video_id, VIDEO)
        self.assertEqual(yt.render(t, "timestamped"), "[00:00] hello there\n[00:02] general kenobi")

    def test_missing_key_is_an_error(self):
        saved = dict(os.environ)
        try:
            os.environ.pop("GEMINI_API_KEY", None)
            with self.assertRaises(LookupError):
                yt.fetch_transcript_gemini(VIDEO, post=self._post()[0])
        finally:
            os.environ.clear()
            os.environ.update(saved)

    def test_http_error_is_an_error(self):
        post, _ = self._post(status=429, payload={}, text='{"error": {"message": "quota"}}')
        with self.assertRaises(RuntimeError) as ctx:
            yt.fetch_transcript_gemini(VIDEO, api_key="k", post=post)
        self.assertIn("429", str(ctx.exception))

    def test_empty_segments_is_an_error(self):
        empty = {"candidates": [{"content": {"parts": [{"text": json.dumps({"language_code": "en", "segments": []})}]}}]}
        post, _ = self._post(payload=empty)
        with self.assertRaises(LookupError):
            yt.fetch_transcript_gemini(VIDEO, api_key="k", post=post)

    def test_key_in_the_environment_enables_the_default_chain(self):
        saved = dict(os.environ)
        try:
            os.environ["GEMINI_API_KEY"] = "k"
            self.assertIsNotNone(yt.default_gemini_fetcher(("en",)))
            os.environ.pop("GEMINI_API_KEY")
            self.assertIsNone(yt.default_gemini_fetcher(("en",)))
        finally:
            os.environ.clear()
            os.environ.update(saved)

    def test_ask_gemini_sends_the_file_and_returns_the_answer(self):
        import ask_gemini

        reply = {"candidates": [{"content": {"parts": [{"text": "Looks "}, {"text": "fine."}]}}]}
        post, calls = self._post(payload=reply)
        answer = ask_gemini.ask("Review this", attachment="# README", api_key="k", model="gemini-test", post=post)
        self.assertEqual(answer, "Looks fine.")
        parts = calls[0]["json"]["contents"][0]["parts"]
        self.assertIn("# README", parts[0]["text"])
        self.assertEqual(parts[1]["text"], "Review this")


class Formats(unittest.TestCase):
    def setUp(self):
        self.t = fetched(VIDEO, ["hello world", "second line"])  # starts 0 and 1, one second each

    def test_timestamped(self):
        self.assertEqual(yt.render(self.t, "timestamped"), "[00:00] hello world\n[00:01] second line")

    def test_clock_rolls_into_hours(self):
        self.assertEqual(yt._clock(3725.9), "1:02:05")
        self.assertEqual(yt._clock(59), "00:59")

    def test_srt_vtt_json_are_the_library_formatters(self):
        srt = yt.render(self.t, "srt")
        self.assertIn("00:00:00,000 --> 00:00:01,000", srt)
        self.assertIn("hello world", srt)
        vtt = yt.render(self.t, "vtt")
        self.assertTrue(vtt.startswith("WEBVTT"))
        self.assertIn("00:00:01.000 --> 00:00:02.000", vtt)
        data = json.loads(yt.render(self.t, "json"))
        self.assertEqual(data[0], {"text": "hello world", "start": 0.0, "duration": 1.0})

    def test_unknown_format_is_rejected(self):
        with self.assertRaises(ValueError):
            yt.render(self.t, "docx")

    def test_write_captures_every_shape(self):
        [r] = yt.extract_all([VIDEO], api=FakeApi({VIDEO: self.t}))
        with tempfile.TemporaryDirectory() as out:
            paths = yt.write_captures(r, out)
            names = sorted(os.path.basename(p) for p in paths)
            self.assertEqual(names, sorted([
                f"{VIDEO}.txt", f"{VIDEO}.timestamped.txt", f"{VIDEO}.srt", f"{VIDEO}.vtt", f"{VIDEO}.json",
            ]))
            with open(os.path.join(out, f"{VIDEO}.timestamped.txt"), encoding="utf-8") as handle:
                self.assertEqual(handle.read(), "[00:00] hello world\n[00:01] second line\n")

    def test_failed_result_writes_nothing(self):
        [r] = yt.extract_all([VIDEO], api=FakeApi({VIDEO: TranscriptsDisabled(VIDEO)}))
        with tempfile.TemporaryDirectory() as out:
            self.assertEqual(yt.write_captures(r, out), [])
            self.assertEqual(os.listdir(out), [])


class CommandLine(unittest.TestCase):
    def _run(self, argv, api, **kwargs):
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            code = yt.main(argv, api=api, **kwargs)
        return code, buf.getvalue()

    def test_timestamped_preview(self):
        code, out = self._run(["--format", "timestamped", VIDEO], FakeApi({VIDEO: fetched(VIDEO, ["one", "two"])}))
        self.assertEqual(code, 0)
        self.assertIn("[00:00] one\n[00:01] two", out)

    def test_out_writes_every_format(self):
        with tempfile.TemporaryDirectory() as out_dir:
            code, out = self._run(["--out", out_dir, VIDEO], FakeApi({VIDEO: fetched(VIDEO, ["one"])}))
            self.assertEqual(code, 0)
            self.assertIn(f"wrote 5 files to {out_dir}/", out)
            self.assertEqual(len(os.listdir(out_dir)), 5)

    def test_backend_gemini_can_be_forced(self):
        calls = []

        def gemini(video_id):
            calls.append(video_id)
            return fetched(video_id, ["from", "gemini"], is_generated=True)

        code, out = self._run(["--backend", "gemini", VIDEO], FakeApi({VIDEO: fetched(VIDEO, ["library"])}), gemini=gemini)
        self.assertEqual(code, 0)
        self.assertIn("via=gemini", out)
        self.assertEqual(calls, [VIDEO])

    def test_backend_gemini_without_a_key_is_reported(self):
        code, out = self._run(["--backend", "gemini", VIDEO], FakeApi({VIDEO: fetched(VIDEO, ["x"])}), gemini=None)
        self.assertEqual(code, 1)
        self.assertIn("GEMINI_API_KEY", out)

    def test_backend_library_forced_does_not_fall_back(self):
        code, out = self._run(
            ["--backend", "library", VIDEO], FakeApi({VIDEO: IpBlocked(VIDEO)}),
            fallback=lambda video_id: fetched(video_id, ["nope"]), gemini=None,
        )
        self.assertEqual(code, 1)
        self.assertIn("backend forced to library", out)

    def test_languages_flag_reaches_the_library(self):
        api = FakeApi({VIDEO: fetched(VIDEO, ["hola"], language_code="es")})
        code, out = self._run(["--languages", "es,en", VIDEO], api)
        self.assertEqual(code, 0)
        self.assertEqual(api.calls, [("fetch", VIDEO, ("es", "en"))])

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
