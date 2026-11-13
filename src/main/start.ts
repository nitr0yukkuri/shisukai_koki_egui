/**
 * electron/main.cjs から読み込む入口。
 * DBを開いてIPCを登録し、終了時に閉じるための後始末を返す。
 */
import path from "node:path";
import type { BrowserWindow } from "electron";

import { createBackend, type Backend } from "./backend.ts";
import { registerIpc, registerUnavailableIpc } from "./ipc/register-ipc.ts";
import type { SpeechRecognizer } from "./speech/speech-recognizer.ts";

export type StartBackendOptions = {
  /** app.getPath("userData")。DBと控えはこの下に置く(内部設計書 §8.1)。 */
  userDataDir: string;
  getWindow: () => BrowserWindow | undefined;
  recognizer?: SpeechRecognizer;
};

export type BackendHandle = {
  backend: Backend | null;
  databasePath: string;
  error: Error | null;
  close: () => void;
};

export const DATABASE_FILE_NAME = "jobuhan.db";

export function startBackend(options: StartBackendOptions): BackendHandle {
  const databasePath = path.join(options.userDataDir, DATABASE_FILE_NAME);

  try {
    const backend = createBackend({ databasePath, recognizer: options.recognizer });
    const unregister = registerIpc(backend, { getWindow: options.getWindow });
    return {
      backend,
      databasePath,
      error: null,
      close: () => {
        unregister();
        backend.close();
      },
    };
  } catch (error) {
    const failure = error instanceof Error ? error : new Error(String(error));
    const unregister = registerUnavailableIpc(
      "練習ログを保存できる状態ではありません。アプリを再起動してください。",
    );
    return { backend: null, databasePath, error: failure, close: unregister };
  }
}
