# Scintilla Hub Social → YouTube tenant patch — 2026-08-10

Status: exact read-only finding for the canonical `scintilla-hub` owner. This file does not change the live Hub.

## Proven defect

The production Hub query reads `youtube_feed.is_sub` but does not select `subscription_accounts`. Its `SUBS` filter therefore includes every subscribed row, including Personal-only subscriptions, in the Scintilla-branded feed. The two-minute refresh repeatedly reloads the same incorrect result.

The database rows are correctly tagged. Examples from Megyn Kelly and LastWeekTonight/John Oliver contain `subscription_accounts=["personal"]` and never `scintilla`. The read-only 2026-08-10 distribution is 1,031 Scintilla-only rows, 487 Personal-only rows, 60 explicitly shared rows, and 2,147 unscoped/search rows. No deletion or source-data scrub is required.

## Exact reader contract

1. Add `subscription_accounts` to the Hub `youtube_feed` select list.
2. Define account membership from that array; do not infer it from legacy `is_sub`.
3. Scintilla Subscribed = rows whose `subscription_accounts` contains `scintilla`.
4. Personal-only rows must never appear in a Scintilla-branded result.
5. An intentionally global search may remain unscoped, but it must be visibly distinct from the Scintilla subscription feed and must retain provenance.
6. Keep `subscription_accounts` on the in-memory item so the UI can display/debug provenance when necessary.

## Acceptance examples

- A row tagged only `personal`: excluded from Scintilla Subscribed.
- A row tagged only `scintilla`: included in Scintilla Subscribed.
- A row tagged both: included once, with both provenances preserved.
- A row with legacy `is_sub=true` but no Scintilla account tag: excluded from Scintilla Subscribed.
- Refresh after two minutes produces the same tenant-correct result.

Station already applies the account-array filter separately for Personal and Scintilla. The durable repair is one shared account-scoped reader contract, not two independently evolving filters.
