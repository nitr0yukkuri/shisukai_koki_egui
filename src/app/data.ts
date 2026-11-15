import type { LogEntry, Profile, ReportTab } from "./types";

export const questions = ["学生時代に力を入れたことは？", "あなたの強みを教えてください。", "志望動機を教えてください。"];
export const sampleAnswer = "大学時代の長期インターンでユーザーインタビューを行い、課題を見つけて改善しました。\n使いやすさが向上し、ユーザーに喜んでもらえたことに大きなやりがいを感じました。";
export const accentColors = [
  { label: "フォレスト", value: "#1e7149", image: "setting-swatch-forest.svg" },
  { label: "スカイ", value: "#438ce6", image: "setting-swatch-sky.svg" },
  { label: "ラベンダー", value: "#8062cf", image: "setting-swatch-lavender.svg" },
  { label: "サン", value: "#dca623", image: "setting-swatch-sun.svg" },
  { label: "コーラル", value: "#df5c4c", image: "setting-swatch-coral.svg" },
] as const;
export const defaultProfile: Profile = { name: "練習ユーザー", bio: "" };
export const logs: LogEntry[] = [
  { id: 1, date: "2024年3月15日（金） 14:32", mode: "partner", partner: "佐藤 花子さん", initial: "佐", question: "志望動機を教えてください。", answer: "大学時代に長期インターンでWebサービスの企画に携わり、ユーザーの課題を解決する仕事に興味を持ちました。", score: 78 },
  { id: 2, date: "2024年3月12日（火） 19:08", mode: "solo", partner: "練習ユーザー", initial: "AI", question: "自己PRをお願いします。", answer: "強みは周囲を巻き込み、最後までやり切る力です。文化祭の企画では役割を整理し、進行を支えました。", score: 85 },
  { id: 3, date: "2024年3月8日（金） 16:45", mode: "partner", partner: "高橋 健さん", initial: "高", question: "学生時代に力を入れたことは？", answer: "サークルの参加率を上げるため、メンバーの声を聞き、練習の進め方を見直しました。", score: 64 },
  { id: 4, date: "2024年3月5日（火） 15:20", mode: "solo", partner: "練習ユーザー", initial: "AI", question: "最近気になったニュースは？", answer: "物流業界の人手不足に関心を持ち、サービスや働き方への影響について調べました。", score: 72 },
];
export const reportRows: Record<Exclude<ReportTab, "transcript">, { time: string; text: string }[]> = {
  points: [
    { time: "00:12", text: "私は、大学時代に長期インターンシップでWebサービスの企画に携わった経験から、ユーザーの課題を解決する仕事に強く興味を持ちました。" },
    { time: "00:28", text: "ユーザーインタビューを通じて改善を繰り返し、使いやすさが向上していく過程にやりがいを感じています。" },
    { time: "00:47", text: "この経験を活かして、ユーザーの声をもとにしたサービス改善に挑戦したいです。" },
  ],
  hints: [
    { time: "00:12", text: "最初に結論を置くと、聞き手が話の方向をつかみやすくなります。" },
    { time: "00:28", text: "取り組みの中で、自分が工夫した点を一つ具体的に挙げてみましょう。" },
    { time: "00:47", text: "経験と次に挑戦したいことを、ひと続きの説明にしてみましょう。" },
  ],
};
export const reportTabs: [ReportTab, string][] = [
  ["points", "重要なポイント"],
  ["hints", "改善のヒント"],
  ["transcript", "全体の書き起こし"],
];
