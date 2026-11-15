import { useEffect, useRef } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

export function HintDialog({ close }: { close: () => void }) {
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
