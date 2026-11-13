/**
 * 処理側(main)の組み立て(内部設計書 §3.1)。
 * DBを開き、マイグレーションを通し、サービスを束ねる。Electronには依存しない。
 */
import { openDatabase, type AppDatabase } from "./db/database.ts";
import { runMigrations } from "./db/migrator.ts";
import { EsRepository } from "./repositories/es-repository.ts";
import { QuestionRepository } from "./repositories/question-repository.ts";
import { SessionRepository } from "./repositories/session-repository.ts";
import { SettingsRepository } from "./repositories/settings-repository.ts";
import { EsService } from "./services/es-service.ts";
import { HistoryService } from "./services/history-service.ts";
import { PracticeSessionService } from "./services/practice-session-service.ts";
import { QuestionService } from "./services/question-service.ts";
import { SettingsService } from "./services/settings-service.ts";
import { FakeSpeechRecognizer } from "./speech/fake-speech-recognizer.ts";
import type { SpeechRecognizer } from "./speech/speech-recognizer.ts";
import { SpeechService, type SpeechNotifier } from "./speech/speech-service.ts";

export type Backend = {
  database: AppDatabase;
  es: EsService;
  practice: PracticeSessionService;
  history: HistoryService;
  settings: SettingsService;
  speech: SpeechService;
  /** 画面が用意できたあとに、通知の送り先を差し替える。 */
  setSpeechNotifier: (notifier: SpeechNotifier) => void;
  close: () => void;
};

export type CreateBackendOptions = {
  /** jobuhan.db のパス。テストでは ":memory:" を使う。 */
  databasePath: string;
  /**
   * 音声認識の実装。既定は固定の文字起こしを返す Fake(内部設計書 §7.4)。
   * U-06 が決まったら、ここに実サービスのアダプターを渡す。
   */
  recognizer?: SpeechRecognizer;
  notifier?: SpeechNotifier;
  now?: () => string;
};

export function createBackend(options: CreateBackendOptions): Backend {
  const database = openDatabase(options.databasePath);
  runMigrations(database, { filePath: options.databasePath });

  const esRepository = new EsRepository(database);
  const questionRepository = new QuestionRepository(database);
  const sessionRepository = new SessionRepository(database);
  const settingsRepository = new SettingsRepository(database);

  const speech = new SpeechService({
    recognizer: options.recognizer ?? new FakeSpeechRecognizer(),
    notifier: options.notifier,
  });

  const practice = new PracticeSessionService({
    database,
    sessions: sessionRepository,
    esSets: esRepository,
    questions: new QuestionService(questionRepository),
    speech,
    now: options.now,
  });

  // 前回の異常終了を片付けてから練習を始められるようにする(内部設計書 §9.2)。
  practice.recoverInterruptedSessions();

  return {
    database,
    es: new EsService(database, esRepository, options.now),
    practice,
    history: new HistoryService(sessionRepository),
    settings: new SettingsService(settingsRepository, options.now),
    speech,
    setSpeechNotifier: (notifier) => speech.setNotifier(notifier),
    close: () => {
      speech.abortTurn();
      database.close();
    },
  };
}
