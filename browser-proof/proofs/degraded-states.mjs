/* The degraded states, photographed: absence renders as absence on every surface.
   ==============================================================================
   Run: PW_MODULE_DIR=<dir-with-playwright-core> node browser-proof/proofs/degraded-states.mjs
   Four scenarios, each with the failure injected at the page level over the healthy rig:

   1. /health with the PROVIDER dead — equity lanes fail with the failure word, database
      lanes still answer (independence), the internals lane stays BAD by construction.
   2. /health with SUPABASE dead — the provider still answers, and the universe row fails
      CLOSED: "identity unverified — canonical set unreadable; count alone is not identity".
   3. /allocation with every voter dead — no fabricated NEUTRAL: the header, targets,
      moves and trace all say UNAVAILABLE, and the ranking names what it cannot score.
   4. /fundamentals with provider QUOTES dead (everything else alive) — valuation disabled
      with the reason, and the disable SURVIVES a slider drag (the render-time gate).
*/
import assert from "node:assert/strict";
import { launch, shoot, record, nowStamp } from "../rig.mjs";

const { context, origin, close } = await launch();
const FLY = "scintilla-massive-chart-api.fly.dev";
const SB = "wadinxqplrggagkvrdag.supabase.co";

/* ---- 1: /health, provider dead ---- */
const h1 = await context.newPage();
const errs1 = []; h1.on("pageerror", (e) => errs1.push(String(e)));
await h1.route("**/*", (route) =>
  new URL(route.request().url()).host === FLY ? route.abort("connectionrefused") : route.fallback());
await h1.goto(origin + "/health/", { waitUntil: "domcontentloaded" });
await h1.waitForTimeout(3500);
for (const id of ["equitya0", "equitya1", "equitya2"])
  assert.match(await h1.$eval("#" + id, (n) => n.textContent), /unreachable/, id + " fails with the failure word");
const feeder0 = await h1.$eval("#feedersa0", (n) => n.textContent);
assert.notEqual(feeder0, "checking…", "database lanes still answer while the provider is dead");
assert.match(await h1.$eval("#internalsa0", (n) => n.textContent), /no owner, no rows — panes retry forever/);
const shot1 = await shoot(h1, "degraded-health-provider-dead");
assert.deepEqual(errs1, []);
await h1.close();

/* ---- 2: /health, Supabase dead ---- */
const h2 = await context.newPage();
const errs2 = []; h2.on("pageerror", (e) => errs2.push(String(e)));
await h2.route("**/*", (route) =>
  new URL(route.request().url()).host === SB ? route.abort("connectionrefused") : route.fallback());
await h2.goto(origin + "/health/", { waitUntil: "domcontentloaded" });
await h2.waitForTimeout(3500);
assert.match(await h2.$eval("#equitya0", (n) => n.textContent), /asked/, "provider quotes still answer");
assert.match(await h2.$eval("#equitya2", (n) => n.textContent),
  /identity unverified — canonical set unreadable; count alone is not identity/,
  "ownership fails CLOSED when the canonical set cannot be read");
assert.match(await h2.$eval("#feedersa0", (n) => n.textContent), /none readable/,
  "the roster lane reports every member unreadable, not a count");
const shot2 = await shoot(h2, "degraded-health-supabase-dead");
assert.deepEqual(errs2, []);
await h2.close();

/* ---- 3: /allocation, every voter dead ---- */
const a = await context.newPage();
const errs3 = []; a.on("pageerror", (e) => errs3.push(String(e)));
await a.route("**/*", (route) => {
  const u = new URL(route.request().url());
  if (u.host === FLY) return route.abort("connectionrefused");
  if (u.pathname.includes("/rest/v1/vix_term") || u.pathname.includes("/rest/v1/treasury_rates"))
    return route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"forced"}' });
  return route.fallback();
});
await a.goto(origin + "/templates/allocation-module.html", { waitUntil: "domcontentloaded" });
await a.waitForTimeout(4500);
assert.equal(await a.$eval("#heatlabel", (n) => n.textContent), "UNAVAILABLE — NO VOTER ANSWERED");
assert.equal(await a.$eval("#heatnum", (n) => n.textContent), "—");
assert.match(await a.$eval("#targets", (n) => n.textContent), /UNAVAILABLE/);
assert.match(await a.$eval("#moves", (n) => n.textContent), /UNAVAILABLE/);
assert.match(await a.$eval("#trace", (n) => n.textContent), /no heat score — no arithmetic chain to trace/);
assert.match(await a.$eval("#cohort", (n) => n.textContent), /no candidate carries an accepted composite — nothing can be ranked/);
assert.match(await a.$eval("#cohortUnavail", (n) => n.textContent), /excluded from this ranking — accepted composite unavailable:/);
const shot3 = await shoot(a, "degraded-allocation-no-voters");
assert.deepEqual(errs3, []);
await a.close();

