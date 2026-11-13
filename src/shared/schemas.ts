/**
 * IPCの入力スキーマ(内部設計書 §4・NFR-13)。
 * 型だけでは実行時の入力を検証できないため、main側で必ずここを通す。
 */
import { z } from "zod";

import { SETTINGS_KEYS, FONT_SIZES } from "./settings-keys.ts";
import {
  ES_BODY_HARD_LIMIT,
  ES_KINDS,
  ES_NAME_MAX_LENGTH,
  PRACTICE_MODES,
  QUESTION_COUNT_DEFAULT,
  QUESTION_COUNT_MAX,
  QUESTION_COUNT_MIN,
} from "./types.ts";

const id = z.number().int().positive();

export const esSetIdSchema = z.object({ esSetId: id });

/**
 * 本文の長さは ES_BODY_MAX_LENGTH ではなく絶対上限で見る。
 * 上限超過は画面の警告(MSG-02)で扱い、保存は通す(FR-04・外部設計書 §5.2)。
 */
export const esItemSchema = z.object({
  kind: z.enum(ES_KINDS),
  body: z.string().max(ES_BODY_HARD_LIMIT),
});

export const esSetInputSchema = z.object({
  id: id.optional(),
  name: z.string().trim().min(1).max(ES_NAME_MAX_LENGTH),
  items: z.array(esItemSchema).max(ES_KINDS.length),
});

export const practiceStartSchema = z.object({
  mode: z.enum(PRACTICE_MODES).default("solo"),
  esSetId: id.nullable().default(null),
  interviewerImageId: id.nullable().default(null),
  questionCount: z
    .number()
    .int()
    .min(QUESTION_COUNT_MIN)
    .max(QUESTION_COUNT_MAX)
    .default(QUESTION_COUNT_DEFAULT),
});

export const sessionIdSchema = z.object({ sessionId: id });

export const turnRefSchema = z.object({ sessionId: id, turnId: id });

export const practiceFinishSchema = z.object({ sessionId: id, keep: z.boolean().default(true) });

const settingsKey = z.enum([
  SETTINGS_KEYS.consentExternalAi,
  SETTINGS_KEYS.microphoneDeviceId,
  SETTINGS_KEYS.interviewerSelectedImageId,
  SETTINGS_KEYS.uiFontSize,
]);

export const settingsKeySchema = z.object({ key: settingsKey });

export const settingsSetSchema = z.discriminatedUnion("key", [
  z.object({ key: z.literal(SETTINGS_KEYS.consentExternalAi), value: z.boolean() }),
  z.object({ key: z.literal(SETTINGS_KEYS.microphoneDeviceId), value: z.string().max(512) }),
  z.object({ key: z.literal(SETTINGS_KEYS.interviewerSelectedImageId), value: id }),
  z.object({ key: z.literal(SETTINGS_KEYS.uiFontSize), value: z.enum(FONT_SIZES) }),
]);

export const consentSetSchema = z.object({ externalAi: z.boolean() });

const audioPayloadSchema = z.custom<ArrayBuffer | Uint8Array>(
  (value) => value instanceof ArrayBuffer || value instanceof Uint8Array,
  { message: "録音データの形式が正しくありません。" },
);

export const audioChunkSchema = z.object({
  sessionId: id,
  turnId: id,
  data: audioPayloadSchema,
  offsetMs: z.number().int().min(0).optional(),
});

export type EsSetIdInput = z.infer<typeof esSetIdSchema>;
export type EsSetSaveInput = z.infer<typeof esSetInputSchema>;
export type PracticeStartInput = z.infer<typeof practiceStartSchema>;
export type SessionIdInput = z.infer<typeof sessionIdSchema>;
export type TurnRefInput = z.infer<typeof turnRefSchema>;
export type PracticeFinishInput = z.infer<typeof practiceFinishSchema>;
export type SettingsKeyInput = z.infer<typeof settingsKeySchema>;
export type SettingsSetInput = z.infer<typeof settingsSetSchema>;
export type ConsentSetInput = z.infer<typeof consentSetSchema>;
export type AudioChunkInput = z.infer<typeof audioChunkSchema>;
