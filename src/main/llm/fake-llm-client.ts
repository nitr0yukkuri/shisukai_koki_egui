/**
 * 開発・テスト用の生成AI(内部設計書 §7.4)。
 *
 * 固定の JSON を返すので、U-07(どのサービスを使うか)が決まる前でも
 * お助け(FR-19〜21)と評価(FR-22〜26)の画面と処理を作って試せる。
 * 返す形は §7.2 の「機能ごとの入出力」に合わせてある。
 */
import { AppError } from "../app-error.ts";
import { errorCodeFor, type LlmClient, type LlmPurpose, type LlmRequest, type LlmResponse } from "./llm-client.ts";

/** お助けの候補(内部設計書 §7.2)。esRef は根拠にした ES の項目。 */
export const DEFAULT_FAKE_ASSIST = {
  suggestions: [
    {
      point: "まず結論を一文で言う",
      reason: "長期インターンで続けた改善提案が、いちばん伝わる強みだから",
      esRef: "gakuchika",
    },
    {
      point: "具体的な数字を一つ添える",
      reason: "ESに書いた取り組みの規模が伝わるから",
      esRef: "gakuchika",
    },
    {
      point: "最後に学んだことを一言でまとめる",
      reason: "次の質問につながりやすいから",
      esRef: "self_pr",
    },
  ],
};

/** 評価の結果(内部設計書 §7.2)。総合点はアプリが合計するので、ここには入れない。 */
export const DEFAULT_FAKE_EVALUATION = {
  axes: [
    { key: "conclusion", score: 14, comment: "結論から話せています。" },
    { key: "consistency", score: 16, comment: "ESの内容とよく合っています。" },
    { key: "examples", score: 12, comment: "具体例をもう一つ足せます。" },
    { key: "delivery", score: 15, comment: "話す速さは聞き取りやすい範囲です。" },
    { key: "answering", score: 13, comment: "質問の意図にはおおむね答えられています。" },
  ],
  good: ["結論から話せている", "ESと話の筋が合っている"],
  improve: ["具体例を一つ足す", "言い淀みを減らす"],
};

export type FakeLlmClientOptions = {
  /** 返す中身を差し替える。テストで形を変えたいときに使う。 */
  responses?: Partial<Record<LlmPurpose, unknown>>;
  /** 最初の n 回だけ形式不正を返す。作り直しの挙動を試すために使う。 */
  malformedTimes?: number;
  /** 毎回失敗させる。エラー処理を試すために使う。 */
  alwaysFail?: boolean;
};

export class FakeLlmClient implements LlmClient {
  readonly name = "fake";

  private readonly responses: Partial<Record<LlmPurpose, unknown>>;
  private readonly alwaysFail: boolean;
  private malformedLeft: number;

  constructor(options: FakeLlmClientOptions = {}) {
    this.responses = options.responses ?? {};
    this.malformedLeft = options.malformedTimes ?? 0;
    this.alwaysFail = options.alwaysFail ?? false;
  }

  async generateJson<T>(request: LlmRequest<T>): Promise<LlmResponse<T>> {
    if (this.alwaysFail) {
      throw new AppError(errorCodeFor(request.purpose), "AIの応答を取得できませんでした。");
    }

    const maxRetries = request.maxRetries ?? 1;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const candidate = this.nextCandidate(request.purpose);
      const parsed = request.schema.safeParse(candidate);
      if (parsed.success) {
        return { data: parsed.data, model: "fake-1" };
      }
    }

    throw new AppError(
      errorCodeFor(request.purpose),
      "AIの応答の形式が正しくありませんでした。",
    );
  }

  private nextCandidate(purpose: LlmPurpose): unknown {
    if (this.malformedLeft > 0) {
      this.malformedLeft -= 1;
      return { これは: "形式が違う応答" };
    }
    if (purpose in this.responses) {
      return this.responses[purpose];
    }
    return purpose === "assist" ? DEFAULT_FAKE_ASSIST : DEFAULT_FAKE_EVALUATION;
  }
}
