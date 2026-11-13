/**
 * 質問バンクの初期データ(FR-11)。カテゴリと ES の項目を結び付け、質問の選び方で使う。
 *
 * es_kind は ES の項目(es_items.kind)と同じ値。`career` は外部設計書の「経歴/資格」を指し、
 * 将来のキャリアではない(内部設計書 §8.3・要件定義書の用語)。将来を聞く質問は
 * ESの項目に結び付かないので es_kind を null にして、ES非依存の質問として出す。
 */
import type { EsKind } from "../../../shared/types.ts";

const seedQuestions: readonly { text: string; category: string; esKind: EsKind | null }[] = [
  // U-01 の案が「自己紹介 → 志望動機 → ガクチカ → 自己PR → 逆質問」の順なので、導入を用意する。
  { text: "まずは簡単に自己紹介をお願いします。", category: "導入", esKind: null },

  { text: "学生時代に力を入れたことを教えてください。", category: "経験", esKind: "gakuchika" },
  { text: "その経験で、あなたが工夫したことは何ですか。", category: "経験", esKind: "gakuchika" },

  { text: "自己PRをお願いします。", category: "人物", esKind: "self_pr" },
  { text: "あなたの強みを教えてください。", category: "人物", esKind: "self_pr" },
  { text: "あなたの弱みと、その向き合い方を教えてください。", category: "人物", esKind: "self_pr" },

  { text: "志望動機を教えてください。", category: "志望", esKind: "motivation" },
  { text: "数ある会社の中で、なぜ当社なのですか。", category: "志望", esKind: "motivation" },

  // 経歴/資格(career)の質問。ESの経歴欄に書いた内容を聞くもの。
  {
    text: "これまでのご経験で、仕事に活かせるものを教えてください。",
    category: "経歴",
    esKind: "career",
  },
  {
    text: "お持ちの資格や、いま勉強していることがあれば教えてください。",
    category: "経歴",
    esKind: "career",
  },

  // 将来を聞く質問。ESの項目には結び付かない。
  { text: "入社後に挑戦したいことを教えてください。", category: "将来", esKind: null },
  { text: "5年後、どのように働いていたいですか。", category: "将来", esKind: null },

  { text: "最近気になったニュースを教えてください。", category: "その他", esKind: null },
  {
    text: "周囲と意見が合わなかったときの対応を教えてください。",
    category: "その他",
    esKind: null,
  },
  { text: "最後に、質問や伝えたいことはありますか。", category: "その他", esKind: null },
];

function escape(value: string): string {
  return value.replace(/'/g, "''");
}

export const migration0002SeedQuestions = {
  version: 2,
  name: "seed-questions",
  sql: seedQuestions
    .map(
      (question) =>
        `INSERT INTO questions (text, category, es_kind, is_active) VALUES ('${escape(question.text)}', '${escape(question.category)}', ${
          question.esKind === null ? "NULL" : `'${escape(question.esKind)}'`
        }, 1);`,
    )
    .join("\n"),
} as const;
