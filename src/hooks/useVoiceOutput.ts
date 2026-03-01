/**
 * useVoiceOutput — Text-to-Speech hook with lip sync timing
 *
 * Uses the built-in Web Speech API (SpeechSynthesis) for free, offline TTS.
 * Emits mouth open/close events for driving VRM lip sync via blend shapes.
 *
 * Lip sync approach: word boundary events from SpeechSynthesis drive
 * mouth shape changes. Between boundaries, we oscillate the mouth open
 * amount using character-based phoneme estimation.
 */

import { useState, useRef, useCallback, useEffect } from "react";

/** Mouth viseme — maps to VRM blend shape names */
export type Viseme = "aa" | "ih" | "ou" | "ee" | "oh" | "closed";

/** Callback for lip sync: receives mouth open amount (0-1) and current viseme */
export type LipSyncCallback = (mouthOpen: number, viseme: Viseme) => void;

export interface UseVoiceOutputOptions {
  /** Called each animation frame during speech with mouth open amount */
  onLipSync?: LipSyncCallback;
  /** Preferred voice name (partial match) */
  voiceName?: string;
  /** Speech rate (0.5 - 2.0, default 1.0) */
  rate?: number;
  /** Speech pitch (0.5 - 2.0, default 1.0) */
  pitch?: number;
  /** Language code (default: "en-US") */
  lang?: string;
}

export interface UseVoiceOutputReturn {
  /** Whether the browser supports speech synthesis */
  supported: boolean;
  /** Whether currently speaking */
  speaking: boolean;
  /** Speak the given text */
  speak: (text: string) => void;
  /** Stop speaking immediately */
  stop: () => void;
  /** Current mouth open amount (0-1), for direct binding */
  mouthOpen: number;
  /** List available voices */
  getVoices: () => SpeechSynthesisVoice[];
}

/** Viseme intensity — how open the mouth should be for each viseme */
const VISEME_INTENSITY: Record<Viseme, number> = {
  aa: 0.7,
  ih: 0.35,
  ou: 0.5,
  ee: 0.3,
  oh: 0.55,
  closed: 0.0,
};

/**
 * Phoneme estimation from characters.
 * Supports Latin alphabets + CJK characters.
 */
function charToViseme(char: string): Viseme {
  const code = char.charCodeAt(0);

  // CJK characters (Chinese/Japanese/Korean) — most have open mouth sounds
  if (code >= 0x4e00 && code <= 0x9fff) {
    // Rough distribution for Chinese speech
    const hash = code % 5;
    return (["aa", "oh", "ee", "ih", "ou"] as Viseme[])[hash];
  }

  // Hiragana/Katakana
  if ((code >= 0x3040 && code <= 0x30ff)) {
    const hash = code % 5;
    return (["aa", "ih", "ou", "ee", "oh"] as Viseme[])[hash];
  }

  const lower = char.toLowerCase();
  if ("aáàâä".includes(lower)) return "aa";
  if ("iíìîï".includes(lower)) return "ih";
  if ("uúùûü".includes(lower)) return "ou";
  if ("eéèêë".includes(lower)) return "ee";
  if ("oóòôö".includes(lower)) return "oh";
  if ("bmpw".includes(lower)) return "closed";
  if ("fv".includes(lower)) return "ih";
  if ("szc".includes(lower)) return "ee";
  if ("tdnl".includes(lower)) return "ih";
  if ("kgq".includes(lower)) return "oh";
  if ("r".includes(lower)) return "aa";
  if (" ,.!?;:".includes(lower)) return "closed";
  return "aa";
}

