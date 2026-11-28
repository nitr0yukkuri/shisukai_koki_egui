/**
 * Gemini を使う実装の置き場所(U-07)。
 *
 * 使うモデル・APIキーの渡し方・レスポンスの形がまだ決まっていないので、中身は入れていない。
 * 決まったら generateJson() だけを埋めれば、サービス層は変えずに差し替わる。
 *
 * 実装するときの決まりごと(内部設計書 §7.1・§9.4):
 *   - 返させるのは JSON だけ。受け取ったら request.schema で検証する
 *   - 形式不正は maxRetries 回だけ作り直させ、それでも駄目なら errorCodeFor(purpose)
 *   - timeoutMs を超えたら同じエラーコードで止める
 *   - APIキーは safeStorage から読む。DB・ログ・画面には出さない
 *   - 同意(FR-28)がないときは、そもそも呼ばない。呼ばれたら E_CONSENT
 */
import { AppError } from "../app-error.ts";
import { errorCodeFor, type LlmClient, type LlmRequest, type LlmResponse } from "./llm-client.ts";

export type GeminiLlmClientOptions = {
  /** safeStorage から読んだ APIキー。 */
  apiKey: string;
  /** 使うモデル名。決まったら既定値を入れる(U-07)。 */
  model: string;
};

export class GeminiLlmClient implements LlmClient {
  readonly name = "gemini";

  private readonly options: GeminiLlmClientOptions;

  constructor(options: GeminiLlmClientOptions) {
    this.options = options;
  }

  async generateJson<T>(request: LlmRequest<T>): Promise<LlmResponse<T>> {
    if (this.options.apiKey.trim() === "") {
      throw new AppError("E_KEY", "APIキーが設定されていません。");
    }
    throw new AppError(
      errorCodeFor(request.purpose),
      `Geminiとの接続はまだ実装していません(U-07)。モデル: ${this.options.model}`,
    );
  }
}
