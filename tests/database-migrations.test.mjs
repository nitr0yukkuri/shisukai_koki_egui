import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { openDatabase } from "../src/main/db/database.ts";
import { runMigrations } from "../src/main/db/migrator.ts";
import { migrations } from "../src/main/db/migrations/index.ts";
import { EsRepository } from "../src/main/repositories/es-repository.ts";

/** Repository 層は SQLite のエラーを AppError(E_DB) に包むので、コードで確かめる。 */
function isDbError(error) {
  return error?.code === "E_DB";
}

const expectedTables = [
  "schema_migrations",
  "settings",
  "es_sets",
  "es_items",
  "interviewer_images",
  "questions",
  "sessions",
  "turns",
  "utterances",
  "filler_events",
  "assist_events",
  "evaluations",
  "evaluation_scores",
  "evaluation_comments",
];

test("空のDBから最新までマイグレーションが通る", () => {
  const database = openDatabase(":memory:");
  try {
    const result = runMigrations(database);
    assert.deepEqual(
      result.appliedVersions,
      migrations.map((migration) => migration.version),
    );

    const tables = database
      .all("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .map((row) => row.name);
    for (const table of expectedTables) {
      assert.ok(tables.includes(table), `テーブルがありません: ${table}`);
    }

    // 2回目は適用するものがない。
    assert.deepEqual(runMigrations(database).appliedVersions, []);
  } finally {
    database.close();
  }
});

test("質問バンクの初期データが入る", () => {
  const database = openDatabase(":memory:");
  try {
    runMigrations(database);
    const row = database.get("SELECT COUNT(*) AS count FROM questions WHERE is_active = 1");
    assert.ok(row.count >= 10, "質問が足りません");
  } finally {
    database.close();
  }
});

test("外部キーの連鎖削除が効く", () => {
  const database = openDatabase(":memory:");
  try {
    runMigrations(database);
    const sessionId = database.run(
      `INSERT INTO sessions (mode, es_snapshot_json, status, started_at)
       VALUES ('solo', 'null', 'in_progress', '2026-11-08T00:00:00.000Z')`,
    ).lastInsertRowid;
    const turnId = database.run(
      `INSERT INTO turns (session_id, seq, question_text, status)
       VALUES ($sessionId, 1, '質問', 'asked')`,
      { sessionId },
    ).lastInsertRowid;
    database.run(
      `INSERT INTO utterances (turn_id, seq, speaker, text) VALUES ($turnId, 1, 'user', 'はい')`,
      { turnId },
    );
    database.run(`INSERT INTO filler_events (turn_id, word, at_ms) VALUES ($turnId, 'えー', 10)`, {
      turnId,
    });

    database.run("DELETE FROM sessions WHERE id = $id", { id: sessionId });

    assert.equal(database.get("SELECT COUNT(*) AS count FROM turns").count, 0);
    assert.equal(database.get("SELECT COUNT(*) AS count FROM utterances").count, 0);
    assert.equal(database.get("SELECT COUNT(*) AS count FROM filler_events").count, 0);
  } finally {
    database.close();
  }
});

test("トランザクションは失敗したら巻き戻る", () => {
  const database = openDatabase(":memory:");
  try {
    runMigrations(database);
    assert.throws(() => {
      database.transaction(() => {
        database.run("INSERT INTO settings (key, value, updated_at) VALUES ('a', '1', 'now')");
        throw new Error("途中で失敗");
      });
    }, /途中で失敗/);
    assert.equal(database.get("SELECT COUNT(*) AS count FROM settings").count, 0);
  } finally {
    database.close();
  }
});

test("新しいDBでは控えを作らず、更新のある既存DBでは更新前の控えを残す", (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), "jobuhan-migrate-"));
  const filePath = path.join(directory, "jobuhan.db");
  const backupPath = `${filePath}.bak`;
  t.after(() => rmSync(directory, { recursive: true, force: true }));

  // 作ったばかりのDBには守るデータがないので、控えは作らない。
  const first = openDatabase(filePath);
  try {
    runMigrations(first, { filePath });
  } finally {
    first.close();
  }
  assert.equal(existsSync(backupPath), false);

  // 既存DBに新しい版を適用するときは、適用前の状態を控えに残す。
  const second = openDatabase(filePath);
  try {
    second.run("INSERT INTO settings (key, value, updated_at) VALUES ('a', '1', 'now')");
    const result = runMigrations(second, {
      filePath,
      migrations: [
        ...migrations,
        { version: 999, name: "test-only", sql: "CREATE TABLE migrate_probe (id INTEGER PRIMARY KEY);" },
      ],
    });
    assert.deepEqual(result.appliedVersions, [999]);
  } finally {
    second.close();
  }
  assert.equal(existsSync(backupPath), true);

  // 控えはWALの内容まで書き戻してから作るので、直前の行も入っている。
  const backup = openDatabase(backupPath);
  try {
    assert.equal(backup.get("SELECT COUNT(*) AS count FROM settings").count, 1);
    const tables = backup
      .all("SELECT name FROM sqlite_master WHERE type = 'table'")
      .map((row) => row.name);
    assert.equal(tables.includes("migrate_probe"), false, "控えは更新前の状態であるべき");
  } finally {
    backup.close();
  }
});

