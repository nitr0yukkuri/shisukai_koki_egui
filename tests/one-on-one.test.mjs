/**
 * 1on1モードの処理側(EX-01・EX-02)。
 *
 * 1人モードとの違いは2つだけ。
 *   - 質問を出すのは相手(人)なので、質問バンクを使わない
 *   - 相手の発言も会話ログに残す(utterances.speaker = 'partner')
 * 表は1人モードと同じものを使う(内部設計書 §8.1「1on1モードの流用」)。
 */
import assert from "node:assert/strict";
import test from "node:test";

import { createBackend } from "../src/main/backend.ts";
import { createInvokeHandlers, handleAudioChunk } from "../src/main/ipc/handlers.ts";

function setup() {
  const backend = createBackend({ databasePath: ":memory:" });
  return { backend, handlers: createInvokeHandlers(backend) };
}

function unwrap(result) {
  assert.equal(result.ok, true, `失敗しました: ${JSON.stringify(result)}`);
  return result.data;
}

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

test("相手出題の1on1で始めると、質問は出ずにセッションだけができる", async () => {
  const { backend, handlers } = setup();
  try {
    const started = unwrap(await handlers["practice:start"]({ mode: "one_on_one", questionSource: "partner" }));
    // 質問を出すのは相手なので、アプリは最初の質問を持たない。
    assert.equal(started.prompt, null);

    const detail = unwrap(await handlers["history:get"]({ sessionId: started.sessionId }));
    assert.equal(detail.mode, "one_on_one");
    assert.equal(detail.turns.length, 0);
  } finally {
    backend.close();
  }
});

test("相手の質問でターンができ、相手の発言として会話ログに残る", async () => {
  const { backend, handlers } = setup();
  try {
    const started = unwrap(await handlers["practice:start"]({ mode: "one_on_one", questionSource: "partner" }));

    const asked = unwrap(
      await handlers["practice:partnerQuestion"]({
        sessionId: started.sessionId,
        questionText: "まずは自己紹介をお願いします。",
      }),
    );
    assert.equal(asked.seq, 1);
    assert.equal(asked.questionText, "まずは自己紹介をお願いします。");

    const detail = unwrap(await handlers["history:get"]({ sessionId: started.sessionId }));
    assert.equal(detail.turns.length, 1);
    const turn = detail.turns[0];
    assert.equal(turn.questionText, "まずは自己紹介をお願いします。");
    // 質問バンクから出していないので question_id は持たない。
    assert.equal(turn.questionId, null);
    assert.equal(turn.status, "asked");
    assert.equal(turn.utterances.length, 1);
    assert.equal(turn.utterances[0].speaker, "partner");
    assert.equal(turn.utterances[0].text, "まずは自己紹介をお願いします。");
  } finally {
    backend.close();
  }
});

test("回答を保存しても、先に入れた相手の発言は消えない", async () => {
  const { backend, handlers } = setup();
  try {
    const started = unwrap(await handlers["practice:start"]({ mode: "one_on_one", questionSource: "partner" }));
    const asked = unwrap(
      await handlers["practice:partnerQuestion"]({
        sessionId: started.sessionId,
        questionText: "学生時代に力を入れたことを教えてください。",
      }),
    );

    const answer = unwrap(await handlers["practice:beginAnswer"]({ sessionId: started.sessionId }));
    assert.equal(answer.turnId, asked.turnId);
    sendChunks(backend, started.sessionId, answer.turnId, 12);
    const turn = unwrap(
      await handlers["practice:endAnswer"]({
        sessionId: started.sessionId,
        turnId: answer.turnId,
      }),
    );

    assert.equal(turn.status, "answered");
    assert.equal(turn.sttStatus, "ok");

    // 相手の発言1件 + 利用者の発話3件。相手の発言が先頭に残っている。
    assert.equal(turn.utterances.length, 4);
    assert.equal(turn.utterances[0].speaker, "partner");
    assert.deepEqual(
      turn.utterances.slice(1).map((utterance) => utterance.speaker),
      ["user", "user", "user"],
    );
    // 順番は重ならずに続いている。
    assert.deepEqual(
      turn.utterances.map((utterance) => utterance.seq),
      [1, 2, 3, 4],
    );
    // 話速・言い淀みは利用者の発話だけから出す。
    assert.ok(turn.wpm !== null);
    assert.ok(turn.fillerCount > 0);
  } finally {
    backend.close();
  }
});

