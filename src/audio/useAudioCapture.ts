import { useCallback, useEffect, useRef, useState } from "react";

type RecordingTarget = { sessionId: number; turnId: number };

function preferredAudioType(): string | undefined {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return undefined;
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type));
}

/** Opens the requested devices and forwards short audio chunks to the local speech IPC. */
export function useAudioCapture() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const startedAtRef = useRef(0);
  const targetRef = useRef<RecordingTarget | null>(null);
  const pendingChunksRef = useRef(Promise.resolve());
  const [recorderState, setRecorderState] = useState<"inactive" | "recording" | "paused">("inactive");

  const acquireMedia = useCallback(async (video = false) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("この端末ではカメラとマイクを利用できません。");
    }
    let next: MediaStream;
    try {
      next = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video,
      });
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") throw new Error("カメラとマイクの使用が許可されていません。端末の設定を確認してください。", { cause: error });
      if (name === "NotFoundError" || name === "DevicesNotFoundError") throw new Error("利用できるマイクまたはカメラが見つかりません。", { cause: error });
      throw new Error("カメラとマイクを起動できませんでした。デバイスの接続を確認してください。", { cause: error });
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = next;
    setStream(next);
    return next;
  }, []);

  const startRecording = useCallback((target: RecordingTarget, source = streamRef.current) => {
    if (!source?.getAudioTracks().length) throw new Error("マイクが利用できません。");
    if (typeof MediaRecorder === "undefined") throw new Error("この端末では音声録音を利用できません。");
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      throw new Error("すでに録音中です。");
    }
    const audioStream = new MediaStream(source.getAudioTracks());
    const mimeType = preferredAudioType();
    const recorder = new MediaRecorder(audioStream, mimeType ? { mimeType } : undefined);
    targetRef.current = target;
    startedAtRef.current = performance.now();
    pendingChunksRef.current = Promise.resolve();
    recorder.ondataavailable = (event) => {
      const activeTarget = targetRef.current;
      if (!activeTarget || event.data.size === 0) return;
      pendingChunksRef.current = pendingChunksRef.current.then(async () => {
        const data = await event.data.arrayBuffer();
        window.jobuhan.audio.sendChunk({ ...activeTarget, data, offsetMs: Math.round(performance.now() - startedAtRef.current) });
      });
    };
    recorder.onstart = () => setRecorderState("recording");
    recorder.onpause = () => setRecorderState("paused");
    recorder.onresume = () => setRecorderState("recording");
    recorderRef.current = recorder;
    recorder.start(700);
  }, []);

  const stopRecording = useCallback(() => new Promise<void>((resolve) => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      targetRef.current = null;
      resolve();
      return;
    }
    recorder.addEventListener("stop", () => {
      recorderRef.current = null;
      targetRef.current = null;
      void pendingChunksRef.current.catch(() => undefined).then(() => {
        setRecorderState("inactive");
        resolve();
      });
    }, { once: true });
    recorder.stop();
  }), []);

  const pauseRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") recorder.pause();
  }, []);

  const resumeRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder?.state === "paused") recorder.resume();
  }, []);

  const releaseMedia = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
  }, []);

  useEffect(() => () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  return { stream, recorderState, acquireMedia, startRecording, stopRecording, pauseRecording, resumeRecording, releaseMedia };
}
