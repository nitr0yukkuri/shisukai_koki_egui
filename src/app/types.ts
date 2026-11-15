export type Screen = "home" | "solo" | "partner" | "history" | "report" | "settings";
export type NavScreen = Exclude<Screen, "report">;
export type Mode = "solo" | "partner";
export type ReportTab = "points" | "hints" | "transcript";
export type IconName = "home" | "user" | "users" | "chart" | "settings" | "speaker" | "microphone" | "palette" | "account" | "profile" | "bell" | "close";
export type LogEntry = {
  id: number; date: string; mode: Mode; partner: string; initial: string;
  question: string; answer: string; score: number;
};
export type NavigationEntry = { screen: Screen; report?: { entry: LogEntry; tab: ReportTab } };
export type Profile = { name: string; bio: string };
