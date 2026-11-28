/* 28 Nov 2026 (coordinator). The phone's NEON boxes. Alan (relayed by the markets session, 09:25 ET): "the new notification split with the
   new icons" and "The Urth feed should be fully separate ... Another icon on Home Screen all of it." Ten Home Screen apps under
   /notify/b/n-<box>/, built by notify/b/neon/build-neon.mjs; the 19 Nov five keep their own pages and worker until these are proven. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const BOXES = { "n-tape": "TAPE", "n-ai": "AI BUILD", "n-macro": "MACRO", "n-earnings": "EARNINGS", "n-world": "ASIA · EU", "n-flash": "FLASH", "n-research": "RESEARCH", "n-press": "PRESS", "n-home": "HOME", "n-urth": "URTH" };
const pngSize = (p) => { const b = readFileSync(new URL(p, import.meta.url)); assert.equal(b.toString("ascii", 1, 4), "PNG"); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test("ten box apps, each its own Home Screen app: own id, scope, the box's word as its name, and its icons", () => {
  const ids = new Set();
  for (const [b, word] of Object.entries(BOXES)) {
    const m = JSON.parse(read(`../notify/b/${b}/manifest.webmanifest`)), scope = `/notify/b/${b}/`;
    assert.equal(m.id, scope); assert.equal(m.scope, scope); assert.equal(m.start_url, scope); assert.equal(m.display, "standalone");
    assert.equal(m.short_name, word, "the name under the icon and on every alert is the box's word");
    ids.add(m.id);
    for (const f of ["index.html", "card.html"]) assert.ok(existsSync(new URL(`../notify/b/${b}/${f}`, import.meta.url)), b + "/" + f);
    assert.deepEqual(pngSize(`../notify/b/${b}/icon-512.png`), [512, 512]);
    assert.deepEqual(pngSize(`../notify/b/${b}/icon-192.png`), [192, 192]);
    assert.deepEqual(pngSize(`../notify/b/${b}/apple-touch-icon.png`), [180, 180]);
  }
  assert.equal(ids.size, 10);
});

test("URTH is fully separate: its own name and look, private on its page", () => {
  const m = JSON.parse(read("../notify/b/n-urth/manifest.webmanifest"));
  assert.equal(m.name, "Urth"); assert.doesNotMatch(m.name, /scintilla/i);
  const p = read("../notify/b/n-urth/index.html");
  assert.match(p, /PRIVATE = true/); assert.match(p, /const BOX = "n-urth"/);
  assert.match(read("../notify/b/n-home/index.html"), /PRIVATE = true/, "the house and the machinery are private too");
  assert.match(read("../notify/b/n-tape/index.html"), /PRIVATE = false/);
});

test("each page signs up with its box, under its own scope, with the neon worker, from a tap", () => {
  for (const b of Object.keys(BOXES)) {
    const p = read(`../notify/b/${b}/index.html`);
    assert.doesNotMatch(p, /\{\{[A-Z]+\}\}/, b + ": every placeholder filled");
    assert.match(p, new RegExp(`const BOX = "${b}"`));
    assert.match(p, /register\("\/notify\/b\/push-sw-n\.js", \{ scope: SCOPE \}\)/);
    assert.match(p, /box: BOX \}\)/, "the subscription carries its box");
    assert.match(p, /el\("go"\); if \(b\) b\.addEventListener\("click", turnOn\)/, "permission is asked from a tap");
    assert.match(p, /Prefer: "return=minimal"/); assert.match(p, /r\.status !== 409/);
    assert.match(p, /rpc\/notify_box_list/);
    assert.match(p, /caches\.open\("neon-last"\)/, "the page shows the last alert this app received");
    assert.doesNotMatch(p, /service_role|SERVICE_ROLE/);
  }
});

test("a tapped alert opens inside its box, and the way back is the box", () => {
  for (const b of Object.keys(BOXES)) {
    const c = read(`../notify/b/${b}/card.html`);
    assert.match(c, new RegExp(`href="/notify/b/${b}/"`)); assert.doesNotMatch(c, /"\/notify\/"/); assert.doesNotMatch(c, /"\/notify\/icon/);
  }
});

test("the neon worker keeps the last alert per box; the 19 Nov worker is untouched", () => {
  const sw = read("../notify/b/push-sw-n.js");
  assert.match(sw, /new URL\(self\.registration\.scope\)\.pathname/);
  assert.match(sw, /caches\.open\("neon-last"\)/); assert.match(sw, /SCOPE_PATH \+ "__last"/);
  assert.doesNotMatch(read("../notify/b/push-sw.js"), /neon-last/);
});

test("the build sources stay off the site", () => {
  assert.match(read("../.vercelignore"), /^notify\/b\/neon$/m);
});
