import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Regression: ISSUE-001 — mobile browsers could collapse the canvas below the top menu
// Found by /qa on 2026-07-13
// Report: .gstack/qa-reports/qa-report-ottogame-local-2026-07-13.md
const css = readFileSync("styles.css", "utf8");
const game = readFileSync("src/game.js", "utf8");
const html = readFileSync("index.html", "utf8");

const documentSizeRule = css.match(/html,\s*\nbody\s*\{([^}]+)\}/)?.[1] ?? "";
const shellRule = css.match(/\.shell\s*\{([^}]+)\}/)?.[1] ?? "";

assert.match(documentSizeRule, /(?:^|\n)\s*height:\s*100%;/, "html/body must establish a real height for legacy mobile browsers");
assert.match(shellRule, /height:\s*100vh/, "the app shell needs a 100vh fallback before dynamic viewport units");
assert.match(css, /@supports\s*\(height:\s*100dvh\)/, "dynamic viewport units must be applied as a progressive enhancement");
assert.match(game, /function roundedRectPath\(/, "canvas drawing needs a roundRect compatibility helper");
assert.doesNotMatch(game, /\bctx\.roundRect\(/, "canvas drawing must not call roundRect without a fallback");
assert.match(game, /event\.pointerType\s*!==\s*["']touch["']/, "touch movement should preserve automatic enemy aiming");
assert.match(html, /class="mobile-preview"/, "the mobile start screen must show the character and threats before play");

console.log("Mobile compatibility verification passed.");
