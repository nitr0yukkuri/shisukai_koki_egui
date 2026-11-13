import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateSpeakingMetrics,
  calculateSpeakingMs,
  countSpeechCharacters,
  detectFillers,
  toSpeedLabel,
} from "../src/main/speech/speaking-metrics.ts";

/** 決め打ちの文字起こしと時刻(内部設計書 §10.3 のfixture)。 */
const words = [
  { text: "えー", startMs: 0, endMs: 400 },
  { text: "今日は", startMs: 700, endMs: 1300 },
  { text: "あの", startMs: 1300, endMs: 1600 },
  { text: "話します", startMs: 4000, endMs: 4800 },
];
const text = "えー、今日はあの、話します。";

test("文字数は空白と句読点を除いて数える", () => {
  assert.equal(countSpeechCharacters(text), 11);
  assert.equal(countSpeechCharacters("あ、 い。う"), 3);
});

test("発話時間は1.5秒を超える間の分だけ差し引く", () => {
  // 全体 4800ms、2400msの間のうち超過分900msを引く。
  assert.equal(calculateSpeakingMs(words), 3900);
  assert.equal(calculateSpeakingMs([]), 0);
});

test("話速は文字数と発話時間から出し、閾値でラベルを決める", () => {
  const metrics = calculateSpeakingMetrics({ text, words });
  assert.equal(metrics.charCount, 11);
  assert.equal(metrics.speakingMs, 3900);
  assert.equal(metrics.wpm, 169.2);
  assert.equal(metrics.speedLabel, "slow");

  assert.equal(toSpeedLabel(239.9), "slow");
  assert.equal(toSpeedLabel(240), "normal");
  assert.equal(toSpeedLabel(360), "normal");
  assert.equal(toSpeedLabel(360.1), "fast");
  assert.equal(toSpeedLabel(null), "unmeasurable");
});

test("3秒未満の回答は話速を出さない", () => {
  const metrics = calculateSpeakingMetrics({
    text: "はい",
    words: [{ text: "はい", startMs: 0, endMs: 900 }],
  });
  assert.equal(metrics.wpm, null);
  assert.equal(metrics.speedLabel, "unmeasurable");
});

test("言い淀みは、専用の語と、間のある普通の語だけを数える", () => {
  const hits = detectFillers(words);
  assert.deepEqual(
    hits.map((hit) => hit.word),
    ["えー", "あの"],
  );
  assert.equal(hits[1].atMs, 1300);

  // 「あの人」のような普通の用法は、前後に間がないので数えない。
  const normalUsage = detectFillers([
    { text: "私の", startMs: 0, endMs: 500 },
    { text: "あの", startMs: 500, endMs: 800 },
    { text: "人は", startMs: 800, endMs: 1400 },
  ]);
  assert.deepEqual(normalUsage, []);
});
