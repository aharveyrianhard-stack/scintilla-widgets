/* 1 Nov 2026. The phone's end of the notifications: a Home Screen page that carries the Scintilla logo, one tap to turn on, and the switchboard's public headlines as a list. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const page = read("../notify/index.html"), sw = read("../notify/push-sw.js"), mani = JSON.parse(read("../notify/manifest.webmanifest"));
test("a Home Screen app named SCINTILLA, with the logo", () => {
  assert.equal(mani.name, "Scintilla Notifications"); assert.equal(mani.start_url, "/notify/"); assert.equal(mani.display, "standalone");
  assert.match(page, /rel="apple-touch-icon" href="\/notify\/apple-touch-icon\.png"/);
  assert.match(sw, /icon: "\/notify\/icon-192\.png"/, "the notification carries the logo");
});
test("the phone turns on from a tap inside the Home Screen app; Safari first says how to get there", () => {
  assert.match(page, /IOS && !STANDALONE/); assert.match(page, /Add to Home Screen/);
  assert.match(page, /el\("go"\); if \(b\) b\.addEventListener\("click", turnOn\)/, "permission is asked from a tap");
  assert.match(page, /Notification\.requestPermission\(\)/); assert.match(page, /pushManager\.subscribe\(\{ userVisibleOnly: true, applicationServerKey: key\.publicKey \}\)/);
  assert.match(page, /rest\/v1\/push_subscriptions/);
  assert.match(page, /Prefer: "return=minimal"/, "a plain insert: ignore-duplicates needs read rights this table refuses, the 401 Alan hit");
  assert.match(page, /r\.status !== 409/, "already signed up is fine");
});
test("the list reads only the columns anyone may read, and the service key is nowhere", () => {
  assert.match(page, /notify_stream\?select=id,at,level,kind,ticker,title,source,url,pct&order=id\.desc&limit=400&at=gte\./);
  assert.doesNotMatch(page, /service_role|SERVICE_ROLE/); assert.doesNotMatch(page, /__ANON__/);
});
