/**
 * Config — Typed interface for app configuration stored via Tauri backend.
 *
 * All persistence goes through Rust commands; the frontend never
 * touches the filesystem directly.
 */

import { invoke } from "@tauri-apps/api/core";

export interface PoseConfig {
  /** Upper arm rotation in degrees (0 = horizontal T-pose, 90 = arms down) */
  armDown: number;
  /** Lower arm bend in degrees (0 = straight, positive = bend inward) */
  elbowBend: number;
}

export interface AnimationConfig {
  /** Breathing intensity (0 = none, 100 = exaggerated) */
  breathingIntensity: number;
  /** Head sway intensity (0 = none, 100 = large sway) */
  headSwayIntensity: number;
  /** Overall animation speed multiplier (0.1 = very slow, 3.0 = fast) */
  animationSpeed: number;
}

export interface CameraConfig {
  /** Camera height (Y position, roughly the focal height in model units) */
  cameraHeight: number;
  /** Camera distance from model (Z position) */
  cameraDistance: number;
  /** Look-at target height */
  lookAtHeight: number;
  /** Field of view in degrees */
  fov: number;
}

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
  // Pose & Animation
  pose: PoseConfig;
  animation: AnimationConfig;
  camera: CameraConfig;
  // Voice & Camera
  voiceInputEnabled: boolean;
  voiceOutputEnabled: boolean;
  cameraEnabled: boolean;
  ttsVoiceName: string;
  ttsRate: number;
  ttsPitch: number;
  sttLanguage: string;
  autoSendVoice: boolean;
  // Wake word
  wakeWordEnabled: boolean;
  wakeWord: string;
  wakeWordLang: string;
}

export const DEFAULT_POSE: PoseConfig = {
  armDown: 63,
  elbowBend: 8,
};

export const DEFAULT_ANIMATION: AnimationConfig = {
  breathingIntensity: 30,
  headSwayIntensity: 30,
  animationSpeed: 1.0,
};

export const DEFAULT_CAMERA: CameraConfig = {
  cameraHeight: 1.25,
  cameraDistance: 2.8,
  lookAtHeight: 1.15,
  fov: 28,
};

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
  // Pose & Animation
  pose: { ...DEFAULT_POSE },
  animation: { ...DEFAULT_ANIMATION },
  camera: { ...DEFAULT_CAMERA },
  // Voice & Camera defaults
  voiceInputEnabled: false,
  voiceOutputEnabled: false,
  cameraEnabled: false,
  ttsVoiceName: "",
  ttsRate: 1.0,
  ttsPitch: 1.0,
  sttLanguage: "zh-CN",
  autoSendVoice: true,
  // Wake word defaults
  wakeWordEnabled: false,
  wakeWord: "顾衍",
  wakeWordLang: "zh-CN",
};

/**
 * Deep-merge loaded config with defaults so that old configs
 * missing new fields still get sensible values.
 */
function mergeWithDefaults(loaded: Partial<AppConfig>): AppConfig {
  return {
    ...DEFAULT_CONFIG,
    ...loaded,
    pose: { ...DEFAULT_CONFIG.pose, ...(loaded.pose ?? {}) },
    animation: { ...DEFAULT_CONFIG.animation, ...(loaded.animation ?? {}) },
    camera: { ...DEFAULT_CONFIG.camera, ...(loaded.camera ?? {}) },
  };
}

export async function loadConfig(): Promise<AppConfig> {
  const raw = await invoke<Partial<AppConfig>>("get_config");
  return mergeWithDefaults(raw);
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
