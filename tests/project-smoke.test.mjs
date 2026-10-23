import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mainProcess = await readFile(
  new URL("../electron/main.cjs", import.meta.url),
  "utf8",
);
const preload = await readFile(
  new URL("../electron/preload.cjs", import.meta.url),
  "utf8",
);
const manifest = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);

test("Electron renderer keeps Node.js APIs isolated", () => {
  assert.match(mainProcess, /contextIsolation:\s*true/);
  assert.match(mainProcess, /nodeIntegration:\s*false/);
  assert.match(mainProcess, /sandbox:\s*true/);
});

test("preload exposes only the small runtime status bridge", () => {
  assert.match(preload, /exposeInMainWorld\("jobuhan"/);
  assert.match(preload, /process\.versions\.electron/);
  assert.match(preload, /process\.versions\.node/);
});

test("npm provides the development and verification commands", () => {
  for (const script of ["dev", "start", "test", "lint", "typecheck", "build", "check"]) {
    assert.ok(manifest.scripts[script], "Missing npm script: " + script);
  }
});
