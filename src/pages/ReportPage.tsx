import { reportRows, reportTabs } from "../app/data";
import type { LogEntry, ReportTab } from "../app/types";

export function ReportPage({ entry, tab, setTab }: { entry: LogEntry; tab: ReportTab; setTab: (value: ReportTab) => void }) {
  const score = Math.max(0, Math.min(100, entry.score));
  const scoreCircumference = 2 * Math.PI * 51.5;
  const rows = tab === "transcript"
    ? [{ time: "回答", text: entry.answer || "回答内容はありません。" }]
    : reportRows[tab];
  return <section className="report-view">
    <header className="page-heading report-heading"><div><h1>振り返りレポート</h1><p>練習ログを見返して、次の面接に活かしましょう。</p></div>
      <div className="report-date"><span>{entry.date}</span><span>{entry.mode === "solo" ? "一人で練習" : "練習相手：" + entry.partner}</span></div></header>
    <div className="report-top-grid">
      <article className="report-card overall-card"><h2>総合スコア（サンプル）</h2><div className="score-ring" role="img" aria-label={`スコア ${score}点 / 100点`}><svg viewBox="0 0 112 112" aria-hidden="true"><circle className="score-ring-background" cx="56" cy="56" r="56" /><circle className="score-ring-track" cx="56" cy="56" r="51.5" /><circle className="score-ring-progress" cx="56" cy="56" r="51.5" strokeDasharray={scoreCircumference} strokeDashoffset={scoreCircumference * (1 - score / 100)} transform="rotate(-90 56 56)" /></svg><strong>{score}</strong><small>/ 100</small></div><div className="overall-message"><strong>よくできています！</strong><p>話した内容を振り返るための参考情報です。</p></div></article>
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
