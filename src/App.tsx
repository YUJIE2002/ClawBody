import { useEffect, useState, useCallback, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { listen } from "@tauri-apps/api/event";
import VRMViewer from "./components/VRMViewer";
import ContextMenu, { type MenuItem } from "./components/ContextMenu";
import SettingsPanel from "./components/SettingsPanel";
import { useOpenClaw } from "./hooks/useOpenClaw";
import { useVoiceInput } from "./hooks/useVoiceInput";
import { useVoiceOutput } from "./hooks/useVoiceOutput";
import { useCamera } from "./hooks/useCamera";
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

  // Track the previous lastResponse to detect new messages
  const prevResponseRef = useRef("");

  // ── Lip sync state ──
  const [lipSyncMouth, setLipSyncMouth] = useState(0);

  // ── Voice Output (TTS) ──
  const voiceOutput = useVoiceOutput({
    onLipSync: useCallback((amount: number) => {
      setLipSyncMouth(amount);
    }, []),
    voiceName: config?.ttsVoiceName ?? "",
    rate: config?.ttsRate ?? 1.0,
    pitch: config?.ttsPitch ?? 1.0,
  });

  // ── Camera ──
  const camera = useCamera({
    width: 320,
    height: 240,
    quality: 0.6,
  });

  // ── Voice Input (STT) ──
  const handleVoiceResult = useCallback((text: string) => {
    if (!config?.autoSendVoice) {
      // If auto-send is off, put text in chat input
      setChatInput(text);
      return;
    }
    // Auto-send with optional camera attachment
    if (config?.cameraEnabled && camera.active) {
      const frame = camera.snapshot();
      if (frame) {
        void sendMessage(text, [{
          type: "image/jpeg",
          data: frame,
          name: "camera.jpg",
        }]);
        return;
      }
    }
    void sendMessage(text);
  }, [config?.autoSendVoice, config?.cameraEnabled, camera, sendMessage]);

  const voiceInput = useVoiceInput({
    onResult: handleVoiceResult,
    lang: config?.sttLanguage ?? "en-US",
    continuous: false,
  });

  // ── Auto-speak AI responses ──
  useEffect(() => {
    if (!config?.voiceOutputEnabled) return;
    if (!lastResponse || lastResponse === prevResponseRef.current) return;
    prevResponseRef.current = lastResponse;
    voiceOutput.speak(lastResponse);
  }, [lastResponse, config?.voiceOutputEnabled, voiceOutput]);

  // ── Start/stop camera based on config ──
  useEffect(() => {
    if (config?.cameraEnabled && !camera.active) {
      void camera.start();
    } else if (!config?.cameraEnabled && camera.active) {
      camera.stop();
    }
  }, [config?.cameraEnabled, camera]);

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
      if (target.closest("button, a, input, select, textarea, video, .context-menu, .settings-panel, .camera-preview")) return;
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

  const handleSendChat = () => {
    const text = chatInput.trim();
    if (!text) return;

    if (config?.cameraEnabled && camera.active) {
      const frame = camera.snapshot();
      if (frame) {
        void sendMessage(text, [{
          type: "image/jpeg",
          data: frame,
          name: "camera.jpg",
        }]);
        setChatInput("");
        return;
      }
    }
    void sendMessage(text);
    setChatInput("");
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
        <VRMViewer
          modelUrl={modelUrl}
          emotion={emotion}
          speaking={speaking || voiceOutput.speaking}
          mouthOpen={voiceOutput.speaking ? lipSyncMouth : undefined}
          pose={config?.pose}
          animation={config?.animation}
          camera={config?.camera}
        />
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

      {/* Voice input interim text */}
      {voiceInput.listening && voiceInput.interimText && (
        <div className="interim-bubble">
          🎤 {voiceInput.interimText}
        </div>
      )}

      {/* Camera preview */}
      {config?.cameraEnabled && camera.active && (
        <div className="camera-preview">
          <video
            ref={camera.videoRef}
            autoPlay
            playsInline
            muted
            style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }}
          />
        </div>
      )}

      {/* Chat input — click to type, Enter to send */}
      {connected && (
        <div className="chat-input-container">
          {/* Mic button */}
          {config?.voiceInputEnabled && voiceInput.supported && (
            <button
              className={`mic-btn${voiceInput.listening ? " listening" : ""}`}
              onClick={voiceInput.toggleListening}
              title={voiceInput.listening ? "Stop listening" : "Start listening"}
            >
              🎤
            </button>
          )}

          <input
            className="chat-input"
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && chatInput.trim()) {
                handleSendChat();
              }
            }}
            placeholder={voiceInput.listening ? "Listening..." : "Say something..."}
          />

          {/* Camera toggle */}
          {config?.cameraEnabled && (
            <button
              className={`camera-btn${camera.active ? " active" : ""}`}
              onClick={() => {
                if (camera.active) {
                  camera.stop();
                } else {
                  void camera.start();
                }
              }}
              title={camera.active ? "Camera on" : "Camera off"}
            >
              📷
            </button>
          )}

          {/* TTS stop button when speaking */}
          {voiceOutput.speaking && (
            <button
              className="tts-stop-btn"
              onClick={voiceOutput.stop}
              title="Stop speaking"
            >
              🔇
            </button>
          )}
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
