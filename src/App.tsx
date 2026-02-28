import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { listen } from "@tauri-apps/api/event";
import VRMViewer from "./components/VRMViewer";
import ContextMenu, { type MenuItem } from "./components/ContextMenu";
import SettingsPanel from "./components/SettingsPanel";
import { useOpenClaw } from "./hooks/useOpenClaw";
import {
  type AppConfig,
  loadConfig,
  resolveModelUrl,
  DEFAULT_CONFIG,
} from "./lib/config";

export default function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [modelUrl, setModelUrl] = useState("/models/default.vrm");
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const { connected, emotion, speaking, lastResponse, thinking, sendMessage } = useOpenClaw(
    config?.gatewayUrl,
    config?.gatewayToken,
  );
  const [chatInput, setChatInput] = useState("");

  // Load config on mount
  useEffect(() => {
    loadConfig()
      .then((cfg) => setConfig(cfg))
      .catch(() => setConfig(DEFAULT_CONFIG));
  }, []);

  // Resolve model URL when model path changes
  useEffect(() => {
    if (config === null) return;
    let cancelled = false;
    resolveModelUrl(config.modelPath).then((url) => {
      if (!cancelled) setModelUrl(url);
    });
    return () => { cancelled = true; };
  }, [config?.modelPath]);

  // Apply window config
  useEffect(() => {
    if (!config || showSettings) return;
    const win = getCurrentWindow();
    win.setSize(new LogicalSize(config.windowWidth, config.windowHeight)).catch(() => {});
    win.setAlwaysOnTop(config.alwaysOnTop).catch(() => {});
  }, [config, showSettings]);

  // Listen for config-changed events
  useEffect(() => {
    const unlisten = listen<AppConfig>("config-changed", (event) => {
      setConfig(event.payload);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  // Window dragging on left-click — only on empty areas, not on buttons/menus
  useEffect(() => {
    if (showSettings) return;
    const appWindow = getCurrentWindow();
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      // Don't drag when clicking on interactive elements
      if (target.closest("button, a, input, select, textarea, .context-menu, .settings-panel")) return;
      appWindow.startDragging();
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [showSettings]);

  // Right-click context menu (only when settings not shown)
  useEffect(() => {
    if (showSettings) return;
    const handler = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY });
    };
    document.addEventListener("contextmenu", handler, true);
    return () => document.removeEventListener("contextmenu", handler, true);
  }, [showSettings]);

  const handleOpenSettings = () => {
    // Resize window to fit settings panel
    const win = getCurrentWindow();
    win.setSize(new LogicalSize(780, 560)).catch(() => {});
    win.setAlwaysOnTop(false).catch(() => {});
    win.setDecorations(true).catch(() => {});
    setShowSettings(true);
  };

  const handleCloseSettings = () => {
    const win = getCurrentWindow();
    const w = config?.windowWidth ?? 400;
    const h = config?.windowHeight ?? 600;
    win.setSize(new LogicalSize(w, h)).catch(() => {});
    win.setAlwaysOnTop(config?.alwaysOnTop ?? true).catch(() => {});
    win.setDecorations(false).catch(() => {});
    setShowSettings(false);
  };

  const handleConfigUpdate = (newConfig: AppConfig) => {
    setConfig(newConfig);
  };

  const menuItems: MenuItem[] = [
    { label: "⚙️  Settings", action: handleOpenSettings },
    {
      label: "📌  Toggle Always on Top",
      action: () => {
        const win = getCurrentWindow();
        const next = !(config?.alwaysOnTop ?? true);
        win.setAlwaysOnTop(next).catch(() => {});
        if (config) setConfig({ ...config, alwaysOnTop: next });
      },
    },
    {
      label: "❌  Quit",
      action: () => {
        const win = getCurrentWindow();
        win.close();
      },
      danger: true,
    },
  ];

  // ── Settings mode ──
  if (showSettings) {
    return (
      <div style={{ width: "100%", height: "100vh", background: "#1a1a2e" }}>
        <SettingsPanel
          config={config ?? DEFAULT_CONFIG}
          onConfigUpdate={handleConfigUpdate}
          onClose={handleCloseSettings}
        />
      </div>
    );
  }

  // ── Character mode ──
  const opacity = config?.opacity ?? 1.0;
  const scale = config?.characterScale ?? 1.0;

  return (
    <div className="app">
      <div
        className="status-dot"
        title={connected ? "Connected to OpenClaw" : "Disconnected"}
        style={{ backgroundColor: connected ? "#4ade80" : "#f87171" }}
      />

      <div style={{
        opacity,
        transform: `scale(${scale})`,
        transformOrigin: "center bottom",
        width: "100%",
        height: "100%",
        position: "relative",
      }}>
        <VRMViewer modelUrl={modelUrl} emotion={emotion} speaking={speaking} />
        <div
          style={{
            position: "absolute", top: 0, left: 0,
            width: "100%", height: "100%", zIndex: 10,
          }}
        />
      </div>

      {/* Chat bubble — shows AI response */}
      {(lastResponse || thinking) && (
        <div className="chat-bubble">
          {thinking && !lastResponse ? "🤔 Thinking..." : lastResponse.slice(0, 200)}
          {lastResponse.length > 200 && "..."}
        </div>
      )}

      {/* Chat input — click to type, Enter to send */}
      {connected && (
        <div className="chat-input-container">
          <input
            className="chat-input"
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && chatInput.trim()) {
                sendMessage(chatInput.trim());
                setChatInput("");
              }
            }}
            placeholder="Say something..."
          />
        </div>
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={menuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
