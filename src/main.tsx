import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App";
import SettingsPanel from "./components/SettingsPanel";
import "./styles/global.css";

const isSettings = getCurrentWindow().label === "settings";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {isSettings ? <SettingsPanel /> : <App />}
  </React.StrictMode>,
);
