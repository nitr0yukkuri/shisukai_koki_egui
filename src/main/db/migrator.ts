/** 起動時のマイグレーション(内部設計書 §8.5)。 */
import { copyFileSync, existsSync } from "node:fs";

import { AppError } from "../app-error.ts";
import type { AppDatabase } from "./database.ts";
import { migrations as defaultMigrations, type Migration } from "./migrations/index.ts";

export type MigrationResult = {
  appliedVersions: number[];
  currentVersion: number;
};

function hasMigrationsTable(database: AppDatabase): boolean {
  const row = database.get<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'",
  );
  return row !== undefined;
}

function appliedVersions(database: AppDatabase): Set<number> {
  const rows = database.all<{ version: number }>(
    "SELECT version FROM schema_migrations ORDER BY version",
  );
  return new Set(rows.map((row) => row.version));
}

/**
 * リリース前なので、既存データを壊す変更は版を足さずに 0001・0002 を直接書き換えている
 * (内部設計書 §8.5「開発中は列の追加を許す」の範囲)。ただしその書き換えは、すでに版を
 * 適用済みのDBには二度と流れない。古いDBを黙って使い続けると、STRICT もCHECK も索引も
 * 入っていない表のまま動いてしまうので、ここで気づけるようにする。
 *
 * リリース後は、この関数ごと消して新しい版のマイグレーションで移行すること。
 */
function assertSchemaIsCurrent(database: AppDatabase, applied: ReadonlySet<number>): void {
  if (!applied.has(1)) {
    return;
  }
  const row = database.get<{ sql: string | null }>(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'turns'",
  );
  if (row?.sql && !/\bSTRICT\b/i.test(row.sql)) {
    throw new AppError(
      "E_DB",
      "このデータベースは古い作りのままです。" +
        "リリース前の開発中なので、jobuhan.db を削除してからもう一度起動してください。",
    );
  }
}

/**
 * 未適用の版だけを、1つずつトランザクションで適用する。
 * 失敗したらその版を巻き戻し、E_DB を投げる(練習は始めさせない)。
 */
export function runMigrations(
  database: AppDatabase,
  options: { filePath?: string; migrations?: readonly Migration[] } = {},
): MigrationResult {
  const list = [...(options.migrations ?? defaultMigrations)].sort((a, b) => a.version - b.version);
  const isExistingDatabase = hasMigrationsTable(database);
  const applied = isExistingDatabase ? appliedVersions(database) : new Set<number>();
  assertSchemaIsCurrent(database, applied);
  const pending = list.filter((migration) => !applied.has(migration.version));

  if (pending.length === 0) {
    return {
      appliedVersions: [],
      currentVersion: Math.max(0, ...applied),
    };
  }

  // 作ったばかりのDBには守るデータがないので、控えは取らない。
  const backupPath = isExistingDatabase ? backupDatabaseFile(database, options.filePath) : null;

  const done: number[] = [];
  for (const migration of pending) {
    try {
      database.transaction(() => {
        database.exec(migration.sql);
        database.run(
          "INSERT INTO schema_migrations (version, applied_at) VALUES ($version, $appliedAt)",
          { version: migration.version, appliedAt: new Date().toISOString() },
        );
      });
      done.push(migration.version);
    } catch (error) {
      throw new AppError(
        "E_DB",
        `データベースの更新(${migration.version}: ${migration.name})に失敗しました。` +
          (backupPath ? `保存前のファイルは ${backupPath} に残っています。` : ""),
        { cause: error },
      );
    }
  }

  return {
    appliedVersions: done,
    currentVersion: Math.max(...done, ...applied, 0),
  };
}

function backupDatabaseFile(database: AppDatabase, filePath?: string): string | null {
  if (!filePath || filePath === ":memory:" || !existsSync(filePath)) {
    return null;
  }
  const backupPath = `${filePath}.bak`;
  try {
    // WALモードでは直前の変更が -wal 側に残る。本体へ書き戻してから複製しないと、
    // 控えだけが古い状態になる。
    database.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    copyFileSync(filePath, backupPath);
    return backupPath;
  } catch (error) {
    throw new AppError("E_DB", "データベースの控えを作れませんでした。", { cause: error });
  }
}
