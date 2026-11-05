/* Coordinator, 4 Nov 2026. Alan: "when I open it and then I click the thing to bring it like back to the station ... it kind of closes the entire station."
   The window no longer carries the browser's own back-to-tab button; the Station's own button brings the video back and closes only the window. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
for (const p of ["station-shells/scintilla-video-v1/index.html", "station-shells/personal-video-v1/index.html"]) {
  const page = read(p);
  test(p + ": the window opens without the browser's back-to-tab button", () => {
    assert.match(page, /return \{ width, height:Math\.round\(width \* 9 \/ 16\), disallowReturnToOpener:true \};/);
    assert.match(page, /documentPictureInPicture\.requestWindow\(floatSize\(\)\)/);
  });
  test(p + ": the Station's own button is put back on every load and only calls bringBack", () => {
    assert.match(page, /d\.body\.appendChild\(f\);\n  floatBackButton\(d\);/);
    assert.match(page, /b\.addEventListener\("click", bringBack\);/);
    assert.equal((page.match(/(^|[^a-zA-Z_.])(window|top|parent|self)\.close\(/g) || []).length, 0, "nothing here closes the Station's own window");
  });
}
test("the deck's own float path opens without it too", () => {
  assert.match(read("deck/index.html"), /requestWindow\(\{ width:480, height:270, disallowReturnToOpener:true \}\)/);
});
