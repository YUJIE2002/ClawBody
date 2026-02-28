/**
 * VoiceCameraTab — Settings for voice input, TTS output, and camera vision.
 */

import { useState, useEffect } from "react";
import type { AppConfig } from "../../lib/config";

interface Props {
  config: AppConfig;
  updateConfig: (patch: Partial<AppConfig>) => void;
}

export default function VoiceCameraTab({ config, updateConfig }: Props) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [sttSupported] = useState(() => {
    const win = window as unknown as Record<string, unknown>;
    return typeof win.SpeechRecognition === "function" ||
           typeof win.webkitSpeechRecognition === "function";
  });
  const [ttsSupported] = useState(() => "speechSynthesis" in window);
  const [cameraSupported] = useState(() =>
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices !== "undefined" &&
    typeof navigator.mediaDevices.getUserMedia === "function"
  );

  // Load available TTS voices
  useEffect(() => {
    if (!ttsSupported) return;

    const loadVoices = () => {
      const available = window.speechSynthesis.getVoices();
      setVoices(available);
    };

    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
    };
  }, [ttsSupported]);

  return (
    <div className="tab-content">
      <h2>语音 & 摄像头</h2>
      <p className="tab-desc">Configure voice input, speech output, and camera vision.</p>

      {/* ── Voice Input (STT) ── */}
      <div className="settings-section">
        <h3 className="section-title">🎤 Voice Input (Speech-to-Text)</h3>

        {!sttSupported && (
          <div className="warning-box">
            ⚠️ Speech recognition is not supported in this browser/webview.
            Try using Chrome or Edge.
          </div>
        )}

        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={config.voiceInputEnabled}
              disabled={!sttSupported}
              onChange={(e) => updateConfig({ voiceInputEnabled: e.target.checked })}
            />
            Enable voice input
          </label>
        </div>

        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={config.autoSendVoice}
              disabled={!config.voiceInputEnabled}
              onChange={(e) => updateConfig({ autoSendVoice: e.target.checked })}
            />
            Auto-send recognized speech
          </label>
        </div>

        <div className="form-group">
          <label>Language</label>
          <select
            className="form-select"
            value={config.sttLanguage}
            disabled={!config.voiceInputEnabled}
            onChange={(e) => updateConfig({ sttLanguage: e.target.value })}
          >
            <option value="en-US">English (US)</option>
            <option value="en-GB">English (UK)</option>
            <option value="zh-CN">中文 (简体)</option>
            <option value="zh-TW">中文 (繁體)</option>
            <option value="ja-JP">日本語</option>
            <option value="ko-KR">한국어</option>
            <option value="es-ES">Español</option>
            <option value="fr-FR">Français</option>
            <option value="de-DE">Deutsch</option>
          </select>
        </div>
      </div>

      {/* ── Voice Output (TTS) ── */}
      <div className="settings-section">
        <h3 className="section-title">🔊 Voice Output (Text-to-Speech)</h3>

        {!ttsSupported && (
          <div className="warning-box">
            ⚠️ Speech synthesis is not supported in this browser/webview.
          </div>
        )}

        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={config.voiceOutputEnabled}
              disabled={!ttsSupported}
              onChange={(e) => updateConfig({ voiceOutputEnabled: e.target.checked })}
            />
            Enable voice output (speak AI responses)
          </label>
        </div>

        <div className="form-group">
          <label>Voice</label>
          <select
            className="form-select"
            value={config.ttsVoiceName}
            disabled={!config.voiceOutputEnabled}
            onChange={(e) => updateConfig({ ttsVoiceName: e.target.value })}
          >
            <option value="">System Default</option>
            {voices.map((voice) => (
              <option key={voice.name} value={voice.name}>
                {voice.name} ({voice.lang})
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Speed: {config.ttsRate.toFixed(1)}x</label>
          <input
            type="range"
            min={50} max={200} step={10}
            value={config.ttsRate * 100}
            disabled={!config.voiceOutputEnabled}
            onChange={(e) => updateConfig({ ttsRate: Number(e.target.value) / 100 })}
          />
          <div className="range-labels"><span>0.5x</span><span>2.0x</span></div>
        </div>

        <div className="form-group">
          <label>Pitch: {config.ttsPitch.toFixed(1)}</label>
          <input
            type="range"
            min={50} max={200} step={10}
            value={config.ttsPitch * 100}
            disabled={!config.voiceOutputEnabled}
            onChange={(e) => updateConfig({ ttsPitch: Number(e.target.value) / 100 })}
          />
          <div className="range-labels"><span>0.5</span><span>2.0</span></div>
        </div>
      </div>

      {/* ── Camera ── */}
      <div className="settings-section">
        <h3 className="section-title">📷 Camera (Vision)</h3>

        {!cameraSupported && (
          <div className="warning-box">
            ⚠️ Camera access is not supported in this browser/webview.
          </div>
        )}

        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={config.cameraEnabled}
              disabled={!cameraSupported}
              onChange={(e) => updateConfig({ cameraEnabled: e.target.checked })}
            />
            Enable camera (attach frames to messages)
          </label>
        </div>

        <div className="info-box">
          <p>📌 When enabled, a camera preview will appear. Frames are captured at 320×240 JPEG
          and optionally attached to your messages so the AI can see you.</p>
        </div>
      </div>
    </div>
  );
}
