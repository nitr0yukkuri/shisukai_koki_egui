import { migration0001Init } from "./0001-init.ts";
import { migration0002SeedQuestions } from "./0002-seed-questions.ts";
import { migration0003EsSnapshotNameOnly } from "./0003-es-snapshot-name-only.ts";

export type Migration = {
  version: number;
  name: string;
  sql: string;
};

/** 連番で並べる。既存データを壊す変更は、新しい版を足して行う(内部設計書 §8.5)。 */
export const migrations: readonly Migration[] = [
  migration0001Init,
  migration0002SeedQuestions,
  migration0003EsSnapshotNameOnly,
];
