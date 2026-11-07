import { useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from "react";

type Screen = "home" | "solo" | "partner" | "history" | "report" | "settings";
type NavScreen = Exclude<Screen, "report">;
type Mode = "solo" | "partner";
type Filter = "all" | Mode;
type ReportTab = "points" | "hints" | "transcript";
type LogEntry = {
  id: number; date: string; mode: Mode; partner: string; initial: string;
  question: string; answer: string; score: number;
};
type NavigationEntry = { screen: Screen; report?: { entry: LogEntry; tab: ReportTab } };

const img = (name: string) => "./figma/" + name;
const questions = ["学生時代に力を入れたことは？", "あなたの強みを教えてください。", "志望動機を教えてください。"];
const sampleAnswer = "大学時代の長期インターンでユーザーインタビューを行い、課題を見つけて改善しました。\n使いやすさが向上し、ユーザーに喜んでもらえたことに大きなやりがいを感じました。";
const accentColors = [
  { label: "フォレスト", value: "#1e7149", text: "#1e7149", on: "#ffffff", image: "setting-swatch-forest.svg" },
  { label: "スカイ", value: "#438ce6", text: "#245c9e", on: "#111111", image: "setting-swatch-sky.svg" },
  { label: "ラベンダー", value: "#8062cf", text: "#6547a8", on: "#ffffff", image: "setting-swatch-lavender.svg" },
  { label: "サン", value: "#dca623", text: "#805a00", on: "#111111", image: "setting-swatch-sun.svg" },
  { label: "コーラル", value: "#df5c4c", text: "#a42f22", on: "#111111", image: "setting-swatch-coral.svg" },
] as const;
const logs: LogEntry[] = [
  { id: 1, date: "2024年3月15日（金） 14:32", mode: "partner", partner: "佐藤 花子さん", initial: "佐", question: "志望動機を教えてください。", answer: "大学時代に長期インターンでWebサービスの企画に携わり、ユーザーの課題を解決する仕事に興味を持ちました。", score: 78 },
  { id: 2, date: "2024年3月12日（火） 19:08", mode: "solo", partner: "一人練習", initial: "AI", question: "自己PRをお願いします。", answer: "強みは周囲を巻き込み、最後までやり切る力です。文化祭の企画では役割を整理し、進行を支えました。", score: 85 },
  { id: 3, date: "2024年3月8日（金） 16:45", mode: "partner", partner: "高橋 健さん", initial: "高", question: "学生時代に力を入れたことは？", answer: "サークルの参加率を上げるため、メンバーの声を聞き、練習の進め方を見直しました。", score: 64 },
  { id: 4, date: "2024年3月5日（火） 15:20", mode: "solo", partner: "一人練習", initial: "AI", question: "最近気になったニュースは？", answer: "物流業界の人手不足に関心を持ち、サービスや働き方への影響について調べました。", score: 72 },
];

const navItems: { screen: NavScreen; label: string; icon: string }[] = [
  { screen: "home", label: "ホーム", icon: "home" },
  { screen: "solo", label: "一人", icon: "person" },
  { screen: "partner", label: "誰か", icon: "people" },
  { screen: "history", label: "振り返り", icon: "reflection" },
  { screen: "settings", label: "設定", icon: "settings" },
];
const appIcons: Record<string, string> = {
  home: "app-icon-home.svg", person: "app-icon-person.svg", people: "app-icon-people.svg",
  reflection: "app-icon-reflection.svg", settings: "app-icon-settings.svg",
};
const homeIcons: Record<string, string> = {
  home: "home-icon-home.svg", person: "home-icon-person.svg", people: "home-icon-people.svg",
  reflection: "home-icon-reflection.svg", settings: "home-icon-settings.svg",
};

function Image({ name, alt = "", className }: { name: string; alt?: string; className?: string }) {
  return <img src={img(name)} alt={alt} className={className} />;
}

function Sidebar({ screen, onNavigate }: { screen: Screen; onNavigate: (screen: NavScreen) => void }) {
  const isHome = screen === "home";
  const icons = isHome ? homeIcons : appIcons;
  return (
    <aside className="sidebar">
      <div className="brand-lockup"><Image name={isHome ? "home-brand-leaf.svg" : "app-brand-leaf.svg"} className="brand-leaf" /><span>じょぶはん</span></div>
      <div className="sidebar-divider" />
      <nav className="side-navigation" aria-label="メインメニュー">
        {navItems.map((item) => {
          const active = item.screen === screen || (screen === "report" && item.screen === "history");
          return <button key={item.screen} type="button" className={"nav-item" + (active ? " is-active" : "")} aria-current={active ? "page" : undefined} onClick={() => onNavigate(item.screen)}>
            <Image name={icons[item.icon]} className="nav-icon" /><span>{item.label}</span>
          </button>;
        })}
      </nav>
      <section className="weekly-progress" aria-label="今週の練習状況">
        <Image name={isHome ? "home-progress-leaf.svg" : "app-progress-leaf.svg"} className="progress-leaf" />
        <p className="progress-message">継続が<br />自信につながる</p>
        <div className="progress-track"><span /></div>
        <p className="progress-caption">今週の練習 3 / 5 回</p>
      </section>
    </aside>
  );
}

function TopBar({ title, canGoBack, canGoForward, goBack, goForward }: {
  title: string; canGoBack: boolean; canGoForward: boolean; goBack: () => void; goForward: () => void;
}) {
  return <header className="app-topbar">
    <div className="topbar-history-controls" aria-label="画面履歴">
      <button type="button" aria-label="前の画面へ" title="前の画面へ" disabled={!canGoBack} onClick={goBack}>←</button>
      <button type="button" aria-label="次の画面へ" title="次の画面へ" disabled={!canGoForward} onClick={goForward}>→</button>
    </div>
    <div className="topbar-context"><Image name="app-topbar-leaf.svg" className="topbar-leaf" /><span>{title}</span></div>
    <div className="window-controls" aria-label="ウィンドウ操作">
      <button type="button" aria-label="最小化" onClick={() => void window.jobuhan?.window.minimize()}><Image name="window-minimize.svg" /></button>
      <button type="button" aria-label="最大化" onClick={() => void window.jobuhan?.window.toggleMaximize()}><Image name="window-maximize.svg" /></button>
      <button type="button" aria-label="閉じる" onClick={() => void window.jobuhan?.window.close()}><Image name="window-close.svg" /></button>
    </div>
  </header>;
}

function HomePage({ go, notify }: { go: (screen: NavScreen) => void; notify: (message: string) => void }) {
  return <section className="home-view">
    <div className="home-heading">
      <h1>伝えたいことを、自分の言葉で。</h1><span className="heading-underline" />
      <p>質問カードをきっかけに話してみましょう。<br />話した内容を記録して、あとから振り返ることができます。</p>
    </div>
    <Image name="home-brand-logo.png" alt="じょぶはん" className="home-brand-logo" />
    <div className="home-card-grid">
      <article className="home-card start-card">
        <div className="home-card-intro">
          <div className="home-icon-disc"><Image name="home-microphone.svg" className="home-card-icon" /></div>
          <div className="home-card-copy"><h2>練習を始める</h2><p>一人でも、誰かと一緒でも<br />自分のペースで練習できます。</p></div>
          <Image name="home-arrow.svg" className="card-arrow" />
        </div>
        <div className="start-actions">
          <button className="button button-primary" type="button" onClick={() => go("solo")}><Image name="home-person.svg" />一人で始める</button>
          <button className="button button-outline" type="button" onClick={() => go("partner")}><Image name="home-people.svg" />誰かと始める</button>
        </div>
      </article>
      <article className="home-card documents-card">
        <div className="home-card-intro">
          <div className="home-icon-disc documents-disc"><Image name="home-document.svg" className="home-card-icon" /></div>
          <div className="home-card-copy"><h2>履歴書・ESを登録</h2><p>経験や志望内容を登録すると、<br />振り返りに役立てられます。</p></div>
          <Image name="home-arrow.svg" className="card-arrow" />
        </div>
        <button className="button button-document" type="button" onClick={() => notify("履歴書・ESの登録機能は準備中です。書類はまだ保存・送信されません。")}><Image name="home-document-outline.svg" />書類を登録する</button>
      </article>
    </div>
    <div className="home-decoration" aria-hidden="true">
      <Image name="home-wave-back.svg" className="wave wave-back" /><Image name="home-wave-front.svg" className="wave wave-front" />
      <Image name="home-foliage-left.svg" className="foliage foliage-left" /><Image name="home-foliage-right.svg" className="foliage foliage-right" />
    </div>
  </section>;
}

function PracticePage({ mode, question, setQuestion, answer, setAnswer, finish, hint, notify }: {
  mode: Mode; question: number; setQuestion: (index: number) => void; answer: string;
  setAnswer: (value: string) => void; finish: () => void; hint: () => void; notify: (message: string) => void;
}) {
  const isSolo = mode === "solo";
  return <section className="practice-view">
    <header className="page-heading practice-heading"><h1>{isSolo ? "一人で面接練習" : "誰かと面接練習"}</h1>
      <p>{isSolo ? "質問カードを見ながら練習しましょう。回答を記録して、あとで振り返ることができます。" : "面接相手と対話しながら、実践形式で練習しましょう。回答を記録して、あとで振り返ることができます。"}</p>
    </header>
    <section className="practice-canvas" aria-label="練習する質問"><div className="canvas-inner">
      <div className="question-card"><span>今回の質問</span><strong>{questions[question]}</strong></div>
      <div className="avatar-silhouette" aria-hidden="true"><span className="avatar-head" /><span className="avatar-shoulders" /></div>
    </div></section>
    <section className="transcript-card" aria-labelledby="transcript-title">
      <div className="transcript-header"><div className="transcript-title"><Image name="transcript-document.svg" /><h2 id="transcript-title">あなたの回答（文字起こし欄・編集できます）</h2></div>
        <div className="record-status"><span className="status-dot" /><span>サンプル表示</span><time>00:32</time></div>
      </div>
      <div className="transcript-panel"><Image name="waveform.svg" className="waveform" /><textarea aria-label="あなたの回答" value={answer} onChange={(event) => setAnswer(event.currentTarget.value)} /></div>
      <div className="practice-controls">
        <button className="control-button control-primary" type="button" onClick={() => notify("音声の録音・文字起こしはまだ利用できません。回答欄には直接入力できます。")}><span className="record-icon"><i /></span>録音を開始</button>
        <button className="control-button" type="button" onClick={() => notify("録音機能の実装後に利用できます.")}><Image name="pause.svg" />一時停止</button>
        <button className="control-button control-next" type="button" onClick={() => setQuestion((question + 1) % questions.length)}><Image name="next.svg" />次の質問</button>
        <button className="control-button" type="button" onClick={finish}><Image name="end.svg" />練習を終了</button>
      </div>
    </section>
    <div className="practice-actions">
      <button className="action-card" type="button" onClick={hint}><span className="action-icon help-icon">？</span><span><strong>ヒントを見る</strong><small>詰まったときの考え方を整理</small></span></button>
      <button className="action-card summary-action" type="button" onClick={finish}><span className="action-icon summary-icon"><i /><i /><i /></span><span><strong>振り返りを開く</strong><small>回答内容をあとから確認</small></span></button>
    </div>
    {!isSolo && <p className="privacy-note">このアプリが扱う音声は練習する本人のマイク入力のみです。相手の音声は取得しません。</p>}
  </section>;
}

function HistoryPage({ filter, setFilter, newest, setNewest, open }: {
  filter: Filter; setFilter: (value: Filter) => void; newest: boolean; setNewest: (value: boolean) => void; open: (entry: LogEntry) => void;
}) {
  const entries = logs.filter((entry) => filter === "all" || entry.mode === filter);
  const ordered = newest ? entries : [...entries].reverse();
  return <section className="history-view">
    <header className="page-heading history-heading"><h1>振り返り履歴</h1><p>これまでの練習を見返して、次の面接に活かしましょう。</p></header>
    <div className="history-toolbar"><div className="history-filters" role="group" aria-label="練習形式">
      {([["all", "すべて"], ["solo", "一人"], ["partner", "誰かと"]] as [Filter, string][]).map(([value, label]) => <button className={"filter-button" + (filter === value ? " selected" : "")} key={value} type="button" onClick={() => setFilter(value)}>{label}</button>)}
    </div><div className="history-meta"><button className="sort-button" type="button" onClick={() => setNewest(!newest)}><Image name="history-sort.svg" />{newest ? "日付の新しい順" : "日付の古い順"}</button><span>全 {entries.length} 件</span></div></div>
    <div className="history-list">{ordered.map((entry, index) => <button className={"history-record" + (index === 0 ? " featured" : "")} key={entry.id} type="button" onClick={() => open(entry)}>
      <span className="record-person"><time>{entry.date}</time><span className={"mode-badge " + entry.mode}>{entry.mode === "solo" ? "一人" : "誰かと"}</span><span className="record-partner"><span className="partner-avatar">{entry.initial}</span><span><strong>{entry.partner}</strong><small>{entry.mode === "solo" ? "一人練習" : "練習相手"}</small></span></span></span>
      <span className="record-answer"><small>質問</small><strong>{entry.question}</strong><span className="answer-log-label"><Image name="history-log.svg" />回答ログ</span><span className="answer-excerpt">{entry.answer}</span></span>
      <span className="record-score"><small>参考値</small><span><strong>{entry.score}</strong><small>/ 100 点</small></span><span className="score-track"><i style={{ width: entry.score + "%" }} /></span><b>詳細を見る →</b></span>
    </button>)}{ordered.length === 0 && <p className="empty-history">この形式の練習ログはまだありません。</p>}</div>
  </section>;
}

const reportRows: Record<Exclude<ReportTab, "transcript">, { time: string; text: string }[]> = {
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
const reportTabs: [ReportTab, string][] = [
  ["points", "重要なポイント"],
  ["hints", "改善のヒント"],
  ["transcript", "全体の書き起こし"],
];

function ReportPage({ entry, tab, setTab }: { entry: LogEntry; tab: ReportTab; setTab: (value: ReportTab) => void }) {
  const rows = tab === "transcript"
    ? [{ time: "回答", text: entry.answer || "回答内容はありません。" }]
    : reportRows[tab];
  return <section className="report-view">
    <header className="page-heading report-heading"><div><h1>振り返りレポート</h1><p>練習ログを見返して、次の面接に活かしましょう。</p></div>
      <div className="report-date"><span>{entry.date}</span><span>{entry.mode === "solo" ? "一人で練習" : "練習相手：" + entry.partner}</span></div></header>
    <div className="report-top-grid">
      <article className="report-card overall-card"><h2>総合スコア（サンプル）</h2><div className="score-ring"><Image name="report-score-ring.svg" /><strong>{entry.score}</strong><small>/ 100</small></div><div className="overall-message"><strong>よくできています！</strong><p>話した内容を振り返るための参考情報です。</p></div></article>
      <article className="report-card breakdown-card"><h2>振り返りの内訳（参考）</h2>
        {[["結論の明確さ", 16], ["具体例の充実度", 15], ["話し方", 12], ["伝えた内容", 17], ["質問への答え方", 18]].map(([label, value], index) => <div className="breakdown-row" key={label}><span>{label}</span><span className="breakdown-track"><i className={index === 2 ? "amber" : ""} style={{ width: (Number(value) / 20) * 100 + "%" }} /></span><strong>{value}</strong></div>)}
      </article>
    </div>
    <div className="report-middle-grid">
      <article className="report-card metrics-card"><h2>話し方の指標（サンプル）</h2><div className="metric-grid">
        <div className="metric-tile"><strong>話速</strong><span className="metric-tag amber-tag">やや速め</span><p>192文字/分。少し落ち着いて話すと伝わりやすくなります。</p></div>
        <div className="metric-tile"><strong>フィラー</strong><span className="metric-tag amber-tag">えー 3回</span><p>「えー」「あのー」がありました。必要なら箇所を確認しましょう。</p></div>
        <div className="metric-tile"><strong>無音</strong><span className="metric-tag">2回</span><p>適切な間の取り方。落ち着いて話せています。</p></div>
      </div></article>
      <article className="report-card feedback-card"><h2>振り返りポイント</h2><div className="good-points"><strong>✓ 良かった点</strong><p>経験を交えて説明できていました。自分の言葉で伝えられています。</p></div><div className="next-points"><strong>次回の確認ポイント</strong><p>成果や数字を具体的に伝える / 経験と次の挑戦をつなげる</p></div></article>
    </div>
    <article className="report-card speech-card"><div className="speech-header"><h2>発話内容の振り返り</h2><div className="report-tabs" role="tablist" aria-label="振り返り表示">
      {reportTabs.map(([value, label], index) => <button id={"report-tab-" + value} aria-controls="report-tabpanel" tabIndex={tab === value ? 0 : -1} className={tab === value ? "active" : ""} key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)} onKeyDown={(event) => { const key = event.key; if (key !== "ArrowLeft" && key !== "ArrowRight" && key !== "Home" && key !== "End") return; event.preventDefault(); const nextIndex = key === "Home" ? 0 : key === "End" ? reportTabs.length - 1 : (index + (key === "ArrowRight" ? 1 : -1) + reportTabs.length) % reportTabs.length; const nextTab = reportTabs[nextIndex][0]; setTab(nextTab); document.getElementById("report-tab-" + nextTab)?.focus(); }}>{label}</button>)}
    </div></div><div className="transcript-rows" id="report-tabpanel" role="tabpanel" aria-labelledby={"report-tab-" + tab} tabIndex={0}>{rows.map((row) => <div className={"transcript-row" + (tab === "transcript" ? " transcript-full" : "")} key={row.time || "answer"}>{row.time && (tab === "transcript" ? <span>{row.time}</span> : <time>{row.time}</time>)}<p>{row.text}</p></div>)}</div></article>
    <p className="report-disclaimer">サンプル表示です。今回の回答は保存・評価されていません。練習の合否、適性、人格を判定するものではありません。</p>
  </section>;
}

