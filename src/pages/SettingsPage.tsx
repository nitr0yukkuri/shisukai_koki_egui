import { accentColors } from "../app/data";
import type { IconName, Profile } from "../app/types";
import { Icon } from "../components/Icon";
import { Image } from "../components/Image";

function SettingTitle({ icon, title, description }: { icon: IconName; title: string; description: string }) {
  return <div className="setting-title"><span className="setting-icon"><Icon name={icon} /></span><h2>{title}</h2><p>{description}</p></div>;
}

export function SettingsPage({ accent, setAccent, notifications, toggleNotification, profile, editProfile, notify }: {
  accent: string; setAccent: (color: string) => void; notifications: boolean[];
  toggleNotification: (index: number) => void; profile: Profile; editProfile: () => void; notify: (message: string) => void;
}) {
  return <section className="settings-view"><header className="page-heading settings-heading"><h1>設定</h1><p>音声デバイスやカラー、アカウント情報を管理できます。</p></header>
    <div className="settings-grid">
      <article className="setting-card"><SettingTitle icon="speaker" title="スピーカー" description="音声の出力先を選択します" /><div className="setting-controls"><button type="button" className="device-select" onClick={() => notify("音声デバイスの選択機能は準備中です。")}>既定のスピーカー <span>⌄</span></button><button type="button" className="setting-button" onClick={() => notify("スピーカーのテスト機能は準備中です。")}>テスト再生</button></div></article>
      <article className="setting-card"><SettingTitle icon="microphone" title="マイク" description="音声入力に使うデバイスを選択します" /><div className="setting-controls"><button type="button" className="device-select" onClick={() => notify("音声デバイスの選択機能は準備中です。")}>既定のマイク <span>⌄</span></button><button type="button" className="setting-button" onClick={() => notify("マイクのテスト機能は準備中です。")}>入力をテスト</button></div></article>
      <article className="setting-card"><SettingTitle icon="palette" title="カラー" description="画面のアクセントカラーを選びます" /><div className="color-picker">{accentColors.map((color) => <button className={"color-choice" + (accent === color.value ? " chosen" : "")} key={color.value} type="button" aria-label={color.label} aria-pressed={accent === color.value} onClick={() => setAccent(color.value)}><Image name={color.image} /></button>)}<strong>{accentColors.find((color) => color.value === accent)?.label ?? "フォレスト"}</strong></div></article>
      <article className="setting-card"><SettingTitle icon="account" title="アカウント" description="ログイン情報を確認・変更できます" /><div className="account-panel"><span>登録情報・ログイン方法</span><button type="button" className="setting-button" onClick={() => notify("アカウント機能は準備中です。")}>アカウント管理</button></div></article>
      <article className="setting-card"><SettingTitle icon="profile" title="プロフィール" description="表示名や自己紹介を編集できます" /><div className="profile-panel"><span className="profile-avatar"><Icon name="profile" /></span><span><strong>{profile.name}</strong><small>{profile.bio || "自己紹介はまだありません"}</small></span><button type="button" className="setting-button" onClick={editProfile}>プロフィール編集</button></div></article>
      <article className="setting-card notification-card"><SettingTitle icon="bell" title="通知" description="受け取りたい通知を選択します" /><div className="notification-list">{["面接練習のリマインダー", "練習レポートのお知らせ", "サービスからのお知らせ"].map((label, index) => <label className="notification-row" key={label}><span>{label}</span><button className={"toggle-button" + (notifications[index] ? " on" : "")} type="button" role="switch" aria-checked={notifications[index]} aria-label={label} onClick={() => toggleNotification(index)}><span /></button></label>)}</div></article>
    </div>
  </section>;
}
