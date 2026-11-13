/**
 * 話し方の検出(内部設計書 §6)。
 *
 * 入力は音声認識が返した「単語と開始/終了時刻」と確定テキストだけ。音声そのものは扱わ
 * ないので、同じ入力からいつでも再計算できる。
 */
import {
  ALWAYS_FILLER_WORDS,
  CONTEXT_FILLER_PAUSE_MS,
  CONTEXT_FILLER_WORDS,
} from "../../shared/fillers.ts";
import type { FillerHit, SpeakingMetrics, SpeechWord, SpeedLabel } from "../../shared/types.ts";

/** これを超える間(無音)は、超えた分を発話時間から差し引く。 */
export const LONG_PAUSE_MS = 1500;
/** 話速ラベルの境界(文字/分)。実際の発話で試して調整する。 */
export const SLOW_WPM_MAX = 240;
export const NORMAL_WPM_MAX = 360;
/** これより短い回答は話速を出さない。 */
export const MIN_MEASURABLE_SPEAKING_MS = 3000;

const COUNTED_OUT_PATTERN = /[\s\u3000、。，．,.・…!?！？「」『』【】（）()：:；;"']/gu;

/** 文字数 = 回答テキストから空白・句読点を除いた数。 */
export function countSpeechCharacters(text: string): number {
  return [...text.replace(COUNTED_OUT_PATTERN, "")].length;
}

/**
 * 発話時間 = 最初の単語の開始から最後の単語の終了まで。
 * ただし LONG_PAUSE_MS を超える間は、超えた分だけ差し引く。
 */
export function calculateSpeakingMs(words: readonly SpeechWord[]): number {
  if (words.length === 0) {
    return 0;
  }
  const sorted = [...words].sort((a, b) => a.startMs - b.startMs);
  const first = sorted[0];
  const last = sorted.reduce((latest, word) => (word.endMs > latest.endMs ? word : latest), sorted[0]);
  const span = Math.max(0, last.endMs - first.startMs);

  let excess = 0;
  for (let index = 1; index < sorted.length; index += 1) {
    const gap = sorted[index].startMs - sorted[index - 1].endMs;
    if (gap > LONG_PAUSE_MS) {
      excess += gap - LONG_PAUSE_MS;
    }
  }

  return Math.max(0, span - excess);
}

export function toSpeedLabel(wpm: number | null): SpeedLabel {
  if (wpm === null) {
    return "unmeasurable";
  }
  if (wpm < SLOW_WPM_MAX) {
    return "slow";
  }
  if (wpm <= NORMAL_WPM_MAX) {
    return "normal";
  }
  return "fast";
}

function normalizeWord(text: string): string {
  return text.replace(COUNTED_OUT_PATTERN, "").trim();
}

/**
 * 言い淀みを数える。
 * 普通の語と重なるもの(あの・その・まあ)は、直前または直後に CONTEXT_FILLER_PAUSE_MS
 * 以上の間があるときだけ数える(「あの人」のような普通の用法を避けるため)。
 */
export function detectFillers(words: readonly SpeechWord[]): FillerHit[] {
  const hits: FillerHit[] = [];
  const sorted = [...words].sort((a, b) => a.startMs - b.startMs);

  sorted.forEach((word, index) => {
    const normalized = normalizeWord(word.text);
    if (normalized === "") {
      return;
    }

    if (ALWAYS_FILLER_WORDS.includes(normalized)) {
      hits.push({ word: normalized, atMs: word.startMs });
      return;
    }

    if (!CONTEXT_FILLER_WORDS.includes(normalized)) {
      return;
    }

    const previous = sorted[index - 1];
    const next = sorted[index + 1];
    const pauseBefore = previous ? word.startMs - previous.endMs : Number.POSITIVE_INFINITY;
    const pauseAfter = next ? next.startMs - word.endMs : Number.POSITIVE_INFINITY;

    if (pauseBefore >= CONTEXT_FILLER_PAUSE_MS || pauseAfter >= CONTEXT_FILLER_PAUSE_MS) {
      hits.push({ word: normalized, atMs: word.startMs });
    }
  });

  return hits;
}

export function calculateSpeakingMetrics(input: {
  text: string;
  words: readonly SpeechWord[];
}): SpeakingMetrics {
  const charCount = countSpeechCharacters(input.text);
  const speakingMs = calculateSpeakingMs(input.words);
  const measurable = speakingMs >= MIN_MEASURABLE_SPEAKING_MS && charCount > 0;
  const wpm = measurable ? Math.round((charCount / (speakingMs / 1000 / 60)) * 10) / 10 : null;
  const fillers = detectFillers(input.words);

  return {
    charCount,
    speakingMs,
    wpm,
    speedLabel: toSpeedLabel(wpm),
    fillerCount: fillers.length,
    fillers,
  };
}
