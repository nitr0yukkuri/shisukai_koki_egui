/**
 * 内部設計書 §8.3 のテーブル定義。SQLを.sqlファイルにせず、ビルド後も確実に読めるTSに置く。
 *
 * 表はすべて STRICT で作る(内部設計書 §8.1・テーブル定義書)。SQLiteは既定では
 * 型違いの値も通してしまうが、STRICTなら 'abc' や 1.5 を INTEGER 列へ入れた時点で弾ける。
 * そのぶん、小数のミリ秒を INTEGER 列へ入れるとエラーになるため、音声認識から受け取った
 * 時刻は SpeechService で Math.round して整数にしてから渡す。
 */
export const migration0001Init = {
  version: 1,
  name: "init",
  sql: `
CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
) STRICT;

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE es_sets (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE es_items (
  id INTEGER PRIMARY KEY,
  es_set_id INTEGER NOT NULL REFERENCES es_sets (id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('self_pr', 'gakuchika', 'motivation', 'career')),
  body TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  UNIQUE (es_set_id, kind)
) STRICT;

CREATE TABLE interviewer_images (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  is_builtin INTEGER NOT NULL DEFAULT 0 CHECK (is_builtin IN (0, 1))
) STRICT;

CREATE TABLE questions (
  id INTEGER PRIMARY KEY,
  text TEXT NOT NULL,
  category TEXT NOT NULL,
  es_kind TEXT CHECK (
    es_kind IS NULL
    OR es_kind IN ('self_pr', 'gakuchika', 'motivation', 'career')
  ),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
) STRICT;

CREATE TABLE sessions (
  id INTEGER PRIMARY KEY,
  mode TEXT NOT NULL CHECK (mode IN ('solo', 'one_on_one')),
  es_set_id INTEGER REFERENCES es_sets (id) ON DELETE SET NULL,
  es_snapshot_json TEXT NOT NULL,
  interviewer_image_id INTEGER REFERENCES interviewer_images (id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('in_progress', 'finished', 'interrupted')),
  started_at TEXT NOT NULL,
  ended_at TEXT
) STRICT;

CREATE TABLE turns (
  id INTEGER PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  seq INTEGER NOT NULL CHECK (seq >= 1),
  question_id INTEGER REFERENCES questions (id) ON DELETE SET NULL,
  question_text TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('asked', 'answering', 'answered', 'skipped')),
  answer_text TEXT NOT NULL DEFAULT '',
  speaking_ms INTEGER,
  char_count INTEGER,
  wpm REAL,
  filler_count INTEGER NOT NULL DEFAULT 0 CHECK (filler_count >= 0),
  stt_status TEXT NOT NULL DEFAULT 'none' CHECK (stt_status IN ('ok', 'failed', 'none')),
  started_at TEXT,
  ended_at TEXT,
  UNIQUE (session_id, seq)
) STRICT;

CREATE TABLE utterances (
  id INTEGER PRIMARY KEY,
  turn_id INTEGER NOT NULL REFERENCES turns (id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  speaker TEXT NOT NULL CHECK (speaker IN ('user', 'partner')),
  text TEXT NOT NULL,
  start_ms INTEGER,
  end_ms INTEGER,
  words_json TEXT
) STRICT;

CREATE TABLE filler_events (
  id INTEGER PRIMARY KEY,
  turn_id INTEGER NOT NULL REFERENCES turns (id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  at_ms INTEGER
) STRICT;

CREATE TABLE assist_events (
  id INTEGER PRIMARY KEY,
  turn_id INTEGER NOT NULL REFERENCES turns (id) ON DELETE CASCADE,
  requested_at TEXT NOT NULL,
  suggestions_json TEXT NOT NULL,
  picked_index INTEGER
) STRICT;

CREATE TABLE evaluations (
  id INTEGER PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  total_score INTEGER NOT NULL CHECK (total_score BETWEEN 0 AND 100),
  model TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE evaluation_scores (
  evaluation_id INTEGER NOT NULL REFERENCES evaluations (id) ON DELETE CASCADE,
  axis_key TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 20),
  comment TEXT NOT NULL,
  PRIMARY KEY (evaluation_id, axis_key)
) STRICT;

CREATE TABLE evaluation_comments (
  id INTEGER PRIMARY KEY,
  evaluation_id INTEGER NOT NULL REFERENCES evaluations (id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('good', 'improve')),
  body TEXT NOT NULL
) STRICT;

-- 一覧・ログ表示のための索引。
CREATE INDEX idx_sessions_started_at ON sessions (started_at DESC);
CREATE INDEX idx_utterances_turn_seq ON utterances (turn_id, seq);
CREATE INDEX idx_filler_events_turn ON filler_events (turn_id);
CREATE INDEX idx_assist_events_turn ON assist_events (turn_id);
CREATE INDEX idx_evaluations_session ON evaluations (session_id);
CREATE INDEX idx_evaluation_comments_eval_seq ON evaluation_comments (evaluation_id, seq);

-- SQLiteは外部キーの子の列に索引を自動で作らない。親を消すたびに子の表を全部調べるため、
-- ON DELETE SET NULL の子の列にも付ける(内部設計書 §8.4)。
-- turns(session_id) と es_items(es_set_id) は複合UNIQUEの先頭列なのでそれで足りる。
CREATE INDEX idx_sessions_es_set ON sessions (es_set_id);
CREATE INDEX idx_sessions_interviewer_image ON sessions (interviewer_image_id);
CREATE INDEX idx_turns_question ON turns (question_id);
`,
} as const;
