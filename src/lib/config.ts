/**
 * Config — Typed interface for app configuration stored via Tauri backend.
 *
 * All persistence goes through Rust commands; the frontend never
 * touches the filesystem directly.
 */

import { invoke } from "@tauri-apps/api/core";

export interface AppConfig {
  modelPath: string;
  gatewayUrl: string;
  gatewayToken: string;
  windowWidth: number;
  windowHeight: number;
  opacity: number;
  alwaysOnTop: boolean;
  characterScale: number;
  autoReconnect: boolean;
  // Voice & Camera
  voiceInputEnabled: boolean;
  voiceOutputEnabled: boolean;
  cameraEnabled: boolean;
  ttsVoiceName: string;
  ttsRate: number;
  ttsPitch: number;
  sttLanguage: string;
  autoSendVoice: boolean;
}

export const DEFAULT_CONFIG: AppConfig = {
  modelPath: "",
  gatewayUrl: "ws://localhost:18789",
  gatewayToken: "",
  windowWidth: 400,
  windowHeight: 600,
  opacity: 1.0,
  alwaysOnTop: true,
  characterScale: 1.0,
  autoReconnect: true,
  // Voice & Camera defaults
  voiceInputEnabled: false,
  voiceOutputEnabled: false,
  cameraEnabled: false,
  ttsVoiceName: "",
  ttsRate: 1.0,
  ttsPitch: 1.0,
  sttLanguage: "en-US",
  autoSendVoice: true,
};

export async function loadConfig(): Promise<AppConfig> {
  return invoke<AppConfig>("get_config");
}

export async function saveConfig(config: AppConfig): Promise<void> {
  return invoke("save_config", { config });
}

export async function copyModel(sourcePath: string): Promise<string> {
  return invoke<string>("copy_model", { sourcePath });
}

export async function listModels(): Promise<string[]> {
  return invoke<string[]>("list_models");
}

export async function deleteModel(filename: string): Promise<void> {
  return invoke("delete_model", { filename });
}

/**
 * Load a model file from the app data directory as a Blob URL.
 * Returns a URL suitable for Three.js GLTFLoader.
 */
export async function resolveModelUrl(modelPath: string): Promise<string> {
  if (!modelPath) return "/models/default.vrm";

  try {
    const data: ArrayBuffer = await invoke("read_model_file", {
      filename: modelPath,
    });
    const blob = new Blob([data], { type: "application/octet-stream" });
    return URL.createObjectURL(blob);
  } catch (err) {
    console.warn("[ClawBody] Failed to load custom model:", err);
    return "/models/default.vrm";
  }
}

export async function toggleVisibility(): Promise<void> {
  return invoke("toggle_visibility");
}