test("接続のたびに設計どおりのPRAGMAを設定する", (t) => {
  const memory = openDatabase(":memory:");
  try {
    assert.equal(memory.get("PRAGMA foreign_keys").foreign_keys, 1);
    assert.equal(memory.get("PRAGMA secure_delete").secure_delete, 1);
    assert.equal(memory.get("PRAGMA busy_timeout").timeout, 5000);
  } finally {
    memory.close();
  }

  // WAL と synchronous はファイルのDBだけに効く。
  const directory = mkdtempSync(path.join(tmpdir(), "jobuhan-pragma-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const file = openDatabase(path.join(directory, "jobuhan.db"));
  try {
    assert.equal(file.get("PRAGMA journal_mode").journal_mode, "wal");
    assert.equal(file.get("PRAGMA synchronous").synchronous, 1);
    assert.equal(file.get("PRAGMA secure_delete").secure_delete, 1);
  } finally {
    file.close();
  }
});

test("表はすべてSTRICTで、設計どおりの索引がある", () => {
  const database = openDatabase(":memory:");
  try {
    runMigrations(database);

    const tables = database.all(
      "SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
    );
    assert.equal(tables.length, expectedTables.length);
    for (const table of tables) {
      assert.ok(table.sql.includes("STRICT"), `STRICTになっていない表: ${table.name}`);
    }

    const indexes = database
      .all("SELECT name FROM sqlite_master WHERE type = 'index' AND name IS NOT NULL")
      .map((row) => row.name);
    for (const name of [
      "idx_sessions_started_at",
      "idx_utterances_turn_seq",
      "idx_filler_events_turn",
      "idx_assist_events_turn",
      "idx_evaluations_session",
      "idx_evaluation_comments_eval_seq",
      // 外部キーの子の列(内部設計書 §8.4)。
      "idx_sessions_es_set",
      "idx_sessions_interviewer_image",
      "idx_turns_question",
    ]) {
      assert.ok(indexes.includes(name), `索引がありません: ${name}`);
    }
  } finally {
    database.close();
  }
});

test("STRICTとCHECKが規定外の値を弾く", () => {
  const database = openDatabase(":memory:");
  try {
    runMigrations(database);
    const sessionId = database.run(
      `INSERT INTO sessions (mode, es_snapshot_json, status, started_at)
       VALUES ('solo', 'null', 'in_progress', '2026-11-13T00:00:00.000Z')`,
    ).lastInsertRowid;

    const insertTurn = (columns, values) =>
      database.run(
        `INSERT INTO turns (session_id, question_text, status, ${columns})
         VALUES ($sessionId, '質問', 'asked', ${values})`,
        { sessionId },
      );

    assert.throws(() => insertTurn("seq", "0"), isDbError, "seq は1以上");
    assert.throws(
      () => insertTurn("seq, filler_count", "1, -1"),
      isDbError,
      "言い淀みの回数は0以上",
    );
    // STRICT: 小数は INTEGER 列へ入らない。だから時刻は丸めてから渡す。
    assert.throws(
      () => insertTurn("seq, speaking_ms", "2, 1234.5"),
      isDbError,
      "小数のミリ秒は弾く",
    );
    insertTurn("seq, speaking_ms", "3, 1234");

    const insertEvaluation = (score) =>
      database.run(
        `INSERT INTO evaluations (session_id, total_score, model, prompt_version, created_at)
         VALUES ($sessionId, ${score}, 'fake', 'v1', '2026-11-13T00:00:00.000Z')`,
        { sessionId },
      );
    assert.throws(() => insertEvaluation(101), isDbError, "総合点は100まで");
    insertEvaluation(100);
  } finally {
    database.close();
  }
});

test("相手画像の is_builtin は既定で0(利用者が追加した画像)", () => {
  const database = openDatabase(":memory:");
  try {
    runMigrations(database);
    database.run("INSERT INTO interviewer_images (name, file_path) VALUES ('自作', 'a.png')");
    assert.equal(database.get("SELECT is_builtin FROM interviewer_images").is_builtin, 0);
  } finally {
    database.close();
  }
});

test("質問バンクのcareerは経歴/資格の質問で、自己紹介も入っている", () => {
  const database = openDatabase(":memory:");
  try {
    runMigrations(database);

    // career は「経歴/資格」であって将来のキャリアではない(内部設計書 §8.3)。
    const career = database.all("SELECT text, category FROM questions WHERE es_kind = 'career'");
    assert.ok(career.length >= 2, "経歴/資格の質問が足りません");
    for (const question of career) {
      assert.equal(question.category, "経歴");
    }

    // 将来を聞く質問は ES の項目に結び付けない。
    const future = database.all("SELECT es_kind FROM questions WHERE category = '将来'");
    assert.ok(future.length > 0);
    for (const question of future) {
      assert.equal(question.es_kind, null);
    }

    // U-01 の案に必要な導入の質問。
    assert.ok(
      database.get("SELECT COUNT(*) AS count FROM questions WHERE category = '導入'").count >= 1,
      "自己紹介の質問がありません",
    );
  } finally {
    database.close();
  }
});

test("消したESの本文は、DBファイルにも -wal にも残らない", (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), "jobuhan-delete-"));
  const filePath = path.join(directory, "jobuhan.db");
  t.after(() => rmSync(directory, { recursive: true, force: true }));

  const secret = "ヒミツノジコピーアール";
  const probe = Buffer.from(secret, "utf8");
  const database = openDatabase(filePath);
  try {
    runMigrations(database, { filePath });
    const esSetId = database.run(
      "INSERT INTO es_sets (name, created_at, updated_at) VALUES ('A社', 't', 't')",
    ).lastInsertRowid;
    database.run(
      "INSERT INTO es_items (es_set_id, kind, body, updated_at) VALUES ($id, 'self_pr', $body, 't')",
      { id: esSetId, body: secret },
    );

    database.checkpoint();
    assert.ok(readFileSync(filePath).includes(probe), "保存した直後は本文がファイルにある");

    // Repository 経由で消すと secure_delete と checkpoint の両方が効く(FR-29)。
    assert.equal(new EsRepository(database).deleteSet(esSetId), 1);

    const walPath = `${filePath}-wal`;
    if (existsSync(walPath)) {
      assert.equal(statSync(walPath).size, 0, "-wal が切り詰められていません");
    }
    assert.ok(!readFileSync(filePath).includes(probe), "消したはずの本文がファイルに残っています");
  } finally {
    database.close();
  }
});
