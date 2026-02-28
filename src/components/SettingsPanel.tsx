import { useState, useCallback } from "react";
import { type AppConfig, saveConfig } from "../lib/config";
import ModelTab from "./settings/ModelTab";
import ConnectionTab from "./settings/ConnectionTab";
import AppearanceTab from "./settings/AppearanceTab";
import AboutTab from "./settings/AboutTab";
import "../styles/settings.css";

type TabId = "model" | "connection" | "appearance" | "about";

interface TabDef {
  id: TabId;
  icon: string;
  label: string;
}

const TABS: TabDef[] = [
  { id: "model", icon: "📦", label: "模型" },
  { id: "connection", icon: "🔗", label: "连接" },
  { id: "appearance", icon: "🎨", label: "外观" },
  { id: "about", icon: "ℹ️", label: "关于" },
];

interface Props {
  config: AppConfig;
  onConfigUpdate: (config: AppConfig) => void;
  onClose: () => void;
}

export default function SettingsPanel({ config, onConfigUpdate, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("model");
  const [saving, setSaving] = useState(false);

  const updateConfig = useCallback(
    async (patch: Partial<AppConfig>) => {
      const updated = { ...config, ...patch };
      onConfigUpdate(updated);
      setSaving(true);
      try {
        await saveConfig(updated);
      } catch (err) {
        console.error("[Settings] Failed to save config:", err);
      } finally {
        setSaving(false);
      }
    },
    [config, onConfigUpdate],
  );

  return (
    <div className="settings-panel">
      <nav className="settings-sidebar">
        <div className="settings-logo">
          <span className="settings-logo-icon">🎭</span>
          <span className="settings-logo-text">ClawBody</span>
        </div>

        <div className="settings-nav">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`settings-nav-item${activeTab === tab.id ? " active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="nav-icon">{tab.icon}</span>
              <span className="nav-label">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="settings-sidebar-footer">
          {saving && <span className="save-indicator">💾 Saving...</span>}
          <button className="btn-close" onClick={onClose}>✕ Close</button>
        </div>
      </nav>

      <main className="settings-content">
        {activeTab === "model" && (
          <ModelTab config={config} updateConfig={updateConfig} />
        )}
        {activeTab === "connection" && (
          <ConnectionTab config={config} updateConfig={updateConfig} />
        )}
        {activeTab === "appearance" && (
          <AppearanceTab config={config} updateConfig={updateConfig} />
        )}
        {activeTab === "about" && <AboutTab />}
      </main>
    </div>
  );
}
