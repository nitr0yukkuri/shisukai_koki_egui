/**
 * IPCハンドラー(内部設計書 §4)。
 * Electronに依らないのでテストから直接呼べる。入力は必ずスキーマで検証する。
 */
import type { ZodType } from "zod";

import { AppError, toAppError } from "../app-error.ts";
import type { Backend } from "../backend.ts";
import { INVOKE_CHANNELS, type InvokeChannel } from "../../shared/ipc.ts";
import type { IpcResult } from "../../shared/errors.ts";
import {
  audioChunkSchema,
  consentSetSchema,
  esSetIdSchema,
  esSetInputSchema,
  practiceFinishSchema,
  practiceStartSchema,
  sessionIdSchema,
  settingsKeySchema,
  settingsSetSchema,
  turnRefSchema,
} from "../../shared/schemas.ts";

export type InvokeHandler = (payload: unknown) => Promise<IpcResult<unknown>>;

function parse<T>(schema: ZodType<T>, payload: unknown): T {
  const parsed = schema.safeParse(payload ?? {});
  if (!parsed.success) {
    throw new AppError("E_VALIDATION", "入力内容を確認してください。", { cause: parsed.error });
  }
  return parsed.data;
}

async function toResult<T>(work: () => T | Promise<T>): Promise<IpcResult<T>> {
  try {
    return { ok: true, data: await work() };
  } catch (error) {
    const appError = toAppError(error);
    return { ok: false, error: { code: appError.code, message: appError.message } };
  }
}

export function createInvokeHandlers(backend: Backend): Record<InvokeChannel, InvokeHandler> {
  return {
    [INVOKE_CHANNELS.esList]: () => toResult(() => backend.es.list()),
    [INVOKE_CHANNELS.esGet]: (payload) =>
      toResult(() => backend.es.get(parse(esSetIdSchema, payload).esSetId)),
    [INVOKE_CHANNELS.esSave]: (payload) =>
      toResult(() => backend.es.save(parse(esSetInputSchema, payload))),
    [INVOKE_CHANNELS.esDuplicate]: (payload) =>
      toResult(() => backend.es.duplicate(parse(esSetIdSchema, payload).esSetId)),
    [INVOKE_CHANNELS.esDelete]: (payload) =>
      toResult(() => {
        backend.es.delete(parse(esSetIdSchema, payload).esSetId);
        return null;
      }),

    [INVOKE_CHANNELS.practiceStart]: (payload) =>
      toResult(() => backend.practice.start(parse(practiceStartSchema, payload))),
    [INVOKE_CHANNELS.practiceBeginAnswer]: (payload) =>
      toResult(() => backend.practice.beginAnswer(parse(sessionIdSchema, payload).sessionId)),
    [INVOKE_CHANNELS.practiceEndAnswer]: (payload) =>
      toResult(() => {
        const input = parse(turnRefSchema, payload);
        return backend.practice.endAnswer(input.sessionId, input.turnId);
      }),
    [INVOKE_CHANNELS.practiceNext]: (payload) =>
      toResult(() => backend.practice.next(parse(sessionIdSchema, payload).sessionId)),
    [INVOKE_CHANNELS.practiceFinish]: (payload) =>
      toResult(() => {
        const input = parse(practiceFinishSchema, payload);
        backend.practice.finish(input.sessionId, input.keep);
        return null;
      }),

    [INVOKE_CHANNELS.historyList]: () => toResult(() => backend.history.list()),
    [INVOKE_CHANNELS.historyGet]: (payload) =>
      toResult(() => backend.history.get(parse(sessionIdSchema, payload).sessionId)),
    [INVOKE_CHANNELS.historyDelete]: (payload) =>
      toResult(() => {
        backend.history.delete(parse(sessionIdSchema, payload).sessionId);
        return null;
      }),

    [INVOKE_CHANNELS.settingsGet]: (payload) =>
      toResult(() => backend.settings.get(parse(settingsKeySchema, payload).key)),
    [INVOKE_CHANNELS.settingsSet]: (payload) =>
      toResult(() => {
        const input = parse(settingsSetSchema, payload);
        backend.settings.set(input.key, input.value);
        return null;
      }),
    [INVOKE_CHANNELS.consentGet]: () => toResult(() => backend.settings.getConsent()),
    [INVOKE_CHANNELS.consentSet]: (payload) =>
      toResult(() => backend.settings.setConsent(parse(consentSetSchema, payload).externalAi)),
  };
}

/** 録音データの受け取り(audio:chunk)。失敗しても練習は止めない。 */
export function handleAudioChunk(backend: Backend, payload: unknown): void {
  const parsed = audioChunkSchema.safeParse(payload);
  if (!parsed.success) {
    return;
  }
  const { sessionId, turnId, data, offsetMs } = parsed.data;
  backend.speech.pushChunk(
    { sessionId, turnId },
    {
      data: data instanceof Uint8Array ? data : new Uint8Array(data),
      offsetMs,
    },
  );
}
