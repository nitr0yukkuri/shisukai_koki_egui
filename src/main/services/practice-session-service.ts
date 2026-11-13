/**
 * 練習の進行(内部設計書 §5・§11.2)。
 *
 * 状態遷移を持つのはこのサービスだけ。回答の保存は1トランザクションでまとめ、
 * 異常終了しても直前の回答までは残る(NFR-08)。
 */
import { AppError } from "../app-error.ts";
import type { AppDatabase } from "../db/database.ts";
import type { EsRepository } from "../repositories/es-repository.ts";
import type { SessionRepository } from "../repositories/session-repository.ts";
import type { SpeechService } from "../speech/speech-service.ts";
import type {
  AnswerStarted,
  EsKind,
  PracticeMode,
  PracticeNextResult,
  PracticePrompt,
  PracticeStarted,
  QuestionSummary,
  TurnRecord,
} from "../../shared/types.ts";
import type { QuestionService } from "./question-service.ts";

export type PracticeStartOptions = {
  mode: PracticeMode;
  esSetId: number | null;
  interviewerImageId: number | null;
  questionCount: number;
};

/** 進行中の練習の覚え書き。質問の並びは表に持たないため、ここで保持する。 */
type ActivePractice = {
  sessionId: number;
  plan: QuestionSummary[];
  /** いま出している質問の位置(0始まり)。 */
  index: number;
  currentTurnId: number;
  answering: boolean;
};

export class PracticeSessionService {
  private active: ActivePractice | null = null;

  private readonly deps: {
    database: AppDatabase;
    sessions: SessionRepository;
    esSets: EsRepository;
    questions: QuestionService;
    speech: SpeechService;
    now?: () => string;
  };

  constructor(deps: {
    database: AppDatabase;
    sessions: SessionRepository;
    esSets: EsRepository;
    questions: QuestionService;
    speech: SpeechService;
    now?: () => string;
  }) {
    this.deps = deps;
  }

  private now(): string {
    return (this.deps.now ?? (() => new Date().toISOString()))();
  }

  /** 起動時の後始末(内部設計書 §9.2)。in_progress のまま残った練習を interrupted にする。 */
  recoverInterruptedSessions(): number {
    this.active = null;
    return this.deps.sessions.markInProgressAsInterrupted(this.now());
  }

  start(options: PracticeStartOptions): PracticeStarted {
    if (this.active || this.deps.sessions.findInProgressSession()) {
      throw new AppError("E_STATE", "進行中の練習があります。先に終了してください。");
    }

    const esSet = options.esSetId === null ? null : this.deps.esSets.find(options.esSetId);
    if (options.esSetId !== null && !esSet) {
      throw new AppError("E_NOT_FOUND", "ESが見つかりません。");
    }

    const filledEsKinds: EsKind[] = (esSet?.items ?? [])
      .filter((item) => item.body.trim() !== "")
      .map((item) => item.kind);
    const plan = this.deps.questions.pick(options.questionCount, filledEsKinds);
    const startedAt = this.now();

    const { sessionId, turnId } = this.deps.database.transaction(() => {
      const newSessionId = this.deps.sessions.createSession({
        mode: options.mode,
        esSetId: options.esSetId,
        esSnapshotJson: JSON.stringify(esSet),
        interviewerImageId: options.interviewerImageId,
        startedAt,
      });
      const newTurnId = this.deps.sessions.createTurn({
        sessionId: newSessionId,
        seq: 1,
        questionId: plan[0].id,
        questionText: plan[0].text,
      });
      return { sessionId: newSessionId, turnId: newTurnId };
    });

    this.active = { sessionId, plan, index: 0, currentTurnId: turnId, answering: false };

    return { sessionId, prompt: this.toPrompt(turnId, 1, plan[0]) };
  }

  /** 回答開始。認識を開いてから、画面が録音を始める。 */
  async beginAnswer(sessionId: number): Promise<AnswerStarted> {
    const active = this.requireActive(sessionId);
    if (active.answering) {
      throw new AppError("E_STATE", "すでに回答中です。");
    }

    const turnId = active.currentTurnId;
    await this.deps.speech.beginTurn({ sessionId, turnId });
    this.deps.sessions.startAnswering(turnId, this.now());
    active.answering = true;

    return { turnId, recognizer: this.deps.speech.recognizerName };
  }

