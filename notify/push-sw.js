/* 1 Nov 2026. The phone's end of the notifications: a push arrives, a notification with the Scintilla logo is shown; a tap opens the story. Caches nothing, answers no fetch. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("push", (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: "SCINTILLA", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "SCINTILLA", { body: d.body || "", icon: "/notify/icon-192.png", badge: "/notify/icon-192.png", tag: d.tag || undefined, data: { url: d.url || "/notify/" }, timestamp: d.at ? Date.parse(d.at) || Date.now() : Date.now() }));
});
self.addEventListener("notificationclick", (e) => { e.notification.close(); e.waitUntil(self.clients.openWindow((e.notification.data && e.notification.data.url) || "/notify/")); });
