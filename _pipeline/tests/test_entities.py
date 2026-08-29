"""Entity resolution — chiefly, not resolving things that are not entities."""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from youtube_transcripts.entities import (  # noqa: E402
    COLLIDING_TICKERS,
    Confidence,
    EntityResolver,
)

# Real symbols from the live universe, chosen because they collide.
UNIVERSE = ["MU", "NVDA", "AAPL", "LOW", "NOW", "BE", "SO", "PM", "DE", "MO",
            "CAT", "MA", "ED", "ES", "AU", "T", "C", "D", "F", "O", "V"]


def resolver(**kwargs):
    return EntityResolver(UNIVERSE, **kwargs)


class TestFalsePositives(unittest.TestCase):
    """The live universe contains LOW, NOW, BE, SO, PM, DE, MO, CAT, MA, ED.

    Every one is a word a market commentator says constantly. Matching them
    bare would mint holdings out of ordinary English.
    """

    def test_ordinary_english_yields_nothing(self):
        passages = [
            "the low of the day was ugly",
            "we go now to the close",
            "it will be fine so we wait",
            "the PM session was quiet",
            "de facto that is the read",
            "no mo' upside left",
            "the cat is out of the bag",
            "ma and pa retail piled in",
            "ed said the same thing",
            "es futures are the tell",
        ]
        for passage in passages:
            self.assertEqual(
                [h.symbol for h in resolver().resolve_text(passage)], [],
                "false positive in: " + passage,
            )

    def test_lowercase_symbol_is_not_a_match(self):
        self.assertEqual(resolver().resolve_text("i bought mu yesterday"), [])

    def test_single_letters_do_not_match_bare(self):
        for passage in ("option A or option B", "plan C it is", "vitamin D"):
            self.assertEqual([h.symbol for h in resolver().resolve_text(passage)],
                             [], passage)

    def test_symbol_not_in_universe_is_ignored(self):
        self.assertEqual(resolver().resolve_text("ZZZZ is ripping"), [])


class TestTruePositives(unittest.TestCase):
    def test_cashtag_always_resolves(self):
        hits = resolver().resolve_text("I am long $MU into the print")
        self.assertEqual([h.symbol for h in hits], ["MU"])
        self.assertEqual(hits[0].confidence, Confidence.CASHTAG)

    def test_cashtag_beats_the_collision_list(self):
        """$LOW is Lowe's, unambiguously, even though LOW is a word."""
        hits = resolver().resolve_text("$LOW reports tomorrow")
        self.assertEqual([h.symbol for h in hits], ["LOW"])
        self.assertEqual(hits[0].confidence, Confidence.CASHTAG)

    def test_uppercase_non_colliding_symbol(self):
        hits = resolver().resolve_text("NVDA ripped into the close")
        self.assertEqual([h.symbol for h in hits], ["NVDA"])
        self.assertEqual(hits[0].confidence, Confidence.SYMBOL)

    def test_alias_resolves_a_spoken_name(self):
        """Transcripts say "Micron", not "MU" — aliases are the workhorse."""
        hits = resolver().resolve_text("Micron guided higher and Nvidia followed")
        self.assertEqual(sorted(h.symbol for h in hits), ["MU", "NVDA"])
        for hit in hits:
            self.assertEqual(hit.confidence, Confidence.ALIAS)

    def test_longest_alias_wins(self):
        hits = resolver().resolve_text("philip morris raised the dividend")
        self.assertEqual([h.symbol for h in hits], ["PM"])

    def test_alias_requires_a_word_boundary(self):
        self.assertEqual(resolver().resolve_text("micronutrients matter"), [])

    def test_colliding_symbol_rescued_by_context(self):
        hits = resolver().resolve_text("LOW shares fell after earnings")
        self.assertEqual([h.symbol for h in hits], ["LOW"])
        self.assertEqual(hits[0].confidence, Confidence.CORROBORATED)

    def test_corroboration_must_be_nearby(self):
        far = "LOW" + " filler" * 30 + " shares"
        self.assertEqual([h.symbol for h in resolver().resolve_text(far)], [])

    def test_hits_are_ordered_by_position(self):
        hits = resolver().resolve_text("NVDA then $MU then Apple")
        self.assertEqual([h.symbol for h in hits], ["NVDA", "MU", "AAPL"])

    def test_no_double_count_of_the_same_span(self):
        hits = resolver().resolve_text("$MU")
        self.assertEqual(len(hits), 1)


class TestConfidenceTiers(unittest.TestCase):
    def test_trusted_excludes_corroborated(self):
        self.assertIn(Confidence.CASHTAG, Confidence.TRUSTED)
        self.assertIn(Confidence.ALIAS, Confidence.TRUSTED)
        self.assertIn(Confidence.SYMBOL, Confidence.TRUSTED)
        self.assertNotIn(Confidence.CORROBORATED, Confidence.TRUSTED)

    def test_trusted_filter(self):
        hits = resolver().resolve_text("NVDA up, and LOW shares fell on earnings")
        self.assertEqual(len(hits), 2)
        self.assertEqual([h.symbol for h in EntityResolver.trusted(hits)], ["NVDA"])

    def test_collision_list_covers_the_live_universe(self):
        """Regression: these are really in public.tickers."""
        for symbol in ("LOW", "NOW", "BE", "SO", "PM", "DE", "MO", "ES", "AU",
                       "CAT", "MA", "ED"):
            self.assertIn(symbol, COLLIDING_TICKERS)


class TestSegmentsAndThemes(unittest.TestCase):
    def test_segment_index_is_carried(self):
        segments = [{"text": "nothing here"}, {"text": "NVDA ripped"}]
        hits = resolver().resolve_segments(segments)
        self.assertEqual(len(hits), 1)
        self.assertEqual(hits[0].segment_index, 1)

    def test_themes_counted(self):
        found = resolver().resolve_themes(
            "the Fed signalled a rate cut as inflation and CPI cooled"
        )
        self.assertIn("MONETARY_POLICY", found)
        self.assertIn("INFLATION", found)

    def test_no_themes_in_neutral_text(self):
        self.assertEqual(resolver().resolve_themes("good morning everyone"), {})

    def test_empty_inputs(self):
        self.assertEqual(resolver().resolve_text(""), [])
        self.assertEqual(resolver().resolve_text(None), [])
        self.assertEqual(resolver().resolve_segments([]), [])
        self.assertEqual(resolver().resolve_themes(""), {})

    def test_custom_alias_map_replaces_the_seed(self):
        custom = EntityResolver(UNIVERSE, aliases={"big blue": "T"})
        self.assertEqual(
            [h.symbol for h in custom.resolve_text("big blue reported")], ["T"]
        )
        self.assertEqual(custom.resolve_text("Micron reported"), [])

    def test_kind_defaults_to_equity_and_honours_the_map(self):
        typed = EntityResolver(UNIVERSE, kinds={"MU": "crypto"})
        self.assertEqual(typed.resolve_text("$MU")[0].kind, "crypto")
        self.assertEqual(typed.resolve_text("NVDA up")[0].kind, "equity")

    def test_hit_serializes(self):
        hit = resolver().resolve_text("$MU")[0].as_dict()
        self.assertEqual(hit["symbol"], "MU")
        self.assertEqual(hit["surface"], "$MU")


if __name__ == "__main__":
    unittest.main()
