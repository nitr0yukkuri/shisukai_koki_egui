import { useCallback, useEffect, useRef, useState } from "react";
import { questions } from "../app/data";
import type { Mode } from "../app/types";
import type { MetricsUpdateEvent, PracticePrompt, SttFinalEvent, SttPartialEvent, SttErrorEvent } from "../shared/types";
import { Image } from "../components/Image";
import { useAudioCapture } from "../audio/useAudioCapture";
import { HostRtcPanel } from "../rtc/HostRtcPanel";
import "../rtc/join.css";

export function PracticePage({ mode, question, setQuestion, setAnswer, finish, hint, notify }: {
  mode: Mode; question: number; setQuestion: (index: number) => void;
  setAnswer: (value: string) => void; finish: () => void; hint: () => void; notify: (message: string) => void;
}) {
  const isSolo = mode === "solo";
  const media = useAudioCapture();
  const [sessionId, setSessionId] = useState<number | null>(null);
  const notifyRef = useRef(notify);
  const sessionIdRef = useRef<number | null>(null);
  const sessionFinishedRef = useRef(false);
  const [prompt, setPrompt] = useState<PracticePrompt | null>(null);
  const turnIdRef = useRef<number | null>(null);
  const activeTurnRef = useRef<{ sessionId: number; turnId: number } | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [partial, setPartial] = useState("");
  const [metrics, setMetrics] = useState<MetricsUpdateEvent["metrics"] | null>(null);
  const [speechError, setSpeechError] = useState("");
  const [acknowledgement, setAcknowledgement] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [startingAnswer, setStartingAnswer] = useState(false);
  const startingAnswerRef = useRef(false);
  const stopAnswerPromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => { notifyRef.current = notify; }, [notify]);

  useEffect(() => {
    let cancelled = false;
    const startTimer = window.setTimeout(() => {
      void window.jobuhan.practice.start({ mode: isSolo ? "solo" : "one_on_one", questionCount: 5 }).then((result) => {
        if (!result.ok) throw new Error(result.error.message);
        if (cancelled) {
          void window.jobuhan.practice.finish(result.data.sessionId, true);
          return;
        }
        sessionIdRef.current = result.data.sessionId;
        setSessionId(result.data.sessionId);
        setPrompt(result.data.prompt);
        turnIdRef.current = result.data.prompt.turnId;
      }).catch((error: unknown) => {
        if (!cancelled) notifyRef.current(error instanceof Error ? error.message : "練習を開始できませんでした。");
      }).finally(() => { if (!cancelled) setLoadingSession(false); });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(startTimer);
      void media.stopRecording().then(async () => {
        const activeSessionId = sessionIdRef.current;
        if (activeSessionId && !sessionFinishedRef.current) {
          const activeTurn = activeTurnRef.current;
          if (activeTurn?.sessionId === activeSessionId) await window.jobuhan.practice.endAnswer(activeTurn.sessionId, activeTurn.turnId);
          await window.jobuhan.practice.finish(activeSessionId, true);
          sessionFinishedRef.current = true;
        }
        media.releaseMedia();
      });
    };
  }, [isSolo, media.releaseMedia, media.stopRecording]);

  useEffect(() => {
    const unsubscribe = [
      window.jobuhan.speech.onPartial((event: SttPartialEvent) => {
        if (event.sessionId === activeTurnRef.current?.sessionId && event.turnId === activeTurnRef.current.turnId) setPartial(event.text);
      }),
      window.jobuhan.speech.onFinal((event: SttFinalEvent) => {
        if (event.sessionId !== activeTurnRef.current?.sessionId || event.turnId !== activeTurnRef.current.turnId) return;
        setTranscript((current) => current + event.text);
        setPartial("");
      }),
      window.jobuhan.speech.onMetrics((event: MetricsUpdateEvent) => {
        if (event.sessionId === activeTurnRef.current?.sessionId && event.turnId === activeTurnRef.current.turnId) setMetrics(event.metrics);
      }),
      window.jobuhan.speech.onError((event: SttErrorEvent) => {
        if (event.sessionId === activeTurnRef.current?.sessionId && event.turnId === activeTurnRef.current.turnId) setSpeechError(event.message);
      }),
    ];
    return () => unsubscribe.forEach((stop) => stop());
  }, []);

  useEffect(() => {
    if (!recording) return;
    const startedAt = Date.now() - elapsed * 1000;
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  const startAnswer = useCallback(async (providedStream?: MediaStream) => {
    if (startingAnswerRef.current) return;
    startingAnswerRef.current = true;
    setStartingAnswer(true);
    const currentSessionId = sessionIdRef.current;
    if (!currentSessionId) {
      startingAnswerRef.current = false;
      setStartingAnswer(false);
      throw new Error("練習の準備ができていません。少し待ってからもう一度お試しください。");
    }
    let source = providedStream ?? media.stream;
    let begun: { turnId: number } | null = null;
    try {
      if (!source) source = await media.acquireMedia(!isSolo);
      const result = await window.jobuhan.practice.beginAnswer(currentSessionId);
      if (!result.ok) throw new Error(result.error.message);
      begun = result.data;
      activeTurnRef.current = { sessionId: currentSessionId, turnId: begun.turnId };
      turnIdRef.current = begun.turnId;
      setTranscript("");
      setAnswer("");
      setPartial("");
      setMetrics(null);
      setSpeechError("");
      setElapsed(0);
      media.startRecording({ sessionId: currentSessionId, turnId: begun.turnId }, source);
      setRecording(true);
    } catch (error) {
      if (begun) {
        activeTurnRef.current = null;
        await window.jobuhan.practice.endAnswer(currentSessionId, begun.turnId);
      }
      if (!providedStream && source) media.releaseMedia();
      throw error;
    } finally {
      startingAnswerRef.current = false;
      setStartingAnswer(false);
    }
  }, [isSolo, media, setAnswer]);

  const stopAnswer = useCallback(async () => {
    if (stopAnswerPromiseRef.current) return stopAnswerPromiseRef.current;
    if (!recording) return;
    const stopping = (async () => {
      setRecording(false);
      await media.stopRecording();
      const currentSessionId = sessionIdRef.current;
      const currentTurnId = turnIdRef.current;
      if (!currentSessionId || !currentTurnId) return;
      const result = await window.jobuhan.practice.endAnswer(currentSessionId, currentTurnId);
      if (!result.ok) { notify(result.error.message); return; }
      activeTurnRef.current = null;
      setTranscript(result.data.answerText);
      setAnswer(result.data.answerText);
      setPartial("");
    })();
    stopAnswerPromiseRef.current = stopping;
    try { await stopping; }
    finally { stopAnswerPromiseRef.current = null; }
  }, [media.stopRecording, notify, recording, setAnswer]);

  const goNext = async () => {
    if (actionBusy) return;
    if (startingAnswerRef.current) { notify("マイクの準備が終わってから操作してください。"); return; }
    setActionBusy(true);
    try {
      if (recording) await stopAnswer();
      const currentSessionId = sessionIdRef.current;
      if (!currentSessionId) throw new Error("練習を開始できませんでした。");
      const result = await window.jobuhan.practice.next(currentSessionId);
      if (!result.ok) throw new Error(result.error.message);
      if (result.data.done) {
        sessionFinishedRef.current = true;
        sessionIdRef.current = null;
        setSessionId(null);
        await media.stopRecording();
        finish();
        return;
      }
      setPrompt(result.data.prompt);
      turnIdRef.current = result.data.prompt.turnId;
      activeTurnRef.current = null;
      setTranscript("");
      setPartial("");
      setAnswer("");
      setQuestion(question + 1);
      setAcknowledgement("");
    } catch (error) { notify(error instanceof Error ? error.message : "次の質問を表示できませんでした。"); }
    finally { setActionBusy(false); }
  };

  const finishPractice = async () => {
    if (actionBusy) return;
    if (startingAnswerRef.current) { notify("マイクの準備が終わってから操作してください。"); return; }
    setActionBusy(true);
    try {
      if (recording) await stopAnswer();
      const currentSessionId = sessionIdRef.current;
      if (currentSessionId) {
        const result = await window.jobuhan.practice.finish(currentSessionId, true);
        if (!result.ok) throw new Error(result.error.message);
      }
      sessionFinishedRef.current = true;
      sessionIdRef.current = null;
      setSessionId(null);
      finish();
    } catch (error) { notify(error instanceof Error ? error.message : "練習を終了できませんでした。"); }
    finally { setActionBusy(false); }
  };

  const currentQuestion = prompt?.question.text ?? questions[question % questions.length];
  const displayTranscript = transcript + partial;
  return <section className="practice-view">
    <header className="page-heading practice-heading"><h1>{isSolo ? "一人で面接練習" : "誰かと面接練習"}</h1>
      <p>{isSolo ? "質問カードを見ながら答えてみましょう。回答は練習ログに保存されます。" : "面接相手と対話しながら練習しましょう。"}</p>
    </header>
    {isSolo ? <section className="practice-canvas" aria-label="面接官と質問"><div className="canvas-inner solo-interviewer">
      <div className="question-card"><span>{loadingSession ? "練習を準備中" : `質問 ${prompt?.seq ?? question + 1} / ${prompt?.totalQuestions ?? 5}`}</span><strong>{currentQuestion}</strong></div>
      <img className="interviewer-avatar" src="./figma/interviewer-avatar.svg" alt="面接官" />
    </div></section> : <section className="practice-canvas partner-practice-canvas" aria-label="面接相手との映像">
      <HostRtcPanel question={currentQuestion} questionIndex={prompt?.seq ?? question + 1} stream={media.stream} acquireMedia={media.acquireMedia} startRecording={startAnswer} stopRecording={stopAnswer} releaseMedia={media.releaseMedia} onAcknowledgement={setAcknowledgement} />
    </section>}
    <section className="transcript-card" aria-labelledby="transcript-title">
      <div className="transcript-header"><div className="transcript-title"><Image name="transcript-document.svg" /><h2 id="transcript-title">あなたの回答（リアルタイム文字起こし）</h2></div>
        <div className="record-status"><span className={"status-dot " + (recording ? "is-recording" : "is-idle")} /><span>{recording ? "録音中" : "録音待機中"}</span><time>{String(Math.floor(elapsed / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")}</time></div>
      </div>
      <div className="transcript-panel"><Image name="waveform.svg" className="waveform" /><textarea aria-label="あなたの回答" placeholder={recording ? "話した内容を認識しています…" : "録音を開始すると文字起こしが表示されます。ここに直接入力することもできます。"} value={displayTranscript} onChange={(event) => { setTranscript(event.currentTarget.value); setPartial(""); setAnswer(event.currentTarget.value); }} /></div>
      <div className="transcript-live-meta" aria-live="polite">{metrics && <span>話速 {metrics.wpm ?? "—"} 字/分 · フィラー {metrics.fillerCount}回</span>}{acknowledgement && <span>相手の相づち: {acknowledgement}</span>}{speechError && <span className="rtc-error">{speechError}</span>}</div>
      <div className="practice-controls">
        {!recording ? <button className="control-button control-primary" type="button" disabled={loadingSession || actionBusy || startingAnswer || sessionId === null} onClick={() => void startAnswer().catch((error: unknown) => notify(error instanceof Error ? error.message : "録音を開始できませんでした。"))}><span className="record-icon"><i /></span>{startingAnswer ? "準備中…" : "録音を開始"}</button> : <button className="control-button control-primary recording-stop" type="button" onClick={() => void stopAnswer().catch((error: unknown) => notify(error instanceof Error ? error.message : "録音を停止できませんでした。"))}><span className="record-icon"><i /></span>録音を停止</button>}
        <button className="control-button" type="button" disabled={!recording} onClick={() => media.recorderState === "paused" ? media.resumeRecording() : media.pauseRecording()}><Image name="pause.svg" />{media.recorderState === "paused" ? "再開" : "一時停止"}</button>
        <button className="control-button control-next" type="button" disabled={loadingSession || actionBusy || startingAnswer} onClick={() => void goNext()}><Image name="next.svg" />次の質問</button>
        <button className="control-button" type="button" disabled={loadingSession || actionBusy || startingAnswer} onClick={() => void finishPractice()}><Image name="end.svg" />練習を終了</button>
      </div>
    </section>
    <div className="practice-actions">
      <button className="action-card" type="button" onClick={hint}><span className="action-icon help-icon">？</span><span><strong>ヒントを見る</strong><small>覚えておきたいこと・ESの要点</small></span></button>
      <button className="action-card summary-action" type="button" onClick={() => void finishPractice()} disabled={actionBusy}><span className="action-icon summary-icon"><i /><i /><i /></span><span><strong>要約・振り返り</strong><small>回答内容を保存して振り返る</small></span></button>
    </div>
  </section>;
}
