/* MOVED 27 Sep (CL4): the bubble's geometry now lives in /_indicators/lens-bars.mjs, because the live
   chart pane draws it. This path re-exports it, so this review page now draws the SHIPPED sizes
   (60% of the 26 Sep ones) — the 26 Sep screenshots in screens/ keep the old picture. */
export * from "../../../_indicators/lens-bars.mjs";
