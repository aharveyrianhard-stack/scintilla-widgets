// Prints what each Y4 picture run measured (screens/*.json), one block per run.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../screens");
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
  const r = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  console.log("===== " + r.label + " · " + r.root + " · " + r.at + " · blocked writes " + r.blocked_writes + (r.simulated ? " · SIMULATED ROWS" : ""));
  for (const s of r.shots) {
    const x = s.facts;
    console.log("  " + s.name + " | tiles " + x.tiles + " cols " + x.cols + " | not started: " + x.not_started_tiles + " (in the first 12: " + x.not_started_among_first_12 + ")" +
      " | age shown on " + x.age_visible + " · " + x.age_style + " | star " + JSON.stringify(x.star_style) + " | saved tiles " + x.saved_tiles +
      " | flash: " + (x.flash || "—") + " | marks " + JSON.stringify(x.sources) + (s.acted ? " | " + JSON.stringify(s.acted) : "") + " | page errors " + JSON.stringify(s.errors));
    for (const [name, tiles] of Object.entries(x.named))
      console.log("      " + name.padEnd(19) + (tiles.map((t) => "#" + t.n + " " + (t.live ? "LIVE·started " : "") + (t.age || "no age") + " [" + (t.badge || "no length") + "]").join("   ") || "— not on the first page"));
  }
}
