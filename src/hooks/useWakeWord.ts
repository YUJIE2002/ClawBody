/**
 * useWakeWord — Always-on wake word detection using Web Speech API.
 *
 * Runs SpeechRecognition continuously in the background, scanning
 * for the configured wake phrase. When detected, fires onWake with
 * any trailing text (so "顾衍 今天天气怎么样" fires with "今天天气怎么样").
 *
 * Architecture:
 * - IDLE: continuous recognition running, scanning all transcripts for wake word
 * - ACTIVATED: wake word detected, capture the rest of the utterance
 * - After activation, goes back to IDLE automatically
 *
 * Limitations (Web Speech API):
 * - Requires internet (audio goes to Google/cloud STT)
 * - May pause during network issues
 * - Not as reliable as Porcupine/Snowboy for pure wake word detection
 * - Good enough for desktop pet MVP
 */

import { useState, useRef, useCallback, useEffect } from "react";

// Re-use speech recognition types
interface SpeechRecognitionEvent {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionResult {
  readonly length: number;
  readonly isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}
interface SpeechRecognitionErrorEvent {
  readonly error: string;
  readonly message: string;
}
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  const win = window as unknown as Record<string, unknown>;
  return (win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null) as SpeechRecognitionConstructor | null;
}

export interface UseWakeWordOptions {
  /** Wake phrase to listen for (e.g., "顾衍", "hey yan") */
  wakeWord: string;
  /** Language for speech recognition (e.g., "zh-CN", "en-US") */
  lang?: string;
  /** Called when wake word is detected. text = everything AFTER the wake word (may be empty) */
  onWake: (text: string) => void;
  /** Called when wake word detected but waiting for command (visual feedback) */
  onActivated?: () => void;
  /** Whether wake word detection is enabled */
  enabled?: boolean;
}

export interface UseWakeWordReturn {
  /** Whether the browser supports speech recognition */
  supported: boolean;
  /** Whether currently listening for wake word */
  active: boolean;
  /** Start wake word detection */
  start: () => void;
  /** Stop wake word detection */
  stop: () => void;
  /** Temporarily pause (e.g., when voice input takes over). Auto-resumes via resume(). */
  pause: () => void;
  /** Resume after pause */
  resume: () => void;
}

export function useWakeWord(options: UseWakeWordOptions): UseWakeWordReturn {
  const { wakeWord, lang = "zh-CN", onWake, onActivated, enabled = true } = options;
  const [active, setActive] = useState(false);
  const [supported] = useState(() => getSpeechRecognition() !== null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const keepAliveRef = useRef(false);
  const onWakeRef = useRef(onWake);
  const onActivatedRef = useRef(onActivated);
  const wakeWordRef = useRef(wakeWord);
  const lastWakeTimeRef = useRef(0);

  useEffect(() => { onWakeRef.current = onWake; }, [onWake]);
  useEffect(() => { onActivatedRef.current = onActivated; }, [onActivated]);
  useEffect(() => { wakeWordRef.current = wakeWord; }, [wakeWord]);

  /**
   * Check if transcript contains the wake word.
   * Returns the text AFTER the wake word, or null if not found.
   */
  const checkWakeWord = useCallback((transcript: string): string | null => {
    const wake = wakeWordRef.current.toLowerCase().trim();
    if (!wake) return null;
    const text = transcript.toLowerCase().trim();

    // Check for wake word anywhere in the transcript
    const idx = text.indexOf(wake);
    if (idx === -1) return null;

    // Return everything after the wake word
    const after = transcript.slice(idx + wakeWordRef.current.length).trim();
    return after;
  }, []);

  const startRecognition = useCallback(() => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) return;

    // Clean up existing
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setActive(true);
      console.log("[WakeWord] Listening...");
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // Scan through new results
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;

        // Check interim results for faster wake word detection
        const afterWake = checkWakeWord(transcript);
        if (afterWake !== null) {
          // Debounce: don't fire twice within 2 seconds
          const now = Date.now();
          if (now - lastWakeTimeRef.current < 2000) continue;
          lastWakeTimeRef.current = now;

          console.log("[WakeWord] Detected! After:", afterWake);
          onActivatedRef.current?.();

          if (result.isFinal && afterWake) {
            // Wake word + command in same utterance (e.g., "顾衍 今天天气怎么样")
            onWakeRef.current(afterWake);
          } else if (result.isFinal && !afterWake) {
            // Just the wake word, wait for next utterance
            onWakeRef.current("");
          }
          // For interim results with wake word, we wait for the final result
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      console.warn("[WakeWord] Error:", event.error);
    };

    recognition.onend = () => {
      setActive(false);
      // Auto-restart to keep listening
      if (keepAliveRef.current) {
        setTimeout(() => {
          if (keepAliveRef.current) {
            try {
              recognition.start();
            } catch {
              // Will retry on next cycle
              setTimeout(() => {
                if (keepAliveRef.current) startRecognition();
              }, 1000);
            }
          }
        }, 100);
      }
    };

    keepAliveRef.current = true;
    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (err) {
      console.error("[WakeWord] Failed to start:", err);
    }
  }, [lang, checkWakeWord]);

  const stop = useCallback(() => {
    keepAliveRef.current = false;
    pausedRef.current = false;
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setActive(false);
  }, []);

  // Pause: stop recognition but remember we want to resume
  const pausedRef = useRef(false);

  const pause = useCallback(() => {
    if (!keepAliveRef.current) return; // Not running, nothing to pause
    pausedRef.current = true;
    keepAliveRef.current = false; // Prevent auto-restart
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setActive(false);
    console.log("[WakeWord] Paused (yielding to voice input)");
  }, []);

  const resume = useCallback(() => {
    if (!pausedRef.current) return; // Wasn't paused
    pausedRef.current = false;
    if (enabled && supported && wakeWord.trim()) {
      // Small delay to let the other recognition fully release
      setTimeout(() => {
        if (!pausedRef.current) { // Check again after delay
          startRecognition();
          console.log("[WakeWord] Resumed");
        }
      }, 300);
    }
  }, [enabled, supported, wakeWord, startRecognition]);

  // Auto-start/stop based on enabled prop
  useEffect(() => {
    if (enabled && supported && wakeWord.trim() && !pausedRef.current) {
      startRecognition();
    } else if (!enabled) {
      stop();
    }
    return () => { stop(); };
  }, [enabled, supported, wakeWord, startRecognition, stop]);

  return {
    supported,
    active,
    start: startRecognition,
    stop,
    pause,
    resume,
  };
}
