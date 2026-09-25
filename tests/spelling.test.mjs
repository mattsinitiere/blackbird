import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// The app speaks American English: "triple" not "treble", "color" not
// "colour", and so on. This scans the text people see (string literals and
// JSX text in app/, components/ and lib/) so British forms don't creep back.
// Code identifiers and saved stats keys (trebles, trebleRate, cancelled…)
// are left alone on purpose: renaming them would break saved games.
const root = fileURLToPath(new URL("..", import.meta.url));
const BRITISH = /\b(trebles?|colour\w*|favour\w*|practis(e|ed|es|ing)|personalis\w*|customis\w*|centre[sd]?|behaviour\w*|organis\w*|analys(e|ed|ing)|cancelled|labelled|millimetres?|catalogue|programme)\b/i;

function files(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === "node_modules" || f.startsWith(".") ? [] : files(p);
    return p.endsWith(".js") ? [p] : [];
  });
}

// the visible text on a line: quoted strings and JSX text between tags
function visibleText(line) {
  const t = line.trim();
  if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return [];
  const code = line.replace(/\/\/ .*$/, "");
  const out = [];
  for (const m of code.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|`([^`]*)`|>([^<>{}]+)</g)) {
    // template literals: only the literal text, not the ${code} inside
    out.push(m[3] != null ? m[3].replace(/\$\{[^}]*\}/g, " ") : m[1] ?? m[2] ?? m[4]);
  }
  return out;
}

test("user-facing text uses American spelling", () => {
  const hits = [];
  for (const dir of ["app", "components", "lib"]) {
    for (const f of files(join(root, dir))) {
      readFileSync(f, "utf8")
        .split("\n")
        .forEach((line, i) => {
          for (const text of visibleText(line)) {
            // "cancelled" / "trebles" as a bare quoted key is a saved stats key, not text
            if (/^(cancelled|trebles|trebleRate|trebleTwentyPct)$/.test(text)) continue;
            // the rule telling Merlin not to say "treble" has to name it
            if (/never 'treble'/.test(text)) continue;
            const m = text.match(BRITISH);
            if (m) hits.push(`${f.slice(root.length)}:${i + 1}: "${m[0]}" in ${JSON.stringify(text.slice(0, 80))}`);
          }
        });
    }
  }
  assert.deepEqual(hits, []);
});
