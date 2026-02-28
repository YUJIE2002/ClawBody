import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { listen } from "@tauri-apps/api/event";
import VRMViewer from "./components/VRMViewer";
import ContextMenu, { type MenuItem } from "./components/ContextMenu";
import { useOpenClaw } from "./hooks/useOpenClaw";
import {
  type AppConfig,
  loadConfig,
  resolveModelUrl,
  openSettings,
  toggleVisibility,
  toggleAlwaysOnTop,
  quitApp,
} from "./lib/config";

/**
 * ClawBody — Main Application
 *
 * Renders a transparent window with a VRM 3D character.
 * Right-click opens a context menu for settings, visibility, etc.
 */
export default function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [modelUrl, setModelUrl] = useState("/models/default.vrm");
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const { connected, emotion, speaking } = useOpenClaw(config?.gatewayUrl);

  // Load config on mount
  useEffect(() => {
    loadConfig()
      .then((cfg) => setConfig(cfg))
      .catch((err) => console.error("[ClawBody] Failed to load config:", err));
  }, []);

  // Resolve model URL when model path changes
  useEffect(() => {
    if (config === null) return;
    let cancelled = false;
    const currentModelPath = config.modelPath;

    resolveModelUrl(currentModelPath).then((url) => {
      if (!cancelled) setModelUrl(url);
    });

    return () => {
      cancelled = true;
    };
  }, [config?.modelPath]); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply window config when config changes
  useEffect(() => {
    if (!config) return;
    const win = getCurrentWindow();
    win
      .setSize(new LogicalSize(config.windowWidth, config.windowHeight))
      .catch(() => {});
    win.setAlwaysOnTop(config.alwaysOnTop).catch(() => {});
  }, [config]);

  // Listen for config-changed events from settings window
  useEffect(() => {
    const unlisten = listen<AppConfig>("config-changed", (event) => {
      setConfig(event.payload);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Enable window dragging on left-click
  useEffect(() => {
    const appWindow = getCurrentWindow();
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (
        target.closest(".vrm-viewer") ||
        target.id === "root" ||
        target.classList.contains("drag-region")
      ) {
        appWindow.startDragging();
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  // Context menu handler — use window-level listener to catch events over canvas
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("contextmenu", handleContextMenu);
    return () => window.removeEventListener("contextmenu", handleContextMenu);
  }, []);

  const menuItems: MenuItem[] = [
    { label: "⚙️  Settings", action: () => { openSettings(); } },
    { label: "👁️  Toggle Visibility", action: () => { toggleVisibility(); } },
    { label: "📌  Toggle Always on Top", action: () => { toggleAlwaysOnTop(); } },
    { label: "❌  Quit", action: () => { quitApp(); }, danger: true },
  ];

  const opacity = config?.opacity ?? 1.0;
  const scale = config?.characterScale ?? 1.0;

  return (
    <div className="app">
      {/* Status indicator */}
      <div
        className="status-dot"
        title={connected ? "Connected to OpenClaw" : "Disconnected"}
        style={{ backgroundColor: connected ? "#4ade80" : "#f87171" }}
      />

      {/* VRM Character Viewer */}
      <div
        style={{
          opacity,
          transform: `scale(${scale})`,
          transformOrigin: "center bottom",
          width: "100%",
          height: "100%",
        }}
      >
        <VRMViewer modelUrl={modelUrl} emotion={emotion} speaking={speaking} />
      </div>

      {/* Context menu overlay */}
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
