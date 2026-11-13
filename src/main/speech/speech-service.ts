/**
 * 音声認識の開始・終了と、途中結果の通知(内部設計書 §3.1・§5・§11.2)。
 *
 * 回答中の認識結果はメモリに持ち、DBへは書かない。回答終了のときに
 * PracticeSessionService が1つのトランザクションでまとめて保存する。
 */
import { AppError } from "../app-error.ts";
import type {
  MetricsUpdateEvent,
  SpeakingMetrics,
  SpeechWord,
  SttErrorEvent,
  SttFinalEvent,
  SttPartialEvent,
} from "../../shared/types.ts";
import { calculateSpeakingMetrics } from "./speaking-metrics.ts";
import type {
  AudioChunk,
  SpeechRecognitionStream,
  SpeechRecognizer,
} from "./speech-recognizer.ts";

export type SpeechNotifier = {
  partial: (event: SttPartialEvent) => void;
  final: (event: SttFinalEvent) => void;
  metrics: (event: MetricsUpdateEvent) => void;
  error: (event: SttErrorEvent) => void;
};

export type SpeechTurnSegment = {
  text: string;
  words: SpeechWord[];
  startMs: number | null;
  endMs: number | null;
};

export type SpeechTurnResult = {
  answerText: string;
  segments: SpeechTurnSegment[];
  metrics: SpeakingMetrics;
  sttStatus: "ok" | "failed" | "none";
};

type ActiveTurn = {
  sessionId: number;
  turnId: number;
  stream: SpeechRecognitionStream;
  segments: SpeechTurnSegment[];
  chunkCount: number;
  failed: boolean;
};

const noopNotifier: SpeechNotifier = {
  partial: () => {},
  final: () => {},
  metrics: () => {},
  error: () => {},
};

export class SpeechService {
  private readonly recognizer: SpeechRecognizer;
  private readonly finalWaitMs: number;
  private notifier: SpeechNotifier;
  private active: ActiveTurn | null = null;

  constructor(options: {
    recognizer: SpeechRecognizer;
    notifier?: SpeechNotifier;
    /** 回答終了のあと、最終結果を待つ上限(内部設計書 §5)。 */
    finalWaitMs?: number;
  }) {
    this.recognizer = options.recognizer;
    this.notifier = options.notifier ?? noopNotifier;
    this.finalWaitMs = options.finalWaitMs ?? 5000;
  }

  setNotifier(notifier: SpeechNotifier): void {
    this.notifier = notifier;
  }

  get recognizerName(): string {
    return this.recognizer.name;
  }

  get activeTurnId(): number | null {
    return this.active?.turnId ?? null;
  }

  /** 回答開始。認識を開いてから、画面が録音を始める。 */
  async beginTurn(context: { sessionId: number; turnId: number }): Promise<void> {
    if (this.active) {
      throw new AppError("E_STATE", "すでに回答中の質問があります。");
    }

    const turn: ActiveTurn = {
      sessionId: context.sessionId,
      turnId: context.turnId,
      stream: undefined as unknown as SpeechRecognitionStream,
      segments: [],
      chunkCount: 0,
      failed: false,
    };

    try {
      turn.stream = await this.recognizer.start({
        onPartial: (text) => {
          this.notifier.partial({ sessionId: turn.sessionId, turnId: turn.turnId, text });
        },
        onFinal: (result) => {
          // 表はSTRICTなので、小数のミリ秒は INTEGER 列へ入らない(内部設計書 §8.1)。
          // 外から来た時刻はここで整数に丸め、以降は整数だけを扱う。
          const words = [...result.words]
            .map((word) => ({
              ...word,
              startMs: Math.round(word.startMs),
              endMs: Math.round(word.endMs),
            }))
            .sort((a, b) => a.startMs - b.startMs);
          turn.segments.push({
            text: result.text,
            words,
            startMs: words.length > 0 ? words[0].startMs : null,
            endMs: words.length > 0 ? Math.max(...words.map((word) => word.endMs)) : null,
          });
          this.notifier.final({
            sessionId: turn.sessionId,
            turnId: turn.turnId,
            text: result.text,
            words,
          });
          this.notifier.metrics({
            sessionId: turn.sessionId,
            turnId: turn.turnId,
            metrics: this.measure(turn),
          });
        },
        onError: (error) => {
          turn.failed = true;
          this.notifier.error({
            sessionId: turn.sessionId,
            turnId: turn.turnId,
            code: "E_STT",
            message: error.message,
          });
        },
      });
    } catch (error) {
      throw new AppError("E_STT", "音声認識を開始できませんでした。", { cause: error });
    }

    this.active = turn;
  }

  /** 録音データを認識へ渡す。終了後に届いた分は捨てる。 */
  pushChunk(context: { sessionId: number; turnId: number }, chunk: AudioChunk): void {
    const turn = this.active;
    if (!turn || turn.sessionId !== context.sessionId || turn.turnId !== context.turnId) {
      return;
    }
    turn.chunkCount += 1;
    try {
      turn.stream.write(chunk);
    } catch (error) {
      turn.failed = true;
      this.notifier.error({
        sessionId: turn.sessionId,
        turnId: turn.turnId,
        code: "E_STT",
        message: error instanceof Error ? error.message : "音声認識に失敗しました。",
      });
    }
  }

  /** 回答終了。最終結果を finalWaitMs まで待ってから、まとめた結果を返す。 */
  async endTurn(context: { sessionId: number; turnId: number }): Promise<SpeechTurnResult> {
    const turn = this.active;
    if (!turn || turn.sessionId !== context.sessionId || turn.turnId !== context.turnId) {
      throw new AppError("E_STATE", "回答中の質問が見つかりません。");
    }
    this.active = null;

    try {
      await this.withTimeout(turn.stream.finish());
    } catch (error) {
      turn.failed = true;
      this.notifier.error({
        sessionId: turn.sessionId,
        turnId: turn.turnId,
        code: "E_STT",
        message: error instanceof Error ? error.message : "音声認識の終了に失敗しました。",
      });
    }

    const answerText = turn.segments.map((segment) => segment.text).join("");
    const metrics = this.measure(turn);
    const sttStatus =
      turn.segments.length > 0 ? "ok" : turn.failed || turn.chunkCount > 0 ? "failed" : "none";

    return { answerText, segments: turn.segments, metrics, sttStatus };
  }

  /** 練習の中断や異常終了のときに、結果を待たずに閉じる。 */
  abortTurn(): void {
    const turn = this.active;
    this.active = null;
    if (!turn) {
      return;
    }
    try {
      turn.stream.abort();
    } catch {
      // 閉じられなくても練習の中断は進める。
    }
  }

  private measure(turn: ActiveTurn): SpeakingMetrics {
    return calculateSpeakingMetrics({
      text: turn.segments.map((segment) => segment.text).join(""),
      words: turn.segments.flatMap((segment) => segment.words),
    });
  }

  private async withTimeout(work: Promise<void>): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, this.finalWaitMs);
    });
    try {
      await Promise.race([work, timeout]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }
}
