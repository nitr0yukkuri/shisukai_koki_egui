import assert from "node:assert/strict";
import test from "node:test";

import { SpeechService } from "../src/main/speech/speech-service.ts";

test("認識終了のタイムアウト後は遅いコールバックを捨て、ストリームを閉じる", async () => {
  let callbacks;
  let aborted = false;
  const events = [];
  const recognizer = {
    name: "delayed",
    async start(nextCallbacks) {
      callbacks = nextCallbacks;
      return {
        write() {},
        finish: () => new Promise(() => {}),
        abort() {
          aborted = true;
        },
      };
    },
  };
  const service = new SpeechService({
    recognizer,
    finalWaitMs: 1,
    notifier: {
      partial: (event) => events.push(event),
      final: (event) => events.push(event),
      metrics: (event) => events.push(event),
      error: (event) => events.push(event),
    },
  });

  await service.beginTurn({ sessionId: 1, turnId: 2 });
  const result = await service.endTurn({ sessionId: 1, turnId: 2 });

  assert.equal(aborted, true);
  assert.equal(result.sttStatus, "failed");
  assert.equal(result.segments.length, 0);
  assert.equal(events.filter((event) => event.code === "E_STT").length, 1);

  callbacks.onFinal({ text: "遅れて届いた結果", words: [] });
  callbacks.onPartial("遅れた途中結果");
  assert.equal(result.segments.length, 0);
  assert.equal(events.filter((event) => event.text === "遅れて届いた結果").length, 0);
});
