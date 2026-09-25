import { test } from "node:test";
import assert from "node:assert/strict";
import { validateNewAccount, createAccount, validateTagEdit } from "../lib/adminAccount.js";

const good = { displayName: " Sam  Lee ", email: "Sam@Example.com", handle: "@SamLee", password: "darts1234", color: "#2563eb", tag: "ab1", tagIcon: "crown" };

test("new account input is validated and normalized", () => {
  const r = validateNewAccount(good);
  assert.equal(r.ok, true);
  assert.deepEqual(r.value, { displayName: "Sam Lee", email: "sam@example.com", handle: "samlee", password: "darts1234", color: "#2563eb", tag: "AB1", tagIcon: "crown" });
  assert.equal(validateNewAccount({ ...good, email: "nope" }).ok, false);
  assert.equal(validateNewAccount({ ...good, password: "short" }).ok, false);
  assert.equal(validateNewAccount({ ...good, handle: "ad" }).ok, false);
  assert.equal(validateNewAccount({ ...good, tagIcon: "dragon" }).ok, false);
  assert.equal(validateNewAccount({ ...good, color: "blue" }).ok, false);
  assert.equal(validateNewAccount({ ...good, tag: "", tagIcon: null, color: "" }).value.tag, null);
});

function fakeAdmin({ clash = [], insertError = null } = {}) {
  const calls = { created: null, inserted: null, deleted: null };
  const admin = {
    from: () => ({
      select: () => ({ ilike: (col) => ({ limit: async () => ({ data: clash.filter((c) => (col === "username" ? c.username : c.handle)) }) }) }),
      insert: async (row) => {
        calls.inserted = row;
        return { error: insertError };
      },
    }),
    auth: {
      admin: {
        createUser: async (u) => {
          calls.created = u;
          return { data: { user: { id: "uid-1" } }, error: null };
        },
        deleteUser: async (id) => {
          calls.deleted = id;
          return {};
        },
      },
    },
  };
  return { admin, calls };
}

test("createAccount makes a confirmed user and a linked player", async () => {
  const { admin, calls } = fakeAdmin();
  const r = await createAccount(admin, validateNewAccount(good).value);
  assert.equal(r.ok, true);
  assert.equal(calls.created.email_confirm, true);
  assert.equal(calls.created.user_metadata.display_name, "Sam Lee");
  assert.deepEqual(calls.inserted, { username: "Sam Lee", auth_id: "uid-1", handle: "samlee", color: "#2563eb", tag: "AB1", tag_icon: "crown" });
  assert.equal(calls.deleted, null);
});

test("createAccount rolls back the user when the player row fails, and refuses clashes", async () => {
  const f = fakeAdmin({ insertError: { message: "duplicate key" } });
  const r = await createAccount(f.admin, validateNewAccount(good).value);
  assert.equal(r.ok, false);
  assert.equal(f.calls.deleted, "uid-1");
  const c = fakeAdmin({ clash: [{ username: "Sam Lee", handle: null }] });
  const r2 = await createAccount(c.admin, validateNewAccount(good).value);
  assert.equal(r2.ok, false);
  assert.match(r2.error, /already a player/);
  assert.equal(c.calls.created, null);
});

test("tag edits validate letters and icon", () => {
  assert.deepEqual(validateTagEdit({ tag: "dev", tagIcon: "devCode" }).value, { tag: "DEV", tag_icon: "devCode" });
  assert.deepEqual(validateTagEdit({ tag: "", tagIcon: null }).value, { tag: null, tag_icon: null });
  assert.equal(validateTagEdit({ tag: "ADMIN" }).ok, false);
});
