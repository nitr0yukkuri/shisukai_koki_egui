import { Image } from "./Image";

export function TopBar({ title, canGoBack, canGoForward, goBack, goForward }: {
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
