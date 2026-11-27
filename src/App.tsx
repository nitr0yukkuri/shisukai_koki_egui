import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { logs, questions } from "./app/data";
import { readStoredAccent, readStoredNotifications, readStoredProfile } from "./app/storage";
import type { LogEntry, Mode, NavigationEntry, NavScreen, ReportTab, Screen } from "./app/types";
import { HintDialog } from "./dialogs/HintDialog";
import { ProfileDialog } from "./dialogs/ProfileDialog";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { HistoryPage } from "./pages/HistoryPage";
import { HomePage } from "./pages/HomePage";
import { PracticePage } from "./pages/PracticePage";
import { ReportPage } from "./pages/ReportPage";
import { SettingsPage } from "./pages/SettingsPage";

function App() {
  const [navigation, setNavigation] = useState<{ entries: NavigationEntry[]; position: number }>({ entries: [{ screen: "home" }], position: 0 });
  const currentRoute = navigation.entries[navigation.position];
  const screen = currentRoute.screen;
  const [notice, setNotice] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [interviewNote, setInterviewNote] = useState<{ value: string; storageError: "load" | "save" | null }>(() => {
    try { return { value: window.localStorage.getItem("jobuhan:interview-note") ?? "", storageError: null }; }
    catch { return { value: "", storageError: "load" }; }
  });
  const [question, setQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<Mode, Record<number, string>>>({ solo: {}, partner: {} });
  const [newest, setNewest] = useState(true);
  const [accent, setAccent] = useState(readStoredAccent);
  const [notifications, setNotifications] = useState(readStoredNotifications);
  const [profile, setProfile] = useState(readStoredProfile);
  const [showProfile, setShowProfile] = useState(false);
  const notify = useCallback((message: string) => setNotice(message), []);
  const toggleNotification = (index: number) => setNotifications((current) => current.map((value, item) => item === index ? !value : value));
  const updateInterviewNote = (value: string) => {
    try {
      window.localStorage.setItem("jobuhan:interview-note", value);
      setInterviewNote({ value, storageError: null });
    } catch {
      setInterviewNote({ value, storageError: "save" });
    }
  };
  useEffect(() => {
    try {
      window.localStorage.setItem("jobuhan:accent", accent);
      window.localStorage.setItem("jobuhan:notifications", JSON.stringify(notifications));
      window.localStorage.setItem("jobuhan:profile", JSON.stringify(profile));
    } catch { /* Keep settings usable for the current session when local storage is unavailable. */ }
  }, [accent, notifications, profile]);
  const goTo = (next: Screen, reportEntry?: LogEntry) => {
    setNavigation((current) => {
      const entries = current.entries.slice(0, current.position + 1);
      const previousEntry = entries[entries.length - 1];
      if (next !== "report" && previousEntry?.screen === next) return current;
      if (next === "report" && !reportEntry) return current;
      entries.push(next === "report"
        ? { screen: next, report: { entry: reportEntry!, tab: "points" } }
        : { screen: next });
      return { entries, position: entries.length - 1 };
    });
    setNotice("");
  };
  const navigate = (next: NavScreen) => {
    goTo(next); setNotice("");
    if (next === "solo" || next === "partner") setQuestion(0);
  };
  const moveNavigation = (offset: -1 | 1) => {
    setNotice("");
    setNavigation((current) => {
      const position = current.position + offset;
      if (position < 0 || position >= current.entries.length) return current;
      return { ...current, position };
    });
  };
  const setReportTab = (value: ReportTab) => {
    setNavigation((current) => {
      const entries = current.entries.slice();
      const route = entries[current.position];
      if (route.screen !== "report" || !route.report) return current;
      entries[current.position] = { ...route, report: { ...route.report, tab: value } };
      return { ...current, entries };
    });
  };
  const titles: Record<Screen, string> = {
    home: "一人でできる、面接練習", solo: "一人でできる、面接練習", partner: "誰かと話す、面接練習",
    history: "一人でできる、振り返り・評価", report: "一人でできる、振り返り・評価", settings: "アカウント・環境設定",
  };
  const finish = () => {
    const mode = screen === "partner" ? "partner" : "solo";
    const entry: LogEntry = {
      ...logs[0],
      id: 0,
      date: "今回の練習（サンプル）",
      mode,
      partner: mode === "solo" ? profile.name : "サンプル相手",
      initial: mode === "solo" ? "AI" : "練",
      question: questions[question],
      answer: answers[mode][question] ?? "",
    };
    goTo("report", entry);
  };
  const openReport = (entry: LogEntry) => goTo("report", entry);
  return <div className="app-frame" style={{ "--accent": accent } as CSSProperties & { "--accent": string }}>
    <Sidebar screen={screen} onNavigate={navigate} /><div className="app-main"><TopBar title={titles[screen]} canGoBack={navigation.position > 0} canGoForward={navigation.position < navigation.entries.length - 1} goBack={() => moveNavigation(-1)} goForward={() => moveNavigation(1)} />
      <main className={"app-content screen-" + screen}>
        {screen === "home" && <HomePage go={navigate} notify={notify} />}
        {(screen === "solo" || screen === "partner") && <PracticePage mode={screen} question={question} setQuestion={setQuestion} setAnswer={(value) => setAnswers((current) => ({ ...current, [screen]: { ...current[screen], [question]: value } }))} finish={finish} hint={() => setShowHint(true)} notify={notify} />}
        {screen === "history" && <HistoryPage newest={newest} setNewest={setNewest} open={openReport} />}
        {screen === "report" && <ReportPage entry={currentRoute.report?.entry ?? logs[0]} tab={currentRoute.report?.tab ?? "points"} setTab={setReportTab} />}
        {screen === "settings" && <SettingsPage accent={accent} setAccent={setAccent} notifications={notifications} toggleNotification={toggleNotification} profile={profile} editProfile={() => setShowProfile(true)} notify={notify} />}
      </main>
    </div>
    {notice && <div className="status-toast" role="status"><span>{notice}</span><button type="button" aria-label="閉じる" onClick={() => setNotice("")}>×</button></div>}
    {showHint && <HintDialog close={() => setShowHint(false)} interviewNote={interviewNote.value} onInterviewNoteChange={updateInterviewNote} storageError={interviewNote.storageError} />}
    {showProfile && <ProfileDialog profile={profile} save={(nextProfile) => { setProfile(nextProfile); setShowProfile(false); }} close={() => setShowProfile(false)} />}
  </div>;
}

export default App;
