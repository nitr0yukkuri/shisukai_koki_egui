/** sessions / turns / utterances / filler_events のSQL(内部設計書 §8.3)。 */
import type { AppDatabase } from "../db/database.ts";
import type {
  EsSetSnapshot,
  FillerHit,
  PracticeMode,
  SessionDetail,
  SessionStatus,
  SessionSummary,
  Speaker,
  SpeechWord,
  SttStatus,
  TurnRecord,
  TurnStatus,
  UtteranceRecord,
} from "../../shared/types.ts";
import { toSpeedLabel } from "../speech/speaking-metrics.ts";

type SessionRow = {
  id: number;
  mode: string;
  es_set_id: number | null;
  es_snapshot_json: string;
  interviewer_image_id: number | null;
  status: string;
  started_at: string;
  ended_at: string | null;
};

type SessionSummaryRow = SessionRow & {
  es_set_name: string | null;
  turn_count: number;
  answered_count: number;
  total_score: number | null;
};

type TurnRow = {
  id: number;
  session_id: number;
  seq: number;
  question_id: number | null;
  question_text: string;
  status: string;
  answer_text: string;
  speaking_ms: number | null;
  char_count: number | null;
  wpm: number | null;
  filler_count: number;
  stt_status: string;
  started_at: string | null;
  ended_at: string | null;
};

type UtteranceRow = {
  id: number;
  seq: number;
  speaker: string;
  text: string;
  start_ms: number | null;
  end_ms: number | null;
  words_json: string | null;
};

type FillerRow = {
  word: string;
  at_ms: number | null;
};

export type AnsweredTurnInput = {
  turnId: number;
  status: TurnStatus;
  answerText: string;
  speakingMs: number | null;
  charCount: number | null;
  wpm: number | null;
  fillerCount: number;
  sttStatus: SttStatus;
  endedAt: string;
};

export class SessionRepository {
  private readonly database: AppDatabase;

  constructor(database: AppDatabase) {
    this.database = database;
  }

  createSession(input: {
    mode: PracticeMode;
    esSetId: number | null;
    esSnapshotJson: string;
    interviewerImageId: number | null;
    startedAt: string;
  }): number {
    return this.database.run(
      `INSERT INTO sessions (mode, es_set_id, es_snapshot_json, interviewer_image_id, status, started_at)
       VALUES ($mode, $esSetId, $esSnapshotJson, $interviewerImageId, 'in_progress', $startedAt)`,
      {
        mode: input.mode,
        esSetId: input.esSetId,
        esSnapshotJson: input.esSnapshotJson,
        interviewerImageId: input.interviewerImageId,
        startedAt: input.startedAt,
      },
    ).lastInsertRowid;
  }

  findSession(sessionId: number): SessionRow | undefined {
    return this.database.get<SessionRow>("SELECT * FROM sessions WHERE id = $id", {
      id: sessionId,
    });
  }

  findInProgressSession(): SessionRow | undefined {
    return this.database.get<SessionRow>(
      "SELECT * FROM sessions WHERE status = 'in_progress' ORDER BY started_at LIMIT 1",
    );
  }

  /** 起動時の後始末(内部設計書 §9.2)。 */
  markInProgressAsInterrupted(endedAt: string): number {
    return this.database.run(
      "UPDATE sessions SET status = 'interrupted', ended_at = COALESCE(ended_at, $endedAt) WHERE status = 'in_progress'",
      { endedAt },
    ).changes;
  }

  updateSessionStatus(sessionId: number, status: SessionStatus, endedAt: string | null): void {
    this.database.run("UPDATE sessions SET status = $status, ended_at = $endedAt WHERE id = $id", {
      id: sessionId,
      status,
      endedAt,
    });
  }

  deleteSession(sessionId: number): number {
    const changes = this.database.run("DELETE FROM sessions WHERE id = $id", { id: sessionId })
      .changes;
    // 前回チェックポイントがロックで失敗していても、再試行でWALを消去できるよう毎回確認する。
    this.database.checkpoint();
    return changes;
  }

  createTurn(input: {
    sessionId: number;
    seq: number;
    questionId: number | null;
    questionText: string;
  }): number {
    return this.database.run(
      `INSERT INTO turns (session_id, seq, question_id, question_text, status, stt_status)
       VALUES ($sessionId, $seq, $questionId, $questionText, 'asked', 'none')`,
      input,
    ).lastInsertRowid;
  }

  startAnswering(turnId: number, startedAt: string): void {
    this.database.run(
      "UPDATE turns SET status = 'answering', started_at = $startedAt WHERE id = $id",
      { id: turnId, startedAt },
    );
  }

  saveAnsweredTurn(input: AnsweredTurnInput): void {
    this.database.run(
      `UPDATE turns
          SET status = $status,
              answer_text = $answerText,
              speaking_ms = $speakingMs,
              char_count = $charCount,
              wpm = $wpm,
              filler_count = $fillerCount,
              stt_status = $sttStatus,
              ended_at = $endedAt
        WHERE id = $turnId`,
      {
        turnId: input.turnId,
        status: input.status,
        answerText: input.answerText,
        speakingMs: input.speakingMs,
        charCount: input.charCount,
        wpm: input.wpm,
        fillerCount: input.fillerCount,
        sttStatus: input.sttStatus,
        endedAt: input.endedAt,
      },
    );
  }

