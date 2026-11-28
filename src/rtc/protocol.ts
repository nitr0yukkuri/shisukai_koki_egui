import { z } from "zod";

export const roomMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("question"), id: z.string().min(1).max(80), index: z.number().int().min(0).max(100), text: z.string().min(1).max(1000) }).strict(),
  z.object({ type: z.literal("acknowledgement"), questionId: z.string().min(1).max(80), phrase: z.enum(["はい", "なるほど", "分かりました"]) }).strict(),
]);

export type RoomMessage = z.infer<typeof roomMessageSchema>;

const signalCodeSchema = z.object({ version: z.literal(1), role: z.enum(["offer", "answer"]), sdp: z.string().min(20).max(240_000) }).strict();
export type SignalCode = z.infer<typeof signalCodeSchema>;

export function parseRoomMessage(data: unknown): RoomMessage | null {
  if (typeof data !== "string" || data.length > 16_000) return null;
  try {
    const result = roomMessageSchema.safeParse(JSON.parse(data) as unknown);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function encodeSignalCode(role: SignalCode["role"], sdp: string): string {
  const parsed = signalCodeSchema.safeParse({ version: 1, role, sdp });
  if (!parsed.success) throw new Error("接続情報の形式が正しくありません。");
  return btoa(JSON.stringify(parsed.data)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

export function decodeSignalCode(value: string): SignalCode {
  const normalized = value.replace(/\s+/gu, "").replaceAll("-", "+").replaceAll("_", "/");
  if (!normalized || normalized.length > 360_000) throw new Error("接続コードを確認してください。");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  let decoded: unknown;
  try { decoded = JSON.parse(atob(padded)) as unknown; }
  catch { throw new Error("接続コードを読み取れませんでした。"); }
  const parsed = signalCodeSchema.safeParse(decoded);
  if (!parsed.success) throw new Error("接続コードの形式が正しくありません。");
  return parsed.data;
}
