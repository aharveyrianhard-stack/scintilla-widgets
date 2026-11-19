/* 19 Nov 2026 (coordinator). The phone boxes' push worker (/notify/b/<box>/ each register it with their own scope): a push arrives, a
   notification with the box's icon is shown; a tap opens the alert's page inside the box. The same as /notify/push-sw.js otherwise.
   Caches nothing, answers no fetch. */
const SCOPE_PATH = new URL(self.registration.scope).pathname;   /* /notify/b/markets/ */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("push", (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: "SCINTILLA", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "SCINTILLA", { body: d.body || "", icon: SCOPE_PATH + "icon-192.png", badge: SCOPE_PATH + "icon-192.png", tag: d.tag || undefined, data: { url: d.url || SCOPE_PATH }, timestamp: d.at ? Date.parse(d.at) || Date.now() : Date.now() }));
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