  /**
   * 回答終了。音声認識の最終結果を待ってから、回答文・時刻・話速・言い淀みを
   * 1トランザクションで確定する。
   */
  async endAnswer(sessionId: number, turnId: number): Promise<TurnRecord> {
    const active = this.requireActive(sessionId);
    if (!active.answering || active.currentTurnId !== turnId) {
      throw new AppError("E_STATE", "回答中の質問が見つかりません。");
    }

    const result = await this.deps.speech.endTurn({ sessionId, turnId });
    active.answering = false;
    const endedAt = this.now();

    this.deps.database.transaction(() => {
      this.deps.sessions.clearTurnRecords(turnId);
      this.deps.sessions.saveAnsweredTurn({
        turnId,
        // skipped は音声認識に失敗して「スキップ」を選んだ回答だけ(内部設計書 §5・MSG-05)。
        // 何も話さずに終えた回答(stt_status='none')は answered とし、画面は stt_status で
        // 「(無回答)」と「(スキップ)」を分けて出す(外部設計書 SC-07)。
        status: result.sttStatus === "failed" ? "skipped" : "answered",
        answerText: result.answerText,
        speakingMs: result.segments.length > 0 ? result.metrics.speakingMs : null,
        charCount: result.segments.length > 0 ? result.metrics.charCount : null,
        wpm: result.metrics.wpm,
        fillerCount: result.metrics.fillerCount,
        sttStatus: result.sttStatus,
        endedAt,
      });
      result.segments.forEach((segment, position) => {
        this.deps.sessions.insertUtterance({
          turnId,
          seq: position + 1,
          speaker: "user",
          text: segment.text,
          startMs: segment.startMs,
          endMs: segment.endMs,
          words: segment.words,
        });
      });
      for (const filler of result.metrics.fillers) {
        this.deps.sessions.insertFillerEvent({ turnId, word: filler.word, atMs: filler.atMs });
      }
    });

    const saved = this.deps.sessions.loadTurnRecord(turnId);
    if (!saved) {
      throw new AppError("E_DB", "回答を保存できませんでした。");
    }
    return saved;
  }

  /** 次の質問。残りがなければ練習を終了する。 */
  next(sessionId: number): PracticeNextResult {
    const active = this.requireActive(sessionId);
    if (active.answering) {
      throw new AppError("E_STATE", "回答中です。先に回答を終了してください。");
    }

    const nextIndex = active.index + 1;
    if (nextIndex >= active.plan.length) {
      this.deps.sessions.updateSessionStatus(sessionId, "finished", this.now());
      this.active = null;
      return { done: true };
    }

    const question = active.plan[nextIndex];
    const seq = nextIndex + 1;
    const turnId = this.deps.sessions.createTurn({
      sessionId,
      seq,
      questionId: question.id,
      questionText: question.text,
    });

    active.index = nextIndex;
    active.currentTurnId = turnId;

    return { done: false, prompt: this.toPrompt(turnId, seq, question) };
  }

  /**
   * 練習の終了・中断。
   * keep が false のときは、記録を残さず練習ごと削除する(内部設計書 §5)。
   */
  finish(sessionId: number, keep: boolean): void {
    const session = this.deps.sessions.findSession(sessionId);
    if (!session) {
      throw new AppError("E_NOT_FOUND", "練習が見つかりません。");
    }

    const active = this.active?.sessionId === sessionId ? this.active : null;
    if (active?.answering) {
      this.deps.speech.abortTurn();
    }
    if (active) {
      this.active = null;
    }

    if (!keep) {
      this.deps.sessions.deleteSession(sessionId);
      return;
    }

    if (session.status === "in_progress") {
      const answeredAll = active !== null && active.index + 1 >= active.plan.length;
      this.deps.sessions.updateSessionStatus(
        sessionId,
        answeredAll ? "finished" : "interrupted",
        this.now(),
      );
    }
  }

  private requireActive(sessionId: number): ActivePractice {
    if (!this.active || this.active.sessionId !== sessionId) {
      throw new AppError("E_STATE", "進行中の練習が見つかりません。");
    }
    return this.active;
  }

  private toPrompt(turnId: number, seq: number, question: QuestionSummary): PracticePrompt {
    return {
      turnId,
      seq,
      totalQuestions: this.active?.plan.length ?? seq,
      question,
    };
  }
}
