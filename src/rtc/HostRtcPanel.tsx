import { useEffect, useRef, useState } from "react";
import { InterviewPeer, type PeerConnectionStatus } from "./InterviewPeer";
import type { RoomMessage } from "./protocol";

const connectionLabels: Record<PeerConnectionStatus, string> = {
  new: "未接続", connecting: "接続中", connected: "接続済み", disconnected: "切断されました", failed: "接続できませんでした", closed: "終了しました",
};

export function HostRtcPanel({ question, questionIndex, stream, acquireMedia, startRecording, stopRecording, releaseMedia, onAcknowledgement }: {
  question: string;
  questionIndex: number;
  stream: MediaStream | null;
  acquireMedia: (video?: boolean) => Promise<MediaStream>;
  startRecording: (stream?: MediaStream) => Promise<void>;
  stopRecording: () => Promise<void>;
  releaseMedia: () => void;
  onAcknowledgement: (phrase: string) => void;
}) {
  const [consentVideo, setConsentVideo] = useState(false);
  const [consentAudio, setConsentAudio] = useState(false);
  const [status, setStatus] = useState<PeerConnectionStatus>("new");
  const [isStarting, setIsStarting] = useState(false);
  const [offerCode, setOfferCode] = useState("");
  const [answerCode, setAnswerCode] = useState("");
  const [error, setError] = useState("");
  const [lastAck, setLastAck] = useState("");
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<InterviewPeer | null>(null);
  const questionRef = useRef({ id: String(questionIndex), text: question });
  const localStreamRef = useRef<MediaStream | null>(null);
  const recordingStartedRef = useRef(false);
  const startRecordingRef = useRef(startRecording);
  const stopRecordingRef = useRef(stopRecording);
  const releaseMediaRef = useRef(releaseMedia);

  useEffect(() => { if (localVideoRef.current) localVideoRef.current.srcObject = stream; }, [stream]);
  useEffect(() => { if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream; }, [remoteStream]);
  useEffect(() => { startRecordingRef.current = startRecording; stopRecordingRef.current = stopRecording; releaseMediaRef.current = releaseMedia; }, [releaseMedia, startRecording, stopRecording]);
  useEffect(() => {
    questionRef.current = { id: String(questionIndex), text: question };
    if (status === "connected") peerRef.current?.send({ type: "question", id: String(questionIndex), index: questionIndex, text: question });
  }, [question, questionIndex, status]);
  useEffect(() => () => {
    peerRef.current?.close();
    void stopRecordingRef.current();
    releaseMediaRef.current();
  }, []);

  const startCall = async () => {
    if (isStarting) return;
    setIsStarting(true);
    setError("");
    try {
      const local = await acquireMedia(true);
      localStreamRef.current = local;
      const peer = InterviewPeer.createHost(local, {
        onRemoteStream: setRemoteStream,
        onStatus: (nextStatus) => {
          setStatus(nextStatus);
          if (nextStatus === "failed" || nextStatus === "closed") setRemoteStream(null);
          if ((nextStatus === "disconnected" || nextStatus === "failed") && recordingStartedRef.current) {
            recordingStartedRef.current = false;
            void stopRecordingRef.current().finally(() => {
              localStreamRef.current = null;
              releaseMediaRef.current();
            });
          }
          if (nextStatus === "connected" && !recordingStartedRef.current && localStreamRef.current) {
            recordingStartedRef.current = true;
            void startRecordingRef.current(localStreamRef.current).catch((reason: unknown) => {
              recordingStartedRef.current = false;
              setError(reason instanceof Error ? reason.message : "録音を開始できませんでした。");
            });
          }
        },
        onInvalidMessage: () => setError("相手から受け取ったデータの形式を確認できませんでした。"),
        onMessage: (message: RoomMessage) => {
          if (message.type !== "acknowledgement" || message.questionId !== questionRef.current.id) return;
          setLastAck(message.phrase);
          onAcknowledgement(message.phrase);
        },
      });
      peerRef.current = peer;
      setOfferCode(await peer.createOfferCode());
    } catch (reason) {
      peerRef.current?.close();
      peerRef.current = null;
      setOfferCode("");
      setRemoteStream(null);
      await stopRecording();
      recordingStartedRef.current = false;
      localStreamRef.current = null;
      releaseMedia();
      setError(reason instanceof Error ? reason.message : "接続を開始できませんでした。");
    } finally { setIsStarting(false); }
  };

  const acceptAnswer = async () => {
    setError("");
    try {
      if (!peerRef.current) throw new Error("先に招待コードを作成してください。");
      await peerRef.current.acceptAnswerCode(answerCode);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "回答コードを読み取れませんでした。"); }
  };

  const endCall = async () => {
    peerRef.current?.close();
    peerRef.current = null;
    await stopRecording();
    recordingStartedRef.current = false;
    localStreamRef.current = null;
    setRemoteStream(null);
    setOfferCode("");
    setAnswerCode("");
    setLastAck("");
    setStatus("closed");
    setConsentAudio(false);
    setConsentVideo(false);
    releaseMedia();
  };

  const retryCall = async () => {
    setError("");
    try {
      await endCall();
      setStatus("new");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "接続を終了できませんでした。");
    }
  };

  return <section className="host-rtc-panel" aria-label="面接相手との接続">
    <div className="rtc-panel-heading"><div><strong>面接相手と接続</strong><p>招待コードを交換して接続します。音声・映像は同意後に相手へ送信されます。</p></div><span className={"rtc-status rtc-status-" + status}>{connectionLabels[status]}</span></div>
    <div className="rtc-video-grid">
      <div className="rtc-video-card"><video ref={localVideoRef} autoPlay muted playsInline aria-label="あなたのカメラ映像" />{!stream && <div className="rtc-video-placeholder"><span>あなた</span><small>同意後にカメラが起動します</small></div>}<span className="rtc-video-label">あなた</span></div>
      <div className="rtc-video-card"><video ref={remoteVideoRef} autoPlay playsInline aria-label="面接相手の映像" />{!remoteStream && <div className="rtc-video-placeholder"><span>{status === "disconnected" || status === "failed" ? "相手との接続が切れました" : "面接相手の映像を待っています"}</span><small>相手が接続すると表示されます</small></div>}<span className="rtc-video-label">面接相手</span></div>
    </div>
    {status === "connected" ? <div className="host-connected-tools"><div className="partner-question"><small>相手に表示中の質問</small><strong>{question}</strong></div><div className="acknowledgement-status"><span>相手の相づち</span><strong>{lastAck || "まだありません"}</strong></div><button className="button button-outline" type="button" onClick={() => void endCall()}>接続を終了</button></div> : <>
      {!offerCode && <div className="rtc-consent-box"><strong>開始前に同意してください</strong><label><input type="checkbox" checked={consentVideo} onChange={(event) => setConsentVideo(event.currentTarget.checked)} /> 自分のカメラ映像を面接相手に送信する</label><label><input type="checkbox" checked={consentAudio} onChange={(event) => setConsentAudio(event.currentTarget.checked)} /> 自分のマイク音声を面接相手に送信する</label><p>マイク音声は文字起こしにも使います。音声・映像ファイルは保存しません。</p><button className="button button-primary" type="button" disabled={!consentVideo || !consentAudio || isStarting} onClick={() => void startCall()}>{isStarting ? "準備中…" : "同意して接続コードを作る"}</button></div>}
      {offerCode && <div className="rtc-signaling-grid"><label><strong>1. 招待コード</strong><small>面接相手用画面にコピーして共有してください。</small><textarea readOnly value={offerCode} onFocus={(event) => event.currentTarget.select()} /></label><label><strong>2. 相手の回答コード</strong><small>相手が作成した回答コードを貼り付けます。</small><textarea value={answerCode} onChange={(event) => setAnswerCode(event.currentTarget.value)} placeholder="回答コードをここに貼り付け" /></label><div className="rtc-signaling-actions"><button className="button button-primary" type="button" disabled={!answerCode.trim()} onClick={() => void acceptAnswer()}>回答コードで接続</button><button className="button button-outline" type="button" onClick={() => void window.jobuhan.window.openJoin()}>相手用画面を開く</button><button className="button button-outline" type="button" onClick={() => void endCall()}>キャンセル</button></div></div>}
      {(status === "disconnected" || status === "failed" || status === "closed") && <button className="button button-outline" type="button" onClick={() => void retryCall()}>接続をやり直す</button>}
    </>}
    {error && <p className="rtc-error" role="alert">{error}</p>}
  </section>;
}
