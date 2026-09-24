/* SCINTILLA · STATION — EXPAND IN PLACE, AND THE ROTATION QUEUE (M74)
   ============================================================================
   Alan, 24 Sep: "I need to have a feature where I can grab a chart that's on a multi-chart
   layout and view that one in the expanded way without leaving the window. And then another
   button where I add that view of that ticker to the auto rotating station rotation queue."

   SO, TWO THINGS, AND NOTHING ELSE:
     1. a detail view that opens OVER the wall — same window, same page, no navigation — and
        that is REMOVED, not hidden, when it closes, so it costs nothing while it is not up;
     2. a per-device queue of tickers Alan marked from that view. The queue is a LIST OF
        NAMES, not a running slideshow: it is stored, it is shown, and the coordinator can
        promote it into scenes.js when Alan says so. It never rewrites a curated page and it
        never joins auto-rotate on its own.

   WHAT OPENS IT. The wall's chart panes are iframes of the pinned chart shell, and inside
   that shell a click already means crosshair/pan and a DOUBLE click already means "reset
   this chart's view". Stealing either would break a gesture Alan uses, in a shell this lane
   is not allowed to edit, so the expand control is the deck's own: a ⤢ badge on each chart
   pane, the pane's title, and the keyboard. The shell-side message is honoured too, so the
   day the chart shell offers its own expand gesture, this file needs no change. */
