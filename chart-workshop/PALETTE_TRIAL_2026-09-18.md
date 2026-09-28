# Custom workshop neon-pink trial

Local-only, not deployed or visually approved. This trial follows the user's explicit request for a more neon pink without changing the opacity hierarchy. Pine and Station's existing chart/deck/shared tokens are untouched.

## Audit

- Existing Station `chart/index.html` and `deck/index.html` use cyan `#00D4FF`, green `#00FFA3`, and red `#FF2D55`. These are different semantic families, not an existing indigo/pink ribbon palette to adopt.
- Root `tokens.css` records neutral UI tokens and a muted blue accent `#5b9dd9`. Its restriction against substituting the global palette is respected: this is an explicitly requested, isolated workshop trial, not a global theme change.
- Workshop fills/lines had shared indigo `#0C3299` and pink `#E6007E`, but captions separately used pale `#7895ed` / `#d86da8`, and legend swatches used `#355cba` / wine `#af176d`.

## Narrow change

The single `palette` object in `model.mjs` remains the source of truth. Pink changes to **`#FF00A8`**: full red and zero green, a more saturated magenta-pink without a white/pastel component. The liked indigo remains **`#0C3299`**. `workshop.mjs` exposes those same two values as page-local `--cloud-blue` / `--cloud-pink` CSS properties; caption text and legend now use them. Canvas fills, lines, and leaders already consume the shared palette.

All line/cloud opacity numbers, line widths/styles, calculations, crossing ownership, controls, and layout remain unchanged. There is no glow, blend-mode change, shadow, or hidden alpha multiplier. The earlier zero-height cloud-transition fix is preserved.

## Review caveats

- A10–22% transparent pink over a nearly black background remains dark. Changing hue alone cannot promise an emissive neon appearance; this pass does not disguise that by increasing alpha.
- Matching small blue caption text to the exact deep-indigo token reduces its contrast compared with the prior pale caption blue. That needs actual visual review; no separate lightened/white-tinted caption token was silently introduced.
- This does not address the fixed label gutter or dynamic line thickness. Those are separate requested rendering tasks.

The design-system skill influenced this pass by auditing existing tokens first and removing inconsistent per-role color literals in the isolated workshop. Color consistency does not establish calculation parity or visual acceptance.

## Verification

`tests/cloud-workshop-palette.test.mjs` checks shared color-role binding, exact preserved opacity/width/state defaults, byte-identical `computeAverages`, no white-tinted pink, and no hidden compositing/opacity change. Existing transition regression tests remain part of the focused suite. **31/31 focused tests passed**, and `node --check chart-workshop/workshop.mjs` passed. No browser, database, or deployment operation is part of this worker's change.

### Main-agent visual check

The main agent inspected the actual local TSLA chart in Chrome after this change and independently reran all 31 tests. The changed base pink alone still reads wine-like in the low-opacity fills on black, and exact-base indigo captions are too dim. This trial is therefore **not a finished visual solution and must not be deployed as accepted**. The public preview was not replaced. Next rendering work must address perceptual tone/contrast without changing the user's opacity hierarchy or adding white/pastel tint, alongside the already-requested dynamic label/viewport behavior.
