"""Entity and ticker resolution over transcript segments (sentiment step 1).

The hard part is not finding tickers, it is *not* finding them. Matching
uppercase tokens against the live universe looks fine until you check what is
actually in it: LOW (Lowe's), NOW (ServiceNow), BE (Bloom Energy), SO
(Southern), PM (Philip Morris), DE (Deere), MO (Altria), ES (Eversource), AU
(AngloGold), CAT, MA, ED, FIX -- plus single letters C, D, F, O, P, T, V.
Every one of those is a word a market commentator says constantly. "The low of
the day", "right now", "it'll be fine", "the PM session" would each mint a
false holding.

Two further facts shape this:

  * `public.tickers` has no company-name column, so "Micron" cannot be resolved
    to MU from the database alone. Aliases are injected; the default map is a
    small curated seed, and its absence is reported rather than papered over.
  * YouTube auto-captions are lowercase or sentence case and do not reliably
    capitalize tickers, so casing is evidence, not proof.

Everything therefore carries a confidence tier and downstream filters on it,
instead of a boolean that hides how the match was made.
"""

import re
from typing import Any, Dict, Iterable, List, Optional, Sequence, Set

__all__ = [
    "Confidence",
    "EntityHit",
    "MACRO_THEMES",
    "COLLIDING_TICKERS",
    "DEFAULT_ALIASES",
    "EntityResolver",
]


class Confidence:
    """How the match was made, so a consumer can pick its own threshold."""

    CASHTAG = "CASHTAG"        # $MU — unambiguous by construction
    ALIAS = "ALIAS"            # "Micron" — name match, unambiguous
    SYMBOL = "SYMBOL"          # bare MU — uppercase, not a colliding word
    CORROBORATED = "CORROBORATED"  # "LOW shares" — colliding word, rescued by context

    ORDER = (CASHTAG, ALIAS, SYMBOL, CORROBORATED)
    #: Tiers safe to aggregate without human review.
    TRUSTED = frozenset({CASHTAG, ALIAS, SYMBOL})


class EntityHit:
    def __init__(self, symbol: str, kind: str, confidence: str, surface: str,
                 start: int, segment_index: Optional[int] = None):
        self.symbol = symbol
        self.kind = kind                # equity | etf | crypto | index | theme | ...
        self.confidence = confidence
        self.surface = surface          # the text that actually matched
        self.start = start
        self.segment_index = segment_index

    def as_dict(self) -> Dict[str, Any]:
        return {
            "symbol": self.symbol,
            "kind": self.kind,
            "confidence": self.confidence,
            "surface": self.surface,
            "start": self.start,
            "segment_index": self.segment_index,
        }

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return "<EntityHit {0} {1}>".format(self.symbol, self.confidence)


# Tickers in the live universe that are also ordinary English. A bare,
# uncorroborated occurrence of one of these is discarded.
COLLIDING_TICKERS = frozenset({
    "A", "ALL", "AU", "BE", "BY", "C", "CAT", "CB", "D", "DE", "ED", "ES",
    "EH", "F", "FIX", "FOR", "GO", "HD", "IT", "KEY", "LI", "LOW", "MA",
    "MO", "MS", "NEW", "NOW", "O", "ON", "ONE", "OUT", "P", "PM", "REAL",
    "SO", "T", "TT", "V", "WELL",
})

# Context that rescues a colliding symbol. Deliberately narrow: these are
# words that accompany an instrument, not merely finance vocabulary.
_CORROBORATING = (
    "shares", "share", "stock", "stocks", "ticker", "calls", "puts", "options",
    "earnings", "dividend", "buyback", "guidance", "downgrade", "upgrade",
    "price target", "market cap", "quarter", "eps", "revenue", "long", "short",
)
_CORROBORATION_WINDOW = 40  # characters either side

MACRO_THEMES: Dict[str, Sequence[str]] = {
    "MONETARY_POLICY": ("fed", "fomc", "rate cut", "rate hike", "central bank",
                        "powell", "ecb", "boj", "tightening", "easing",
                        "quantitative", "basis points", "bps"),
    "INFLATION": ("inflation", "cpi", "ppi", "pce", "disinflation",
                  "deflation", "price pressure", "sticky prices"),
    "LIQUIDITY": ("liquidity", "money supply", "m2", "balance sheet",
                  "reverse repo", "credit impulse"),
    "RECESSION": ("recession", "hard landing", "soft landing", "slowdown",
                  "contraction", "yield curve", "inversion"),
    "EMPLOYMENT": ("payrolls", "unemployment", "jobless", "labor market",
                   "jobs report", "wage growth"),
    "ENERGY": ("oil", "crude", "opec", "natural gas", "barrel", "wti", "brent"),
    "GEOPOLITICS": ("tariff", "sanctions", "trade war", "geopolitical",
                    "export controls", "supply chain"),
    "CREDIT": ("credit spread", "high yield", "default rate", "refinancing",
               "leverage", "debt ceiling"),
    "HOUSING": ("housing", "mortgage", "home sales", "real estate", "rents"),
    "AI_CAPEX": ("ai capex", "data center", "gpu", "accelerator", "hyperscaler",
                 "training cluster", "inference demand"),
}

