import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import JoinApp from "./rtc/JoinApp";
import "./styles.css";
import "./rtc/join.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("面接相手画面の表示領域が見つかりません。");
createRoot(rootElement).render(<StrictMode><JoinApp /></StrictMode>);