  insertUtterance(input: {
    turnId: number;
    seq: number;
    speaker: Speaker;
    text: string;
    startMs: number | null;
    endMs: number | null;
    words: readonly SpeechWord[];
  }): number {
    return this.database.run(
      `INSERT INTO utterances (turn_id, seq, speaker, text, start_ms, end_ms, words_json)
       VALUES ($turnId, $seq, $speaker, $text, $startMs, $endMs, $wordsJson)`,
      {
        turnId: input.turnId,
        seq: input.seq,
        speaker: input.speaker,
        text: input.text,
        startMs: input.startMs,
        endMs: input.endMs,
        wordsJson: JSON.stringify(input.words),
      },
    ).lastInsertRowid;
  }

  insertFillerEvent(input: { turnId: number; word: string; atMs: number | null }): void {
    this.database.run(
      "INSERT INTO filler_events (turn_id, word, at_ms) VALUES ($turnId, $word, $atMs)",
      input,
    );
  }

  /** 同じ回答をやり直したときに、前の記録を消す。 */
  clearTurnRecords(turnId: number): void {
    this.database.run("DELETE FROM utterances WHERE turn_id = $turnId", { turnId });
    this.database.run("DELETE FROM filler_events WHERE turn_id = $turnId", { turnId });
  }

  findTurn(turnId: number): TurnRow | undefined {
    return this.database.get<TurnRow>("SELECT * FROM turns WHERE id = $id", { id: turnId });
  }

  countTurns(sessionId: number): number {
    const row = this.database.get<{ count: number }>(
      "SELECT COUNT(*) AS count FROM turns WHERE session_id = $sessionId",
      { sessionId },
    );
    return row?.count ?? 0;
  }

  loadTurnRecord(turnId: number): TurnRecord | undefined {
    const row = this.findTurn(turnId);
    return row ? this.toTurnRecord(row) : undefined;
  }

  /**
   * 履歴一覧(SC-06)。
   * ESセット名は es_sets を結合せず、開始時の写し(es_snapshot_json)から取る。
   * es_set_id は ON DELETE SET NULL なので、結合ではESを消したときに名前が消えてしまう。
   */
  listSummaries(): SessionSummary[] {
    return this.database
      .all<SessionSummaryRow>(
        `SELECT s.*,
                json_extract(s.es_snapshot_json, '$.name') AS es_set_name,
                (SELECT COUNT(*) FROM turns t WHERE t.session_id = s.id) AS turn_count,
                (SELECT COUNT(*) FROM turns t WHERE t.session_id = s.id AND t.status = 'answered') AS answered_count,
                (SELECT e.total_score FROM evaluations e WHERE e.session_id = s.id ORDER BY e.created_at DESC, e.id DESC LIMIT 1) AS total_score
           FROM sessions s
          ORDER BY s.started_at DESC, s.id DESC`,
      )
      .map((row) => ({
        id: row.id,
        mode: row.mode as PracticeMode,
        status: row.status as SessionStatus,
        esSetName: typeof row.es_set_name === "string" ? row.es_set_name : null,
        startedAt: row.started_at,
        endedAt: row.ended_at,
        turnCount: row.turn_count,
        answeredCount: row.answered_count,
        totalScore: row.total_score,
      }));
  }

  loadSessionDetail(sessionId: number): SessionDetail | undefined {
    const session = this.findSession(sessionId);
    if (!session) {
      return undefined;
    }
    const turns = this.database
      .all<TurnRow>("SELECT * FROM turns WHERE session_id = $sessionId ORDER BY seq", { sessionId })
      .map((row) => this.toTurnRecord(row));

    return {
      id: session.id,
      mode: session.mode as PracticeMode,
      status: session.status as SessionStatus,
      esSetId: session.es_set_id,
      esSnapshot: parseEsSnapshot(session.es_snapshot_json),
      interviewerImageId: session.interviewer_image_id,
      startedAt: session.started_at,
      endedAt: session.ended_at,
      turns,
    };
  }

  private listUtterances(turnId: number): UtteranceRecord[] {
    return this.database
      .all<UtteranceRow>(
        "SELECT id, seq, speaker, text, start_ms, end_ms, words_json FROM utterances WHERE turn_id = $turnId ORDER BY seq",
        { turnId },
      )
      .map((row) => ({
        id: row.id,
        seq: row.seq,
        speaker: row.speaker as Speaker,
        text: row.text,
        startMs: row.start_ms,
        endMs: row.end_ms,
        words: parseWords(row.words_json),
      }));
  }

  private listFillers(turnId: number): FillerHit[] {
    return this.database
      .all<FillerRow>(
        "SELECT word, at_ms FROM filler_events WHERE turn_id = $turnId ORDER BY at_ms, id",
        { turnId },
      )
      .map((row) => ({ word: row.word, atMs: row.at_ms }));
  }

  private toTurnRecord(row: TurnRow): TurnRecord {
    return {
      id: row.id,
      sessionId: row.session_id,
      seq: row.seq,
      questionId: row.question_id,
      questionText: row.question_text,
      status: row.status as TurnStatus,
      answerText: row.answer_text,
      speakingMs: row.speaking_ms,
      charCount: row.char_count,
      wpm: row.wpm,
      speedLabel: toSpeedLabel(row.wpm),
      fillerCount: row.filler_count,
      sttStatus: row.stt_status as SttStatus,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      utterances: this.listUtterances(row.id),
      fillers: this.listFillers(row.id),
    };
  }
}

function parseWords(raw: string | null): SpeechWord[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SpeechWord[]) : [];
  } catch {
    return [];
  }
}

function parseEsSnapshot(raw: string): EsSetSnapshot | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    const snapshot = parsed as { id?: unknown; name?: unknown };
    if (!Number.isInteger(snapshot.id) || (snapshot.id as number) <= 0 || typeof snapshot.name !== "string") {
      return null;
    }
    return { id: snapshot.id as number, name: snapshot.name };
  } catch {
    return null;
  }
}
