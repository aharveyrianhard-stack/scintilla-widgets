(() => {
  if (window.__xFeedFloatLoaded) {
    return;
  }
  window.__xFeedFloatLoaded = true;

  const STORAGE_KEY = "xFeedFloatSettings";
  const DEFAULT_SETTINGS = {
    settingsVersion: 9,
    speedPxPerSecond: 3,
    sourceZoom: 1,
    resumeDelayMs: 550,
    viewerWidth: 430,
    viewerHeight: 690,
    preferredFeedTab: "Trading",
    activeView: "trading",
    hideFeedTabs: true,
    minimizeSourceOnOpen: true
  };

  const session = {
    pipWindow: null,
    mediaStream: null,
    video: null,
    canvas: null,
    canvasFrame: null,
    captureIsRegionCropped: false,
    captureLayoutStyle: null,
    cropTargetElement: null,
    cropColumn: null,
    cropResizeObserver: null,
    cropMutationObserver: null,
    cropUpdateFrame: null,
    cropGeometryTimer: null,
    stationCropGeometry: null,
    stationCropGeometryDirty: true,
    notificationMutationObserver: null,
    notificationFilterFrame: null,
    scrollFrame: null,
    scrollFrameWindow: null,
    lastScrollTimestamp: null,
    scrollCarryPx: 0,
    stationRenderedOffset: 0,
    stationScrollGeneration: 0,
    stationPendingScrollGeneration: 0,
    stationMetrics: {
      ticks: 0,
      integerScrolls: 0,
      confirmedCaptureFrames: 0,
      geometryMeasures: 0,
      geometryInvalidations: 0,
      negativeCommitOffsets: 0
    },
    scrollEnabled: false,
    pointerPause: false,
    resumeTimer: null,
    collapsed: false,
    closing: false,
    controlsTimer: null,
    switchingView: false,
    activeView: "trading",
    settings: { ...DEFAULT_SETTINGS },
    stationMode: false,
    stationConsumer: null,
    stationRelayTimer: null,
    stationHoverShield: null,
    ui: {}
  };
  let settingsReady = null;

  function runtimeMessage(message) {
    try {
      if (!chrome.runtime?.id) {
        return Promise.resolve({ ok: false, error: "Extension context invalidated." });
      }
      return chrome.runtime.sendMessage(message).catch((error) => ({
        ok: false,
        error: error?.message || "Extension message failed."
      }));
    } catch (error) {
      return Promise.resolve({
        ok: false,
        error: error?.message || "Extension context invalidated."
      });
    }
  }

  function loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(STORAGE_KEY, (data) => {
        const saved = data[STORAGE_KEY] || {};
        session.settings = {
          ...DEFAULT_SETTINGS,
          ...saved,
          settingsVersion: 9,
          // The float is the working surface. Always tuck away its oversized
          // source after a successful launch, even if an older build saved a
          // stale false value for this preference.
          minimizeSourceOnOpen: true
        };

        if ((saved.settingsVersion || 0) < 4) {
          session.settings.speedPxPerSecond = Math.min(
            Number(saved.speedPxPerSecond) || DEFAULT_SETTINGS.speedPxPerSecond,
            DEFAULT_SETTINGS.speedPxPerSecond
          );
          session.settings.sourceZoom = DEFAULT_SETTINGS.sourceZoom;
        }

        // Older builds encouraged much faster values because their low end
        // could stall. Start the first 0.6.7 session at the preferred calm
        // pace; after that, preserve whatever the viewer chooses.
        if ((saved.settingsVersion || 0) < 9) {
          session.settings.speedPxPerSecond = Math.min(
            Number(session.settings.speedPxPerSecond) || DEFAULT_SETTINGS.speedPxPerSecond,
            DEFAULT_SETTINGS.speedPxPerSecond
          );
        }

        const savedSpeed = Number(session.settings.speedPxPerSecond);
        const savedZoom = Number(session.settings.sourceZoom);
        session.settings.speedPxPerSecond = Math.max(
          0.5,
          Math.min(30, Number.isFinite(savedSpeed) ? savedSpeed : DEFAULT_SETTINGS.speedPxPerSecond)
        );
        session.settings.sourceZoom = Math.max(
          0.25,
          Math.min(1, Number.isFinite(savedZoom) ? savedZoom : DEFAULT_SETTINGS.sourceZoom)
        );

        chrome.storage.local.set({ [STORAGE_KEY]: session.settings });
        resolve(session.settings);
      });
    });
  }

  function saveSettings(patch = {}) {
    session.settings = { ...session.settings, ...patch };
    chrome.storage.local.set({ [STORAGE_KEY]: session.settings });
  }

  // The curved speed scale gives the calm 0.5–10 px/s region most of the
  // slider while retaining a deliberately capped 30 px/s upper end.
  function speedFromSlider(position) {
    const slider = Math.max(0, Math.min(100, Number(position)));
    const speed = 0.5 + Math.pow(slider / 100, 2) * 29.5;
    return Math.round(speed * 10) / 10;
  }

  function sliderFromSpeed(value) {
    const speed = Math.max(0.5, Math.min(30, Number(value)));
    return Math.sqrt((speed - 0.5) / 29.5) * 100;
  }

  function zoomFromSlider(position) {
    const slider = Math.max(0, Math.min(100, Number(position)));
    const zoom = 0.25 + (slider / 100) * 0.75;
    return Math.round(zoom * 100) / 100;
  }

  function sliderFromZoom(value) {
    const zoom = Math.max(0.25, Math.min(1, Number(value)));
    return ((zoom - 0.25) / 0.75) * 100;
  }

  function isPaused() {
    return !session.scrollEnabled || session.pointerPause;
  }

  function pauseLabel() {
    if (session.pointerPause) {
      return "HOVER";
    }
    if (!session.scrollEnabled) {
      return "PAUSED";
    }
    return "LIVE";
  }

  function updateUi() {
    const {
      app,
      status,
      stage,
      speedValue,
      zoomValue
    } = session.ui;
    if (!status) {
      return;
    }

    const label = pauseLabel();
    const paused = isPaused();

    status.textContent = label;
    status.dataset.mode = paused ? "paused" : "live";
    stage?.classList.toggle("is-hover-paused", session.pointerPause);
    const speed = Math.round(session.settings.speedPxPerSecond * 10) / 10;
    speedValue.textContent = `${Number.isInteger(speed) ? speed : speed.toFixed(1)} px/s`;
    zoomValue.textContent = `${Math.round(session.settings.sourceZoom * 100)}%`;
    app?.classList.toggle("is-paused", paused);
    for (const button of session.ui.viewButtons || []) {
      const isActive = button.dataset.view === session.activeView;
      button.setAttribute("aria-pressed", String(isActive));
    }
  }

  function startScrolling() {
    session.scrollEnabled = true;
    session.lastScrollTimestamp = null;

    if (session.scrollFrame) {
      updateUi();
      return;
    }

    const step = (timestamp) => {
      if (!session.scrollEnabled && !session.pipWindow) {
        session.scrollFrame = null;
        return;
      }

      if (session.lastScrollTimestamp === null) {
        session.lastScrollTimestamp = timestamp;
      }

      const elapsedMs = Math.min(timestamp - session.lastScrollTimestamp, 100);
      session.lastScrollTimestamp = timestamp;

      if (!isPaused()) {
        const root = document.scrollingElement || document.documentElement;
        session.scrollCarryPx +=
          (session.settings.speedPxPerSecond * elapsedMs) / 1000;

        // scrollTop is effectively whole-pixel on some X/Chrome layouts. Keep
        // fractional motion in our own accumulator so low speeds still advance.
        // The canvas renderer uses the remaining fraction as a subpixel crop
        // offset, making even 3 px/s visibly continuous between DOM steps.
        const wholePixels = Math.floor(session.scrollCarryPx);
        if (wholePixels > 0) {
          const before = root.scrollTop;
          root.scrollTop = before + wholePixels;
          session.scrollCarryPx = root.scrollTop > before
            ? session.scrollCarryPx - wholePixels
            : 0;
        }
      }

      const frameWindow =
        session.pipWindow && !session.pipWindow.closed
          ? session.pipWindow
          : window;
      session.scrollFrameWindow = frameWindow;
      session.scrollFrame = frameWindow.requestAnimationFrame(step);
    };

    const frameWindow =
      session.pipWindow && !session.pipWindow.closed
        ? session.pipWindow
        : window;
    session.scrollFrameWindow = frameWindow;
    session.scrollFrame = frameWindow.requestAnimationFrame(step);
    updateUi();
  }

  function stopScrolling() {
    session.scrollEnabled = false;
    session.lastScrollTimestamp = null;
    resetStationScrollComposite();
    updateUi();
  }

  function setPointerPause(paused) {
    if (session.resumeTimer) {
      clearTimeout(session.resumeTimer);
      session.resumeTimer = null;
    }

    if (paused) {
      session.pointerPause = true;
      updateUi();
      return;
    }

    session.resumeTimer = setTimeout(() => {
      session.pointerPause = false;
      session.resumeTimer = null;
      updateUi();
      if (session.stationMode) installStationHoverShield();
    }, session.settings.resumeDelayMs);
  }

  function pointerIsInsideStationCrop(event, rect) {
    const x = Number(event?.clientX);
    const y = Number(event?.clientY);
    return Number.isFinite(x) && Number.isFinite(y) &&
      x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  // The shield pauses unattended source scrolling while hovered. A deliberate
  // first pointerdown removes it before the next native click/tap, so ordinary
  // X interaction remains an explicit separate action rather than a synthetic
  // replay. The shield is armed again only after automatic scrolling resumes.
  function installStationHoverShield() {
    if (!session.stationMode || session.stationHoverShield) return;
    const rect = calculateCropRect();
    const shield = document.createElement("div");
    shield.id = "x-feed-float-station-hover-shield";
    shield.setAttribute("aria-hidden", "true");
    Object.assign(shield.style, {
      position: "fixed",
      pointerEvents: "auto",
      zIndex: "2147483645",
      left: `${Math.round(rect.left)}px`,
      top: `${Math.round(rect.top)}px`,
      width: `${Math.round(rect.width)}px`,
      height: `${Math.round(rect.height)}px`,
      background: "transparent",
      cursor: "default"
    });
    const beginNativeInteraction = () => {
      if (!session.stationMode) return;
      const exitObserver = (event) => {
        if (pointerIsInsideStationCrop(event, calculateCropRect())) return;
        document.removeEventListener("pointermove", exitObserver, true);
        if (session.stationHoverShield?.exitObserver === exitObserver) {
          session.stationHoverShield = null;
        }
        setPointerPause(false);
      };
      shield.remove();
      session.stationHoverShield = { exitObserver };
      document.addEventListener("pointermove", exitObserver, true);
      setPointerPause(true);
    };
    shield.addEventListener("pointerenter", () => setPointerPause(true));
    shield.addEventListener("pointerleave", () => setPointerPause(false));
    shield.addEventListener("pointerdown", beginNativeInteraction, { once: true });
    document.documentElement.appendChild(shield);
    session.stationHoverShield = { element: shield };
  }

  function removeStationHoverShield() {
    const shield = session.stationHoverShield;
    if (shield) {
      shield.element?.remove();
      if (shield.exitObserver) {
        document.removeEventListener("pointermove", shield.exitObserver, true);
      }
    }
    session.stationHoverShield = null;
  }

  function findPrimaryColumn() {
    return (
      document.querySelector('[data-testid="primaryColumn"]') ||
      document.querySelector('main[role="main"] section') ||
      document.querySelector('main[role="main"]') ||
      document.querySelector("main")
    );
  }

  function findFeedTabsBottom(viewportHeight) {
    const column = findPrimaryColumn();
    let chromeBottom = 0;

    if (session.settings.hideFeedTabs) {
      const visibleTabStrips = [
        ...(column?.querySelectorAll('[role="tablist"]') || [])
      ]
        .map((tabStrip) => ({ rect: tabStrip.getBoundingClientRect() }))
        .filter(({ rect }) =>
          rect.height > 20 &&
          rect.height < 120 &&
          rect.bottom > 0 &&
          rect.bottom <= viewportHeight * 0.32
        )
        .sort((a, b) => a.rect.top - b.rect.top);
      chromeBottom = visibleTabStrips[0]?.rect.bottom || 0;
    }

    // X's notification-generated /i/timeline adds a sticky Back + Posts bar.
    // It can slide away and later reappear while the timeline scrolls. Measure
    // it every frame and crop below its live edge instead of letting it cover a
    // post. The small buffer includes the header's lower padding/border.
    if (window.location.pathname === "/i/timeline") {
      const postsHeader = [...(column?.querySelectorAll("h2") || [])]
        .map((heading) => ({
          heading,
          rect: heading.getBoundingClientRect()
        }))
        .filter(({ heading, rect }) =>
          elementLabel(heading) === "Posts" &&
          rect.height > 12 &&
          rect.height < 80 &&
          rect.bottom > 0 &&
          rect.top < viewportHeight * 0.2
        )
        .sort((a, b) => a.rect.top - b.rect.top)[0];

      if (postsHeader) {
        chromeBottom = Math.max(chromeBottom, postsHeader.rect.bottom + 12);
      }
    }

    return Math.max(
      0,
      Math.min(viewportHeight - 160, Math.ceil(chromeBottom) + 1)
    );
  }

  function applyNotificationFilter() {
    document.documentElement.dataset.xffCaptureView = session.activeView;
    if (session.activeView !== "notifications") {
      return;
    }

    const column = findPrimaryColumn();
    const notifications = [
      ...(column?.querySelectorAll('[data-testid="notification"]') || [])
    ];
    for (const notification of notifications) {
      const label = (notification.innerText || notification.textContent || "")
        .replace(/\s+/g, " ")
        .trim();
      notification.dataset.xffPostNotification = String(
        label.includes("New post notifications for")
      );
    }
  }

  function scheduleNotificationFilter() {
    if (session.notificationFilterFrame) {
      cancelAnimationFrame(session.notificationFilterFrame);
    }
    session.notificationFilterFrame = requestAnimationFrame(() => {
      session.notificationFilterFrame = null;
      applyNotificationFilter();
    });
  }

  function ensureNotificationFilterObserver() {
    if (session.notificationMutationObserver || !document.body) {
      return;
    }
    session.notificationMutationObserver = new MutationObserver(
      scheduleNotificationFilter
    );
    session.notificationMutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  function applyCaptureColumnLayout() {
    const pipWindow = session.pipWindow;
    const stage = session.ui.stage;
    const station = session.stationMode ? session.stationConsumer : null;
    if ((!pipWindow || pipWindow.closed || !stage) && !station) {
      return;
    }

    if (!session.captureLayoutStyle) {
      const style = document.createElement("style");
      style.id = "x-feed-float-capture-layout";
      style.textContent = `
        [data-testid="primaryColumn"] {
          width: var(--xff-capture-column-width) !important;
          min-width: var(--xff-capture-column-width) !important;
          max-width: var(--xff-capture-column-width) !important;
          flex-basis: var(--xff-capture-column-width) !important;
        }

        [data-testid="tweet"] [data-testid="Tweet-User-Avatar"],
        [data-testid="tweet"] [data-testid^="UserAvatar-Container"] {
          visibility: hidden !important;
        }

        [data-testid="tweet"] [role="group"]:has([data-testid="reply"]):has([data-testid="retweet"]):has([data-testid="like"]) {
          display: none !important;
        }

        html[data-xff-capture-view="notifications"]
          [data-testid="notification"][data-xff-post-notification="false"] {
          display: none !important;
        }
      `;
      document.documentElement.appendChild(style);
      session.captureLayoutStyle = style;
    }

    ensureNotificationFilterObserver();
    applyNotificationFilter();

    const viewportHeight =
      document.documentElement.clientHeight || window.innerHeight;
    const visibleHeight = Math.max(
      220,
      viewportHeight - findFeedTabsBottom(viewportHeight)
    );
    const frameAspect = Math.max(
      0.45,
      Math.min(
        1.8,
        (stage?.clientWidth || station?.width || 430) /
          Math.max(1, stage?.clientHeight || station?.height || 690)
      )
    );
    const zoom = Math.max(0.25, session.settings.sourceZoom || 1);
    const desiredPhysicalWidth = Math.max(
      300,
      Math.min(540, visibleHeight * zoom * frameAspect)
    );
    const cssWidth = Math.max(240, Math.min(600, desiredPhysicalWidth / zoom));

    document.documentElement.style.setProperty(
      "--xff-capture-column-width",
      `${Math.round(cssWidth)}px`
    );
  }

  function removeCaptureColumnLayout() {
    session.captureLayoutStyle?.remove();
    session.captureLayoutStyle = null;
    session.notificationMutationObserver?.disconnect();
    session.notificationMutationObserver = null;
    if (session.notificationFilterFrame) {
      cancelAnimationFrame(session.notificationFilterFrame);
      session.notificationFilterFrame = null;
    }
    document.documentElement.removeAttribute("data-xff-capture-view");
    for (const notification of document.querySelectorAll(
      '[data-xff-post-notification]'
    )) {
      notification.removeAttribute("data-xff-post-notification");
    }
    document.documentElement.style.removeProperty("--xff-capture-column-width");
  }

  function findInnerContentLeft(column, top, viewportHeight) {
    const candidates = [];
    const tweets = [...column.querySelectorAll('[data-testid="tweet"]')];

    for (const tweet of tweets) {
      const tweetRect = tweet.getBoundingClientRect();
      if (tweetRect.bottom <= top || tweetRect.top >= viewportHeight) {
        continue;
      }

      const anchor =
        tweet.querySelector('[data-testid="tweetText"]') ||
        tweet.querySelector('[data-testid="User-Name"]') ||
        tweet.querySelector('[data-testid="tweetPhoto"]') ||
        tweet.querySelector('[data-testid="card.wrapper"]');
      const anchorRect = anchor?.getBoundingClientRect();
      if (anchorRect && anchorRect.width > 20) {
        candidates.push(anchorRect.left);
      }
    }

    if (!candidates.length) {
      return null;
    }

    candidates.sort((a, b) => a - b);
    return candidates[Math.floor(candidates.length / 2)];
  }

  // The Station renderer can crop a captured X frame by a fractional offset.
  // Keep that fractional state separate from the source page's integer
  // scrollTop: on an integer move the capture pipeline can still be painting
  // the pre-scroll frame for a couple of source frames. Replacing .9 with .2
  // at that instant is the backwards "bounce" the viewers were seeing.
  function nextStationScrollState(state, elapsedMs, speedPxPerSecond, appliedPixels) {
    const accrued = Math.max(0, Number(state.carryPx) || 0) +
      (Math.max(0, Number(speedPxPerSecond) || 0) * Math.max(0, Number(elapsedMs) || 0)) / 1000;
    const requestedPixels = Math.floor(accrued);
    const movedPixels = Math.max(0, Math.min(requestedPixels, Number(appliedPixels) || 0));

    if (requestedPixels > 0 && movedPixels === 0) {
      return {
        carryPx: 0,
        renderedOffset: 0,
        generation: Number(state.generation) || 0,
        requestedPixels,
        movedPixels,
        needsSettle: false
      };
    }

    const carryPx = requestedPixels > 0 ? accrued - movedPixels : accrued;
    const integerMove = movedPixels > 0;
    return {
      carryPx,
      // Do not replace the currently rendered fractional crop until the
      // source has passed its post-scroll capture-frame settle barrier.
      renderedOffset: integerMove ? (Number(state.renderedOffset) || 0) : carryPx,
      generation: (Number(state.generation) || 0) + (integerMove ? 1 : 0),
      requestedPixels,
      movedPixels,
      needsSettle: integerMove
    };
  }

  function refreshStationCropGeometry({ force = false } = {}) {
    if (!force && !session.stationCropGeometryDirty && session.stationCropGeometry) {
      return session.stationCropGeometry;
    }
    session.stationCropGeometry = calculateCropRect();
    session.stationCropGeometryDirty = false;
    session.stationMetrics.geometryMeasures += 1;
    return session.stationCropGeometry;
  }

  function invalidateStationCropGeometry() {
    session.stationCropGeometryDirty = true;
    session.stationMetrics.geometryInvalidations += 1;
    if (session.cropGeometryTimer) {
      return;
    }

    // X virtualizes its timeline aggressively. Coalesce its mutation bursts
    // so a 10 Hz Station clock never forces a fresh DOM geometry scan.
    session.cropGeometryTimer = setTimeout(() => {
      session.cropGeometryTimer = null;
      if (!session.cropTargetElement && !session.stationMode) {
        return;
      }
      if (session.cropUpdateFrame) {
        return;
      }
      session.cropUpdateFrame = requestAnimationFrame(() => {
        session.cropUpdateFrame = null;
        applyCropTargetGeometry();
      });
    }, 120);
  }

  function requestStationCaptureFrame(generation) {
    runtimeMessage({ type: "XFF_STATION_SCROLL_GENERATION", generation }).catch(() => {});
  }

  function confirmStationCaptureFrame(generation) {
    const confirmed = Math.max(0, Number(generation) || 0);
    /* A late frame belongs to a scroll position we have already superseded.
       Keep the last confirmed crop until the newest generation is decoded. */
    if (!confirmed || confirmed !== session.stationPendingScrollGeneration) return false;
    session.stationRenderedOffset = session.scrollCarryPx;
    session.stationPendingScrollGeneration = 0;
    session.stationMetrics.confirmedCaptureFrames += 1;
    runtimeMessage({ type: "XFF_STATION_CROP", crop: stationCropPayload() });
    return true;
  }

  function resetStationScrollComposite() {
    session.scrollCarryPx = 0;
    session.stationRenderedOffset = 0;
    session.stationPendingScrollGeneration = 0;
  }

  function calculateCropRect() {
    const column = findPrimaryColumn();
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const viewportHeight = document.documentElement.clientHeight || window.innerHeight;

    if (!column) {
      const fallbackWidth = Math.min(640, viewportWidth);
      return {
        left: Math.max(0, (viewportWidth - fallbackWidth) / 2),
        top: 0,
        width: fallbackWidth,
        height: viewportHeight
      };
    }

    const rect = column.getBoundingClientRect();
    const baseLeft = Math.max(0, rect.left);
    const baseRight = Math.min(viewportWidth, rect.right);
    const baseWidth = Math.max(240, baseRight - baseLeft);
    const top = findFeedTabsBottom(viewportHeight);

    // The useful visual lane starts where tweet text and media cards start,
    // not at X's avatar rail. Prefer live tweet geometry and use the stable X
    // column ratio as a fallback while the timeline is mounting.
    const detectedContentLeft = findInnerContentLeft(column, top, viewportHeight);
    const fallbackContentLeft = baseLeft + Math.min(64, baseWidth * 0.19);
    const rightTrim = Math.min(18, baseWidth * 0.06);
    const contentRight = baseRight - rightTrim;
    const minimumContentWidth = Math.max(160, baseWidth * 0.68);
    const contentLeft = Math.min(
      contentRight - minimumContentWidth,
      Math.max(baseLeft, detectedContentLeft ?? fallbackContentLeft)
    );

    return {
      left: contentLeft,
      top,
      width: Math.min(contentRight - contentLeft, viewportWidth - contentLeft),
      height: Math.max(160, viewportHeight - top)
    };
  }

  function applyCropTargetGeometry() {
    if (!session.cropTargetElement) {
      return;
    }

    const rect = refreshStationCropGeometry({ force: true });
    Object.assign(session.cropTargetElement.style, {
      left: `${Math.round(rect.left)}px`,
      top: `${Math.round(rect.top)}px`,
      width: `${Math.round(rect.width)}px`,
      height: `${Math.round(rect.height)}px`
    });
  }

  function scheduleCropTargetUpdate() {
    invalidateStationCropGeometry();
  }

  function createCropTargetElement() {
    removeCropTargetElement();

    const target = document.createElement("div");
    target.id = "x-feed-float-crop-target";
    target.setAttribute("aria-hidden", "true");
    Object.assign(target.style, {
      position: "fixed",
      pointerEvents: "none",
      zIndex: "2147483646",
      background: "rgba(0, 0, 0, 0.001)"
    });

    document.documentElement.appendChild(target);
    session.cropTargetElement = target;
    applyCropTargetGeometry();

    window.addEventListener("resize", scheduleCropTargetUpdate);

    if ("ResizeObserver" in window) {
      session.cropResizeObserver = new ResizeObserver(scheduleCropTargetUpdate);
    }

    const observeCurrentColumn = () => {
      const column = findPrimaryColumn();
      if (column !== session.cropColumn) {
        session.cropResizeObserver?.disconnect();
        session.cropColumn = column;
        if (column) {
          session.cropResizeObserver?.observe(column);
        }
      }
      scheduleCropTargetUpdate();
    };

    observeCurrentColumn();

    if (document.body) {
      session.cropMutationObserver = new MutationObserver(observeCurrentColumn);
      session.cropMutationObserver.observe(document.body, {
        childList: true,
        subtree: true
      });
    }

    return target;
  }

  function removeCropTargetElement() {
    window.removeEventListener("resize", scheduleCropTargetUpdate);
    session.cropResizeObserver?.disconnect();
    session.cropMutationObserver?.disconnect();
    session.cropResizeObserver = null;
    session.cropMutationObserver = null;
    session.cropColumn = null;

    if (session.cropUpdateFrame) {
      cancelAnimationFrame(session.cropUpdateFrame);
      session.cropUpdateFrame = null;
    }
    if (session.cropGeometryTimer) {
      clearTimeout(session.cropGeometryTimer);
      session.cropGeometryTimer = null;
    }
    session.stationCropGeometry = null;
    session.stationCropGeometryDirty = true;

    session.cropTargetElement?.remove();
    session.cropTargetElement = null;
  }

  async function requestCaptureStream() {
    const response = await runtimeMessage({
      type: "XFF_GET_STREAM_ID"
    });

    if (!response?.ok || !response.streamId) {
      throw new Error(response?.error || "Chrome could not capture this tab.");
    }

    return navigator.mediaDevices.getUserMedia({
      video: {
        mandatory: {
          chromeMediaSource: "tab",
          chromeMediaSourceId: response.streamId,
          minWidth: 240,
          minHeight: 240,
          maxWidth: 2560,
          maxHeight: 1440,
          minFrameRate: 10,
          maxFrameRate: 60
        }
      },
      audio: false
    });
  }

  async function cropStream(stream, target) {
    const [track] = stream.getVideoTracks();
    if (
      !track ||
      !("CropTarget" in window) ||
      typeof CropTarget.fromElement !== "function" ||
      typeof track.cropTo !== "function"
    ) {
      return false;
    }

    try {
      const cropTarget = await CropTarget.fromElement(target);
      await track.cropTo(cropTarget);
      return true;
    } catch (error) {
      console.warn("X Feed Float is using visual center-crop fallback:", error);
      return false;
    }
  }

  function viewerMarkup(documentRef) {
    const root = documentRef.createElement("div");
    root.className = "xff-app";
    root.innerHTML = `
      <main class="xff-stage">
        <video class="xff-video" autoplay muted playsinline></video>
        <canvas class="xff-canvas"></canvas>
      </main>
      <span class="xff-resize-cue xff-resize-cue-top" aria-hidden="true"></span>
      <span class="xff-resize-cue xff-resize-cue-bottom" aria-hidden="true"></span>
      <button class="xff-minimize-peek" type="button" title="Minimize feed" aria-label="Minimize feed">−</button>
      <div class="xff-bubble" role="toolbar" aria-label="Feed controls">
        <span class="xff-status" data-mode="live">LIVE</span>
        <button class="xff-icon-button xff-view-button" data-view="trading" type="button" title="Trading feed" aria-label="Show Trading feed">T</button>
        <button class="xff-icon-button xff-view-button" data-view="notifications" type="button" title="New post notifications" aria-label="Show new post notifications">N</button>
        <span class="xff-divider" aria-hidden="true"></span>
        <button class="xff-icon-button xff-rewind" type="button" title="Go back 30 seconds" aria-label="Go back 30 seconds">−30s</button>
        <button class="xff-icon-button xff-refresh" type="button" title="Refresh current feed" aria-label="Refresh current feed">↻</button>
        <button class="xff-icon-button xff-settings-toggle" type="button" title="Speed and source zoom" aria-label="Speed and source zoom">⚙︎</button>
      </div>
      <div class="xff-settings-panel">
        <label class="xff-control">
          <span>Speed</span>
          <input class="xff-speed" type="range" min="0" max="100" step="1">
          <output class="xff-speed-value"></output>
        </label>
        <label class="xff-control">
          <span>X zoom</span>
          <input class="xff-zoom" type="range" min="0" max="100" step="1">
          <output class="xff-zoom-value"></output>
        </label>
      </div>
      <div class="xff-compact">
        <button class="xff-icon-button xff-compact-expand" type="button" title="Restore window" aria-label="Restore window">›</button>
        <button class="xff-icon-button xff-compact-source" type="button" title="Open full X" aria-label="Open full X">↗</button>
      </div>
    `;
    return root;
  }

  function viewerStyles(documentRef) {
    const style = documentRef.createElement("style");
    style.textContent = `
      :root {
        color-scheme: dark;
        font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #000;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        width: 100%;
        height: 100%;
        margin: 0;
        overflow: hidden;
        background: #000;
        color: #f2f2f2;
      }

      button,
      input {
        font: inherit;
      }

      .xff-app {
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: #000;
      }

      .xff-mark {
        width: 5px;
        height: 5px;
        flex: 0 0 auto;
        border-radius: 50%;
        background: #1d9bf0;
        box-shadow: 0 0 10px rgba(29, 155, 240, 0.82);
      }

      .xff-status {
        color: #68bdf5;
        font-size: 8px;
        font-weight: 800;
        letter-spacing: 0.1em;
      }

      .xff-status {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
      }

      .xff-status[data-mode="paused"] {
        color: #d7b957;
      }

      .xff-icon-button {
        display: grid;
        width: 17px;
        height: 17px;
        place-items: center;
        border: 0;
        border-radius: 50%;
        padding: 0;
        color: rgba(255, 255, 255, 0.82);
        background: rgba(255, 255, 255, 0.08);
        font-size: 10px;
        font-weight: 700;
        line-height: 1;
        cursor: pointer;
        transition: color 120ms ease, background 120ms ease, transform 120ms ease;
      }

      .xff-icon-button:hover {
        color: #fff;
        background: rgba(255, 255, 255, 0.18);
        transform: scale(1.05);
      }

      .xff-icon-button[aria-pressed="true"] {
        color: #fff;
        background: rgba(29, 155, 240, 0.5);
      }

      .xff-stage {
        position: absolute;
        inset: 0;
        overflow: hidden;
        background: #000;
        cursor: pointer;
      }

      .xff-video,
      .xff-canvas {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: fill;
        background: #000;
      }

      .xff-canvas {
        display: none;
      }

      .xff-app.xff-canvas-mode .xff-video {
        position: absolute;
        width: 1px;
        height: 1px;
        opacity: 0;
        pointer-events: none;
      }

      .xff-app.xff-canvas-mode .xff-canvas {
        display: block;
      }

      .xff-resize-cue {
        position: absolute;
        z-index: 2;
        width: 9px;
        height: 9px;
        opacity: 0.2;
        pointer-events: none;
        transition: opacity 140ms ease;
      }

      .xff-resize-cue-top {
        left: 2px;
        top: 2px;
        border-top: 1px solid rgba(255, 255, 255, 0.72);
        border-left: 1px solid rgba(255, 255, 255, 0.72);
        border-radius: 3px 0 0;
      }

      .xff-resize-cue-bottom {
        right: 2px;
        bottom: 2px;
        border-right: 1px solid rgba(255, 255, 255, 0.72);
        border-bottom: 1px solid rgba(255, 255, 255, 0.72);
        border-radius: 0 0 3px;
      }

      .xff-app:hover .xff-resize-cue {
        opacity: 0.48;
      }

      .xff-minimize-peek {
        position: absolute;
        right: 2px;
        bottom: 2px;
        z-index: 4;
        display: grid;
        width: 12px;
        height: 12px;
        place-items: center;
        border: 0;
        border-radius: 50%;
        padding: 0 0 1px;
        color: rgba(255, 255, 255, 0.72);
        background: rgba(5, 5, 5, 0.42);
        box-shadow: 0 3px 12px rgba(0, 0, 0, 0.22);
        font-size: 8px;
        line-height: 1;
        cursor: pointer;
        opacity: 0.16;
        transition: opacity 120ms ease, background 120ms ease, transform 120ms ease;
      }

      .xff-app:hover .xff-minimize-peek {
        opacity: 0.42;
      }

      .xff-minimize-peek:hover {
        opacity: 0.96 !important;
        background: rgba(5, 5, 5, 0.82);
        transform: scale(1.05);
      }

      .xff-bubble,
      .xff-settings-panel {
        position: absolute;
        z-index: 3;
        opacity: 0;
        pointer-events: none;
        transition: opacity 160ms ease, transform 160ms ease;
      }

      .xff-bubble {
        right: 6px;
        top: 6px;
        display: flex;
        align-items: center;
        gap: 1px;
        padding: 2px 3px;
        border: 1px solid rgba(255, 255, 255, 0.09);
        border-radius: 999px;
        background: rgba(12, 12, 12, 0.46);
        box-shadow: 0 5px 18px rgba(0, 0, 0, 0.18);
        backdrop-filter: blur(18px) saturate(1.2);
        transform: translateY(-4px);
      }

      .xff-view-button {
        width: 18px;
        border-radius: 999px;
        font-size: 8px;
      }

      .xff-rewind {
        width: 29px;
        border-radius: 999px;
        font-size: 7px;
        font-variant-numeric: tabular-nums;
        letter-spacing: -0.02em;
      }

      .xff-settings-toggle {
        font-size: 9px;
      }

      .xff-divider {
        width: 1px;
        height: 9px;
        margin: 0 1px;
        background: rgba(255, 255, 255, 0.13);
      }

      .xff-app.controls-visible .xff-bubble,
      .xff-app.settings-visible .xff-bubble {
        opacity: 1;
        pointer-events: auto;
        transform: translateY(0);
      }

      .xff-settings-panel {
        left: 8px;
        right: 8px;
        bottom: 8px;
        display: grid;
        gap: 8px;
        padding: 9px 10px 8px;
        border: 1px solid rgba(255, 255, 255, 0.13);
        border-radius: 14px;
        background: rgba(7, 7, 7, 0.68);
        box-shadow: 0 8px 28px rgba(0, 0, 0, 0.36);
        backdrop-filter: blur(16px);
        transform: translateY(8px);
      }

      .xff-app.settings-visible .xff-settings-panel {
        opacity: 1;
        pointer-events: auto;
        transform: translateY(0);
      }

      .xff-control {
        display: grid;
        grid-template-columns: 40px minmax(64px, 1fr) 44px;
        align-items: center;
        gap: 8px;
        color: rgba(255, 255, 255, 0.58);
        font-size: 9px;
        font-weight: 700;
      }

      .xff-control output {
        color: rgba(255, 255, 255, 0.82);
        font-variant-numeric: tabular-nums;
        text-align: right;
      }

      input[type="range"] {
        height: 3px;
        accent-color: #1d9bf0;
        cursor: pointer;
      }

      .xff-compact {
        display: none;
        align-items: center;
        justify-content: center;
        gap: 3px;
        width: 100%;
        height: 100%;
        padding: 3px;
        background: #000;
        backdrop-filter: blur(18px);
      }

      .xff-compact .xff-icon-button {
        width: 15px;
        height: 15px;
        color: rgba(255, 255, 255, 0.52);
        background: rgba(255, 255, 255, 0.05);
        font-size: 9px;
      }

      body.xff-collapsed .xff-stage,
      body.xff-collapsed .xff-resize-cue,
      body.xff-collapsed .xff-minimize-peek,
      body.xff-collapsed .xff-bubble,
      body.xff-collapsed .xff-settings-panel {
        display: none;
      }

      body.xff-collapsed .xff-compact {
        display: flex;
      }
    `;
    return style;
  }

  function collapseViewer() {
    const pipWindow = session.pipWindow;
    if (!pipWindow || session.collapsed) {
      return;
    }

    const width = Math.max(280, pipWindow.outerWidth || session.settings.viewerWidth);
    const height = Math.max(280, pipWindow.outerHeight || session.settings.viewerHeight);
    saveSettings({ viewerWidth: width, viewerHeight: height });
    session.collapsed = true;
    pipWindow.document.body.classList.add("xff-collapsed");

    try {
      pipWindow.resizeTo(120, 44);
      const screenRef = pipWindow.screen;
      const parkedX =
        (screenRef.availLeft || 0) + screenRef.availWidth - 34;
      const parkedY =
        (screenRef.availTop || 0) + screenRef.availHeight - 92;
      pipWindow.moveTo(parkedX, parkedY);
    } catch (error) {
      console.warn("Chrome kept the current PiP size:", error);
    }
  }

  function expandViewer() {
    const pipWindow = session.pipWindow;
    if (!pipWindow) {
      return;
    }

    session.collapsed = false;
    pipWindow.document.body.classList.remove("xff-collapsed");

    try {
      pipWindow.resizeTo(
        Math.max(280, session.settings.viewerWidth),
        Math.max(320, session.settings.viewerHeight)
      );
    } catch (error) {
      console.warn("Chrome kept the current PiP size:", error);
    }
  }

  function wait(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  async function waitFor(getValue, timeoutMs = 7000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const value = getValue();
      if (value) {
        return value;
      }
      await wait(120);
    }
    return null;
  }

  function elementLabel(element) {
    return (element?.innerText || element?.textContent || "").trim();
  }

  function findPrimaryTab(label) {
    const column = findPrimaryColumn();
    return [...(column?.querySelectorAll('[role="tab"]') || [])].find(
      (tab) => elementLabel(tab) === label
    );
  }

  function findSeeNewPostsButton() {
    const column = findPrimaryColumn();
    return [...(column?.querySelectorAll('[role="status"] button') || [])].find(
      (button) => elementLabel(button) === "See new posts"
    );
  }

  function isPostNotificationTimeline() {
    return (
      window.location.pathname === "/i/timeline" &&
      Boolean(findPrimaryColumn()?.querySelector('[data-testid="tweet"]'))
    );
  }

  function findPostNotificationDoorway() {
    const column = findPrimaryColumn();
    const matches = [
      ...(column?.querySelectorAll('[data-testid="notification"]') || [])
    ].filter((notification) =>
      elementLabel(notification).includes("New post notifications for")
    );

    return matches.find((notification) => {
      const rect = notification.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }) || matches[0] || null;
  }

  function routeForView(view) {
    return view === "notifications" ? "/notifications" : "/home";
  }

  function navSelectorForView(view) {
    return view === "notifications"
      ? '[data-testid="AppTabBar_Notifications_Link"][href="/notifications"]'
      : '[data-testid="AppTabBar_Home_Link"][href="/home"]';
  }

  async function ensureViewRoute(view) {
    const route = routeForView(view);
    if (window.location.pathname === route) {
      return;
    }

    const navLink = document.querySelector(navSelectorForView(view));
    if (!navLink) {
      throw new Error(`X's ${view === "notifications" ? "Notifications" : "Home"} button is not available.`);
    }

    navLink.click();
    const arrived = await waitFor(() => window.location.pathname === route);
    if (!arrived) {
      throw new Error(`X did not open ${view === "notifications" ? "Notifications" : "Home"}.`);
    }
  }

  function setActiveView(view) {
    session.activeView = view;
    saveSettings({ activeView: view });
    updateUi();
  }

  async function activateNotificationPosts({ refresh = false } = {}) {
    if (isPostNotificationTimeline()) {
      if (refresh) {
        // X's own live update is the safest refresh here. It keeps the special
        // notification-generated Posts timeline instead of reloading X.
        const refreshPrompt = findSeeNewPostsButton();
        if (refreshPrompt) {
          refreshPrompt.click();
          await wait(420);
        }
      }
      return;
    }

    await ensureViewRoute("notifications");
    const allTab = await waitFor(() => findPrimaryTab("All"));
    if (!allTab) {
      throw new Error("X's All notifications tab is not visible.");
    }

    const changingTab = allTab.getAttribute("aria-selected") !== "true";
    if (changingTab) {
      allTab.click();
      await waitFor(
        () => findPrimaryTab("All")?.getAttribute("aria-selected") === "true",
        5000
      );
      await wait(260);
    }

    if (refresh) {
      const refreshPrompt = findSeeNewPostsButton();
      if (refreshPrompt) {
        refreshPrompt.click();
        await wait(420);
      }
    }

    const doorway = await waitFor(findPostNotificationDoorway, 8000);
    if (!doorway) {
      throw new Error("X did not show a New post notifications row.");
    }

    // Click the ARTICLE itself. Its avatar bubbles and author name are child
    // links, so targeting the row container cannot accidentally open a profile.
    doorway.scrollIntoView({ block: "center", behavior: "auto" });
    doorway.click();

    const arrived = await waitFor(isPostNotificationTimeline, 8000);
    if (!arrived) {
      throw new Error("X did not open the notification Posts feed.");
    }
    await wait(260);
  }

  async function activateView(view, { refresh = false, align = true } = {}) {
    if (session.switchingView) {
      return;
    }

    session.switchingView = true;
    try {
      if (view === "notifications") {
        await activateNotificationPosts({ refresh });
        setActiveView(view);
        applyCaptureColumnLayout();
        scheduleCropTargetUpdate();
        if (align) {
          alignCaptureToFirstVisiblePost();
          setTimeout(alignCaptureToFirstVisiblePost, 650);
        }
        return;
      }

      await ensureViewRoute(view);
      const label = "Trading";
      const tab = await waitFor(() => findPrimaryTab(label));
      if (!tab) {
        throw new Error(`X's ${label} tab is not visible.`);
      }

      const changingTab = tab.getAttribute("aria-selected") !== "true";
      if (changingTab) {
        tab.click();
      }

      if (changingTab) {
        await waitFor(
          () => findPrimaryTab(label)?.getAttribute("aria-selected") === "true",
          5000
        );
        await wait(260);
      }

      if (refresh) {
        // Prefer X's own "See new posts" control—the closest desktop equivalent
        // to pull-to-refresh. If it is not present, re-click only the selected
        // center-column tab. This never reloads X or touches Explore/categories.
        const refreshPrompt = findSeeNewPostsButton();
        (refreshPrompt || findPrimaryTab(label) || tab).click();
      }

      setActiveView(view);
      await wait(changingTab || refresh ? 420 : 80);
      applyCaptureColumnLayout();
      scheduleCropTargetUpdate();
      if (align) {
        alignCaptureToFirstVisiblePost();
        setTimeout(alignCaptureToFirstVisiblePost, 650);
      }
    } finally {
      session.switchingView = false;
    }
  }

  function refreshCurrentView() {
    return activateView(session.activeView, { refresh: true });
  }

  function rewindFeed() {
    const root = document.scrollingElement || document.documentElement;
    const thirtySeconds = Math.round(session.settings.speedPxPerSecond * 30);
    resetStationScrollComposite();
    root.scrollBy({
      top: -Math.max(1, thirtySeconds),
      behavior: "smooth"
    });
  }

  async function showSourceWindow() {
    const response = await runtimeMessage({
      type: "XFF_SHOW_SOURCE_WINDOW"
    });
    if (!response?.ok) {
      throw new Error(response?.error || "Chrome could not show the X window.");
    }
  }

  function alignCaptureToFirstVisiblePost() {
    const viewportHeight =
      document.documentElement.clientHeight || window.innerHeight;
    const visibleTop = findFeedTabsBottom(viewportHeight);
    const posts = [...document.querySelectorAll('[data-testid="tweet"]')];
    const firstVisiblePost = posts.find((post) => {
      const rect = post.getBoundingClientRect();
      return rect.bottom > visibleTop + 8 && rect.top < viewportHeight;
    });

    if (!firstVisiblePost) {
      return;
    }

    const root = document.scrollingElement || document.documentElement;
    resetStationScrollComposite();
    root.scrollBy({
      top: firstVisiblePost.getBoundingClientRect().top - visibleTop - 1,
      behavior: "auto"
    });
  }

  async function syncSourceZoom() {
    const response = await runtimeMessage({ type: "XFF_GET_TAB_ZOOM" });
    if (!response?.ok) {
      throw new Error(response?.error || "Chrome could not read the X zoom.");
    }

    const sourceZoom = Number(response.zoomFactor) || 1;
    saveSettings({ sourceZoom });
    if (session.ui.zoom) {
      session.ui.zoom.value = String(sliderFromZoom(sourceZoom));
    }
    applyCaptureColumnLayout();
    updateUi();
    return sourceZoom;
  }

  async function setSourceZoom(value) {
    const requestedZoom = Math.max(0.25, Math.min(1, Number(value)));
    const response = await runtimeMessage({
      type: "XFF_SET_TAB_ZOOM",
      zoomFactor: requestedZoom
    });
    if (!response?.ok) {
      throw new Error(response?.error || "Chrome could not change the X zoom.");
    }

    const sourceZoom = Number(response.zoomFactor) || requestedZoom;
    saveSettings({ sourceZoom });
    if (session.ui.zoom) {
      session.ui.zoom.value = String(sliderFromZoom(sourceZoom));
    }
    applyCaptureColumnLayout();
    setTimeout(applyCaptureColumnLayout, 120);
    updateUi();
    return sourceZoom;
  }

  function stopCanvasRendering() {
    if (session.canvasFrame && session.pipWindow) {
      session.pipWindow.cancelAnimationFrame(session.canvasFrame);
    }
    session.canvasFrame = null;
  }

  function startCanvasRendering() {
    stopCanvasRendering();
    const pipWindow = session.pipWindow;
    const video = session.video;
    const canvas = session.canvas;
    if (!pipWindow || !video || !canvas) {
      return;
    }

    const context = canvas.getContext("2d", { alpha: false });
    if (!context) {
      throw new Error("Chrome could not create the feed renderer.");
    }
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    const draw = () => {
      if (!session.pipWindow || session.pipWindow.closed) {
        session.canvasFrame = null;
        return;
      }

      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        const viewportWidth =
          document.documentElement.clientWidth || window.innerWidth;
        const viewportHeight =
          document.documentElement.clientHeight || window.innerHeight;
        const rect = calculateCropRect();
        const scaleX = video.videoWidth / Math.max(1, viewportWidth);
        const scaleY = video.videoHeight / Math.max(1, viewportHeight);
        const sourceX = Math.max(0, rect.left * scaleX);
        // Between whole-pixel X scrolls, advance the crop by the saved
        // fractional distance. drawImage interpolates this offset, giving the
        // viewer continuous movement at very slow speeds.
        const fractionalScrollOffset = session.scrollCarryPx;
        const sourceY = Math.max(
          0,
          (rect.top + fractionalScrollOffset) * scaleY
        );
        const sourceWidth = Math.min(
          video.videoWidth - sourceX,
          rect.width * scaleX
        );
        const availableSourceHeight = Math.min(
          video.videoHeight - sourceY,
          rect.height * scaleY
        );

        if (sourceWidth > 1 && availableSourceHeight > 1) {
          const stageWidth = Math.max(1, session.ui.stage?.clientWidth || 1);
          const stageHeight = Math.max(1, session.ui.stage?.clientHeight || 1);
          const pixelRatio = Math.min(2, pipWindow.devicePixelRatio || 1);
          const targetWidth = Math.max(
            280,
            Math.min(1200, Math.round(stageWidth * pixelRatio))
          );
          const targetHeight = Math.max(
            220,
            Math.min(1600, Math.round(stageHeight * pixelRatio))
          );
          if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
            canvas.width = targetWidth;
            canvas.height = targetHeight;
          }

          context.fillStyle = "#000";
          context.fillRect(0, 0, canvas.width, canvas.height);

          // Always fit the entire feed width. A shorter frame shows less of the
          // timeline; a taller frame shows more (or a small black tail if the
          // captured tab is not tall enough). Window shape never chops a tweet.
          const logicalSidePadding = Math.max(
            4,
            Math.min(8, stageWidth * 0.015)
          );
          const sidePadding = Math.round(logicalSidePadding * pixelRatio);
          const destinationWidth = Math.max(1, canvas.width - sidePadding * 2);
          const sourceToTargetScale = destinationWidth / sourceWidth;
          const sourceHeight = Math.min(
            availableSourceHeight,
            targetHeight / sourceToTargetScale
          );
          const destinationHeight = sourceHeight * sourceToTargetScale;
          context.drawImage(
            video,
            sourceX,
            sourceY,
            sourceWidth,
            sourceHeight,
            sidePadding,
            0,
            destinationWidth,
            destinationHeight
          );
        }
      }

      session.canvasFrame = pipWindow.requestAnimationFrame(draw);
    };

    session.canvasFrame = pipWindow.requestAnimationFrame(draw);
  }

  async function connectCapture(app) {
    stopCanvasRendering();
    session.mediaStream?.getTracks().forEach((track) => track.stop());
    session.mediaStream = null;

    const stream = await requestCaptureStream();
    session.mediaStream = stream;

    // Keep the source capture full-size and perform the crop in our canvas.
    // This is what lets the PiP resize freely without object-fit cutting edges.
    session.captureIsRegionCropped = false;
    app.classList.add("xff-canvas-mode");

    session.video.srcObject = stream;
    await session.video.play();
    startCanvasRendering();
  }

  function bindViewerUi(pipWindow, app) {
    const documentRef = pipWindow.document;
    const video = app.querySelector(".xff-video");
    const canvas = app.querySelector(".xff-canvas");
    const status = app.querySelector(".xff-status");
    const viewButtons = [...app.querySelectorAll(".xff-view-button")];
    const rewindButton = app.querySelector(".xff-rewind");
    const refreshButton = app.querySelector(".xff-refresh");
    const minimizePeekButton = app.querySelector(".xff-minimize-peek");
    const settingsToggle = app.querySelector(".xff-settings-toggle");
    const stage = app.querySelector(".xff-stage");
    const speed = app.querySelector(".xff-speed");
    const speedValue = app.querySelector(".xff-speed-value");
    const zoom = app.querySelector(".xff-zoom");
    const zoomValue = app.querySelector(".xff-zoom-value");
    const compactExpandButton = app.querySelector(".xff-compact-expand");
    const compactSourceButton = app.querySelector(".xff-compact-source");

    session.ui = {
      app,
      status,
      stage,
      speedValue,
      zoomValue,
      zoom,
      viewButtons
    };
    session.video = video;
    session.canvas = canvas;

    speed.value = String(sliderFromSpeed(session.settings.speedPxPerSecond));
    zoom.value = String(sliderFromZoom(session.settings.sourceZoom));

    const showControls = ({ keepVisible = false } = {}) => {
      if (session.controlsTimer) {
        clearTimeout(session.controlsTimer);
        session.controlsTimer = null;
      }
      app.classList.add("controls-visible");
      if (keepVisible || app.classList.contains("settings-visible")) {
        return;
      }
      session.controlsTimer = setTimeout(() => {
        app.classList.remove("controls-visible");
        session.controlsTimer = null;
      }, 1050);
    };

    const setZoom = async (sliderPosition) => {
      zoom.disabled = true;
      try {
        await setSourceZoom(zoomFromSlider(sliderPosition));
      } catch (error) {
        showError(error);
      } finally {
        zoom.disabled = false;
      }
    };

    for (const button of viewButtons) {
      button.addEventListener("click", async () => {
        const view = button.dataset.view;
        if (!view || view === session.activeView || session.switchingView) {
          return;
        }
        for (const viewButton of viewButtons) {
          viewButton.disabled = true;
        }
        try {
          await activateView(view);
        } catch (error) {
          showError(error);
        } finally {
          for (const viewButton of viewButtons) {
            viewButton.disabled = false;
          }
          showControls();
        }
      });
    }
    rewindButton.addEventListener("click", () => {
      rewindFeed();
      showControls();
    });
    refreshButton.addEventListener("click", async () => {
      refreshButton.disabled = true;
      try {
        await refreshCurrentView();
      } catch (error) {
        showError(error);
      } finally {
        refreshButton.disabled = false;
        showControls();
      }
    });
    minimizePeekButton.addEventListener("click", (event) => {
      event.stopPropagation();
      collapseViewer();
    });
    compactExpandButton.addEventListener("click", expandViewer);
    compactSourceButton.addEventListener("click", () => {
      showSourceWindow().catch(showError);
    });
    settingsToggle.addEventListener("click", () => {
      app.classList.toggle("settings-visible");
      showControls({ keepVisible: app.classList.contains("settings-visible") });
    });

    speed.addEventListener("input", () => {
      saveSettings({ speedPxPerSecond: speedFromSlider(speed.value) });
      updateUi();
    });

    zoom.addEventListener("change", () => setZoom(zoom.value));

    documentRef.body.addEventListener("pointerenter", () => {
      setPointerPause(true);
      showControls();
    });
    documentRef.body.addEventListener("pointermove", () => showControls());
    documentRef.body.addEventListener("pointerleave", () => {
      setPointerPause(false);
      if (!app.classList.contains("settings-visible")) {
        app.classList.remove("controls-visible");
      }
    });
    let resizeSaveTimer = null;
    pipWindow.addEventListener("resize", () => {
      if (session.collapsed) {
        return;
      }
      applyCaptureColumnLayout();
      if (resizeSaveTimer) {
        clearTimeout(resizeSaveTimer);
      }
      resizeSaveTimer = setTimeout(() => {
        saveSettings({
          viewerWidth: Math.max(280, pipWindow.outerWidth),
          viewerHeight: Math.max(320, pipWindow.outerHeight)
        });
      }, 250);
    });

    updateUi();
    showControls();
    applyCaptureColumnLayout();
    syncSourceZoom().catch((error) => console.warn("X Feed Float zoom sync:", error));
    return video;
  }

  async function openViewer() {
    if (session.pipWindow && !session.pipWindow.closed) {
      session.pipWindow.close();
      return;
    }

    if (!("documentPictureInPicture" in window)) {
      throw new Error("This Chrome version does not support Document Picture-in-Picture.");
    }

    session.closing = false;
    session.collapsed = false;
    session.pointerPause = false;
    session.activeView = ["trading", "notifications"].includes(
      session.settings.activeView
    )
      ? session.settings.activeView
      : "trading";

    // This must be the first asynchronous browser request made from the
    // extension-action gesture. Document PiP rejects delayed requests.
    const pipWindowPromise = documentPictureInPicture.requestWindow({
      width: Math.max(280, session.settings.viewerWidth),
      height: Math.max(320, session.settings.viewerHeight),
      disallowReturnToOpener: true
    });
    const pipWindow = await pipWindowPromise;
    session.pipWindow = pipWindow;

    const documentRef = pipWindow.document;
    documentRef.title = "X Feed Float";
    documentRef.head.appendChild(viewerStyles(documentRef));
    const app = viewerMarkup(documentRef);
    documentRef.body.appendChild(app);
    bindViewerUi(pipWindow, app);

    // Always enter through one of our two explicit center-column sources. X's
    // unrelated tabs (Explore categories, composer tools, etc.) are never used.
    await activateView(session.activeView, { align: false });

    // Let X apply the capture-only column layout, then align a real post before
    // the stream becomes visible so the composer never becomes the opening frame.
    await new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
    alignCaptureToFirstVisiblePost();

    pipWindow.addEventListener(
      "pagehide",
      () => {
        closeViewer({ closeWindow: false });
      },
      { once: true }
    );

    await connectCapture(app);

    startScrolling();
    runtimeMessage({ type: "XFF_BADGE", active: true });

    if (session.settings.minimizeSourceOnOpen) {
      const response = await runtimeMessage({
        type: "XFF_MINIMIZE_SOURCE_WINDOW"
      });
      if (!response?.ok) {
        console.warn("X Feed Float could not minimize its source window:", response?.error);
      }
    }
  }

  function closeViewer({ closeWindow = true } = {}) {
    if (session.closing) {
      return;
    }
    session.closing = true;

    stopCanvasRendering();
    if (closeWindow && session.pipWindow && !session.pipWindow.closed) {
      session.pipWindow.close();
    }

    session.mediaStream?.getTracks().forEach((track) => track.stop());
    session.mediaStream = null;
    session.video = null;
    session.canvas = null;
    session.captureIsRegionCropped = false;
    session.ui = {};

    removeCaptureColumnLayout();
    removeCropTargetElement();
    stopScrolling();

    if (session.scrollFrame) {
      session.scrollFrameWindow?.cancelAnimationFrame(session.scrollFrame);
      session.scrollFrame = null;
      session.scrollFrameWindow = null;
    }
    if (session.resumeTimer) {
      clearTimeout(session.resumeTimer);
      session.resumeTimer = null;
    }
    if (session.controlsTimer) {
      clearTimeout(session.controlsTimer);
      session.controlsTimer = null;
    }

    session.pipWindow = null;
    session.pointerPause = false;
    session.collapsed = false;
    session.closing = false;
    runtimeMessage({ type: "XFF_BADGE", active: false });
  }

  function stationCropPayload() {
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
    return {
      rect: refreshStationCropGeometry(),
      viewport: { width: viewportWidth, height: viewportHeight },
      fractionalScrollOffset: session.stationRenderedOffset,
      activeView: session.activeView,
      paused: isPaused()
    };
  }

  function stopStationRelay() {
    if (session.stationRelayTimer) {
      clearTimeout(session.stationRelayTimer);
      session.stationRelayTimer = null;
    }
  }

  function startStationRelay() {
    stopStationRelay();
    if (!session.stationMode) return;
    runtimeMessage({
      type: "XFF_STATION_CROP",
      crop: stationCropPayload()
    }).catch(() => {});
  }

  async function startStationSource(consumer) {
    await settingsReady;
    if (session.pipWindow && !session.pipWindow.closed) closeViewer();
    const nextConsumer = {
      width: Math.max(1, Number(consumer?.width) || 430),
      height: Math.max(1, Number(consumer?.height) || 690)
    };

    // A Station reload or second display may reattach to the approved capture.
    // That must be an idempotent consumer update, not a source restart: view
    // activation and alignment below both move the real X page.
    if (session.stationMode) {
      session.stationConsumer = nextConsumer;
      applyCaptureColumnLayout();
      installStationHoverShield();
      scheduleCropTargetUpdate();
      return;
    }

    session.stationMode = true;
    session.stationConsumer = nextConsumer;
    session.pointerPause = false;
    session.activeView = ["trading", "notifications"].includes(session.settings.activeView)
      ? session.settings.activeView
      : "trading";
    try {
      await activateView(session.activeView, { align: false });
    } catch (error) {
      // The dedicated source tab itself is an acceptable feed. Do not fail the
      // Station pane just because X renamed or temporarily hid a saved tab.
      console.warn("Station X kept the current visible feed:", error);
      session.activeView = "current";
    }
    applyCaptureColumnLayout();
    installStationHoverShield();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    alignCaptureToFirstVisiblePost();
    /* The visible Station pane supplies a 30 Hz wall-clock tick. A hidden X
       source tab cannot be trusted as the animation clock because Chrome may
       throttle its requestAnimationFrame loop. */
    session.scrollEnabled = true;
    session.lastScrollTimestamp = null;
    resetStationScrollComposite();
    updateUi();
    startStationRelay();
  }

  function stopStationSource() {
    stopStationRelay();
    session.stationMode = false;
    session.stationConsumer = null;
    session.pointerPause = false;
    removeStationHoverShield();
    removeCaptureColumnLayout();
    removeCropTargetElement();
    stopScrolling();
  }

  async function stationControl(action, value) {
    if (!session.stationMode) return;
    if (action === "tick") {
      const timestamp = Number(value?.at) || Date.now();
      if (session.lastScrollTimestamp === null) session.lastScrollTimestamp = timestamp;
      const elapsedMs = Math.max(0, Math.min(timestamp - session.lastScrollTimestamp, 100));
      session.lastScrollTimestamp = timestamp;
      if (!isPaused()) {
        const root = document.scrollingElement || document.documentElement;
        const accrued = session.scrollCarryPx +
          (session.settings.speedPxPerSecond * elapsedMs) / 1000;
        const wholePixels = Math.floor(accrued);
        let appliedPixels = 0;
        if (wholePixels > 0) {
          const before = root.scrollTop;
          root.scrollTop = before + wholePixels;
          appliedPixels = Math.max(0, root.scrollTop - before);
        }
        const next = nextStationScrollState(
          {
            carryPx: session.scrollCarryPx,
            renderedOffset: session.stationRenderedOffset,
            generation: session.stationScrollGeneration
          },
          elapsedMs,
          session.settings.speedPxPerSecond,
          appliedPixels
        );
        session.stationMetrics.ticks += 1;
        if (next.renderedOffset < session.stationRenderedOffset) {
          session.stationMetrics.negativeCommitOffsets += 1;
        }
        session.scrollCarryPx = next.carryPx;
        session.stationScrollGeneration = next.generation;
        if (next.needsSettle) {
          session.stationMetrics.integerScrolls += 1;
          session.stationPendingScrollGeneration = next.generation;
          requestStationCaptureFrame(next.generation);
        } else if (!session.stationPendingScrollGeneration) {
          session.stationRenderedOffset = next.renderedOffset;
        }
      }
      runtimeMessage({ type: "XFF_STATION_CROP", crop: stationCropPayload() });
    } else if (action === "pause") {
      setPointerPause(Boolean(value));
    } else if (action === "refresh") {
      await refreshCurrentView();
    } else if (action === "rewind") {
      rewindFeed();
    } else if (action === "view" && ["trading", "notifications"].includes(value)) {
      await activateView(value);
    } else if (action === "resize" && value) {
      session.stationConsumer = {
        width: Math.max(1, Number(value.width) || session.stationConsumer?.width || 430),
        height: Math.max(1, Number(value.height) || session.stationConsumer?.height || 690)
      };
      applyCaptureColumnLayout();
    }
  }

  function showError(error) {
    console.error("X Feed Float:", error);

    const toast = document.createElement("div");
    toast.textContent = `X Feed Float: ${error.message || error}`;
    Object.assign(toast.style, {
      position: "fixed",
      right: "16px",
      bottom: "16px",
      zIndex: "2147483647",
      maxWidth: "360px",
      padding: "11px 13px",
      border: "1px solid #493434",
      borderRadius: "9px",
      color: "#f2c7c7",
      background: "#1b0d0d",
      boxShadow: "0 10px 30px rgba(0, 0, 0, 0.38)",
      font: '12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    });
    document.documentElement.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "XFF_PING") {
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "XFF_TOGGLE_VIEWER") {
      openViewer()
        .then(() => sendResponse({ ok: true }))
        .catch((error) => {
          closeViewer();
          showError(error);
          sendResponse({ ok: false, error: error.message });
        });
      return true;
    }

    if (message?.type === "XFF_START_STATION_SOURCE") {
      startStationSource(message.consumer)
        .then(() => sendResponse({ ok: true }))
        .catch((error) => {
          stopStationSource();
          showError(error);
          sendResponse({ ok: false, error: error.message });
        });
      return true;
    }

    if (message?.type === "XFF_STOP_STATION_SOURCE") {
      stopStationSource();
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "XFF_STATION_CONTROL") {
      stationControl(message.action, message.value)
        .then(() => sendResponse({ ok: true }))
        .catch((error) => sendResponse({ ok: false, error: error.message }));
      return true;
    }
    if (message?.type === "XFF_STATION_CAPTURE_FRAME") {
      confirmStationCaptureFrame(message.generation);
      sendResponse({ ok: true });
      return;
    }

  });

  window.addEventListener("XFF_TOGGLE_VIEWER_GESTURE_V067", () => {
    openViewer().catch((error) => {
      closeViewer();
      showError(error);
    });
  });

  settingsReady = loadSettings().then(() => {
    session.activeView = session.settings.activeView || "trading";
    return session.settings;
  });
  window.addEventListener("pagehide", () => {
    stopStationSource();
    closeViewer();
  });
})();
