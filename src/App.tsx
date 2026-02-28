import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import VRMViewer from "./components/VRMViewer";
import { useOpenClaw } from "./hooks/useOpenClaw";

/**
 * ClawBody — Main Application
 *
 * Renders a transparent window with a VRM 3D character.
 * The character is driven by the OpenClaw AI agent framework,
 * responding to emotions, speech, and proactive messages.
 */
export default function App() {
  const { connected, emotion, speaking } = useOpenClaw();
  const [modelUrl] = useState("/models/default.vrm");

  // Enable window dragging on the transparent area (Tauri v2 API)
  useEffect(() => {
    const appWindow = getCurrentWindow();

    const handleMouseDown = (e: MouseEvent) => {
      // Only drag when clicking on empty space (not on UI elements)
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

  return (
    <div className="app">
      {/* Status indicator — subtle dot in corner */}
      <div
        className="status-dot"
        title={connected ? "Connected to OpenClaw" : "Disconnected"}
        style={{
          backgroundColor: connected ? "#4ade80" : "#f87171",
        }}
      />

      {/* VRM Character Viewer — fills the entire window */}
      <VRMViewer
        modelUrl={modelUrl}
        emotion={emotion}
        speaking={speaking}
      />
    </div>
  );
}
