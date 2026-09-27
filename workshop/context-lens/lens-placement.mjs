/* MOVED 27 Sep (CL4): the placement rule now lives in /_indicators/lens-placement.mjs, beside the
   Station's other indicators, because the live chart pane imports it. This path re-exports it so
   the review pages and their tests keep working unchanged. */
export * from "../../_indicators/lens-placement.mjs";
