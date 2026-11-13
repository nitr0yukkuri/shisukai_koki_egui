/** settings のSQL(内部設計書 §8.3)。値はJSON文字列で持つ。 */
import type { AppDatabase } from "../db/database.ts";

type SettingRow = {
  value: string;
  updated_at: string;
};

export class SettingsRepository {
  private readonly database: AppDatabase;

  constructor(database: AppDatabase) {
    this.database = database;
  }

  find(key: string): { value: unknown; updatedAt: string } | undefined {
    const row = this.database.get<SettingRow>(
      "SELECT value, updated_at FROM settings WHERE key = $key",
      { key },
    );
    if (!row) {
      return undefined;
    }
    return { value: parseValue(row.value), updatedAt: row.updated_at };
  }

  save(key: string, value: unknown, now: string): void {
    this.database.run(
      `INSERT INTO settings (key, value, updated_at)
       VALUES ($key, $value, $now)
       ON CONFLICT (key)
       DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      { key, value: JSON.stringify(value ?? null), now },
    );
  }
}

function parseValue(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
