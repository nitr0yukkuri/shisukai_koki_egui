/** ESセットの作成・更新・複製・削除(FR-01〜04)。 */
import { AppError } from "../app-error.ts";
import type { AppDatabase } from "../db/database.ts";
import type { EsRepository } from "../repositories/es-repository.ts";
import {
  ES_KINDS,
  ES_NAME_MAX_LENGTH,
  type EsSet,
  type EsSetInput,
  type EsSetSummary,
} from "../../shared/types.ts";

export class EsService {
  private readonly database: AppDatabase;
  private readonly repository: EsRepository;
  private readonly now: () => string;

  constructor(
    database: AppDatabase,
    repository: EsRepository,
    now: () => string = () => new Date().toISOString(),
  ) {
    this.database = database;
    this.repository = repository;
    this.now = now;
  }

  list(): EsSetSummary[] {
    return this.repository.listSummaries();
  }

  get(esSetId: number): EsSet {
    const esSet = this.repository.find(esSetId);
    if (!esSet) {
      throw new AppError("E_NOT_FOUND", "ESが見つかりません。");
    }
    return esSet;
  }

  /**
   * 本文の長さは確かめない。
   * 上限を超えても保存でき、画面が赤字で警告する(FR-04・外部設計書 §5.2・MSG-02)。
   * 絶対上限(ES_BODY_HARD_LIMIT)だけは esSetInputSchema が入口で弾く(MSG-18)。
   */
  save(input: EsSetInput): EsSet {
    const name = input.name.trim();
    if (name === "" || name.length > ES_NAME_MAX_LENGTH) {
      throw new AppError("E_VALIDATION", `ESの名前は1〜${ES_NAME_MAX_LENGTH}文字で入力してください。`);
    }

    const now = this.now();
    const esSetId = this.database.transaction(() => {
      let id = input.id;
      if (id === undefined) {
        id = this.repository.insertSet(name, now);
      } else {
        if (this.repository.updateSet(id, name, now) === 0) {
          throw new AppError("E_NOT_FOUND", "ESが見つかりません。");
        }
      }
      for (const item of input.items) {
        this.repository.upsertItem(id, item.kind, item.body, now);
      }
      return id;
    });

    return this.get(esSetId);
  }

  duplicate(esSetId: number): EsSetSummary {
    const source = this.get(esSetId);
    const now = this.now();
    const copyName = `${source.name}のコピー`.slice(0, ES_NAME_MAX_LENGTH);

    const newId = this.database.transaction(() => {
      const id = this.repository.insertSet(copyName, now);
      for (const kind of ES_KINDS) {
        const item = source.items.find((candidate) => candidate.kind === kind);
        this.repository.upsertItem(id, kind, item?.body ?? "", now);
      }
      return id;
    });

    return { id: newId, name: copyName, updatedAt: now };
  }

  delete(esSetId: number): void {
    if (this.repository.deleteSet(esSetId) === 0) {
      throw new AppError("E_NOT_FOUND", "ESが見つかりません。");
    }
  }
}
