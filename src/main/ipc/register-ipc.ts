/**
 * ipcMain への登録(内部設計書 §4・§9.4)。
 * 公開した名前の一覧にあるものだけを受け付け、送信元のウィンドウも確認する。
 */
import { ipcMain, type BrowserWindow, type IpcMainEvent, type IpcMainInvokeEvent } from "electron";

import type { Backend } from "../backend.ts";
import { createInvokeHandlers, handleAudioChunk } from "./handlers.ts";
import {
  INVOKE_CHANNEL_LIST,
  MAIN_TO_RENDERER_CHANNELS,
  RENDERER_TO_MAIN_CHANNELS,
} from "../../shared/ipc.ts";
import type { IpcResult } from "../../shared/errors.ts";

export type RegisterIpcOptions = {
  getWindow: () => BrowserWindow | undefined;
};

export function registerIpc(backend: Backend, options: RegisterIpcOptions): () => void {
  const handlers = createInvokeHandlers(backend);

  const isFromAppWindow = (event: IpcMainInvokeEvent | IpcMainEvent): boolean => {
    const window = options.getWindow();
    return window !== undefined && !window.isDestroyed() && event.sender === window.webContents;
  };

  for (const channel of INVOKE_CHANNEL_LIST) {
    ipcMain.handle(channel, async (event, payload: unknown) => {
      if (!isFromAppWindow(event)) {
        const denied: IpcResult<never> = {
          ok: false,
          error: { code: "E_UNEXPECTED", message: "不正な呼び出しです。" },
        };
        return denied;
      }
      return handlers[channel](payload);
    });
  }

  ipcMain.on(RENDERER_TO_MAIN_CHANNELS.audioChunk, (event, payload: unknown) => {
    if (!isFromAppWindow(event)) {
      return;
    }
    handleAudioChunk(backend, payload);
  });

  // 音声認識の途中結果・話し方の指標は、画面へ通知で送る(内部設計書 §4.2)。
  const send = (channel: string, payload: unknown): void => {
    const window = options.getWindow();
    if (window && !window.isDestroyed()) {
      window.webContents.send(channel, payload);
    }
  };

  backend.setSpeechNotifier({
    partial: (event) => send(MAIN_TO_RENDERER_CHANNELS.sttPartial, event),
    final: (event) => send(MAIN_TO_RENDERER_CHANNELS.sttFinal, event),
    metrics: (event) => send(MAIN_TO_RENDERER_CHANNELS.metricsUpdate, event),
    error: (event) => send(MAIN_TO_RENDERER_CHANNELS.sttError, event),
  });

  return () => {
    for (const channel of INVOKE_CHANNEL_LIST) {
      ipcMain.removeHandler(channel);
    }
    ipcMain.removeAllListeners(RENDERER_TO_MAIN_CHANNELS.audioChunk);
  };
}

/**
 * DBを開けなかったときの受け口。
 * 練習は始めさせず、画面にはE_DBを返す(内部設計書 §8.5)。
 */
export function registerUnavailableIpc(message: string): () => void {
  for (const channel of INVOKE_CHANNEL_LIST) {
    ipcMain.handle(channel, (): IpcResult<never> => ({
      ok: false,
      error: { code: "E_DB", message },
    }));
  }
  ipcMain.on(RENDERER_TO_MAIN_CHANNELS.audioChunk, () => {});

  return () => {
    for (const channel of INVOKE_CHANNEL_LIST) {
      ipcMain.removeHandler(channel);
    }
    ipcMain.removeAllListeners(RENDERER_TO_MAIN_CHANNELS.audioChunk);
  };
}
