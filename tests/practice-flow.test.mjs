import assert from "node:assert/strict";
import test from "node:test";

import { createBackend } from "../src/main/backend.ts";
import { createInvokeHandlers, handleAudioChunk } from "../src/main/ipc/handlers.ts";

function setup() {
  const events = { partial: [], final: [], metrics: [], error: [] };
  const backend = createBackend({
    databasePath: ":memory:",
    notifier: {
      partial: (event) => events.partial.push(event),
      final: (event) => events.final.push(event),
      metrics: (event) => events.metrics.push(event),
      error: (event) => events.error.push(event),
    },
  });
  return { backend, handlers: createInvokeHandlers(backend), events };
}

function unwrap(result) {
  assert.equal(result.ok, true, `失敗しました: ${JSON.stringify(result)}`);
  return result.data;
}

/** 回答中の録音データを送る。Fakeの音声認識は受け取った数で結果を確定させる。 */
function sendChunks(backend, sessionId, turnId, count) {
  for (let index = 0; index < count; index += 1) {
    handleAudioChunk(backend, {
      sessionId,
      turnId,
      data: new Uint8Array([1, 2, 3, 4]),
      offsetMs: index * 250,
    });
  }
}

test("1回の練習の流れがSQLiteに保存される", async () => {
  const { backend, handlers, events } = setup();
  try {
    const saved = unwrap(
      await handlers["es:save"]({
        name: "本命企業",
        items: [
          { kind: "self_pr", body: "最後までやり切る力があります。" },
          { kind: "gakuchika", body: "長期インターンでユーザー調査をしました。" },
        ],
      }),
    );
    assert.equal(saved.name, "本命企業");
    assert.equal(saved.items.length, 4);
    assert.equal(unwrap(await handlers["es:list"]()).length, 1);

    const started = unwrap(
      await handlers["practice:start"]({ esSetId: saved.id, questionCount: 3 }),
    );
    assert.equal(started.prompt.seq, 1);
    assert.equal(started.prompt.totalQuestions, 3);
    assert.ok(started.prompt.question.text.length > 0);

    const answerStart = unwrap(await handlers["practice:beginAnswer"]({ sessionId: started.sessionId }));
    assert.equal(answerStart.turnId, started.prompt.turnId);
    assert.equal(answerStart.recognizer, "fake");

    sendChunks(backend, started.sessionId, answerStart.turnId, 12);

    const turn = unwrap(
      await handlers["practice:endAnswer"]({
        sessionId: started.sessionId,
        turnId: answerStart.turnId,
      }),
    );

    assert.equal(turn.status, "answered");
    assert.equal(turn.sttStatus, "ok");
    assert.ok(turn.answerText.includes("大学時代は"));
    assert.equal(turn.utterances.length, 3);
    assert.ok(turn.utterances[0].words.length > 0);
    assert.equal(turn.fillerCount, 2);
    assert.deepEqual(
      turn.fillers.map((filler) => filler.word),
      ["えー", "あの"],
    );
    assert.ok(turn.charCount > 0);
    assert.ok(turn.speakingMs > 0);
    assert.ok(turn.wpm !== null);
    assert.ok(["slow", "normal", "fast"].includes(turn.speedLabel));
    assert.ok(turn.endedAt !== null);

    // 途中結果と指標が画面へ通知されている(内部設計書 §4.2)。
    assert.ok(events.partial.length > 0);
    assert.equal(events.final.length, 3);
    assert.ok(events.metrics.length >= 3);
    assert.equal(events.error.length, 0);

    const next = unwrap(await handlers["practice:next"]({ sessionId: started.sessionId }));
    assert.equal(next.done, false);
    assert.equal(next.prompt.seq, 2);
    assert.notEqual(next.prompt.question.id, started.prompt.question.id);

    // 何も話さずに終えた回答は、認識結果なしとして残す。
    const secondStart = unwrap(
      await handlers["practice:beginAnswer"]({ sessionId: started.sessionId }),
    );
    const secondTurn = unwrap(
      await handlers["practice:endAnswer"]({
        sessionId: started.sessionId,
        turnId: secondStart.turnId,
      }),
    );
    assert.equal(secondTurn.sttStatus, "none");
    assert.equal(secondTurn.answerText, "");
    // 無音は「スキップ」ではなく、認識結果なしの回答として残す(内部設計書 §5)。
    assert.equal(secondTurn.status, "answered");

    // 3問目は答えないまま終える。turns は作られるが status は asked のまま。
    const third = unwrap(await handlers["practice:next"]({ sessionId: started.sessionId }));
    assert.equal(third.done, false);
    assert.equal(third.prompt.seq, 3);

    assert.deepEqual(unwrap(await handlers["practice:next"]({ sessionId: started.sessionId })), {
      done: true,
    });

    const history = unwrap(await handlers["history:list"]());
    assert.equal(history.length, 1);
    assert.equal(history[0].status, "finished");
    // ESセット名は開始時の写しから取る(SC-06)。
    assert.equal(history[0].esSetName, "本命企業");
    assert.equal(history[0].turnCount, 3);
    assert.equal(history[0].answeredCount, 2);
    assert.equal(history[0].totalScore, null);

    const detail = unwrap(await handlers["history:get"]({ sessionId: started.sessionId }));
    assert.equal(detail.turns.length, 3);
    assert.equal(detail.esSnapshot.name, "本命企業");
    assert.equal(detail.turns[0].utterances.length, 3);
    assert.equal(detail.turns[2].status, "asked");

    unwrap(await handlers["history:delete"]({ sessionId: started.sessionId }));
    const afterDelete = await handlers["history:get"]({ sessionId: started.sessionId });
    assert.equal(afterDelete.ok, false);
    assert.equal(afterDelete.error.code, "E_NOT_FOUND");
  } finally {
    backend.close();
  }
});

