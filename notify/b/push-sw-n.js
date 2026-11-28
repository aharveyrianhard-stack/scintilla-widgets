/* 28 Nov 2026 (coordinator). The neon boxes' push worker (/notify/b/n-<box>/ each register it with their own scope). The same as
   push-sw.js (the 19 Nov boxes keep that one untouched), plus one thing: the last alert this app received is kept on the phone
   (Cache Storage "neon-last", one entry per box), so the box's own page can show it - proof that a push reached THIS app, not only Apple.
   Caches nothing else, answers no fetch. */
const SCOPE_PATH = new URL(self.registration.scope).pathname;   /* /notify/b/n-tape/ */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("push", (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: "SCINTILLA", body: e.data ? e.data.text() : "" }; }
  const shown = self.registration.showNotification(d.title || "SCINTILLA", { body: d.body || "", icon: SCOPE_PATH + "icon-192.png", badge: SCOPE_PATH + "icon-192.png", tag: d.tag || undefined, data: { url: d.url || SCOPE_PATH }, timestamp: d.at ? Date.parse(d.at) || Date.now() : Date.now() });
  const kept = caches.open("neon-last").then((c) => c.put(SCOPE_PATH + "__last", new Response(JSON.stringify({ title: String(d.title || ""), body: String(d.body || "").slice(0, 160), tag: String(d.tag || ""), at: Date.now() }), { headers: { "content-type": "application/json" } }))).catch(() => {});
  e.waitUntil(Promise.all([shown, kept]));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || SCOPE_PATH, self.location.origin).href;
  e.waitUntil((async () => {
    for (const c of await self.clients.matchAll({ type: "window", includeUncontrolled: true })) {
      try { await c.navigate(url); await c.focus(); return; } catch (_) { /* this one cannot be moved: try the next, then a new window */ }
    }
    await self.clients.openWindow(url);
  })());
});
