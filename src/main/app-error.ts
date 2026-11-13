import type { ErrorCode } from "../shared/errors.ts";

/** 処理側で投げる業務エラー。IPC境界で ErrorCode に変換する(内部設計書 §9.1)。 */
export class AppError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AppError";
    this.code = code;
  }
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }
  return new AppError("E_UNEXPECTED", "処理に失敗しました。", { cause: error });
}
