/**
 * Emotion System — Extract emotions from AI text, drive VRM expressions.
 *
 * Two detection modes:
 * 1. Explicit tags: AI includes [emotion:happy] in response → stripped before display
 * 2. Heuristic: keyword/emoji scanning as fallback
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
  expressions: Record<string, number>;
  transitionMs: number;
}

export const EMOTION_PRESETS: Record<Emotion, EmotionPreset> = {
  neutral:     { expressions: {}, transitionMs: 500 },
  happy:       { expressions: { happy: 0.7 }, transitionMs: 300 },
  sad:         { expressions: { sad: 0.6 }, transitionMs: 600 },
  angry:       { expressions: { angry: 0.7 }, transitionMs: 200 },
  surprised:   { expressions: { surprised: 0.8 }, transitionMs: 150 },
  thinking:    { expressions: {}, transitionMs: 400 },
  embarrassed: { expressions: { relaxed: 0.5 }, transitionMs: 400 },
  sleepy:      { expressions: { relaxed: 0.7, blink: 0.4 }, transitionMs: 800 },
};

// ── Emotion extraction ──

/** Regex for explicit emotion tag: [emotion:happy] */
const EMOTION_TAG_RE = /\[emotion:(\w+)\]/gi;

/** Synonym map for fuzzy matching */
const SYNONYMS: Record<string, Emotion> = {
  joy: "happy", excited: "happy", cheerful: "happy", delighted: "happy",
  laugh: "happy", haha: "happy", lol: "happy",
  upset: "sad", depressed: "sad", melancholy: "sad", sorry: "sad",
  furious: "angry", irritated: "angry", annoyed: "angry", damn: "angry", fuck: "angry",
  shocked: "surprised", amazed: "surprised", astonished: "surprised", wow: "surprised", whoa: "surprised",
  confused: "thinking", pondering: "thinking", curious: "thinking", hmm: "thinking",
  shy: "embarrassed", flustered: "embarrassed", blush: "embarrassed", awkward: "embarrassed",
  tired: "sleepy", drowsy: "sleepy", bored: "sleepy", yawn: "sleepy",
};

/** Emoji → emotion */
const EMOJI_MAP: Record<string, Emotion> = {
  "😂": "happy", "🤣": "happy", "😄": "happy", "😁": "happy", "😊": "happy",
  "😀": "happy", "😃": "happy", "🥳": "happy", "😎": "happy",
  "😢": "sad", "😭": "sad", "😞": "sad", "🥺": "sad",
  "😠": "angry", "😤": "angry", "😡": "angry", "🤬": "angry",
  "😲": "surprised", "😮": "surprised", "🤯": "surprised", "😱": "surprised",
  "🤔": "thinking", "💭": "thinking",
  "😳": "embarrassed", "🙈": "embarrassed",
  "😴": "sleepy", "💤": "sleepy", "🥱": "sleepy",
};

export interface EmotionResult {
  /** Detected emotion */
  emotion: Emotion;
  /** Text with emotion tags stripped (for display/TTS) */
  cleanText: string;
}

/**
 * Extract emotion from AI response text.
 * Priority: explicit tag > emoji > keyword heuristic > neutral
 */
export function extractEmotion(text: string): EmotionResult {
  let cleanText = text;
  let emotion: Emotion = "neutral";

  // 1. Check for explicit [emotion:xxx] tags
  const tagMatch = EMOTION_TAG_RE.exec(text);
  if (tagMatch) {
    const raw = tagMatch[1].toLowerCase();
    if (raw in EMOTION_PRESETS) {
      emotion = raw as Emotion;
    } else if (raw in SYNONYMS) {
      emotion = SYNONYMS[raw];
    }
    // Strip all emotion tags from text
    cleanText = text.replace(EMOTION_TAG_RE, "").trim();
    return { emotion, cleanText };
  }

  // 2. Check for emoji
  for (const [emoji, emo] of Object.entries(EMOJI_MAP)) {
    if (text.includes(emoji)) {
      emotion = emo;
      break;
    }
  }

  if (emotion !== "neutral") {
    return { emotion, cleanText };
  }

  // 3. Keyword heuristic (check first 100 chars for speed)
  const sample = text.slice(0, 100).toLowerCase();
  for (const [keyword, emo] of Object.entries(SYNONYMS)) {
    if (sample.includes(keyword)) {
      emotion = emo;
      break;
    }
  }

  return { emotion, cleanText };
}

/**
 * Map a raw emotion string to supported Emotion type.
 */
export function mapToEmotion(raw: string | undefined): Emotion {
  if (!raw) return "neutral";
  const normalized = raw.toLowerCase().trim();
  if (normalized in EMOTION_PRESETS) return normalized as Emotion;
  return SYNONYMS[normalized] ?? "neutral";
}

export function getPreset(emotion: Emotion): EmotionPreset {
  return EMOTION_PRESETS[emotion];
}
