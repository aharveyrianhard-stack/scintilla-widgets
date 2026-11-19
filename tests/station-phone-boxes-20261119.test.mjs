/* 19 Nov 2026 (coordinator). The iPhone's notification boxes. Alan, 12:33 ET (relayed): "what are we gonna do about the notification center on the
   phone, buddy?" One Home Screen app per box under /notify/b/<box>/, so each box is its own stack in Notification Center. Built by
   notify/b/build-boxes.py from notify/b/box.template.html; the sender (edge function notify-push v13) sends each card to its box's app. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const BOXES = ["markets", "press", "earnings", "research", "urth"];
test("five box apps, each its own Home Screen app: own id, scope, name and icons", () => {
  const ids = new Set(), names = new Set();
  for (const b of BOXES) {
    const m = JSON.parse(read(`../notify/b/${b}/manifest.webmanifest`)), scope = `/notify/b/${b}/`;
    assert.equal(m.id, scope); assert.equal(m.scope, scope); assert.equal(m.start_url, scope); assert.equal(m.display, "standalone");
    assert.match(m.short_name, /^SC /, "the name under the icon and on every alert says which box");
    ids.add(m.id); names.add(m.short_name);
    for (const f of ["icon-192.png", "icon-512.png", "apple-touch-icon.png", "index.html", "card.html"]) assert.ok(existsSync(new URL(`../notify/b/${b}/${f}`, import.meta.url)), b + "/" + f);
  }
  assert.equal(ids.size, 5); assert.equal(names.size, 5);
});
test("each box page signs up with its box, under its own scope, from a tap", () => {
  for (const b of BOXES) {
    const p = read(`../notify/b/${b}/index.html`);
    assert.doesNotMatch(p, /\{\{[A-Z]+\}\}/, b + ": every placeholder filled");
    assert.match(p, new RegExp(`const BOX = "${b}"`));
    assert.match(p, /register\("\/notify\/b\/push-sw\.js", \{ scope: SCOPE \}\)/);
    assert.match(p, /box: BOX \}\)/, "the subscription carries its box");
    assert.match(p, /el\("go"\); if \(b\) b\.addEventListener\("click", turnOn\)/, "permission is asked from a tap");
    assert.match(p, /Prefer: "return=minimal"/); assert.match(p, /r\.status !== 409/);
    assert.match(p, /rpc\/notify_box_list/, "the list keeps the public rules (invoker rights), filtered to the box");
    assert.doesNotMatch(p, /service_role|SERVICE_ROLE/);
  }
});
test("a tapped alert opens inside its box, and the way back is the box", () => {
  for (const b of BOXES) {
    const c = read(`../notify/b/${b}/card.html`);
    assert.match(c, new RegExp(`href="/notify/b/${b}/"`)); assert.doesNotMatch(c, /"\/notify\/"/); assert.doesNotMatch(c, /"\/notify\/icon/);
  }
  const sw = read("../notify/b/push-sw.js");
  assert.match(sw, /new URL\(self\.registration\.scope\)\.pathname/, "icon and default link follow the box's own scope");
});
test("a test machine can name itself, so it never quiets Alan's own iPhone app", () => {
  const t = read("../notify/b/box.template.html");
  assert.match(t, /get\("as"\)/); assert.match(t, /AS \|\| \(\/iPhone\//);
});
