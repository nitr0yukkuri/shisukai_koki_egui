/**
 * preload が画面へ公開するAPIの形(内部設計書 §4・§9.4)。
 * preload.cjs と renderer の型(src/types/electron.d.ts)が同じ定義を参照するために置く。
 */
import type { IpcResult } from "./errors.ts";
import type { SettingsKey } from "./settings-keys.ts";
import type {
  AnswerStarted,
  AudioChunkMessage,
  ConsentState,
  EsSet,
  EsSetInput,
  EsSetSummary,
  MetricsUpdateEvent,
  PracticeNextResult,
  PracticeStarted,
  SessionDetail,
  SessionSummary,
  SttErrorEvent,
  SttFinalEvent,
  SttPartialEvent,
  TurnRecord,
} from "./types.ts";

export type Unsubscribe = () => void;

export type JobuhanBridge = {
  runtime: {
    electron: string;
    node: string;
    platform: string;
  };
  window: {
    minimize: () => Promise<void>;
    toggleMaximize: () => Promise<void>;
    close: () => Promise<void>;
  };
  es: {
    list: () => Promise<IpcResult<EsSetSummary[]>>;
    get: (esSetId: number) => Promise<IpcResult<EsSet>>;
    save: (esSet: EsSetInput) => Promise<IpcResult<EsSet>>;
    duplicate: (esSetId: number) => Promise<IpcResult<EsSetSummary>>;
    delete: (esSetId: number) => Promise<IpcResult<null>>;
  };
  practice: {
    start: (input: {
      mode?: "solo" | "one_on_one";
      esSetId?: number | null;
      interviewerImageId?: number | null;
      questionCount?: number;
    }) => Promise<IpcResult<PracticeStarted>>;
    beginAnswer: (sessionId: number) => Promise<IpcResult<AnswerStarted>>;
    endAnswer: (sessionId: number, turnId: number) => Promise<IpcResult<TurnRecord>>;
    next: (sessionId: number) => Promise<IpcResult<PracticeNextResult>>;
    finish: (sessionId: number, keep: boolean) => Promise<IpcResult<null>>;
  };
  history: {
    list: () => Promise<IpcResult<SessionSummary[]>>;
    get: (sessionId: number) => Promise<IpcResult<SessionDetail>>;
    delete: (sessionId: number) => Promise<IpcResult<null>>;
  };
  settings: {
    get: (key: SettingsKey) => Promise<IpcResult<unknown>>;
    set: (key: SettingsKey, value: unknown) => Promise<IpcResult<null>>;
  };
  consent: {
    get: () => Promise<IpcResult<ConsentState>>;
    set: (externalAi: boolean) => Promise<IpcResult<ConsentState>>;
  };
  audio: {
    sendChunk: (message: AudioChunkMessage) => void;
  };
  speech: {
    onPartial: (listener: (event: SttPartialEvent) => void) => Unsubscribe;
    onFinal: (listener: (event: SttFinalEvent) => void) => Unsubscribe;
    onMetrics: (listener: (event: MetricsUpdateEvent) => void) => Unsubscribe;
    onError: (listener: (event: SttErrorEvent) => void) => Unsubscribe;
  };
};