export function useVoiceOutput(options: UseVoiceOutputOptions = {}): UseVoiceOutputReturn {
  const { onLipSync, voiceName, rate = 1.0, pitch = 1.0, lang = "en-US" } = options;
  const [speaking, setSpeaking] = useState(false);
  const [mouthOpen, setMouthOpen] = useState(0);
  const [supported] = useState(() => typeof window !== "undefined" && "speechSynthesis" in window);

  const animFrameRef = useRef<number>(0);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const speakingTextRef = useRef("");
  const charIndexRef = useRef(0);

  // Keep callbacks in refs
  const onLipSyncRef = useRef(onLipSync);
  useEffect(() => { onLipSyncRef.current = onLipSync; }, [onLipSync]);

  /** Find the best matching voice */
  const findVoice = useCallback((): SpeechSynthesisVoice | null => {
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;

    // Try matching by name
    if (voiceName) {
      const match = voices.find(v =>
        v.name.toLowerCase().includes(voiceName.toLowerCase())
      );
      if (match) return match;
    }

    // Try matching by language
    const langMatch = voices.find(v => v.lang.startsWith(lang));
    if (langMatch) return langMatch;

    // Default voice
    return voices.find(v => v.default) ?? voices[0];
  }, [voiceName, lang]);

  /** Animate lip sync during speech */
  const animateLipSync = useCallback(() => {
    const text = speakingTextRef.current;
    const idx = charIndexRef.current;

    if (!text || idx >= text.length) {
      // Still speaking but past text — gentle oscillation
      const t = performance.now() / 1000;
      const amount = (Math.sin(t * 10) + 1) * 0.25;
      setMouthOpen(amount);
      onLipSyncRef.current?.(amount, "aa");
    } else {
      // Look at current char and a small window around it for smoother transitions
      const char = text[idx];
      const viseme = charToViseme(char);
      const baseIntensity = VISEME_INTENSITY[viseme];

      // Add slight natural variation
      const jitter = (Math.sin(performance.now() * 0.015) * 0.08);
      const amount = Math.max(0, Math.min(1, baseIntensity + jitter));

      setMouthOpen(amount);
      onLipSyncRef.current?.(amount, viseme);
    }

    animFrameRef.current = requestAnimationFrame(animateLipSync);
  }, []);

  const speak = useCallback((text: string) => {
    if (!supported) return;

    // Stop any current speech
    window.speechSynthesis.cancel();
    cancelAnimationFrame(animFrameRef.current);

    // Clean text — strip markdown, emoji, etc.
    const cleanText = text
      .replace(/[*_~`#>]/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // markdown links
      .replace(/\n+/g, ". ")
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.lang = lang;

    const voice = findVoice();
    if (voice) utterance.voice = voice;

    speakingTextRef.current = cleanText;
    charIndexRef.current = 0;
    utteranceRef.current = utterance;

    utterance.onstart = () => {
      setSpeaking(true);
      animFrameRef.current = requestAnimationFrame(animateLipSync);
    };

    utterance.onboundary = (event: SpeechSynthesisEvent) => {
      // Update character index on word boundaries
      charIndexRef.current = event.charIndex;
    };

    utterance.onend = () => {
      setSpeaking(false);
      setMouthOpen(0);
      cancelAnimationFrame(animFrameRef.current);
      onLipSyncRef.current?.(0, "closed");
      utteranceRef.current = null;
      speakingTextRef.current = "";
      charIndexRef.current = 0;
    };

    utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
      // "interrupted" and "canceled" are normal when we call cancel()
      if (event.error === "interrupted" || event.error === "canceled") return;
      console.error("[ClawBody] Speech synthesis error:", event.error);
      setSpeaking(false);
      setMouthOpen(0);
      cancelAnimationFrame(animFrameRef.current);
      onLipSyncRef.current?.(0, "closed");
    };

    window.speechSynthesis.speak(utterance);
  }, [supported, rate, pitch, lang, findVoice, animateLipSync]);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    cancelAnimationFrame(animFrameRef.current);
    setSpeaking(false);
    setMouthOpen(0);
    onLipSyncRef.current?.(0, "closed");
    utteranceRef.current = null;
  }, []);

  const getVoices = useCallback((): SpeechSynthesisVoice[] => {
    if (!supported) return [];
    return window.speechSynthesis.getVoices();
  }, [supported]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  return {
    supported,
    speaking,
    speak,
    stop,
    mouthOpen,
    getVoices,
  };
}
