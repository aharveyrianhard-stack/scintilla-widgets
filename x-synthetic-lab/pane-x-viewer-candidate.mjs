/*
 * SCINTILLA X LAB — presentation-only pane-X candidate.
 *
 * This is deliberately not imported by the stable viewer. It mirrors only the
 * shape of pane-X's guarded presentation loop: accept the newest delivered
 * endpoint, render at display cadence, freeze for named pause reasons, and
 * stop/restart cleanly. It has no source-scroll, capture, crop, transport,
 * pairing, routing, receiver, or lifecycle authority.
 */

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp01 = value => Math.max(0, Math.min(1, finite(value)));

export class PaneXViewerPresentationCandidate {
  constructor({ render = () => {} } = {}) {
    this.render = render;
    this.running = false;
    this.position = 0;
    this.from = 0;
    this.target = 0;
    this.segmentStartedAt = 0;
    this.segmentDurationMs = 80;
    this.latestSequence = -1;
    this.endpointChecks = 0;
    this.maximumEndpointError = 0;
    this.pauseReasons = new Set();
    this.pauseStartedAt = 0;
    this.receivedWhilePaused = false;
    this.renderCount = 0;
  }

  start({ position = 0, at = 0 } = {}) {
    const initial = finite(position);
    this.running = true;
    this.position = initial;
    this.from = initial;
    this.target = initial;
    this.segmentStartedAt = finite(at);
    this.segmentDurationMs = 80;
    this.latestSequence = -1;
    this.endpointChecks = 0;
    this.maximumEndpointError = 0;
    this.pauseReasons.clear();
    this.pauseStartedAt = 0;
    this.receivedWhilePaused = false;
    this.renderCount = 0;
    this.#paint("start", at);
    return this.position;
  }

  stop({ at = 0 } = {}) {
    if (!this.running) return this.position;
    if (!this.pauseReasons.size) this.frame(at);
    this.running = false;
    this.pauseReasons.clear();
    this.pauseStartedAt = 0;
    this.receivedWhilePaused = false;
    return this.position;
  }

  receive({ position, sequence, deliveredAt, cadenceMs } = {}) {
    if (!this.running) return false;
    const nextSequence = Math.floor(finite(sequence, -1));
    if (nextSequence <= this.latestSequence) return false;

    const at = finite(deliveredAt);
    const endpoint = finite(position, this.target);
    const duration = Math.max(1, finite(cadenceMs, this.segmentDurationMs));

    if (this.pauseReasons.size) {
      /* Keep the visible pane frozen but replace the pending target with the
         newest delivery. No stale endpoint queue is allowed to accumulate. */
      this.from = this.position;
      this.target = endpoint;
      this.segmentStartedAt = at;
      this.segmentDurationMs = duration;
      this.latestSequence = nextSequence;
      this.receivedWhilePaused = true;
      return true;
    }

    this.frame(at);
    /* The previous delivered target becomes an exact rendered endpoint before
       it is replaced. This assignment is the endpoint-preservation contract. */
    this.position = this.target;
    this.maximumEndpointError = Math.max(
      this.maximumEndpointError,
      Math.abs(this.position - this.target)
    );
    this.endpointChecks += 1;
    this.#paint("endpoint", at);

    this.from = this.target;
    this.target = endpoint;
    this.segmentStartedAt = at;
    this.segmentDurationMs = duration;
    this.latestSequence = nextSequence;
    return true;
  }

  frame(at = 0) {
    if (!this.running || this.pauseReasons.size) return this.position;
    const progress = clamp01((finite(at) - this.segmentStartedAt) / this.segmentDurationMs);
    const low = Math.min(this.from, this.target);
    const high = Math.max(this.from, this.target);
    const interpolated = this.from + (this.target - this.from) * progress;
    this.position = Math.max(low, Math.min(high, interpolated));
    if (progress >= 1) this.position = this.target;
    this.#paint(progress >= 1 ? "endpoint" : "frame", at);
    return this.position;
  }

  setPaused(reason, held, at = 0) {
    const key = String(reason || "manual");
    const now = finite(at);
    if (held) {
      if (this.pauseReasons.has(key)) return this.position;
      if (!this.pauseReasons.size) {
        this.frame(now);
        this.pauseStartedAt = now;
      }
      this.pauseReasons.add(key);
      return this.position;
    }

    if (!this.pauseReasons.delete(key) || this.pauseReasons.size) return this.position;
    if (this.receivedWhilePaused) {
      this.from = this.position;
      this.segmentStartedAt = now;
      this.receivedWhilePaused = false;
    } else {
      this.segmentStartedAt += Math.max(0, now - this.pauseStartedAt);
    }
    this.pauseStartedAt = 0;
    return this.position;
  }

  snapshot() {
    return {
      running: this.running,
      position: this.position,
      from: this.from,
      target: this.target,
      latestSequence: this.latestSequence,
      endpointChecks: this.endpointChecks,
      maximumEndpointError: this.maximumEndpointError,
      paused: Boolean(this.pauseReasons.size),
      pauseReasons: Array.from(this.pauseReasons),
      renderCount: this.renderCount
    };
  }

  #paint(kind, at) {
    this.renderCount += 1;
    this.render(this.position, {
      kind,
      at: finite(at),
      sequence: this.latestSequence,
      target: this.target
    });
  }
}
