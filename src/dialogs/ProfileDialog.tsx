import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import type { Profile } from "../app/types";
import { Icon } from "../components/Icon";

export function ProfileDialog({ profile, save, close }: { profile: Profile; save: (profile: Profile) => void; close: () => void }) {
  const [name, setName] = useState(profile.name);
  const [bio, setBio] = useState(profile.bio);
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

  return <div ref={backdropRef} className="dialog-backdrop profile-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <form className="profile-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-title" onSubmit={(event) => { event.preventDefault(); const cleanName = name.trim(); if (cleanName) save({ name: cleanName, bio: bio.trim() }); }} onKeyDown={handleKeyDown}>
      <button ref={closeButtonRef} className="dialog-close" type="button" onClick={close} aria-label="閉じる"><Icon name="close" /></button>
      <span className="dialog-kicker">アカウント設定</span><h2 id="profile-title">プロフィールを編集</h2>
      <label className="profile-field">表示名<input required maxLength={40} value={name} onChange={(event) => setName(event.currentTarget.value)} /></label>
      <label className="profile-field">自己紹介<textarea maxLength={240} rows={4} value={bio} onChange={(event) => setBio(event.currentTarget.value)} /></label>
      <p className="profile-help">入力した内容はこの端末に保存されます。</p>
      <div className="profile-dialog-actions"><button className="setting-button" type="button" onClick={close}>キャンセル</button><button className="button button-primary" type="submit">保存する</button></div>
    </form>
  </div>;
}
