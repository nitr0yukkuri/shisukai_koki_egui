/**
 * settings 表のキー(内部設計書 §8.3)。
 *
 * 画面と処理で文字列がずれても settings:get は null を返すだけで静かに壊れるため、
 * キー名はここだけに置き、どちらからもこの定数を使う(文字列を直接書かない)。
 * APIキーはDBに入れない。safeStorage で別に保管する(内部設計書 §9.4・NFR-11)。
 */

export const SETTINGS_KEYS = {
  /** 外部AIへの送信に同意したか(FR-28 / SC-09)。値は boolean。 */
  consentExternalAi: "consent.externalAi",
  /** 使うマイク(FR-27 / SC-03)。値は string。 */
  microphoneDeviceId: "microphone.deviceId",
  /** 選んだ相手の画像(FR-10 / SC-03)。値は number。 */
  interviewerSelectedImageId: "interviewer.selectedImageId",
  /** 文字の大きさ(NFR-15 / SC-08)。値は FontSize。 */
  uiFontSize: "ui.fontSize",
} as const;

export type SettingsKey = (typeof SETTINGS_KEYS)[keyof typeof SETTINGS_KEYS];

export const SETTINGS_KEY_LIST: readonly SettingsKey[] = Object.values(SETTINGS_KEYS);

/** ui.fontSize に入る値(外部設計書 SC-08)。 */
export const FONT_SIZES = ["small", "medium", "large"] as const;
export type FontSize = (typeof FONT_SIZES)[number];