(function (root) {
  "use strict";

  const SHELL_DETAIL = "/station-shells/detail-v1/";
  const SHELL_FUNDAMENTALS = "/station-shells/fundamentals-v1/";
  const QUEUE_KEY = "station.detail.rotation";
  const QUEUE_MAX = 24;

  /* The five zoomed screens Alan named, plus the fundamentals page. They live in the MENU.
     They are deliberately NOT in SceneModel.ROTATION_SCENES: auto-rotate keeps cycling the
     curated nine until Alan says otherwise, which is exactly what the dispatch asked for. */
  const DETAIL_SCREENS = Object.freeze([
    Object.freeze({ id:"detailSPY", ticker:"SPY", label:"DETAIL · SPY", kind:"detail" }),
    Object.freeze({ id:"detailQQQ", ticker:"QQQ", label:"DETAIL · QQQ", kind:"detail" }),
    Object.freeze({ id:"detailMU", ticker:"MU", label:"DETAIL · MU", kind:"detail" }),
    Object.freeze({ id:"detailGOOGL", ticker:"GOOGL", label:"DETAIL · GOOGL", kind:"detail" }),
    Object.freeze({ id:"detailAVGO", ticker:"AVGO", label:"DETAIL · AVGO", kind:"detail" }),
    Object.freeze({ id:"fundamentals", ticker:"", label:"FUNDAMENTALS", kind:"fundamentals" })
  ]);

  const clean = (t) => String(t || "").toUpperCase().replace(/[^A-Z0-9.\-]/g, "").slice(0, 12);

  /* ---- the URL of a view, so the tests can read it without a browser ---- */
  function detailUrl(ticker, range, view) {
    return SHELL_DETAIL + "?shell=v1&t=" + encodeURIComponent(clean(ticker)) +
      "&range=" + encodeURIComponent(range || "3h") + (view ? "&view=" + encodeURIComponent(view) : "");
  }
  function fundamentalsUrl(ticker, view) {
    const t = clean(ticker);
    return SHELL_FUNDAMENTALS + "?shell=v1" + (t ? "&t=" + encodeURIComponent(t) : "") +
      (view ? "&view=" + encodeURIComponent(view) : "");
  }

  /* ---- the queue: one ticker once, newest last, per device ---- */
  function store() {
    try { return root.localStorage || null; } catch (e) { return null; }
  }
  function readQueue(storage) {
    const s = storage === undefined ? store() : storage;
    if (!s) return [];
    let raw = null;
    try { raw = s.getItem(QUEUE_KEY); } catch (e) { return []; }
    if (!raw) return [];
    try {
      const list = JSON.parse(raw);
      if (!Array.isArray(list)) return [];
      return list.filter((e) => e && clean(e.ticker))
        .map((e) => ({ ticker:clean(e.ticker), range:String(e.range || "3h"), added:e.added || null }));
    } catch (e) { return []; }
  }
  function writeQueue(list, storage) {
    const s = storage === undefined ? store() : storage;
    if (!s) return list;
    try { s.setItem(QUEUE_KEY, JSON.stringify(list)); } catch (e) {}
    return list;
  }
  /* Adding a ticker already in the queue REFRESHES its timeframe and its place rather than
     making a second entry — Alan pressing the button twice is not a request for two copies. */
  function addToQueue(ticker, range, storage, now) {
    const t = clean(ticker);
    if (!t) return { queue:readQueue(storage), added:false, reason:"NO_TICKER" };
    const list = readQueue(storage).filter((e) => e.ticker !== t);
    list.push({ ticker:t, range:String(range || "3h"), added:now || new Date().toISOString() });
    while (list.length > QUEUE_MAX) list.shift();
    writeQueue(list, storage);
    return { queue:list, added:true, ticker:t };
  }
  function removeFromQueue(ticker, storage) {
    const t = clean(ticker);
    const list = readQueue(storage).filter((e) => e.ticker !== t);
    writeQueue(list, storage);
    return list;
  }

  /* ---- the menu: a detail screen matches by its own name and by its ticker ---- */
  function matchScreens(query) {
    const q = String(query || "").trim().toUpperCase();
    if (!q) return DETAIL_SCREENS.slice();
    return DETAIL_SCREENS.filter((s) =>
      s.label.toUpperCase().includes(q) || (s.ticker && s.ticker.startsWith(q)) ||
      (s.kind === "fundamentals" && "FUNDAMENTALS".startsWith(q)));
  }

  /* ---- the overlay itself ---- */
  let OPEN = null;   /* { kind, ticker, node, frame, restoreFocus } */

  function viewMode() {
    try { return new URLSearchParams(root.location.search).get("view") || ""; } catch (e) { return ""; }
  }

  function ensureStyle(doc) {
    if (doc.getElementById("detailOverlayStyle")) return;
    const css = doc.createElement("style");
    css.id = "detailOverlayStyle";
    css.textContent =
      "#detailOverlay{position:fixed;inset:0;z-index:60;background:rgba(5,6,10,.86);" +
      "display:flex;align-items:stretch;justify-content:center;backdrop-filter:blur(2px)}" +
      "#detailOverlay .sheet{flex:1 1 auto;margin:18px;border:1px solid #252538;border-radius:8px;" +
      "background:#0A0A0F;box-shadow:0 18px 60px rgba(0,0,0,.6);overflow:hidden;display:flex}" +
      "#detailOverlay iframe{flex:1 1 auto;border:0;width:100%;height:100%;background:#0A0A0F}" +
      "@media (max-width:760px){#detailOverlay .sheet{margin:0;border-radius:0;border:0}}" +
      ".pane .detail-open{position:absolute;top:4px;right:5px;z-index:14;font:600 10px/1 var(--mono," +
      "ui-monospace,monospace);letter-spacing:.08em;color:#C6C8DE;background:rgba(13,13,20,.86);" +
      "border:1px solid #252538;border-radius:4px;padding:3px 5px;cursor:pointer;opacity:.55}" +
      ".pane .detail-open:hover{opacity:1;color:#F2F2F8;border-color:#00D4FF}";
    (doc.head || doc.documentElement).appendChild(css);
  }

  function open(ticker, options) {
    const opts = options || {};
    const doc = root.document;
    if (!doc) return null;
    const kind = opts.kind === "fundamentals" ? "fundamentals" : "detail";
    const t = clean(ticker);
    if (kind === "detail" && !t) return null;
    /* Re-opening for the same ticker is a no-op rather than a second frame. */
    if (OPEN && OPEN.kind === kind && OPEN.ticker === t) return OPEN;
    if (OPEN) close();
    ensureStyle(doc);
    const node = doc.createElement("div");
    node.id = "detailOverlay";
    node.setAttribute("role", "dialog");
    node.setAttribute("aria-label", kind === "fundamentals" ? "Fundamentals" : t + " detail view");
    const sheet = doc.createElement("div");
    sheet.className = "sheet";
    const frame = doc.createElement("iframe");
    frame.src = kind === "fundamentals" ? fundamentalsUrl(t, viewMode()) : detailUrl(t, opts.range || "3h", viewMode());
    frame.setAttribute("title", kind === "fundamentals" ? "Fundamentals" : t + " detail");
    sheet.appendChild(frame);
    node.appendChild(sheet);
    /* A click on the darkened wall behind the sheet closes, like every other Station overlay. */
    node.addEventListener("click", (e) => { if (e.target === node) close(); });
    doc.body.appendChild(node);
    OPEN = { kind, ticker:t, node, frame, url:frame.src };
    try { frame.focus(); } catch (e) {}
    return OPEN;
  }

  function openFundamentals(ticker) { return open(ticker || "", { kind:"fundamentals" }); }

  /* CLOSING REMOVES THE FRAME. Not display:none, not a cached iframe kept "warm" — the
     detail view is mounted only while it is shown, which is the load contract in the brief. */
  function close() {
    if (!OPEN) return false;
    const node = OPEN.node;
    OPEN = null;
    if (node && node.parentNode) node.parentNode.removeChild(node);
    return true;
  }
  const isOpen = () => !!OPEN;
  const current = () => (OPEN ? { kind:OPEN.kind, ticker:OPEN.ticker, url:OPEN.url } : null);

  /* ---- the ⤢ badge the deck puts on a chart pane ---- */
  function attach(pane) {
    if (!pane || !pane.node || !pane.def || pane.def.kind !== "chart") return false;
    if (pane.node.querySelector(".detail-open")) return false;
    const doc = root.document;
    ensureStyle(doc);
    const btn = doc.createElement("button");
    btn.type = "button";
    btn.className = "detail-open";
    btn.textContent = "⤢ DETAIL";
    btn.title = "open this ticker's detail view over the wall (Esc returns)";
    btn.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      /* AN EMPTY SLOT HAS NO TICKER, AND ITS TITLE IS THE WORDS "Choose a symbol" — reading a
         ticker out of that would open a detail view for a name that does not exist. An empty
         slot does here exactly what its own card does: it asks for a symbol. */
      const t = clean(pane.def.ticker);
      if (t) { open(t, { range:(root.RANGE || "3h") }); return; }
      if (typeof root.focusTickerFor === "function") root.focusTickerFor(pane.def.key);
    });
    pane.node.appendChild(btn);
    /* The pane's own title is a second way in, for a pane whose badge is under the pointer. */
    const title = pane.node.querySelector(".t, .title, .ph");
    if (title) title.addEventListener("dblclick", () => {
      const t = clean(pane.def.ticker);
      if (t) open(t, { range:(root.RANGE || "3h") });
    });
    return true;
  }

  /* ---- the jump list: the deck hands us its list element and we add our entries ---- */
  function appendJumpEntries(list, query, onPick) {
    if (!list || !root.document) return 0;
    const doc = root.document;
    let n = 0;
    for (const screen of matchScreens(query)) {
      const b = doc.createElement("button");
      b.type = "button";
      b.className = "btn";
      b.textContent = screen.label;
      b.title = screen.kind === "fundamentals"
        ? "one ticker, stored fundamentals — never in the rotation"
        : screen.label + " — the zoomed view, over the wall";
      b.addEventListener("click", () => {
        if (typeof onPick === "function") onPick(screen);
        if (screen.kind === "fundamentals") openFundamentals("");
        else open(screen.ticker, { range:(root.RANGE || "3h") });
      });
      list.appendChild(b);
      n++;
    }
    return n;
  }

  /* ---- messages from the shells, and the keyboard ---- */
  function onMessage(event) {
    const data = event && event.data;
    if (!data || typeof data !== "object") return;
    if (data.sc === "detail-close") { close(); return; }
    if (data.sc === "detail-rotation-add") {
      const res = addToQueue(data.ticker, data.range);
      /* the deck may want to paint a receipt; it is an event, never a page change */
      try {
        root.dispatchEvent(new root.CustomEvent("station-detail-rotation", { detail:{ ticker:res.ticker, queue:res.queue } }));
      } catch (e) {}
      return;
    }
    /* honoured in advance: if the chart shell ever offers its own expand gesture */
    if (data.sc === "chart-expand" && data.ticker) open(data.ticker, { range:data.range || root.RANGE || "3h" });
  }

  function install() {
    if (!root.addEventListener) return;
    root.addEventListener("message", onMessage);
    root.addEventListener("keydown", (e) => { if (e.key === "Escape" && OPEN) { e.stopPropagation(); close(); } }, true);
  }
  install();

  root.StationDetail = Object.freeze({
    DETAIL_SCREENS, QUEUE_KEY, QUEUE_MAX,
    detailUrl, fundamentalsUrl,
    readQueue, addToQueue, removeFromQueue, matchScreens,
    open, openFundamentals, close, isOpen, current, attach, appendJumpEntries
  });
})(typeof globalThis === "object" ? globalThis : window);
