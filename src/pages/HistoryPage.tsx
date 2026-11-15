import { logs } from "../app/data";
import type { LogEntry } from "../app/types";
import { Image } from "../components/Image";

export function HistoryPage({ newest, setNewest, open }: {
  newest: boolean; setNewest: (value: boolean) => void; open: (entry: LogEntry) => void;
}) {
  const ordered = newest ? logs : [...logs].reverse();
  return <section className="history-view">
    <header className="page-heading history-heading"><h1>振り返り履歴</h1><p>これまでの練習を見返して、次の面接に活かしましょう。</p></header>
    <div className="history-toolbar"><div className="history-meta"><button className="sort-button" type="button" onClick={() => setNewest(!newest)}><Image name="history-sort.svg" />{newest ? "日付の新しい順" : "日付の古い順"}</button><span>全 {ordered.length} 件</span></div></div>
    <div className="history-list">{ordered.map((entry, index) => <button className={"history-record" + (index === 0 ? " featured" : "")} key={entry.id} type="button" onClick={() => open(entry)}>
      <span className="record-person"><time>{entry.date}</time><span className="record-partner"><span className="partner-avatar">{entry.initial}</span><span><strong>{entry.partner}</strong></span></span></span>
      <span className="record-answer"><small>質問</small><strong>{entry.question}</strong><span className="answer-log-label"><Image name="history-log.svg" />回答ログ</span><span className="answer-excerpt">{entry.answer}</span></span>
      <span className="record-score"><small>参考値</small><span><strong>{entry.score}</strong><small>/ 100 点</small></span><span className="score-track"><i style={{ width: entry.score + "%" }} /></span><b>詳細を見る →</b></span>
    </button>)}{ordered.length === 0 && <p className="empty-history">練習ログはまだありません。</p>}</div>
  </section>;
}
