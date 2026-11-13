/**
 * 開発・テスト用の音声認識(内部設計書 §7.4)。
 * 固定の文字起こしと単語時刻を返すので、U-06が決まる前でも練習の流れを通して試せる。
 */
import type { SpeechWord } from "../../shared/types.ts";
import type {
  RecognitionCallbacks,
  RecognitionFinal,
  SpeechRecognitionStream,
  SpeechRecognizer,
} from "./speech-recognizer.ts";

/** [表記, 発音の長さ(ms), 直後の間(ms)] から単語列を組み立てる。 */
type WordSpec = [text: string, durationMs: number, pauseAfterMs?: number];

function buildWords(specs: readonly WordSpec[], startMs: number): SpeechWord[] {
  let cursor = startMs;
  return specs.map(([text, durationMs, pauseAfterMs = 0]) => {
    const word: SpeechWord = { text, startMs: cursor, endMs: cursor + durationMs };
    cursor = word.endMs + pauseAfterMs;
    return word;
  });
}

function toSegment(specs: readonly WordSpec[], startMs: number): RecognitionFinal {
  const words = buildWords(specs, startMs);
  return { text: words.map((word) => word.text).join(""), words };
}

/** 言い淀み・間を含む、日本語のサンプル回答。 */
export const DEFAULT_FAKE_SCRIPT: readonly RecognitionFinal[] = [
  toSegment(
    [
      ["えー", 420, 360],
      ["大学時代は", 900],
      ["長期インターンで", 1100],
      ["ユーザーインタビューを", 1200],
      ["担当しました", 1000, 900],
    ],
    0,
  ),
  toSegment(
    [
      ["あの", 300, 520],
      ["課題を", 600],
      ["整理して", 800],
      ["改善の提案を", 1100],
      ["続けました", 900, 1200],
    ],
    6300,
  ),
  toSegment(
    [
      ["使いやすさが", 1000],
      ["向上したことに", 1200],
      ["やりがいを", 900],
      ["感じました", 1000],
    ],
    12800,
  ),
];

export type FakeSpeechRecognizerOptions = {
  script?: readonly RecognitionFinal[];
  /** 1つの発話を確定させるまでに受け取る録音データの数。 */
  chunksPerSegment?: number;
  /** finish() のときに残りをまとめて確定させるか。 */
  flushOnFinish?: boolean;
};

export class FakeSpeechRecognizer implements SpeechRecognizer {
  readonly name = "fake";

  private readonly script: readonly RecognitionFinal[];
  private readonly chunksPerSegment: number;
  private readonly flushOnFinish: boolean;

  constructor(options: FakeSpeechRecognizerOptions = {}) {
    this.script = options.script ?? DEFAULT_FAKE_SCRIPT;
    this.chunksPerSegment = Math.max(1, options.chunksPerSegment ?? 4);
    this.flushOnFinish = options.flushOnFinish ?? true;
  }

  async start(callbacks: RecognitionCallbacks): Promise<SpeechRecognitionStream> {
    const script = this.script;
    const chunksPerSegment = this.chunksPerSegment;
    const flushOnFinish = this.flushOnFinish;

    let chunks = 0;
    let finalized = 0;
    let closed = false;

    const emitFinal = (index: number): void => {
      const segment = script[index];
      callbacks.onFinal({ text: segment.text, words: segment.words.map((word) => ({ ...word })) });
    };

    return {
      write() {
        if (closed) {
          return;
        }
        chunks += 1;
        const expected = Math.min(script.length, Math.floor(chunks / chunksPerSegment));
        while (finalized < expected) {
          emitFinal(finalized);
          finalized += 1;
        }
        const pending = script[finalized];
        if (pending) {
          const ratio = (chunks % chunksPerSegment) / chunksPerSegment;
          const upTo = Math.max(1, Math.ceil(pending.words.length * ratio));
          callbacks.onPartial(
            pending.words
              .slice(0, upTo)
              .map((word) => word.text)
              .join(""),
          );
        }
      },
      async finish() {
        if (closed) {
          return;
        }
        closed = true;
        if (!flushOnFinish) {
          return;
        }
        // 受け取った録音データの分だけ確定させる。1つも来ていなければ結果なし。
        while (finalized < script.length && finalized < Math.ceil(chunks / chunksPerSegment)) {
          emitFinal(finalized);
          finalized += 1;
        }
      },
      abort() {
        closed = true;
      },
    };
  }
}
