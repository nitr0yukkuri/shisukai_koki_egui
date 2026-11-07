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

test("preload exposes only runtime status and window controls", () => {
  assert.match(preload, /exposeInMainWorld\("jobuhan"/);
  assert.match(preload, /process\.versions\.electron/);
  assert.match(preload, /process\.versions\.node/);
  assert.match(preload, /minimize: \(\) => ipcRenderer\.invoke\("window:minimize"\)/);
  assert.match(preload, /toggleMaximize: \(\) => ipcRenderer\.invoke\("window:toggle-maximize"\)/);
  assert.match(preload, /close: \(\) => ipcRenderer\.invoke\("window:close"\)/);
  assert.doesNotMatch(preload, /exposeInMainWorld\(["']ipcRenderer/);
});

test("Electron blocks renderer navigation outside the app document", () => {
  assert.match(mainProcess, /setWindowOpenHandler\(\(\) => \(\{ action: "deny" \}\)\)/);
  assert.match(mainProcess, /webContents\.on\("will-navigate"/);
  assert.match(mainProcess, /new URL\(event\.url\)/);
  assert.doesNotMatch(mainProcess, /navigationUrl/);
  assert.match(mainProcess, /event\.senderFrame !== mainWindow\.webContents\.mainFrame/);
});

test("npm provides the development and verification commands", () => {
  for (const script of ["dev", "start", "test", "lint", "typecheck", "build", "check"]) {
    assert.ok(manifest.scripts[script], "Missing npm script: " + script);
  }
});
