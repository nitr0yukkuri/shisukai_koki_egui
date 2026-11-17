import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

export function HintDialog({ close }: { close: () => void }) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [interviewNote, setInterviewNote] = useState(() => {
    try { return window.localStorage.getItem("jobuhan:interview-note") ?? ""; }
    catch { return ""; }
  });

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

  useEffect(() => {
    try { window.localStorage.setItem("jobuhan:interview-note", interviewNote); }
    catch { /* Keep the note available for this dialog session if storage is unavailable. */ }
  }, [interviewNote]);

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
    <button ref={closeButtonRef} className="dialog-close" type="button" onClick={close} aria-label="閉じる">×</button><span className="dialog-kicker">面接前に確認</span><h2 id="hint-title">覚えておきたいこと・ESの要点</h2><p>話す前に確認したいことや、面接で伝えたい内容をまとめておけます。</p>
    <label className="interview-note-field"><strong>自分が覚えておきたいこと</strong><textarea maxLength={500} rows={4} value={interviewNote} onChange={(event) => setInterviewNote(event.currentTarget.value)} placeholder="例：伝えたい強み、具体的な成果、面接官に聞きたいこと" /></label>
    <section className="es-extract-panel" aria-labelledby="es-extract-title"><strong id="es-extract-title">ESから抽出した内容</strong><p>ESはまだ登録されていません。登録すると、志望理由や経験などから面接で伝えたい要点を表示します。</p></section>
    <p className="interview-note-help">入力したメモはこの端末に保存されます。</p>
    <button className="button button-primary dialog-done" type="button" onClick={close}>練習に戻る</button>
  </section></div>;
}
