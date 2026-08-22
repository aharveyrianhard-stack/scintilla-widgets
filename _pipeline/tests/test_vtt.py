"""VTT parsing and normalization."""

import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from youtube_transcripts.vtt import (  # noqa: E402
    join_segments,
    parse_timestamp,
    parse_vtt_text,
    strip_caption_markup,
)

SAMPLE_VTT = """WEBVTT
Kind: captions
Language: en

00:00:01.100 --> 00:00:03.500 align:start position:0%
<c.colorE5E5E5>Welcome to Scintilla market</c>

00:00:03.500 --> 00:00:06.000
<c.colorE5E5E5>Welcome to Scintilla market</c> insights update.

00:00:06.000 --> 00:00:09.200
Macro liquidity <b>expansion</b> is accelerating across major central banks.
"""


class TestVttParsing(unittest.TestCase):
    def test_markup_stripped_and_timestamps_captured(self):
        segments = parse_vtt_text(SAMPLE_VTT)

        self.assertEqual(len(segments), 3)
        self.assertEqual(segments[0]["start"], "00:00:01.100")
        self.assertEqual(segments[0]["end"], "00:00:03.500")
        self.assertEqual(segments[0]["text"], "Welcome to Scintilla market")
        self.assertEqual(
            segments[1]["text"], "Welcome to Scintilla market insights update."
        )
        self.assertEqual(
            segments[2]["text"],
            "Macro liquidity expansion is accelerating across major central banks.",
        )
        for segment in segments:
            self.assertNotIn("<", segment["text"])

    def test_cue_settings_do_not_leak_into_the_end_timestamp(self):
        segments = parse_vtt_text(SAMPLE_VTT)
        self.assertEqual(segments[0]["end"], "00:00:03.500")
        self.assertNotIn("align", segments[0]["end"])

    def test_numeric_seconds_are_derived(self):
        segments = parse_vtt_text(SAMPLE_VTT)
        self.assertAlmostEqual(segments[0]["start_sec"], 1.1)
        self.assertAlmostEqual(segments[2]["end_sec"], 9.2)

    def test_repeated_phrase_later_in_the_video_is_kept(self):
        """A global seen-set silently deletes real repeated speech.

        "Thank you" at 00:01 and again at 05:00 are two separate utterances.
        Dropping the second shortens the transcript the sentiment stage scores
        and misaligns every timestamp after it.
        """
        vtt = """WEBVTT

00:00:01.000 --> 00:00:02.000
Thank you.

00:00:02.000 --> 00:00:04.000
Gold is breaking out.

00:05:00.000 --> 00:05:01.000
Thank you.
"""
        segments = parse_vtt_text(vtt)
        self.assertEqual(len(segments), 3)
        self.assertEqual(segments[2]["text"], "Thank you.")
        self.assertEqual(segments[2]["start"], "00:05:00.000")

    def test_consecutive_rolling_repeat_is_collapsed(self):
        vtt = """WEBVTT

00:00:01.000 --> 00:00:02.000
Rates are falling

00:00:02.000 --> 00:00:03.000
Rates are falling

00:00:03.000 --> 00:00:04.000
Rates are falling fast
"""
        segments = parse_vtt_text(vtt)
        self.assertEqual(len(segments), 2)
        # The collapsed cue keeps the wall-clock coverage of both.
        self.assertEqual(segments[0]["end"], "00:00:03.000")

    def test_join_removes_rolling_overlap(self):
        segments = parse_vtt_text(SAMPLE_VTT)
        joined = join_segments(segments)
        self.assertEqual(
            joined,
            "Welcome to Scintilla market insights update. Macro liquidity "
            "expansion is accelerating across major central banks.",
        )
        self.assertEqual(joined.count("Welcome to Scintilla market"), 1)

    def test_short_and_hour_timestamps(self):
        self.assertAlmostEqual(parse_timestamp("00:01.500"), 1.5)
        self.assertAlmostEqual(parse_timestamp("01:02:03.000"), 3723.0)
        self.assertAlmostEqual(parse_timestamp("00:00:01,250"), 1.25)
        self.assertIsNone(parse_timestamp("garbage"))
        self.assertIsNone(parse_timestamp(""))

    def test_mm_ss_cue_form_is_parsed(self):
        segments = parse_vtt_text("WEBVTT\n\n00:01.000 --> 00:04.000\nShort form cue\n")
        self.assertEqual(len(segments), 1)
        self.assertEqual(segments[0]["text"], "Short form cue")

    def test_entities_and_speaker_tags(self):
        self.assertEqual(
            strip_caption_markup("<v Alan>Bonds &amp; equities&nbsp;rallied</v>"),
            "Bonds & equities rallied",
        )

    def test_cue_identifiers_are_not_treated_as_caption_text(self):
        vtt = """WEBVTT

1
00:00:01.000 --> 00:00:02.000
First line

2
00:00:02.000 --> 00:00:03.000
Second line
"""
        segments = parse_vtt_text(vtt)
        self.assertEqual([s["text"] for s in segments], ["First line", "Second line"])


class TestDegradedInput(unittest.TestCase):
    """Edge cases the mandate names: empty captions and malformed VTTs."""

    def test_empty_track(self):
        self.assertEqual(parse_vtt_text("WEBVTT\n\n"), [])

    def test_header_only_with_metadata(self):
        self.assertEqual(parse_vtt_text("WEBVTT\nKind: captions\nLanguage: en\n"), [])

    def test_corrupt_input(self):
        self.assertEqual(parse_vtt_text("Not a valid VTT file\nRandom text"), [])

    def test_empty_and_none(self):
        self.assertEqual(parse_vtt_text(""), [])
        self.assertEqual(parse_vtt_text(None), [])

    def test_cue_with_no_text_body(self):
        self.assertEqual(parse_vtt_text("WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n\n"), [])

    def test_cue_with_only_markup(self):
        self.assertEqual(
            parse_vtt_text("WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n<c></c>\n"), []
        )

    def test_truncated_file_mid_cue(self):
        segments = parse_vtt_text("WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHalf a sen")
        self.assertEqual(len(segments), 1)
        self.assertEqual(segments[0]["text"], "Half a sen")

    def test_missing_blank_line_between_cues(self):
        vtt = (
            "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nFirst\n"
            "00:00:02.000 --> 00:00:03.000\nSecond\n"
        )
        segments = parse_vtt_text(vtt)
        self.assertEqual([s["text"] for s in segments], ["First", "Second"])

    def test_join_of_empty_segments(self):
        self.assertEqual(join_segments([]), "")
        self.assertEqual(join_segments([{"text": "  "}]), "")


class TestFileRead(unittest.TestCase):
    def test_reads_from_disk_and_normalizes(self):
        handle = tempfile.NamedTemporaryFile(
            "w+", suffix=".vtt", delete=False, encoding="utf-8"
        )
        try:
            handle.write(SAMPLE_VTT)
            handle.close()
            with open(handle.name, "r", encoding="utf-8") as f:
                segments = parse_vtt_text(f.read())
            full_text = join_segments(segments)
            self.assertIn("Macro liquidity expansion", full_text)
            self.assertNotIn("<b>", full_text)
            self.assertNotIn("<c.colorE5E5E5>", full_text)
        finally:
            os.path.exists(handle.name) and os.remove(handle.name)


if __name__ == "__main__":
    unittest.main()