test("入力が規定外ならE_VALIDATIONを返し、DBには触らない", async () => {
  const { backend, handlers } = setup();
  try {
    const noSessionId = await handlers["history:get"]({});
    assert.equal(noSessionId.ok, false);
    assert.equal(noSessionId.error.code, "E_VALIDATION");

    // 絶対上限(ES_BODY_HARD_LIMIT)を超える本文だけは断る(外部設計書 §5.2・MSG-18)。
    const hugeBody = await handlers["es:save"]({
      name: "テスト",
      items: [{ kind: "self_pr", body: "あ".repeat(20001) }],
    });
    assert.equal(hugeBody.ok, false);
    assert.equal(hugeBody.error.code, "E_VALIDATION");

    const badKind = await handlers["es:save"]({ name: "テスト", items: [{ kind: "unknown", body: "" }] });
    assert.equal(badKind.ok, false);
    assert.equal(badKind.error.code, "E_VALIDATION");

    const longName = await handlers["es:save"]({ name: "あ".repeat(31), items: [] });
    assert.equal(longName.ok, false);
    assert.equal(longName.error.code, "E_VALIDATION");

    // 質問数は 3〜5 だけ受け付ける(外部設計書 §5.3)。
    for (const questionCount of [2, 6]) {
      const outOfRange = await handlers["practice:start"]({ questionCount });
      assert.equal(outOfRange.ok, false, `questionCount=${questionCount} は弾くべき`);
      assert.equal(outOfRange.error.code, "E_VALIDATION");
    }

    assert.equal(unwrap(await handlers["es:list"]()).length, 0);
  } finally {
    backend.close();
  }
});

test("表示上の文字数を超えた本文は、警告の対象であって保存はできる", async () => {
  const { backend, handlers } = setup();
  try {
    // FR-04・MSG-02: 超えたときは画面が赤字で警告するが、保存自体は通す。
    const saved = unwrap(
      await handlers["es:save"]({
        name: "長文のES",
        items: [
          { kind: "self_pr", body: "あ".repeat(2001) },
          { kind: "career", body: "い".repeat(1001) },
        ],
      }),
    );
    const selfPr = saved.items.find((item) => item.kind === "self_pr");
    const career = saved.items.find((item) => item.kind === "career");
    assert.equal(selfPr.body.length, 2001);
    assert.equal(career.body.length, 1001);
  } finally {
    backend.close();
  }
});

test("練習は同時に1つだけ始められる", async () => {
  const { backend, handlers } = setup();
  try {
    const started = unwrap(await handlers["practice:start"]({ questionCount: 3 }));
    const second = await handlers["practice:start"]({ questionCount: 3 });
    assert.equal(second.ok, false);
    assert.equal(second.error.code, "E_STATE");

    // 記録を残さず終了すると、練習ごと消える(内部設計書 §5)。
    unwrap(await handlers["practice:finish"]({ sessionId: started.sessionId, keep: false }));
    assert.equal(unwrap(await handlers["history:list"]()).length, 0);
    unwrap(await handlers["practice:start"]({ questionCount: 3 }));
  } finally {
    backend.close();
  }
});

test("中断した練習は起動時にinterruptedへ直り、ログは残る", async () => {
  const { backend, handlers } = setup();
  try {
    const started = unwrap(await handlers["practice:start"]({ questionCount: 3 }));
    const answer = unwrap(await handlers["practice:beginAnswer"]({ sessionId: started.sessionId }));
    sendChunks(backend, started.sessionId, answer.turnId, 8);
    unwrap(
      await handlers["practice:endAnswer"]({
        sessionId: started.sessionId,
        turnId: answer.turnId,
      }),
    );

    // 異常終了を再現する。
    backend.practice.recoverInterruptedSessions();

    const history = unwrap(await handlers["history:list"]());
    assert.equal(history[0].status, "interrupted");
    assert.equal(history[0].answeredCount, 1);

    const detail = unwrap(await handlers["history:get"]({ sessionId: started.sessionId }));
    assert.ok(detail.turns[0].answerText.length > 0);
  } finally {
    backend.close();
  }
});

test("同意の状態はsettingsに残る", async () => {
  const { backend, handlers } = setup();
  try {
    assert.deepEqual(unwrap(await handlers["consent:get"]()), {
      externalAi: false,
      updatedAt: null,
    });

    const updated = unwrap(await handlers["consent:set"]({ externalAi: true }));
    assert.equal(updated.externalAi, true);
    assert.equal(unwrap(await handlers["consent:get"]()).externalAi, true);

    unwrap(await handlers["settings:set"]({ key: "microphone.deviceId", value: "default" }));
    assert.equal(unwrap(await handlers["settings:get"]({ key: "microphone.deviceId" })), "default");
  } finally {
    backend.close();
  }
});
