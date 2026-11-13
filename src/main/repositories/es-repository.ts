/** es_sets / es_items のSQL(内部設計書 §8.3)。 */
import type { AppDatabase } from "../db/database.ts";
import { ES_KINDS, type EsKind, type EsSet, type EsSetSummary } from "../../shared/types.ts";

type EsSetRow = {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
};

type EsItemRow = {
  kind: string;
  body: string;
};

export class EsRepository {
  private readonly database: AppDatabase;

  constructor(database: AppDatabase) {
    this.database = database;
  }

  listSummaries(): EsSetSummary[] {
    return this.database
      .all<EsSetRow>("SELECT id, name, created_at, updated_at FROM es_sets ORDER BY updated_at DESC")
      .map((row) => ({ id: row.id, name: row.name, updatedAt: row.updated_at }));
  }

  find(esSetId: number): EsSet | undefined {
    const row = this.database.get<EsSetRow>(
      "SELECT id, name, created_at, updated_at FROM es_sets WHERE id = $id",
      { id: esSetId },
    );
    if (!row) {
      return undefined;
    }
    const items = this.database.all<EsItemRow>(
      "SELECT kind, body FROM es_items WHERE es_set_id = $id",
      { id: esSetId },
    );
    const byKind = new Map(items.map((item) => [item.kind, item.body]));
    return {
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      items: ES_KINDS.map((kind) => ({ kind, body: byKind.get(kind) ?? "" })),
    };
  }

  insertSet(name: string, now: string): number {
    return this.database.run(
      "INSERT INTO es_sets (name, created_at, updated_at) VALUES ($name, $now, $now)",
      { name, now },
    ).lastInsertRowid;
  }

  updateSet(esSetId: number, name: string, now: string): number {
    return this.database.run(
      "UPDATE es_sets SET name = $name, updated_at = $now WHERE id = $id",
      { id: esSetId, name, now },
    ).changes;
  }

  upsertItem(esSetId: number, kind: EsKind, body: string, now: string): void {
    this.database.run(
      `INSERT INTO es_items (es_set_id, kind, body, updated_at)
       VALUES ($esSetId, $kind, $body, $now)
       ON CONFLICT (es_set_id, kind)
       DO UPDATE SET body = excluded.body, updated_at = excluded.updated_at`,
      { esSetId, kind, body, now },
    );
  }

  deleteSet(esSetId: number): number {
    const changes = this.database.run("DELETE FROM es_sets WHERE id = $id", { id: esSetId }).changes;
    // 前回チェックポイントがロックで失敗していても、再試行でWALを消去できるよう毎回確認する。
    this.database.checkpoint();
    return changes;
  }
}
