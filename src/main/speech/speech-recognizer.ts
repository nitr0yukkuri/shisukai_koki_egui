/**
 * 音声認識アダプターの口(内部設計書 §3.1・§7.2)。
 * 実装(U-06)が決まっても、この形だけ合わせればサービス層は変えない。
 */
import type { SpeechWord } from "../../shared/types.ts";

export type AudioChunk = {
  data: Uint8Array;
  /** 回答開始からの経過時間(ms)。分からないときは省略できる。 */
  offsetMs?: number;
};

export type RecognitionFinal = {
  text: string;
  words: SpeechWord[];
};

export type RecognitionCallbacks = {
  onPartial: (text: string) => void;
  onFinal: (result: RecognitionFinal) => void;
  onError: (error: Error) => void;
};

export interface SpeechRecognitionStream {
  /** 録音データを渡す。 */
  write(chunk: AudioChunk): void;
  /** 残っている結果を確定させて閉じる。 */
  finish(): Promise<void>;
  /** 結果を待たずに閉じる。 */
  abort(): void;
}

export interface SpeechRecognizer {
  readonly name: string;
  start(callbacks: RecognitionCallbacks): Promise<SpeechRecognitionStream>;
}
