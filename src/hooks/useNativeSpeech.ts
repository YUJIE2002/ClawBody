/**
 * useNativeSpeech — macOS native speech recognition via SFSpeechRecognizer.
 *
 * Uses Tauri commands + events to communicate with the Rust/Swift backend.
 * Returns null/unsupported on non-macOS platforms (fallback to Web Speech API).
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

interface NativeSpeechEvent {
  status: "idle" | "running" | "final" | "error";
  text: string;
  error: string;
}

export interface UseNativeSpeechOptions {
  onResult: (text: string) => void;
  onInterim?: (text: string) => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
  lang?: string;
}

export interface UseNativeSpeechReturn {
  supported: boolean;
  listening: boolean;
  interimText: string;
  error: string;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
}

export function useNativeSpeech(options: UseNativeSpeechOptions): UseNativeSpeechReturn {
  const { onResult, onInterim, onEnd, onError, lang = "zh-CN" } = options;

  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState("");

  const onResultRef = useRef(onResult);
  const onInterimRef = useRef(onInterim);
  const onEndRef = useRef(onEnd);
  const onErrorRef = useRef(onError);
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);
  useEffect(() => { onInterimRef.current = onInterim; }, [onInterim]);
  useEffect(() => { onEndRef.current = onEnd; }, [onEnd]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  // Check availability on mount
  useEffect(() => {
    invoke<boolean>("is_native_speech_available")
      .then((available) => setSupported(available))
      .catch(() => setSupported(false));
  }, []);

  // Listen for native speech events
  useEffect(() => {
    const unlisten = listen<NativeSpeechEvent>("native-speech-result", (event) => {
      const { status, text, error: errMsg } = event.payload;

      if (status === "running" && text) {
        setInterimText(text);
        onInterimRef.current?.(text);
      }

      if (status === "final") {
        setInterimText("");
        setListening(false);
        if (text.trim()) {
          onResultRef.current(text.trim());
        }
        onEndRef.current?.();
      }

      if (status === "error") {
        const errorMap: Record<string, string> = {
          "permission-denied": "🎤 语音识别权限被拒绝，请在系统设置中允许",
          "permission-restricted": "🎤 语音识别权限受限",
          "recognizer-unavailable": "🎤 语音识别器不可用",
        };
        const msg = errorMap[errMsg] ?? `🎤 语音识别错误: ${errMsg}`;
        setError(msg);
        setListening(false);
        onErrorRef.current?.(msg);
        onEndRef.current?.();
      }
    });

    return () => { unlisten.then((fn) => fn()); };
  }, []);

  const startListening = useCallback(() => {
    setError("");
    setInterimText("");
    setListening(true);
    invoke("start_native_speech", { lang })
      .catch((err) => {
        setError(`🎤 ${err}`);
        setListening(false);
      });
  }, [lang]);

  const stopListening = useCallback(() => {
    setListening(false);
    setInterimText("");
    invoke("stop_native_speech").catch(() => {});
  }, []);

  const toggleListening = useCallback(() => {
    if (listening) {
      stopListening();
    } else {
      startListening();
    }
  }, [listening, startListening, stopListening]);

  return {
    supported,
    listening,
    interimText,
    error,
    startListening,
    stopListening,
    toggleListening,
  };
}