test("相手の相づちや深掘りも、同じターンに積める", async () => {
  const { backend, handlers } = setup();
  try {
    const started = unwrap(await handlers["practice:start"]({ mode: "one_on_one", questionSource: "partner" }));
    const asked = unwrap(
      await handlers["practice:partnerQuestion"]({
        sessionId: started.sessionId,
        questionText: "志望動機を教えてください。",
      }),
    );

    const recorded = unwrap(
      await handlers["practice:partnerSpeech"]({
        sessionId: started.sessionId,
        turnId: asked.turnId,
        text: "なるほど、もう少し詳しく聞かせてください。",
        startMs: 12000,
        endMs: 14500,
      }),
    );
    assert.equal(recorded.seq, 2);

    const detail = unwrap(await handlers["history:get"]({ sessionId: started.sessionId }));
    const utterances = detail.turns[0].utterances;
    assert.equal(utterances.length, 2);
    assert.equal(utterances[1].speaker, "partner");
    assert.equal(utterances[1].startMs, 12000);
    assert.equal(utterances[1].endMs, 14500);
  } finally {
    backend.close();
  }
});

test("質問を繰り返して、最後に終えると finished になる", async () => {
  const { backend, handlers } = setup();
  try {
    const started = unwrap(await handlers["practice:start"]({ mode: "one_on_one", questionSource: "partner" }));

    for (const [index, text] of ["1問目です。", "2問目です。", "3問目です。"].entries()) {
      const asked = unwrap(
        await handlers["practice:partnerQuestion"]({ sessionId: started.sessionId, questionText: text }),
      );
      assert.equal(asked.seq, index + 1);
      const answer = unwrap(await handlers["practice:beginAnswer"]({ sessionId: started.sessionId }));
      sendChunks(backend, started.sessionId, answer.turnId, 12);
      unwrap(
        await handlers["practice:endAnswer"]({
          sessionId: started.sessionId,
          turnId: answer.turnId,
        }),
      );
    }

    unwrap(await handlers["practice:finish"]({ sessionId: started.sessionId, keep: true }));

    const history = unwrap(await handlers["history:list"]());
    assert.equal(history.length, 1);
    // 質問数が決まっていないので、利用者が終えた時点で finished とする。
    assert.equal(history[0].status, "finished");
    assert.equal(history[0].turnCount, 3);
    assert.equal(history[0].answeredCount, 3);
  } finally {
    backend.close();
  }
});

test("モードの取り違えはエラーにする", async () => {
  const { backend, handlers } = setup();
  try {
    // 1on1では practice:next を使わない。
    const oneOnOne = unwrap(await handlers["practice:start"]({ mode: "one_on_one", questionSource: "partner" }));
    const next = await handlers["practice:next"]({ sessionId: oneOnOne.sessionId });
    assert.equal(next.ok, false);
    assert.equal(next.error.code, "E_STATE");

    // 質問が来る前は回答できない。
    const tooEarly = await handlers["practice:beginAnswer"]({ sessionId: oneOnOne.sessionId });
    assert.equal(tooEarly.ok, false);
    assert.equal(tooEarly.error.code, "E_STATE");

    unwrap(await handlers["practice:finish"]({ sessionId: oneOnOne.sessionId, keep: false }));

    // 1人モードでは相手の質問を受け付けない。
    const solo = unwrap(await handlers["practice:start"]({ mode: "solo", questionCount: 3 }));
    const asked = await handlers["practice:partnerQuestion"]({
      sessionId: solo.sessionId,
      questionText: "これは1人モードなので入らない。",
    });
    assert.equal(asked.ok, false);
    assert.equal(asked.error.code, "E_STATE");
  } finally {
    backend.close();
  }
});

test("相手の質問は空にできず、長すぎても断る", async () => {
  const { backend, handlers } = setup();
  try {
    const started = unwrap(await handlers["practice:start"]({ mode: "one_on_one", questionSource: "partner" }));

    for (const questionText of ["", "   ", "あ".repeat(2001)]) {
      const result = await handlers["practice:partnerQuestion"]({
        sessionId: started.sessionId,
        questionText,
      });
      assert.equal(result.ok, false, `弾くべき入力が通りました: ${questionText.slice(0, 10)}`);
      assert.equal(result.error.code, "E_VALIDATION");
    }
  } finally {
    backend.close();
  }
});