#: Seed only. The database has no company-name column, so anything richer has
#: to be supplied by the caller.
DEFAULT_ALIASES: Dict[str, str] = {
    "nvidia": "NVDA", "micron": "MU", "apple": "AAPL", "microsoft": "MSFT",
    "amazon": "AMZN", "alphabet": "GOOGL", "google": "GOOGL", "meta": "META",
    "tesla": "TSLA", "broadcom": "AVGO", "netflix": "NFLX", "palantir": "PLTR",
    "advanced micro devices": "AMD", "taiwan semi": "TSM", "tsmc": "TSM",
    "caterpillar": "CAT", "lowe's": "LOW", "lowes": "LOW", "deere": "DE",
    "servicenow": "NOW", "altria": "MO", "philip morris": "PM",
    "coca-cola": "KO", "mastercard": "MA", "citigroup": "C", "at&t": "T",
    "exxon": "XOM", "chevron": "CVX", "jpmorgan": "JPM", "goldman": "GS",
    "morgan stanley": "MS", "berkshire": "BRK.B", "eli lilly": "LLY",
    "bitcoin": "BTCUSD", "ethereum": "ETHUSD",
}

_CASHTAG = re.compile(r"\$([A-Za-z][A-Za-z0-9.\-]{0,9})\b")
_UPPER_TOKEN = re.compile(r"\b([A-Z][A-Z0-9.\-]{0,9})\b")


class EntityResolver:
    def __init__(
        self,
        universe: Iterable[str],
        kinds: Optional[Dict[str, str]] = None,
        aliases: Optional[Dict[str, str]] = None,
        colliding: Optional[Set[str]] = None,
        themes: Optional[Dict[str, Sequence[str]]] = None,
    ):
        self.universe = {str(s).upper() for s in universe if s}
        self.kinds = {str(k).upper(): v for k, v in (kinds or {}).items()}
        self.aliases = {k.lower(): v.upper() for k, v in
                        (DEFAULT_ALIASES if aliases is None else aliases).items()}
        self.colliding = frozenset(
            COLLIDING_TICKERS if colliding is None else {c.upper() for c in colliding}
        )
        self.themes = MACRO_THEMES if themes is None else themes

    def kind_of(self, symbol: str) -> str:
        return self.kinds.get(symbol.upper()) or "equity"

    def _corroborated(self, text: str, start: int, end: int) -> bool:
        window = text[
            max(0, start - _CORROBORATION_WINDOW) : end + _CORROBORATION_WINDOW
        ].lower()
        return any(marker in window for marker in _CORROBORATING)

    def resolve_text(
        self, text: str, segment_index: Optional[int] = None
    ) -> List[EntityHit]:
        """Find instruments in one passage. Order is by position in the text."""
        if not text:
            return []
        hits: List[EntityHit] = []
        claimed: List[tuple] = []

        def overlaps(start: int, end: int) -> bool:
            return any(start < e and end > s for s, e in claimed)

        # 1. Cashtags: unambiguous, so they win any overlap.
        for match in _CASHTAG.finditer(text):
            symbol = match.group(1).upper()
            if symbol in self.universe:
                claimed.append(match.span())
                hits.append(EntityHit(symbol, self.kind_of(symbol),
                                      Confidence.CASHTAG, match.group(0),
                                      match.start(), segment_index))

        # 2. Aliases: a name is as unambiguous as a cashtag, and is what
        #    actually appears in speech. Longest first so "philip morris"
        #    is not shadowed by a shorter alias inside it.
        lowered = text.lower()
        for alias in sorted(self.aliases, key=len, reverse=True):
            symbol = self.aliases[alias]
            for match in re.finditer(
                r"(?<![a-z0-9])" + re.escape(alias) + r"(?![a-z0-9])", lowered
            ):
                if overlaps(*match.span()):
                    continue
                claimed.append(match.span())
                hits.append(EntityHit(symbol, self.kind_of(symbol),
                                      Confidence.ALIAS,
                                      text[match.start():match.end()],
                                      match.start(), segment_index))

        # 3. Bare uppercase symbols.
        for match in _UPPER_TOKEN.finditer(text):
            symbol = match.group(1).upper()
            if symbol not in self.universe or overlaps(*match.span()):
                continue
            if symbol in self.colliding:
                if not self._corroborated(text, match.start(), match.end()):
                    continue
                confidence = Confidence.CORROBORATED
            else:
                confidence = Confidence.SYMBOL
            claimed.append(match.span())
            hits.append(EntityHit(symbol, self.kind_of(symbol), confidence,
                                  match.group(0), match.start(), segment_index))

        hits.sort(key=lambda hit: hit.start)
        return hits

    def resolve_segments(
        self, segments: Sequence[Dict[str, Any]]
    ) -> List[EntityHit]:
        out: List[EntityHit] = []
        for index, segment in enumerate(segments):
            out.extend(self.resolve_text(segment.get("text") or "", index))
        return out

    def resolve_themes(self, text: str) -> Dict[str, int]:
        """Count macro-theme keyword hits. Themes are topical, not positional."""
        lowered = (text or "").lower()
        found: Dict[str, int] = {}
        for theme, keywords in self.themes.items():
            count = sum(lowered.count(keyword) for keyword in keywords)
            if count:
                found[theme] = count
        return found

    @staticmethod
    def trusted(hits: Iterable[EntityHit]) -> List[EntityHit]:
        return [hit for hit in hits if hit.confidence in Confidence.TRUSTED]
