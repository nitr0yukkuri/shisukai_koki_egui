/** IPCのチャンネル名(内部設計書 §4)。名前は「ドメイン:動作」で揃える。 */

export const INVOKE_CHANNELS = {
  esList: "es:list",
  esGet: "es:get",
  esSave: "es:save",
  esDuplicate: "es:duplicate",
  esDelete: "es:delete",
  practiceStart: "practice:start",
  practiceBeginAnswer: "practice:beginAnswer",
  practiceEndAnswer: "practice:endAnswer",
  practiceNext: "practice:next",
  practiceFinish: "practice:finish",
  historyList: "history:list",
  historyGet: "history:get",
  historyDelete: "history:delete",
  settingsGet: "settings:get",
  settingsSet: "settings:set",
  consentGet: "consent:get",
  consentSet: "consent:set",
} as const;

export type InvokeChannel = (typeof INVOKE_CHANNELS)[keyof typeof INVOKE_CHANNELS];

/** 画面→処理の通知(録音データ)。 */
export const RENDERER_TO_MAIN_CHANNELS = {
  audioChunk: "audio:chunk",
} as const;

/** 処理→画面の通知。 */
export const MAIN_TO_RENDERER_CHANNELS = {
  sttPartial: "stt:partial",
  sttFinal: "stt:final",
  metricsUpdate: "metrics:update",
  sttError: "stt:error",
} as const;

export const INVOKE_CHANNEL_LIST: readonly InvokeChannel[] = Object.values(INVOKE_CHANNELS);

export const RENDERER_TO_MAIN_CHANNEL_LIST: readonly string[] = Object.values(
  RENDERER_TO_MAIN_CHANNELS,
);

export const MAIN_TO_RENDERER_CHANNEL_LIST: readonly string[] = Object.values(
  MAIN_TO_RENDERER_CHANNELS,
);