/* ---- 4: /fundamentals, provider quotes dead, everything else alive ---- */
const f = await context.newPage();
const errs4 = []; f.on("pageerror", (e) => errs4.push(String(e)));
await f.route("**/*", (route) => {
  const u = new URL(route.request().url());
  if (u.host === FLY && u.pathname === "/quotes") return route.abort("connectionrefused");
  return route.fallback();
});
await f.goto(origin + "/templates/fundamentals.html", { waitUntil: "domcontentloaded" });
await f.waitForTimeout(6000);
assert.match(await f.$eval("#tickerStat", (n) => n.textContent), /price unavailable/,
  "the header states the missing price");
assert.match(await f.$eval("#tickerCaveat", (n) => n.textContent), /No provider price for NVDA/,
  "the banner names the failure and survives the flags line");
assert.equal(await f.$eval("#oUp", (n) => n.textContent), "price unavailable");
/* The gate survives interaction: drag the growth slider and the valuation stays disabled. */
await f.$eval("#g", (n) => { n.value = "40"; n.dispatchEvent(new Event("input", { bubbles: true })); });
await f.waitForTimeout(400);
assert.equal(await f.$eval("#oFV", (n) => n.textContent), "—", "no fair value appears on a slider drag");
assert.equal(await f.$eval("#oUp", (n) => n.textContent), "price unavailable", "the disable holds through render()");
assert.match(await f.$eval("#universeStatus", (n) => n.textContent), /tickers loaded live/,
  "the rest of the page loads normally around the disabled valuation");
const shot4 = await shoot(f, "degraded-fundamentals-quotes-dead");
assert.deepEqual(errs4, []);
await f.close();

console.log("degraded-states proof PASSED");

record(`## ${nowStamp()} — degraded states, photographed: absence renders as absence

Command: \`PW_MODULE_DIR=… node browser-proof/proofs/degraded-states.mjs\` (asserts inline; failures injected per page over the healthy rig)

- **/health, provider dead** (${shot1}): all three equity lanes fail with the failure word; the database lanes still answer beside them (the fixture roster carries rows the way the live tables do); the internals lane stays BAD by construction — the fixtures deliberately carry ZERO rows for ADD/PCC/CUMTICK/TICK/TRIN, mirroring their measured live state.
- **/health, Supabase dead** (${shot2}): provider quotes still answer, and the universe row fails CLOSED — "identity unverified — canonical set unreadable; count alone is not identity" — while the roster lane says "none readable" (a member that cannot be read is not a healthy member).
- **/allocation, every voter dead** (${shot3}): header UNAVAILABLE — NO VOTER ANSWERED, heat —, targets and moves UNAVAILABLE, the trace declines to narrate, the ranking says "no candidate carries an accepted composite" and lists the unscored names. No fabricated NEUTRAL anywhere. **This scenario caught a real defect the source pin could not**: the cohort table's empty-state message sat behind \`html || fallback\`, but \`html\` always carries the header row, so the promised message was unreachable — zero ranked rows painted a bare header (an empty panel where a named absence was promised). Fixed by deciding emptiness on the raw row count; the COMPARABLES table had the same dead gate (its old fallback even named a state that cannot occur, since dropped rows stay rendered greyed-out) — both now append the named absence under the kept header.
- **/fundamentals, provider quotes dead** (${shot4}): the header and banner state the missing price; valuation is disabled and STAYS disabled through a slider drag (the render-time gate, exercised in a real browser); the universe and fundamentals sections load normally around it. Also fixed in this unit: the page's boot had no catch, so a cold provider outage used to stop the whole page from booting with no banner at all — the universe failure now paints where the universe status lives and the ticker sections still load.

Zero page errors across all four scenarios.
`);

await close();
