/**
 * SQLiteへの接続(内部設計書 §8.1)。
 *
 * ドライバーは Node.js 同梱の node:sqlite を使う。内部設計書では better-sqlite3(仮)
 * としていたが、Electronのバージョンごとにネイティブモジュールを再ビルドする必要が
 * なく、同じ同期APIで書けるため採用した。差し替えられるよう、SQLは Repository だけが
 * 書き、接続はこの AppDatabase インターフェースの裏に閉じる。
 */
import { DatabaseSync } from "node:sqlite";

import { AppError } from "../app-error.ts";

export type SqlValue = string | number | bigint | null | Uint8Array;
export type SqlParams = Record<string, SqlValue>;

export type RunResult = {
  changes: number;
  lastInsertRowid: number;
};

export interface AppDatabase {
  exec(sql: string): void;
  get<T>(sql: string, params?: SqlParams): T | undefined;
  all<T>(sql: string, params?: SqlParams): T[];
  run(sql: string, params?: SqlParams): RunResult;
  /** 1つのトランザクションでまとめる。入れ子は SAVEPOINT で扱う。 */
  transaction<T>(work: () => T): T;
  /**
   * WALに溜まった分を本体ファイルへ書き戻し、-wal を切り詰める(内部設計書 §8.4)。
   * secure_delete は本体ファイルしか守らないため、消したあとにこれを呼ばないと
   * 利用者が消した内容が -wal に残る。:memory: では何も起きない。
   */
  checkpoint(): void;
  close(): void;
}

function wrapDbError(error: unknown): never {
  if (error instanceof AppError) {
    throw error;
  }
  throw new AppError("E_DB", "データの読み書きに失敗しました。", { cause: error });
}

export function openDatabase(filePath: string): AppDatabase {
  let connection: DatabaseSync;
  try {
    connection = new DatabaseSync(filePath);
  } catch (error) {
    wrapDbError(error);
  }

  // 接続のたびに設定する(内部設計書 §8.1)。
  // secure_delete は、利用者が消したES・会話ログの中身がファイルに残らないようにする(FR-29)。
  try {
    connection.exec("PRAGMA foreign_keys = ON;");
    connection.exec("PRAGMA secure_delete = ON;");
    connection.exec("PRAGMA busy_timeout = 5000;");
    if (filePath !== ":memory:") {
      connection.exec("PRAGMA journal_mode = WAL;");
      connection.exec("PRAGMA synchronous = NORMAL;");
    }
  } catch (error) {
    connection.close();
    wrapDbError(error);
  }

  let depth = 0;

  const database: AppDatabase = {
    exec(sql) {
      try {
        connection.exec(sql);
      } catch (error) {
        wrapDbError(error);
      }
    },
    get<T>(sql: string, params?: SqlParams): T | undefined {
      try {
        const statement = connection.prepare(sql);
        return (params ? statement.get(params) : statement.get()) as T | undefined;
      } catch (error) {
        wrapDbError(error);
      }
    },
    all<T>(sql: string, params?: SqlParams): T[] {
      try {
        const statement = connection.prepare(sql);
        return (params ? statement.all(params) : statement.all()) as T[];
      } catch (error) {
        wrapDbError(error);
      }
    },
    run(sql, params) {
      try {
        const statement = connection.prepare(sql);
        const result = params ? statement.run(params) : statement.run();
        return {
          changes: Number(result.changes),
          lastInsertRowid: Number(result.lastInsertRowid),
        };
      } catch (error) {
        wrapDbError(error);
      }
    },
    transaction<T>(work: () => T): T {
      const level = depth;
      const savepoint = `jobuhan_sp_${level}`;
      database.exec(level === 0 ? "BEGIN" : `SAVEPOINT ${savepoint}`);
      depth = level + 1;

      const rollback = (): void => {
        if (level === 0) {
          database.exec("ROLLBACK");
        } else {
          database.exec(`ROLLBACK TO ${savepoint}`);
          database.exec(`RELEASE ${savepoint}`);
        }
      };

      let result: T;
      try {
        result = work();
      } catch (error) {
        try {
          rollback();
        } catch {
          // 巻き戻しに失敗した場合は元のエラーを優先して伝える。
        } finally {
          depth = level;
        }
        throw error;
      }

      try {
        database.exec(level === 0 ? "COMMIT" : `RELEASE ${savepoint}`);
        return result;
      } catch (error) {
        try {
          rollback();
        } catch {
          // 巻き戻しに失敗した場合はコミット時のエラーを優先して伝える。
        }
        throw error;
      } finally {
        depth = level;
      }
    },
    checkpoint() {
      try {
        const status = database.get<{ busy: number; log: number; checkpointed: number }>(
          "PRAGMA wal_checkpoint(TRUNCATE);",
        );
        if (!status || status.busy !== 0 || status.log !== status.checkpointed) {
          throw new AppError(
            "E_DB",
            "WALファイルを安全に切り詰められませんでした。ほかのアプリでDBを開いていないか確認して再試行してください。",
          );
        }
      } catch (error) {
        wrapDbError(error);
      }
    },
    close() {
      try {
        connection.close();
      } catch (error) {
        wrapDbError(error);
      }
    },
  };

  return database;
}
