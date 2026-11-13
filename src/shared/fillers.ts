/**
 * 言い淀みの語リスト(内部設計書 §6)。
 * コード変更だけで追加・削除できるよう、ここだけに置く。
 */

/** 単語が一致すれば必ず数えるもの(伸ばして発音するもの・言い淀み専用の語)。 */
export const ALWAYS_FILLER_WORDS: readonly string[] = [
  "えー",
  "えーっ",
  "ええー",
  "あー",
  "ああー",
  "うーん",
  "んー",
  "んーと",
  "えっと",
  "えーと",
  "ええと",
  "あのー",
  "そのー",
  "まあー",
];

/**
 * 普通の語と重なるもの。
 * 単語単体で、直前または直後に CONTEXT_FILLER_PAUSE_MS 以上の間があるときだけ数える。
 */
export const CONTEXT_FILLER_WORDS: readonly string[] = ["あの", "その", "まあ", "ええ", "うん"];

/** 文脈つきの語を言い淀みとして数えるために必要な間(ms)。 */
export const CONTEXT_FILLER_PAUSE_MS = 300;
