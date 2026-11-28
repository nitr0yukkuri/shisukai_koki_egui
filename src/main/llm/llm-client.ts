/**
 * 生成AIアダプターの口(内部設計書 §3.1・§7.1)。
 *
 * 使うサービス(U-07)は未決。Gemini を使う予定だが、実装が決まっても差し替えるのは
 * このインターフェースの裏だけで、サービス層は変えない。
 *
 * 約束ごと:
 *   - 返すのは JSON だけ。呼ぶ側が渡した Zod スキーマで検証する
 *   - 形式が不正なら 1 回だけ作り直させ、それでも駄目なら purpose に応じたエラーにする
 *   - 送るのは ES の本文・質問文・回答の文字起こし・話し方の数値まで。音声は送らない
 */
import type { ZodType } from "zod";

import type { ErrorCode } from "../../shared/errors.ts";

/** 何のための呼び出しか。失敗したときのエラーコードと待ち時間がこれで決まる。 */
export type LlmPurpose = "assist" | "evaluation";

/** タイムアウトの既定(内部設計書 §7.1。仮の値で、実測して見直す)。 */
export const LLM_TIMEOUT_MS: Record<LlmPurpose, number> = {
  assist: 15_000,
  evaluation: 90_000,
};

/** 失敗したときに画面へ返すコード(内部設計書 §4.3)。 */
export function errorCodeFor(purpose: LlmPurpose): ErrorCode {
  return purpose === "assist" ? "E_ASSIST" : "E_EVAL";
}

export type LlmRequest<T> = {
  purpose: LlmPurpose;
  /** 役割と出力形式の指示。利用者が書いた文章はここに入れない。 */
  system: string;
  /** 送るデータ。ES や回答は asData() で囲んでから渡す。 */
  user: string;
  /** 返ってきた JSON の検証に使う。 */
  schema: ZodType<T>;
  /** 省略すると LLM_TIMEOUT_MS の既定を使う。 */
  timeoutMs?: number;
  /** 形式不正のときの作り直し回数。既定は 1 回(内部設計書 §7.1)。 */
  maxRetries?: number;
};

export type LlmResponse<T> = {
  data: T;
  /** evaluations.model に残す(内部設計書 §8.3)。 */
  model: string;
};

export interface LlmClient {
  readonly name: string;
  generateJson<T>(request: LlmRequest<T>): Promise<LlmResponse<T>>;
}

/**
 * ES や回答を「データ」として区切り記号で囲む(内部設計書 §7.3)。
 * 指示と混ざらないようにして、プロンプトインジェクションを防ぐ。
 * 本文に区切り記号そのものが入っていても閉じたことにならないよう、取り除いてから囲む。
 */
export function asData(label: string, body: string): string {
  const fence = "<<<";
  const cleaned = body.replaceAll("<<<", "").replaceAll(">>>", "");
  return `${fence}${label}\n${cleaned}\n>>>${label}`;
}
