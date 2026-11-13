/** IPCで返すエラーコード(内部設計書 §4.3)。画面側の表示文言(MSG-xx)はrendererが持つ。 */
export const ERROR_CODES = [
  "E_VALIDATION",
  "E_MIC",
  "E_STT",
  "E_ASSIST",
  "E_EVAL",
  "E_CONSENT",
  "E_KEY",
  "E_NET",
  "E_DB",
  "E_STATE",
  "E_NOT_FOUND",
  "E_UNEXPECTED",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export type IpcError = {
  code: ErrorCode;
  message: string;
};

export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: IpcError };

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && (ERROR_CODES as readonly string[]).includes(value);
}
