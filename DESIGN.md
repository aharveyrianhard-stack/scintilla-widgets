# Design tokens — how a session picks a look

Written 2026-08-08 after a Scintilla parity sheet arrived in URTH green and
URTH work was done in golf styling. Sessions reach for whatever is nearest,
so what is nearest must be correct.

## The rule

**NEAREST TOKENS FILE WINS.** Before writing any interface, find the closest
`tokens.css` walking up from the file you are editing, and use it.

- A subdirectory may **tighten** the tokens — fewer choices, a narrower scale.
- A subdirectory may **never substitute** a different palette or typeface.
- **No tokens file is a FINDING, not a licence.** Say so and stop; do not invent
  a design language.

## The three worlds, and they do not mix

| | character | ground | accent | type |
|---|---|---|---|---|
| **SCINTILLA** | dark, dense, data-first | `#0e1116` | `#5b9dd9` | SF Mono + system sans |
| **URTH** | warm, light, rounded | `#F5F0E7` | `#CDA24A` gold | Fraunces + Mada |
| **SWING LAB** | its own, separate | — | — | — |

**SWING LAB has no repository yet.** It exists only in the target structure.
When it gets one, it gets its own tokens file — it does not borrow Scintilla's.

## Capability Studio

Voice, image and visuals tools **inherit the design of whatever they render
into**. A chart generated for Scintilla is a Scintilla chart. The same tool
rendering into URTH produces an URTH one. The tool has no look of its own.

## Where these came from

Neither palette was designed by a session. Scintilla's was read from the live
analytics surface; URTH's from `apps.urthlandscaping.com/theme.css`. They were
already settled — this only writes them down where a session will look.
