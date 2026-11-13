/**
 * 質問バンクから質問を選ぶ(FR-11・12)。
 * 選び方(U-01 未決)は差し替え可能な関数にして、サービスの外から渡せるようにする。
 */
import { AppError } from "../app-error.ts";
import type { QuestionRepository } from "../repositories/question-repository.ts";
import type { EsKind, QuestionSummary } from "../../shared/types.ts";

export type QuestionSelectionContext = {
  /** 本文が入っているESの項目。質問をESに寄せるために使う。 */
  filledEsKinds: readonly EsKind[];
  count: number;
  random: () => number;
};

export type QuestionSelector = (
  questions: readonly QuestionSummary[],
  context: QuestionSelectionContext,
) => QuestionSummary[];

/**
 * 既定の選び方。
 * 1. ESに本文がある項目に関係する質問を優先する。
 * 2. 同じカテゴリが続かないように、カテゴリごとに1問ずつ取る。
 * 3. 足りなければ残りから補う。
 */
export const defaultQuestionSelector: QuestionSelector = (questions, context) => {
  const shuffled = shuffle(questions, context.random);
  const related = shuffled.filter(
    (question) => question.esKind !== null && context.filledEsKinds.includes(question.esKind),
  );
  const others = shuffled.filter((question) => !related.includes(question));
  const ordered = [...spreadByCategory(related, context.random), ...spreadByCategory(others, context.random)];

  return ordered.slice(0, context.count);
};

export class QuestionService {
  private readonly repository: QuestionRepository;
  private readonly selector: QuestionSelector;
  private readonly random: () => number;

  constructor(
    repository: QuestionRepository,
    selector: QuestionSelector = defaultQuestionSelector,
    random: () => number = Math.random,
  ) {
    this.repository = repository;
    this.selector = selector;
    this.random = random;
  }

  /** 1回の練習で出す質問を、重複なしで count 件選ぶ。 */
  pick(count: number, filledEsKinds: readonly EsKind[] = []): QuestionSummary[] {
    const questions = this.repository.listActive();
    if (questions.length === 0) {
      throw new AppError("E_NOT_FOUND", "質問バンクに質問がありません。");
    }

    const picked = this.selector(questions, { filledEsKinds, count, random: this.random });
    const unique = dedupeById(picked).slice(0, count);

    if (unique.length < Math.min(count, questions.length)) {
      const remaining = questions.filter(
        (question) => !unique.some((chosen) => chosen.id === question.id),
      );
      unique.push(...remaining.slice(0, count - unique.length));
    }

    return unique;
  }
}

function dedupeById(questions: readonly QuestionSummary[]): QuestionSummary[] {
  const seen = new Set<number>();
  const result: QuestionSummary[] = [];
  for (const question of questions) {
    if (!seen.has(question.id)) {
      seen.add(question.id);
      result.push(question);
    }
  }
  return result;
}

function shuffle(questions: readonly QuestionSummary[], random: () => number): QuestionSummary[] {
  const items = [...questions];
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(random() * (index + 1));
    [items[index], items[swapWith]] = [items[swapWith], items[index]];
  }
  return items;
}

/** カテゴリごとに1問ずつ取り出して並べ替える。 */
function spreadByCategory(
  questions: readonly QuestionSummary[],
  random: () => number,
): QuestionSummary[] {
  const byCategory = new Map<string, QuestionSummary[]>();
  for (const question of questions) {
    const bucket = byCategory.get(question.category);
    if (bucket) {
      bucket.push(question);
    } else {
      byCategory.set(question.category, [question]);
    }
  }

  const categories = shuffleStrings([...byCategory.keys()], random);
  const result: QuestionSummary[] = [];
  let remaining = questions.length;
  while (remaining > 0) {
    for (const category of categories) {
      const bucket = byCategory.get(category);
      const next = bucket?.shift();
      if (next) {
        result.push(next);
        remaining -= 1;
      }
    }
  }
  return result;
}

function shuffleStrings(values: string[], random: () => number): string[] {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(random() * (index + 1));
    [values[index], values[swapWith]] = [values[swapWith], values[index]];
  }
  return values;
}
