import { useState, useEffect, useCallback } from "react";
import { emit } from "@tauri-apps/api/event";
import { type AppConfig, loadConfig, saveConfig, DEFAULT_CONFIG } from "../lib/config";
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

/**
 * SettingsPanel — Main settings dashboard rendered in the settings window.
 * Left sidebar with tabs, right content area.
 */
export default function SettingsPanel() {
  const [activeTab, setActiveTab] = useState<TabId>("model");
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load config on mount
  useEffect(() => {
    loadConfig()
      .then((cfg) => setConfig(cfg))
      .catch((err) => console.error("[Settings] Failed to load config:", err))
      .finally(() => setLoading(false));
  }, []);

  // Save config and notify main window
  const handleSave = useCallback(
    async (newConfig: AppConfig) => {
      setConfig(newConfig);
      setSaving(true);
      try {
        await saveConfig(newConfig);
        await emit("config-changed", newConfig);
      } catch (err) {
        console.error("[Settings] Failed to save config:", err);
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  // Update a single config field
  const updateConfig = useCallback(
    (patch: Partial<AppConfig>) => {
      const updated = { ...config, ...patch };
      handleSave(updated);
    },
    [config, handleSave],
  );

  if (loading) {
    return (
      <div className="settings-panel">
        <div className="settings-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="settings-panel">
      {/* Sidebar */}
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
          {saving && <span className="save-indicator">Saving...</span>}
          <span className="version-label">v0.1.0</span>
        </div>
      </nav>

      {/* Content */}
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
