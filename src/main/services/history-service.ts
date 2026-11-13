/** 練習ログの一覧・表示・削除(FR-08・16・29)。 */
import { AppError } from "../app-error.ts";
import type { SessionRepository } from "../repositories/session-repository.ts";
import type { SessionDetail, SessionSummary } from "../../shared/types.ts";

export class HistoryService {
  private readonly sessions: SessionRepository;

  constructor(sessions: SessionRepository) {
    this.sessions = sessions;
  }

  list(): SessionSummary[] {
    return this.sessions.listSummaries();
  }

  get(sessionId: number): SessionDetail {
    const detail = this.sessions.loadSessionDetail(sessionId);
    if (!detail) {
      throw new AppError("E_NOT_FOUND", "練習ログが見つかりません。");
    }
    return detail;
  }

  /** 練習を消すと、ターン・発話・言い淀み・評価まで連鎖して消える(内部設計書 §8.4)。 */
  delete(sessionId: number): void {
    if (this.sessions.deleteSession(sessionId) === 0) {
      throw new AppError("E_NOT_FOUND", "練習ログが見つかりません。");
    }
  }
}
