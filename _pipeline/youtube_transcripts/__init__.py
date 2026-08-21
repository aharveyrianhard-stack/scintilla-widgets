"""SCINTILLA · isolated YouTube transcript extraction.

Raw captions land in the R2 cold bucket and the isolated staging schema. No
part of this package writes to a production table; `storage.StagingWriter`
refuses to.
"""

from .contract import (
    CONTRACT_VERSION,
    PROCESSING_STATUSES,
    ContractError,
    assert_valid,
    build_payload,
    validate_payload,
)
from .extractor import NoCaptionsAvailable, SubtitleDownloadError, SubtitleExtractor
from .metadata import QuotaExceeded, YouTubeAPIError, YouTubeDataAPI
from .pipeline import ProcessOutcome, TranscriptPipeline
from .ratelimit import (
    AlreadyRunning,
    CircuitBreaker,
    CircuitOpen,
    Deadline,
    RateLimiter,
    SingleFlight,
)
from .storage import (
    ISOLATED_SCHEMA,
    STAGING_TABLE,
    IsolationViolation,
    MemoryColdStore,
    R2ColdStore,
    StagingWriter,
    transcript_key,
)
from .vtt import join_segments, parse_vtt_text, strip_caption_markup

__version__ = "1.0.0"

__all__ = [
    "CONTRACT_VERSION", "PROCESSING_STATUSES", "ContractError", "assert_valid",
    "build_payload", "validate_payload", "NoCaptionsAvailable",
    "SubtitleDownloadError", "SubtitleExtractor", "QuotaExceeded",
    "YouTubeAPIError", "YouTubeDataAPI", "ProcessOutcome", "TranscriptPipeline",
    "AlreadyRunning", "CircuitBreaker", "CircuitOpen", "Deadline", "RateLimiter",
    "SingleFlight", "ISOLATED_SCHEMA", "STAGING_TABLE", "IsolationViolation",
    "MemoryColdStore", "R2ColdStore", "StagingWriter", "transcript_key",
    "join_segments", "parse_vtt_text", "strip_caption_markup", "__version__",
]
