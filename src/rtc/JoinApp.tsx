import { useEffect, useRef, useState } from "react";
import { InterviewPeer, type PeerConnectionStatus } from "./InterviewPeer";
import type { RoomMessage } from "./protocol";

const statusLabels: Record<PeerConnectionStatus, string> = {
  new: "未接続", connecting: "接続中", connected: "接続済み", disconnected: "切断されました", failed: "接続できませんでした", closed: "終了しました",
};

export default function JoinApp() {
  const [consentVideo, setConsentVideo] = useState(false);
  const [consentAudio, setConsentAudio] = useState(false);
  const [offerCode, setOfferCode] = useState("");
  const [answerCode, setAnswerCode] = useState("");
  const [status, setStatus] = useState<PeerConnectionStatus>("new");
  const [question, setQuestion] = useState<Extract<RoomMessage, { type: "question" }> | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [waiting, setWaiting] = useState(false);
  const peerRef = useRef<InterviewPeer | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const questionRef = useRef<typeof question>(null);

  useEffect(() => { questionRef.current = question; }, [question]);
  useEffect(() => { if (localVideoRef.current) localVideoRef.current.srcObject = localStream; }, [localStream]);
  useEffect(() => { if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream; }, [remoteStream]);
  useEffect(() => () => {
    peerRef.current?.close();
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const join = async () => {
    setError("");
    setNotice("");
    setWaiting(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("この端末ではカメラとマイクを利用できません。");
      const local = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: true });
      localStreamRef.current = local;
      setLocalStream(local);
      const { session, answerCode: answer } = await InterviewPeer.joinOffer(offerCode, local, {
        onRemoteStream: setRemoteStream,
        onStatus: (nextStatus) => {
          setStatus(nextStatus);
          if (nextStatus === "failed" || nextStatus === "closed") setRemoteStream(null);
        },
        onInvalidMessage: () => setError("受け取ったデータの形式を確認できませんでした。"),
        onMessage: (message: RoomMessage) => { if (message.type === "question") setQuestion(message); },
      });
      peerRef.current = session;
      setAnswerCode(answer);
    } catch (reason) {
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
      setError(reason instanceof Error ? reason.message : "接続を開始できませんでした。");
      setStatus("new");
    } finally { setWaiting(false); }
  };

  const sendAcknowledgement = (phrase: "はい" | "なるほど" | "分かりました") => {
    const current = questionRef.current;
    if (!current || !peerRef.current?.send({ type: "acknowledgement", questionId: current.id, phrase })) {
      setNotice("面接相手との接続を確認してください。");
      return;
    }
    setNotice(`「${phrase}」を面接相手に送りました。`);
  };

  const endSession = () => {
    peerRef.current?.close();
    peerRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setQuestion(null);
    setAnswerCode("");
    setStatus("closed");
    setConsentVideo(false);
    setConsentAudio(false);
  };

  const reset = () => {
    endSession();
    setOfferCode("");
    setError("");
    setNotice("");
    setStatus("new");
  };

  return <div className="join-window">
    <header className="join-topbar"><div className="join-brand"><img src="./figma/app-topbar-leaf.svg" alt="" /><strong>じょぶはん</strong><span>面接相手用</span></div><div className="join-window-controls"><button type="button" aria-label="最小化" onClick={() => void window.jobuhan.window.minimize()}><img src="./figma/window-minimize.svg" alt="" /></button><button type="button" aria-label="最大化" onClick={() => void window.jobuhan.window.toggleMaximize()}><img src="./figma/window-maximize.svg" alt="" /></button><button type="button" aria-label="閉じる" onClick={() => void window.jobuhan.window.close()}><img src="./figma/window-close.svg" alt="" /></button></div></header>
    <main className="join-content"><header className="join-heading"><span>1on1 面接練習</span><h1>面接相手用画面</h1><p>接続コードで参加すると、質問を確認して相づちを送れます。</p></header>
      <div className="join-layout"><section className="join-connection-card"><div className="join-card-heading"><div><small>接続状態</small><strong>{statusLabels[status]}</strong></div><span className={"rtc-status rtc-status-" + status}>{statusLabels[status]}</span></div>
        <div className="rtc-video-grid join-video-grid"><div className="rtc-video-card"><video ref={remoteVideoRef} autoPlay playsInline aria-label="面接練習をしている人の映像" />{!remoteStream && <div className="rtc-video-placeholder"><span>{status === "disconnected" || status === "failed" ? "相手との接続が切れました" : "相手の映像を待っています"}</span><small>接続すると映像が表示されます</small></div>}<span className="rtc-video-label">面接練習中の人</span></div><div className="rtc-video-card"><video ref={localVideoRef} autoPlay muted playsInline aria-label="あなたのカメラ映像" />{!localStream && <div className="rtc-video-placeholder"><span>あなた</span><small>同意後にカメラが起動します</small></div>}<span className="rtc-video-label">あなた</span></div></div>
        {!answerCode && <div className="join-consent-box"><strong>参加前に同意してください</strong><label><input type="checkbox" checked={consentVideo} onChange={(event) => setConsentVideo(event.currentTarget.checked)} /> 自分のカメラ映像を面接相手に送信する</label><label><input type="checkbox" checked={consentAudio} onChange={(event) => setConsentAudio(event.currentTarget.checked)} /> 自分のマイク音声を面接相手に送信する</label><p>音声と映像は接続中にのみ利用します。アプリに録音・保存しません。</p><label className="join-code-field"><strong>招待コード</strong><textarea value={offerCode} onChange={(event) => setOfferCode(event.currentTarget.value)} placeholder="面接練習をする人から受け取ったコード" /></label><button className="button button-primary" type="button" disabled={!consentVideo || !consentAudio || !offerCode.trim() || waiting} onClick={() => void join()}>{waiting ? "接続準備中…" : "同意して参加する"}</button></div>}
        {answerCode && <div className="join-answer-box"><strong>回答コードを返してください</strong><p>このコードを面接練習をする人へ共有すると、接続が始まります。</p><textarea readOnly value={answerCode} onFocus={(event) => event.currentTarget.select()} aria-label="回答コード" /><button className="button button-outline" type="button" onClick={endSession}>接続を終了</button></div>}
        {(status === "failed" || status === "disconnected" || status === "closed") && <button className="button button-outline" type="button" onClick={reset}>もう一度接続する</button>}
      </section><section className="join-question-card" aria-live="polite"><small>面接官からの質問</small><h2>{question?.text ?? "接続すると質問がここに表示されます。"}</h2>{question && <div className="join-ack-actions"><span>相づちを送る</span><button type="button" disabled={status !== "connected"} onClick={() => sendAcknowledgement("はい")}>はい</button><button type="button" disabled={status !== "connected"} onClick={() => sendAcknowledgement("なるほど")}>なるほど</button><button type="button" disabled={status !== "connected"} onClick={() => sendAcknowledgement("分かりました")}>分かりました</button></div>}{notice && <p className="join-notice" role="status">{notice}</p>}{error && <p className="rtc-error" role="alert">{error}</p>}</section></div>
    </main>
  </div>;
}
