/* 1 Nov 2026. The phone's end of the notifications: a push arrives, a notification with the Scintilla logo is shown; a tap opens the story. Caches nothing, answers no fetch. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("push", (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: "SCINTILLA", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "SCINTILLA", { body: d.body || "", icon: "/notify/icon-192.png", badge: "/notify/icon-192.png", tag: d.tag || undefined, data: { url: d.url || "/notify/" }, timestamp: d.at ? Date.parse(d.at) || Date.now() : Date.now() }));
});
/* 2 Nov: an app already open is moved to the tapped alert; opening a new window alone can just bring back the page it was on (Alan: "it sends me to this feed ... The thing that I clicked on is not there") */
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/notify/", self.location.origin).href;
  e.waitUntil((async () => {
    for (const c of await self.clients.matchAll({ type: "window", includeUncontrolled: true })) {
      try { await c.navigate(url); await c.focus(); return; } catch (_) { /* this one cannot be moved: try the next, then a new window */ }
    }
    await self.clients.openWindow(url);
  })());
});
