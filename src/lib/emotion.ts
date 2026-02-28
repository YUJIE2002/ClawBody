/**
 * Emotion System — Maps AI emotional states to VRM expressions
 *
 * The OpenClaw gateway sends emotion strings. This module normalizes
 * them into a finite set of VRM-compatible expression presets,
 * each with blend shape weights for the VRM model.
 */

/** Supported emotion states */
export type Emotion =
  | "neutral"
  | "happy"
  | "sad"
  | "angry"
  | "surprised"
  | "thinking"
  | "embarrassed"
  | "sleepy";

/** VRM expression weights for each emotion */
export interface EmotionPreset {
  /** VRM blend shape name → weight (0.0 - 1.0) */
  expressions: Record<string, number>;
  /** Transition duration in milliseconds */
  transitionMs: number;
}

/**
 * Predefined emotion presets mapped to VRM blend shapes.
 *
 * These use the VRMExpressionPresetName values from @pixiv/three-vrm:
 * - happy, angry, sad, relaxed, surprised
 * - aa, ih, ou, ee, oh (mouth shapes)
 * - blink, blinkLeft, blinkRight
 * - lookUp, lookDown, lookLeft, lookRight
 */
export const EMOTION_PRESETS: Record<Emotion, EmotionPreset> = {
  neutral: {
    expressions: {},
    transitionMs: 500,
  },
  happy: {
    expressions: { happy: 0.8 },
    transitionMs: 300,
  },
  sad: {
    expressions: { sad: 0.7 },
    transitionMs: 600,
  },
  angry: {
    expressions: { angry: 0.8 },
    transitionMs: 200,
  },
  surprised: {
    expressions: { surprised: 0.9 },
    transitionMs: 150,
  },
  thinking: {
    expressions: { neutral: 0.5 },
    transitionMs: 400,
  },
  embarrassed: {
    expressions: { relaxed: 0.6 },
    transitionMs: 400,
  },
  sleepy: {
    expressions: { relaxed: 0.8, blink: 0.5 },
    transitionMs: 800,
  },
};

/**
 * Maps a raw emotion string from the AI to a supported Emotion type.
 * Handles fuzzy matching for common synonyms.
 */
export function mapToEmotion(raw: string | undefined): Emotion {
  if (!raw) return "neutral";

  const normalized = raw.toLowerCase().trim();

  // Direct match
  if (normalized in EMOTION_PRESETS) {
    return normalized as Emotion;
  }

  // Fuzzy synonym mapping
  const synonyms: Record<string, Emotion> = {
    joy: "happy",
    excited: "happy",
    cheerful: "happy",
    delighted: "happy",
    upset: "sad",
    depressed: "sad",
    melancholy: "sad",
    furious: "angry",
    irritated: "angry",
    annoyed: "angry",
    shocked: "surprised",
    amazed: "surprised",
    astonished: "surprised",
    confused: "thinking",
    pondering: "thinking",
    curious: "thinking",
    shy: "embarrassed",
    flustered: "embarrassed",
    tired: "sleepy",
    drowsy: "sleepy",
    bored: "sleepy",
  };

  return synonyms[normalized] ?? "neutral";
}

/**
 * Get the VRM expression preset for an emotion.
 */
export function getPreset(emotion: Emotion): EmotionPreset {
  return EMOTION_PRESETS[emotion];
}
