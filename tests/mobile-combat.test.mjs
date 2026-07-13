import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const game = readFileSync("src/game.js", "utf8");
const css = readFileSync("styles.css", "utf8");
const html = readFileSync("index.html", "utf8");

const coneFactor = Number(game.match(/TOUCH_AIM_HALF_ANGLE\s*=\s*Math\.PI\s*\*\s*([\d.]+)/)?.[1]);
const lockDelay = Number(game.match(/TOUCH_LOCK_DELAY\s*=\s*([\d.]+)/)?.[1]);
const fireRate = Number(game.match(/TOUCH_FIRE_RATE\s*=\s*([\d.]+)/)?.[1]);

assert.ok(coneFactor >= 0.22 && coneFactor <= 0.32, "touch aim should require steering within a focused forward cone");
assert.ok(lockDelay >= 0.16, "touch aim should require a deliberate target lock before firing");
assert.ok(fireRate >= 0.15, "touch fire rate should be slower than desktop autofire");
assert.match(game, /function findTouchAimTarget\(/, "touch combat needs target acquisition instead of global nearest-enemy aim");
assert.match(game, /p\.touchTarget\s*&&\s*p\.touchLock\s*>=\s*TOUCH_LOCK_DELAY/, "touch firing must be gated by target lock");
assert.match(game, /function getDashVector\(/, "dash direction should be derived in one testable path");
assert.match(game, /pointer\.down[\s\S]+pointer\.x\s*-\s*p\.x/, "touch dash must use the live drag direction");
assert.match(game, /navigator\.vibrate/, "successful touch dashes should provide tactile feedback when available");
assert.match(css, /\.dash-button\.is-ready/, "the dash control needs an obvious ready state");
assert.match(css, /\.dash-hint/, "the dash control needs touch instructions");
assert.match(html, /class="dash-hint">Hold \+ tap</, "the game must explain the two-thumb dash gesture");
assert.match(html, /mobile-control">Aim <kbd>Steer<\/kbd>/, "mobile controls must describe directional aiming honestly");

console.log("Mobile combat balance verification passed.");
