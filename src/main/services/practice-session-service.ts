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
import type { SpeechService, SpeechTurnResult } from "../speech/speech-service.ts";
import type {
  AnswerStarted,
  EsKind,
  PartnerQuestionStarted,
  PartnerSpeechRecorded,
  PracticeMode,
  PracticeNextResult,
  PracticePrompt,
  PracticeStarted,
  QuestionSource,
  QuestionSummary,
  TurnRecord,
} from "../../shared/types.ts";
import type { QuestionService } from "./question-service.ts";

export type PracticeStartOptions = {
  mode: PracticeMode;
  /** Defaults to app questions to preserve the existing one-on-one flow. */
  questionSource?: QuestionSource;
  esSetId: number | null;
  interviewerImageId: number | null;
  questionCount: number;
};

/** 進行中の練習の覚え書き。質問の並びは表に持たないため、ここで保持する。 */
type ActivePractice = {
  sessionId: number;
  mode: PracticeMode;
  questionSource: QuestionSource;
  /** アプリが質問を出す場合の質問の並び。 */
  plan: QuestionSummary[];
  /** いま出している質問の位置(0始まり)。 */
  index: number;
  /** partner出題は相手の質問が来るまでターンがないので null。 */
  currentTurnId: number | null;
  answering: boolean;
  /** DB保存に失敗したとき、同じ回答を再保存するためにメモリへ保持する。 */
  pendingAnswer?: { turnId: number; result: SpeechTurnResult; endedAt: string };
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

    const questionSource = options.questionSource ?? "app";
    if (options.mode !== "one_on_one" && questionSource !== "app") {
      throw new AppError("E_VALIDATION", "相手が質問する形式は1on1でのみ利用できます。");
    }

    const filledEsKinds: EsKind[] = (esSet?.items ?? [])
      .filter((item) => item.body.trim() !== "")
      .map((item) => item.kind);

    // 未指定は従来どおりアプリ出題。相手出題は明示選択時だけ質問バンクを使わない。
    const plan = questionSource === "partner"
      ? []
      : this.deps.questions.pick(options.questionCount, filledEsKinds);
    const first = plan[0];
    if (questionSource === "app" && !first) {
      throw new AppError("E_STATE", "最初の質問を準備できませんでした。");
    }
    const startedAt = this.now();

    const { sessionId, turnId } = this.deps.database.transaction(() => {
      const newSessionId = this.deps.sessions.createSession({
        mode: options.mode,
        esSetId: options.esSetId,
        esSnapshotJson: JSON.stringify(esSet),
        interviewerImageId: options.interviewerImageId,
        startedAt,
      });
      const newTurnId = first
        ? this.deps.sessions.createTurn({
            sessionId: newSessionId,
            seq: 1,
            questionId: first.id,
            questionText: first.text,
          })
        : null;
      return { sessionId: newSessionId, turnId: newTurnId };
    });

    this.active = {
      sessionId,
      mode: options.mode,
      questionSource,
      plan,
      index: 0,
      currentTurnId: turnId,
      answering: false,
    };

    if (questionSource === "partner") {
      return { sessionId, questionSource, prompt: null };
    }

    if (turnId === null || !first) {
      throw new AppError("E_STATE", "最初の質問を準備できませんでした。");
    }
    return { sessionId, questionSource, prompt: this.toPrompt(turnId, 1, first) };
  }

  /**
   * partner出題の1on1: 相手が出した質問でターンを作る(EX-01)。
   *
   * 質問文は turns.question_text に写し、同じ文を相手の発言としても会話ログに残す(EX-02)。
   * 相手の音声をどう取り込むか(U-09)は未決なので、ここは文字になったものを受け取る。
   * 取り込み方が決まっても、呼ぶ前の処理が変わるだけでここは変えなくてよい。
   */
  askByPartner(sessionId: number, questionText: string): PartnerQuestionStarted {
    const active = this.requirePartnerQuestionSession(sessionId);
    if (active.answering || active.pendingAnswer) {
      throw new AppError("E_STATE", "回答中または保存待ちです。先に回答を確定してください。");
    }

    if (active.currentTurnId !== null) {
      const current = this.deps.sessions.loadTurnRecord(active.currentTurnId);
      if (!current || (current.status !== "answered" && current.status !== "skipped")) {
        throw new AppError("E_STATE", "現在の質問への回答を確定してから、次の質問を登録してください。");
      }
    }

    const seq = this.deps.sessions.countTurns(sessionId) + 1;
    const turnId = this.deps.database.transaction(() => {
      const newTurnId = this.deps.sessions.createTurn({
        sessionId,
        seq,
        // 質問バンクから出していないので question_id は持たない。
        questionId: null,
        questionText,
      });
      this.deps.sessions.insertUtterance({
        turnId: newTurnId,
        seq: 1,
        speaker: "partner",
        text: questionText,
        startMs: null,
        endMs: null,
        words: [],
      });
      return newTurnId;
    });

    active.currentTurnId = turnId;
    active.index = seq - 1;

    return { turnId, seq, questionText };
  }

  /**
   * partner出題の1on1: 相手の発言を会話ログに残す(EX-02)。
   * 質問以外の相づちや深掘りも、同じターンに積んでいく。
   */
  recordPartnerSpeech(input: {
    sessionId: number;
    turnId: number;
    text: string;
    startMs: number | null;
    endMs: number | null;
  }): PartnerSpeechRecorded {
    this.requirePartnerQuestionSession(input.sessionId);

    const turn = this.deps.sessions.loadTurnRecord(input.turnId);
    if (!turn || turn.sessionId !== input.sessionId) {
      throw new AppError("E_NOT_FOUND", "質問が見つかりません。");
    }

    const seq = this.deps.sessions.countUtterances(input.turnId) + 1;
    const utteranceId = this.deps.sessions.insertUtterance({
      turnId: input.turnId,
      seq,
      speaker: "partner",
      text: input.text,
      startMs: input.startMs,
      endMs: input.endMs,
      words: [],
    });

    return { turnId: input.turnId, utteranceId, seq };
  }

  /** 回答開始。認識を開いてから、画面が録音を始める。 */
  async beginAnswer(sessionId: number): Promise<AnswerStarted> {
    const active = this.requireActive(sessionId);
    if (active.answering) {
      throw new AppError("E_STATE", "すでに回答中です。");
    }

    const turnId = active.currentTurnId;
    if (turnId === null) {
      throw new AppError(
        "E_STATE",
        active.questionSource === "partner"
          ? "まだ質問がありません。相手の質問を登録してから回答してください。"
          : "回答できる質問がありません。",
      );
    }
    await this.deps.speech.beginTurn({ sessionId, turnId });
    try {
      this.deps.sessions.startAnswering(turnId, this.now());
    } catch (error) {
      this.deps.speech.abortTurn();
      throw error;
    }
    active.answering = true;

    return { turnId, recognizer: this.deps.speech.recognizerName };
  }

  /**
   * 回答終了。音声認識の最終結果を待ってから、回答文・時刻・話速・言い淀みを
   * 1トランザクションで確定する。
   */
  async endAnswer(sessionId: number, turnId: number): Promise<TurnRecord> {
    const active = this.requireActive(sessionId);
    if (active.currentTurnId !== turnId) {
      throw new AppError("E_STATE", "回答中の質問が見つかりません。");
    }

    if (!active.pendingAnswer) {
      if (!active.answering) {
        throw new AppError("E_STATE", "回答中の質問が見つかりません。");
      }
      const result = await this.deps.speech.endTurn({ sessionId, turnId });
      active.answering = false;
      active.pendingAnswer = { turnId, result, endedAt: this.now() };
    }

    const pending = active.pendingAnswer;
    if (!pending || pending.turnId !== turnId) {
      throw new AppError("E_STATE", "保存待ちの回答が見つかりません。");
    }
    const { result, endedAt } = pending;

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
      // 1on1では相手の発言が先に入っているので、その続きの番号から積む。
      const base = this.deps.sessions.countUtterances(turnId);
      result.segments.forEach((segment, position) => {
        this.deps.sessions.insertUtterance({
          turnId,
          seq: base + position + 1,
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
    active.pendingAnswer = undefined;
    return saved;
  }

  /** 次の質問。残りがなければ練習を終了する。 */
  next(sessionId: number): PracticeNextResult {
    const active = this.requireActive(sessionId);
    if (active.questionSource === "partner") {
      throw new AppError(
        "E_STATE",
        "相手が質問する形式では practice:partnerQuestion を使ってください。",
      );
    }
    if (active.answering || active.pendingAnswer) {
      throw new AppError("E_STATE", "回答中または保存待ちです。先に回答を確定してください。");
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
    if (keep && active?.pendingAnswer) {
      throw new AppError("E_STATE", "回答を保存できていません。回答を確定してから終了してください。");
    }
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
      // 相手出題は質問数が決まっていないので、利用者が終えた時点で finished とする。
      const answeredAll = active?.questionSource === "partner" ||
        (active === null && session.mode === "one_on_one") ||
        (active !== null && active.index + 1 >= active.plan.length);
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

  private requirePartnerQuestionSession(sessionId: number): ActivePractice {
    const active = this.requireActive(sessionId);
    if (active.mode !== "one_on_one" || active.questionSource !== "partner") {
      throw new AppError("E_STATE", "相手が質問する1on1モードではありません。");
    }
    return active;
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
