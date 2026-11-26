import { test } from "node:test";
import assert from "node:assert/strict";
import { navTabFor } from "../lib/navTab.js";

// walk a sequence of screens the way the app does, carrying the lit tab along
function walk(steps) {
  let prev = "home";
  return steps.map(([view, onMyProfile = false]) => (prev = navTabFor(view, { prev, onMyProfile })));
}

test("screens that belong to one tab always light it", () => {
  assert.equal(navTabFor("home", { prev: "stats" }), "home");
  assert.equal(navTabFor("leaderboard", { prev: "me" }), "stats");
  assert.equal(navTabFor("records", { prev: "home" }), "stats");
  assert.equal(navTabFor("matchup"), "matchup");
  assert.equal(navTabFor("ai"), "ai");
  assert.equal(navTabFor("account", { prev: "home" }), "me");
  assert.equal(navTabFor("admin"), "me");
  for (const v of ["setup", "bots", "summary", "practice", "playX01", "playTicTacToe", "playCheckoutDrill"]) {
    assert.equal(navTabFor(v, { prev: "stats" }), "play", v);
  }
});

test("your own profile is always Me", () => {
  assert.equal(navTabFor("profile", { prev: "stats", onMyProfile: true }), "me");
});

test("a match report opened from your profile keeps Me lit", () => {
  assert.deepEqual(walk([["profile", true], ["game"]]), ["me", "me"]);
});

test("a match report opened from the leaderboard or the summary keeps that tab", () => {
  assert.deepEqual(walk([["leaderboard"], ["game"]]), ["stats", "stats"]);
  assert.deepEqual(walk([["summary"], ["game"]]), ["play", "play"]);
  assert.deepEqual(walk([["home"], ["game"]]), ["home", "home"]);
});

test("another player's profile keeps the tab it was opened from", () => {
  // from Search on Home
  assert.deepEqual(walk([["home"], ["profile"]]), ["home", "home"]);
  // from the leaderboard, then on into one of their games
  assert.deepEqual(walk([["leaderboard"], ["profile"], ["game"]]), ["stats", "stats", "stats"]);
  // from Merlin's chat
  assert.deepEqual(walk([["ai"], ["profile"]]), ["ai", "ai"]);
  // from your own friends list
  assert.deepEqual(walk([["profile", true], ["friends"], ["profile"]]), ["me", "me", "me"]);
});

test("the friends list keeps the tab it was opened from", () => {
  assert.deepEqual(walk([["home"], ["friends"]]), ["home", "home"]);
  assert.deepEqual(walk([["profile", true], ["friends"]]), ["me", "me"]);
});

test("switching from someone's profile to your own lights Me", () => {
  assert.deepEqual(walk([["leaderboard"], ["profile"], ["profile", true]]), ["stats", "stats", "me"]);
});

test("a borrowed screen with no usable previous tab falls back to Home", () => {
  assert.equal(navTabFor("game", { prev: undefined }), "home");
  assert.equal(navTabFor("profile", { prev: "nonsense" }), "home");
});

test("re-rendering a borrowed screen is stable", () => {
  const t = navTabFor("game", { prev: "me" });
  assert.equal(navTabFor("game", { prev: t }), "me");
});
