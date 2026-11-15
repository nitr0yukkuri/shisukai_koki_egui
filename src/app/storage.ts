import { accentColors, defaultProfile } from "./data";
import type { Profile } from "./types";

export function readStoredAccent(): string {
  try {
    const saved = window.localStorage.getItem("jobuhan:accent");
    return accentColors.some((color) => color.value === saved) ? saved! : "#1e7149";
  } catch { return "#1e7149"; }
}

export function readStoredNotifications(): boolean[] {
  try {
    const saved: unknown = JSON.parse(window.localStorage.getItem("jobuhan:notifications") ?? "null");
    if (Array.isArray(saved) && saved.length === 3 && saved.every((value) => typeof value === "boolean")) return saved as boolean[];
  } catch { /* Use defaults when local storage is unavailable. */ }
  return [true, true, false];
}

export function readStoredProfile(): Profile {
  try {
    const saved: unknown = JSON.parse(window.localStorage.getItem("jobuhan:profile") ?? "null");
    if (saved && typeof saved === "object" && "name" in saved && "bio" in saved && typeof saved.name === "string" && typeof saved.bio === "string") return { name: saved.name, bio: saved.bio };
  } catch { /* Use defaults when local storage is unavailable. */ }
  return defaultProfile;
}
