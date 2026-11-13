import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createBackend } from "../src/main/backend.ts";
import { createInvokeHandlers } from "../src/main/ipc/handlers.ts";
import {
  INVOKE_CHANNEL_LIST,
  MAIN_TO_RENDERER_CHANNEL_LIST,
  RENDERER_TO_MAIN_CHANNEL_LIST,
} from "../src/shared/ipc.ts";

const preload = await readFile(new URL("../electron/preload.cjs", import.meta.url), "utf8");
const mainProcess = await readFile(new URL("../electron/main.cjs", import.meta.url), "utf8");

test("preloadは共有定義と同じチャンネル名を使う", () => {
  for (const channel of [
    ...INVOKE_CHANNEL_LIST,
    ...RENDERER_TO_MAIN_CHANNEL_LIST,
    ...MAIN_TO_RENDERER_CHANNEL_LIST,
  ]) {
    assert.ok(preload.includes(`"${channel}"`), `preloadにチャンネルがありません: ${channel}`);
  }
});

test("preloadはipcRenderer自体を画面へ渡さない", () => {
  assert.match(preload, /exposeInMainWorld\("jobuhan"/);
  assert.doesNotMatch(preload, /exposeInMainWorld\([^)]*ipcRenderer\s*[,)]/);
  assert.doesNotMatch(preload, /\bipcRenderer,\s*$/m);
});

test("処理側は公開した名前のハンドラーだけを持つ", () => {
  const backend = createBackend({ databasePath: ":memory:" });
  try {
    const handlers = createInvokeHandlers(backend);
    assert.deepEqual(Object.keys(handlers).sort(), [...INVOKE_CHANNEL_LIST].sort());
  } finally {
    backend.close();
  }
});

test("main.cjsはビルドしたバックエンドを読み込み、終了時に閉じる", () => {
  assert.match(mainProcess, /dist-electron\/main\/start\.js/);
  assert.match(mainProcess, /will-quit/);
  assert.match(mainProcess, /backendHandle\?\.close\(\)/);
});
