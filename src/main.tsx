import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import SettingsPanel from "./components/SettingsPanel";
import "./styles/global.css";

const isSettings = window.location.search.includes("settings=1") ||
                   window.location.hash.includes("settings");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {isSettings ? <SettingsPanel /> : <App />}
  </React.StrictMode>,
);
