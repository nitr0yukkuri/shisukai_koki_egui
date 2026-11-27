import { decodeSignalCode, encodeSignalCode, parseRoomMessage, type RoomMessage } from "./protocol";

export type PeerConnectionStatus = RTCPeerConnectionState;
export type InterviewPeerCallbacks = {
  onRemoteStream: (stream: MediaStream) => void;
  onMessage: (message: RoomMessage) => void;
  onStatus: (status: PeerConnectionStatus) => void;
  onInvalidMessage?: () => void;
};

const rtcConfiguration: RTCConfiguration = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

function waitForIceGathering(peer: RTCPeerConnection, timeoutMs = 20_000): Promise<void> {
  if (peer.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const finish = (timedOut: boolean) => {
      window.clearTimeout(timeout);
      peer.removeEventListener("icegatheringstatechange", checkState);
      if (timedOut) reject(new Error("接続情報の準備がタイムアウトしました。ネットワークを確認してください。"));
      else resolve();
    };
    const checkState = () => { if (peer.iceGatheringState === "complete") finish(false); };
    const timeout = window.setTimeout(() => finish(true), timeoutMs);
    peer.addEventListener("icegatheringstatechange", checkState);
  });
}

export class InterviewPeer {
  private readonly peer: RTCPeerConnection;
  private readonly callbacks: InterviewPeerCallbacks;
  private channel: RTCDataChannel | null = null;
  private fallbackRemoteStream = new MediaStream();
  private readonly queuedMessages: RoomMessage[] = [];

  private constructor(localStream: MediaStream, callbacks: InterviewPeerCallbacks) {
    this.callbacks = callbacks;
    this.peer = new RTCPeerConnection(rtcConfiguration);
    localStream.getTracks().forEach((track) => this.peer.addTrack(track, localStream));
    this.peer.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) this.callbacks.onRemoteStream(stream);
      else {
        this.fallbackRemoteStream.addTrack(event.track);
        this.callbacks.onRemoteStream(this.fallbackRemoteStream);
      }
    };
    this.peer.onconnectionstatechange = () => this.callbacks.onStatus(this.peer.connectionState);
    this.peer.ondatachannel = (event) => this.attachChannel(event.channel);
  }

  static createHost(localStream: MediaStream, callbacks: InterviewPeerCallbacks): InterviewPeer {
    const peer = new InterviewPeer(localStream, callbacks);
    peer.attachChannel(peer.peer.createDataChannel("jobuhan-room", { ordered: true }));
    return peer;
  }

  static async joinOffer(offerCode: string, localStream: MediaStream, callbacks: InterviewPeerCallbacks): Promise<{ session: InterviewPeer; answerCode: string }> {
    const offer = decodeSignalCode(offerCode);
    if (offer.role !== "offer") throw new Error("面接練習をする人から受け取った招待コードを入力してください。");
    const session = new InterviewPeer(localStream, callbacks);
    try {
      await session.peer.setRemoteDescription({ type: "offer", sdp: offer.sdp });
      const answer = await session.peer.createAnswer();
      await session.peer.setLocalDescription(answer);
      await waitForIceGathering(session.peer);
      const sdp = session.peer.localDescription?.sdp;
      if (!sdp) throw new Error("回答コードを作成できませんでした。");
      return { session, answerCode: encodeSignalCode("answer", sdp) };
    } catch (error) { session.close(); throw error; }
  }

  async createOfferCode(): Promise<string> {
    const offer = await this.peer.createOffer();
    await this.peer.setLocalDescription(offer);
    await waitForIceGathering(this.peer);
    const sdp = this.peer.localDescription?.sdp;
    if (!sdp) throw new Error("招待コードを作成できませんでした。");
    return encodeSignalCode("offer", sdp);
  }

  async acceptAnswerCode(answerCode: string): Promise<void> {
    const answer = decodeSignalCode(answerCode);
    if (answer.role !== "answer") throw new Error("面接相手から受け取った回答コードを入力してください。");
    await this.peer.setRemoteDescription({ type: "answer", sdp: answer.sdp });
  }

  send(message: RoomMessage): boolean {
    if (!this.channel) return false;
    if (this.channel.readyState !== "open") {
      this.queuedMessages.push(message);
      return true;
    }
    this.channel.send(JSON.stringify(message));
    return true;
  }

  close(): void {
    this.channel?.close();
    this.peer.close();
    this.callbacks.onStatus("closed");
  }

  private attachChannel(channel: RTCDataChannel): void {
    this.channel = channel;
    channel.onopen = () => {
      this.callbacks.onStatus(this.peer.connectionState);
      while (this.queuedMessages.length > 0 && channel.readyState === "open") {
        const message = this.queuedMessages.shift();
        if (message) channel.send(JSON.stringify(message));
      }
    };
    channel.onclose = () => this.callbacks.onStatus(this.peer.connectionState === "connected" ? "disconnected" : this.peer.connectionState);
    channel.onmessage = (event) => {
      const message = parseRoomMessage(event.data as unknown);
      if (!message) { this.callbacks.onInvalidMessage?.(); return; }
      this.callbacks.onMessage(message);
    };
  }
}
