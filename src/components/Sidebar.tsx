import type { IconName, NavScreen, Screen } from "../app/types";
import { Icon } from "./Icon";
import { Image } from "./Image";

const navItems: { screen: NavScreen; label: string; icon: IconName }[] = [
  { screen: "home", label: "ホーム", icon: "home" },
  { screen: "solo", label: "一人", icon: "user" },
  { screen: "partner", label: "誰か", icon: "users" },
  { screen: "history", label: "振り返り", icon: "chart" },
  { screen: "settings", label: "設定", icon: "settings" },
];
export function Sidebar({ screen, onNavigate }: { screen: Screen; onNavigate: (screen: NavScreen) => void }) {
  return (
    <aside className="sidebar">
      <div className="brand-lockup"><Image name="app-brand-leaf.svg" className="brand-leaf" /><span>じょぶはん</span></div>
      <div className="sidebar-divider" />
      <nav className="side-navigation" aria-label="メインメニュー">
        {navItems.map((item) => {
          const active = item.screen === screen || (screen === "report" && item.screen === "history");
          return <button key={item.screen} title={item.label} type="button" className={"nav-item" + (active ? " is-active" : "")} aria-current={active ? "page" : undefined} onClick={() => onNavigate(item.screen)}>
            {item.icon === "settings" ? <Image name="ic_fluent_settings_24_regular.png" className="nav-icon settings-nav-icon" /> : <Icon name={item.icon} className="nav-icon" />}<span>{item.label}</span>
          </button>;
        })}
      </nav>
    </aside>
  );
}
