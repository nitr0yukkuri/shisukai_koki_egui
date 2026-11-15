import type { NavScreen } from "../app/types";
import { Image } from "../components/Image";

export function HomePage({ go, notify }: { go: (screen: NavScreen) => void; notify: (message: string) => void }) {
  return <section className="home-view">
    <div className="home-heading">
      <h1>ESに基づいた面接練習</h1><span className="heading-underline" />
      <p>質問カードをきっかけに話してみましょう。<br />話した内容を記録して、あとから振り返ることができます。</p>
    </div>
    <Image name="home-brand-logo.png" alt="じょぶはん" className="home-brand-logo" />
    <div className="home-card-grid">
      <article className="home-card start-card">
        <div className="home-card-intro">
          <div className="home-icon-disc"><Image name="home-microphone.svg" className="home-card-icon" /></div>
          <div className="home-card-copy"><h2>練習を始める</h2><p>一人でも、誰かと一緒でも<br />自分のペースで練習できます。</p></div>
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
