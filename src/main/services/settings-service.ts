/**
 * 設定と同意の状態(FR-27・28)。
 * APIキーはDBに入れない。外部AIを使う段階で safeStorage を使う(内部設計書 §9.4)。
 */
import type { SettingsRepository } from "../repositories/settings-repository.ts";
import { SETTINGS_KEYS } from "../../shared/settings-keys.ts";
import type { ConsentState } from "../../shared/types.ts";

export class SettingsService {
  private readonly repository: SettingsRepository;
  private readonly now: () => string;

  constructor(
    repository: SettingsRepository,
    now: () => string = () => new Date().toISOString(),
  ) {
    this.repository = repository;
    this.now = now;
  }

  get(key: string): unknown {
    return this.repository.find(key)?.value ?? null;
  }

  set(key: string, value: unknown): void {
    this.repository.save(key, value, this.now());
  }

  getConsent(): ConsentState {
    const stored = this.repository.find(SETTINGS_KEYS.consentExternalAi);
    return {
      externalAi: stored?.value === true,
      updatedAt: stored?.updatedAt ?? null,
    };
  }

  setConsent(externalAi: boolean): ConsentState {
    const now = this.now();
    this.repository.save(SETTINGS_KEYS.consentExternalAi, externalAi, now);
    return { externalAi, updatedAt: now };
  }
}
