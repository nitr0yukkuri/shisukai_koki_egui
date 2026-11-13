/** questions のSQL(内部設計書 §8.3)。 */
import type { AppDatabase } from "../db/database.ts";
import type { EsKind, QuestionSummary } from "../../shared/types.ts";

type QuestionRow = {
  id: number;
  text: string;
  category: string;
  es_kind: string | null;
};

export class QuestionRepository {
  private readonly database: AppDatabase;

  constructor(database: AppDatabase) {
    this.database = database;
  }

  listActive(): QuestionSummary[] {
    return this.database
      .all<QuestionRow>(
        "SELECT id, text, category, es_kind FROM questions WHERE is_active = 1 ORDER BY id",
      )
      .map((row) => ({
        id: row.id,
        text: row.text,
        category: row.category,
        esKind: (row.es_kind as EsKind | null) ?? null,
      }));
  }
}