function SettingTitle({ icon, title, description }: { icon: string; title: string; description: string }) {
  return <div className="setting-title"><span className="setting-icon">{icon}</span><h2>{title}</h2><p>{description}</p></div>;
}

function SettingsPage({ accent, setAccent, notifications, toggleNotification, notify }: {
  accent: string; setAccent: (color: string) => void; notifications: boolean[];
  toggleNotification: (index: number) => void; notify: (message: string) => void;
}) {
  return <section className="settings-view"><header className="page-heading settings-heading"><h1>設定</h1><p>音声デバイスやカラー、アカウント情報を管理できます。</p></header>
    <div className="settings-grid">
      <article className="setting-card"><SettingTitle icon="音" title="スピーカー" description="音声の出力先を選択します" /><div className="setting-controls"><button type="button" className="device-select" onClick={() => notify("音声デバイスの選択機能は準備中です。")}>既定のスピーカー <span>⌄</span></button><button type="button" className="setting-button" onClick={() => notify("スピーカーのテスト機能は準備中です。")}>テスト再生</button></div></article>
      <article className="setting-card"><SettingTitle icon="声" title="マイク" description="音声入力に使うデバイスを選択します" /><div className="setting-controls"><button type="button" className="device-select" onClick={() => notify("音声デバイスの選択機能は準備中です。")}>既定のマイク <span>⌄</span></button><button type="button" className="setting-button" onClick={() => notify("マイクのテスト機能は準備中です。")}>入力をテスト</button></div></article>
      <article className="setting-card"><SettingTitle icon="色" title="カラー" description="画面のアクセントカラーを選びます" /><div className="color-picker">{accentColors.map((color) => <button className={"color-choice" + (accent === color.value ? " chosen" : "")} key={color.value} type="button" aria-label={color.label} aria-pressed={accent === color.value} onClick={() => setAccent(color.value)}><Image name={color.image} /></button>)}<strong>{accentColors.find((color) => color.value === accent)?.label ?? "フォレスト"}</strong></div></article>
      <article className="setting-card"><SettingTitle icon="ID" title="アカウント" description="ログイン情報を確認・変更できます" /><div className="account-panel"><span>登録情報・ログイン方法</span><button type="button" className="setting-button" onClick={() => notify("アカウント機能は準備中です。")}>アカウント管理</button></div></article>
      <article className="setting-card"><SettingTitle icon="人" title="プロフィール" description="表示名やプロフィール画像を編集できます" /><div className="profile-panel"><Image name="setting-profile.svg" /><span><strong>プロフィール情報</strong><small>名前・画像・自己紹介</small></span><button type="button" className="setting-button" onClick={() => notify("プロフィール編集機能は準備中です。")}>プロフィール編集</button></div></article>
      <article className="setting-card notification-card"><SettingTitle icon="!" title="通知" description="受け取りたい通知を選択します" /><div className="notification-list">{["面接練習のリマインダー", "練習レポートのお知らせ", "サービスからのお知らせ"].map((label, index) => <label className="notification-row" key={label}><span>{label}</span><button className={"toggle-button" + (notifications[index] ? " on" : "")} type="button" role="switch" aria-checked={notifications[index]} aria-label={label} onClick={() => toggleNotification(index)}><span /></button></label>)}</div></article>
    </div>
  </section>;
}

