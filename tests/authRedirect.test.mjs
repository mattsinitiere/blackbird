import { test } from "node:test";
import assert from "node:assert/strict";
import { safeNext } from "../lib/authRedirect.js";

test("safeNext keeps same-site paths", () => {
  assert.equal(safeNext("/app"), "/app");
  assert.equal(safeNext("/app?tab=stats#x"), "/app?tab=stats#x");
});

test("safeNext rejects anything that could leave the site", () => {
  assert.equal(safeNext("//evil.example"), "/app");
  assert.equal(safeNext("/\\evil.example"), "/app");
  assert.equal(safeNext("https://evil.example"), "/app");
  assert.equal(safeNext("app"), "/app");
  assert.equal(safeNext("/app\r\nSet-Cookie: x"), "/app");
  assert.equal(safeNext(""), "/app");
  assert.equal(safeNext(null), "/app");
  assert.equal(safeNext(undefined, "/"), "/");
});
