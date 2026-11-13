/**
 * 画面側(renderer)と処理側(main)で共有する型。
 * 内部設計書 §3.3・§8 に対応する。実行時の検証は schemas.ts で行う。
 */

export const PRACTICE_MODES = ["solo", "one_on_one"] as const;
export type PracticeMode = (typeof PRACTICE_MODES)[number];

export const SESSION_STATUSES = ["in_progress", "finished", "interrupted"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const TURN_STATUSES = ["asked", "answering", "answered", "skipped"] as const;
export type TurnStatus = (typeof TURN_STATUSES)[number];

export const STT_STATUSES = ["ok", "failed", "none"] as const;
export type SttStatus = (typeof STT_STATUSES)[number];

export const SPEAKERS = ["user", "partner"] as const;
export type Speaker = (typeof SPEAKERS)[number];

export const ES_KINDS = ["self_pr", "gakuchika", "motivation", "career"] as const;
export type EsKind = (typeof ES_KINDS)[number];

/** ESセット名の上限(外部設計書 §5.2)。 */
export const ES_NAME_MAX_LENGTH = 30;

/**
 * ES本文の上限(外部設計書 §5.2)。
 * これは「画面で赤字警告を出す値」であって、保存を断る値ではない(FR-04・MSG-02)。
 * 超えたまま保存でき、AIへ送るときだけこの長さで切り詰める(内部設計書 §7.1)。
 */
export const ES_BODY_MAX_LENGTH: Record<EsKind, number> = {
  self_pr: 2000,
  gakuchika: 2000,
  motivation: 2000,
  career: 1000,
};

/**
 * 保存を断る絶対上限(外部設計書 §5.2・MSG-18)。
 * 貼り付け事故でDBが膨らむのを防ぐためだけの歯止めで、通常の入力では当たらない。
 */
export const ES_BODY_HARD_LIMIT = 20000;

/** 1回の練習で出す質問数(外部設計書 §5.3のプルダウン)。 */
export const QUESTION_COUNT_MIN = 3;
export const QUESTION_COUNT_MAX = 5;
export const QUESTION_COUNT_DEFAULT = 5;

export type EsItem = {
  kind: EsKind;
  body: string;
};

export type EsSetSummary = {
  id: number;
  name: string;
  updatedAt: string;
};

export type EsSet = {
  id: number;
  name: string;
  items: EsItem[];
  createdAt: string;
  updatedAt: string;
};

/** 保存前のESセット。新規作成では id を持たない。 */
export type EsSetInput = {
  id?: number;
  name: string;
  items: EsItem[];
};

export type QuestionSummary = {
  id: number;
  text: string;
  category: string;
  esKind: EsKind | null;
};

/** 音声認識が返す単語と時刻。回答開始を 0ms とする。 */
export type SpeechWord = {
  text: string;
  startMs: number;
  endMs: number;
};

export const SPEED_LABELS = ["slow", "normal", "fast", "unmeasurable"] as const;
export type SpeedLabel = (typeof SPEED_LABELS)[number];

export type FillerHit = {
  word: string;
  atMs: number | null;
};

/** 話し方の指標(内部設計書 §6)。 */
export type SpeakingMetrics = {
  charCount: number;
  speakingMs: number;
  wpm: number | null;
  speedLabel: SpeedLabel;
  fillerCount: number;
  fillers: FillerHit[];
};

export type UtteranceRecord = {
  id: number;
  seq: number;
  speaker: Speaker;
  text: string;
  startMs: number | null;
  endMs: number | null;
  words: SpeechWord[];
};

export type TurnRecord = {
  id: number;
  sessionId: number;
  seq: number;
  questionId: number | null;
  questionText: string;
  status: TurnStatus;
  answerText: string;
  speakingMs: number | null;
  charCount: number | null;
  wpm: number | null;
  speedLabel: SpeedLabel;
  fillerCount: number;
  sttStatus: SttStatus;
  startedAt: string | null;
  endedAt: string | null;
  utterances: UtteranceRecord[];
  fillers: FillerHit[];
};

export type SessionSummary = {
  id: number;
  mode: PracticeMode;
  status: SessionStatus;
  /**
   * 練習に使ったESセットの名前(SC-06)。
   * 開始時の写し(es_snapshot_json)から取るので、あとでESを消しても履歴に残る。
   * ESを選ばずに始めた練習は null。
   */
  esSetName: string | null;
  startedAt: string;
  endedAt: string | null;
  turnCount: number;
  answeredCount: number;
  totalScore: number | null;
};

export type EsSetSnapshot = Pick<EsSet, "id" | "name">;

export type SessionDetail = {
  id: number;
  mode: PracticeMode;
  status: SessionStatus;
  esSetId: number | null;
  esSnapshot: EsSetSnapshot | null;
  interviewerImageId: number | null;
  startedAt: string;
  endedAt: string | null;
  turns: TurnRecord[];
};

/** practice:start / practice:next が返す、次に出す質問。 */
export type PracticePrompt = {
  turnId: number;
  seq: number;
  totalQuestions: number;
  question: QuestionSummary;
};

export type PracticeStarted = {
  sessionId: number;
  prompt: PracticePrompt;
};

export type PracticeNextResult =
  | { done: false; prompt: PracticePrompt }
  | { done: true };

export type AnswerStarted = {
  turnId: number;
  recognizer: string;
};

/** 処理側から画面側へ送る通知の中身(内部設計書 §4.2)。 */
export type SttPartialEvent = {
  sessionId: number;
  turnId: number;
  text: string;
};

export type SttFinalEvent = {
  sessionId: number;
  turnId: number;
  text: string;
  words: SpeechWord[];
};

export type MetricsUpdateEvent = {
  sessionId: number;
  turnId: number;
  metrics: SpeakingMetrics;
};

export type SttErrorEvent = {
  sessionId: number;
  turnId: number;
  code: string;
  message: string;
};

export type AudioChunkMessage = {
  sessionId: number;
  turnId: number;
  /** 録音データ。IPCでは ArrayBuffer として渡る。 */
  data: ArrayBuffer | Uint8Array;
  /** 回答開始からの経過時間(ms)。分からないときは省略できる。 */
  offsetMs?: number;
};

export type ConsentState = {
  externalAi: boolean;
  updatedAt: string | null;
};