function HintDialog({ close }: { close: () => void }) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const backdrop = backdropRef.current;
    const background = Array.from(backdrop?.parentElement?.children ?? [])
      .filter((element): element is HTMLElement => element instanceof HTMLElement && element !== backdrop);
    const previousInert = background.map((element) => element.inert);

    background.forEach((element) => { element.inert = true; });
    closeButtonRef.current?.focus();

    return () => {
      background.forEach((element, index) => { element.inert = previousInert[index]; });
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (!first || !last) {
      event.preventDefault();
      event.currentTarget.focus();
    } else if (event.shiftKey && (active === first || active === event.currentTarget || !event.currentTarget.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || active === event.currentTarget || !event.currentTarget.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  };

  return <div ref={backdropRef} className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><section className="hint-dialog" role="dialog" aria-modal="true" aria-labelledby="hint-title" tabIndex={-1} onKeyDown={handleKeyDown} onMouseDown={(event) => { event.stopPropagation(); if (!(event.target instanceof Element && event.target.closest("button, a[href], input, select, textarea"))) event.currentTarget.focus(); }}>
    <button ref={closeButtonRef} className="dialog-close" type="button" onClick={close} aria-label="閉じる">×</button><span className="dialog-kicker">話を組み立てるヒント</span><h2 id="hint-title">経験を、自分の言葉で整理する</h2><p>答えを決める必要はありません。話しやすい順番を見つけるための目安です。</p>
    <ol><li><strong>結論</strong> まず一番伝えたいことを短く話す</li><li><strong>理由</strong> そう考えるようになった背景を添える</li><li><strong>具体例</strong> 自分がしたことや気づきを一つ紹介する</li><li><strong>まとめ</strong> 経験を次にどう活かしたいかにつなげる</li></ol>
    <button className="button button-primary dialog-done" type="button" onClick={close}>練習に戻る</button>
  </section></div>;
}

function App() {
  const [navigation, setNavigation] = useState<{ entries: NavigationEntry[]; position: number }>({ entries: [{ screen: "home" }], position: 0 });
  const currentRoute = navigation.entries[navigation.position];
  const screen = currentRoute.screen;
  const [notice, setNotice] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [question, setQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<Mode, Record<number, string>>>({ solo: { 0: sampleAnswer }, partner: { 0: sampleAnswer } });
  const [filter, setFilter] = useState<Filter>("all");
  const [newest, setNewest] = useState(true);
  const [accent, setAccent] = useState("#1e7149");
  const [notifications, setNotifications] = useState([true, true, false]);
  const selectedAccent = accentColors.find((color) => color.value === accent) ?? accentColors[0];
  const accentProperties = {
    "--accent": accent,
    "--accent-text": selectedAccent.text,
    "--accent-on": selectedAccent.on,
  } as CSSProperties & Record<"--accent" | "--accent-text" | "--accent-on", string>;
  const notify = (message: string) => setNotice(message);
  const toggleNotification = (index: number) => setNotifications((current) => current.map((value, item) => item === index ? !value : value));
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
      partner: mode === "solo" ? "一人練習" : "サンプル相手",
      initial: mode === "solo" ? "AI" : "練",
      question: questions[question],
      answer: answers[mode][question] ?? "",
    };
    goTo("report", entry);
  };
  const openReport = (entry: LogEntry) => goTo("report", entry);
  return <div className="app-frame" style={accentProperties}>
    <Sidebar screen={screen} onNavigate={navigate} /><div className="app-main"><TopBar title={titles[screen]} canGoBack={navigation.position > 0} canGoForward={navigation.position < navigation.entries.length - 1} goBack={() => moveNavigation(-1)} goForward={() => moveNavigation(1)} />
      <main className={"app-content screen-" + screen}>
        {screen === "home" && <HomePage go={navigate} notify={notify} />}
        {(screen === "solo" || screen === "partner") && <PracticePage mode={screen} question={question} setQuestion={setQuestion} answer={answers[screen][question] ?? ""} setAnswer={(value) => setAnswers((current) => ({ ...current, [screen]: { ...current[screen], [question]: value } }))} finish={finish} hint={() => setShowHint(true)} notify={notify} />}
        {screen === "history" && <HistoryPage filter={filter} setFilter={setFilter} newest={newest} setNewest={setNewest} open={openReport} />}
        {screen === "report" && <ReportPage entry={currentRoute.report?.entry ?? logs[0]} tab={currentRoute.report?.tab ?? "points"} setTab={setReportTab} />}
        {screen === "settings" && <SettingsPage accent={accent} setAccent={setAccent} notifications={notifications} toggleNotification={toggleNotification} notify={notify} />}
      </main>
    </div>
    {notice && <div className="status-toast" role="status"><span>{notice}</span><button type="button" aria-label="閉じる" onClick={() => setNotice("")}>×</button></div>}
    {showHint && <HintDialog close={() => setShowHint(false)} />}
  </div>;
}

export default App;
