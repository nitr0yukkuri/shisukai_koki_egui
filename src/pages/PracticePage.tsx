import { questions } from "../app/data";
import type { Mode } from "../app/types";
import { Image } from "../components/Image";

export function PracticePage({ mode, question, setQuestion, answer, setAnswer, finish, hint, notify }: {
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
