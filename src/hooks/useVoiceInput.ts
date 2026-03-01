/**
 * useVoiceInput — Speech-to-Text hook using Web Speech API
 *
 * Provides microphone input for voice chat. Uses the built-in
 * SpeechRecognition API (free, no API key needed).
 * Falls back gracefully when the API isn't available.
 */

import { useState, useRef, useCallback, useEffect } from "react";

/** SpeechRecognition type declarations for WebKit/standard */
interface SpeechRecognitionEvent {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly length: number;
  readonly isFinal: boolean;
  item(index: number): SpeechRecognitionAlternative;
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

/** Get the SpeechRecognition constructor (standard or webkit-prefixed) */
function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  const win = window as unknown as Record<string, unknown>;
  if (typeof win.SpeechRecognition === "function") {
    return win.SpeechRecognition as unknown as SpeechRecognitionConstructor;
  }
  if (typeof win.webkitSpeechRecognition === "function") {
    return win.webkitSpeechRecognition as unknown as SpeechRecognitionConstructor;
  }
  return null;
}

export interface UseVoiceInputOptions {
  /** Called when a final transcript is recognized */
  onResult: (text: string) => void;
  /** Called with interim (partial) transcript */
  onInterim?: (text: string) => void;
  /** Called when recognition ends (naturally or by user) — use to resume wake word */
  onEnd?: () => void;
  /** Language code (default: "en-US") */
  lang?: string;
  /** Whether to auto-restart after each result (continuous conversation) */
  continuous?: boolean;
}

export interface UseVoiceInputReturn {
  /** Whether the browser supports speech recognition */
  supported: boolean;
  /** Whether currently listening */
  listening: boolean;
  /** Current interim transcript */
  interimText: string;
  /** Start listening */
  startListening: () => void;
  /** Stop listening */
  stopListening: () => void;
  /** Toggle listening on/off */
  toggleListening: () => void;
}

export function useVoiceInput(options: UseVoiceInputOptions): UseVoiceInputReturn {
  const { onResult, onInterim, onEnd, lang = "en-US", continuous = false } = options;
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [supported] = useState(() => getSpeechRecognition() !== null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const shouldRestartRef = useRef(false);

  // Keep callbacks in refs to avoid re-creating recognition
  const onResultRef = useRef(onResult);
  const onInterimRef = useRef(onInterim);
  const onEndRef = useRef(onEnd);
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);
  useEffect(() => { onInterimRef.current = onInterim; }, [onInterim]);
  useEffect(() => { onEndRef.current = onEnd; }, [onEnd]);

  const startListening = useCallback(() => {
    const SpeechRecognitionCtor = getSpeechRecognition();
    if (!SpeechRecognitionCtor) {
      console.warn("[ClawBody] SpeechRecognition not supported in this browser");
      return;
    }

    // Stop any existing instance
    if (recognitionRef.current) {
      shouldRestartRef.current = false;
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.lang = lang;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setListening(true);
      setInterimText("");
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let final_ = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final_ += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (interim) {
        setInterimText(interim);
        onInterimRef.current?.(interim);
      }

      if (final_.trim()) {
        setInterimText("");
        onResultRef.current(final_.trim());
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // "no-speech" and "aborted" are not real errors
      if (event.error === "no-speech" || event.error === "aborted") return;
      console.error("[ClawBody] Speech recognition error:", event.error, event.message);
      setListening(false);
      shouldRestartRef.current = false;
    };

    recognition.onend = () => {
      setListening(false);
      setInterimText("");
      // Auto-restart in continuous mode
      if (shouldRestartRef.current) {
        try {
          recognition.start();
        } catch {
          shouldRestartRef.current = false;
          onEndRef.current?.();
        }
      } else {
        recognitionRef.current = null;
        onEndRef.current?.();
      }
    };

    shouldRestartRef.current = continuous;
    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (err) {
      console.error("[ClawBody] Failed to start speech recognition:", err);
      recognitionRef.current = null;
    }
  }, [lang, continuous]);

  const stopListening = useCallback(() => {
    shouldRestartRef.current = false;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setListening(false);
    setInterimText("");
  }, []);

  const toggleListening = useCallback(() => {
    if (listening) {
      stopListening();
    } else {
      startListening();
    }
  }, [listening, startListening, stopListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      shouldRestartRef.current = false;
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  return {
    supported,
    listening,
    interimText,
    startListening,
    stopListening,
    toggleListening,
  };
}
