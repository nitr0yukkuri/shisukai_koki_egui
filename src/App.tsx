function App() {
  const { electron, node, platform } = window.jobuhan.runtime;

  return (
    <main className="page">
      <section className="card" aria-labelledby="app-title">
        <p className="eyebrow">LOCAL DESKTOP APP</p>
        <h1 id="app-title">じょぶはん</h1>
        <p className="intro">
          開発環境が起動しました。ここから面接練習の体験を作っていきます。
        </p>

        <dl className="runtime">
          <div>
            <dt>Electron</dt>
            <dd>{electron}</dd>
          </div>
          <div>
            <dt>Node.js</dt>
            <dd>{node}</dd>
          </div>
          <div>
            <dt>Platform</dt>
            <dd>{platform}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}

export default App;
