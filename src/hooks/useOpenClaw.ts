import { useState, useEffect, useCallback, useRef } from "react";
import type { Emotion } from "../lib/emotion";
import { mapToEmotion } from "../lib/emotion";

/** Messages received from the OpenClaw gateway */
interface OpenClawMessage {
  type: "emotion" | "speak" | "action" | "idle";
  payload: Record<string, unknown>;
}

interface OpenClawState {
  /** Whether we're connected to the OpenClaw gateway */
  connected: boolean;
  /** Current emotion state of the AI */
  emotion: Emotion;
  /** Whether the AI is currently speaking */
  speaking: boolean;
  /** Send a message to the OpenClaw gateway */
  send: (message: Record<string, unknown>) => void;
}

/**
 * useOpenClaw — WebSocket bridge to the OpenClaw agent gateway
 *
 * Connects to the local OpenClaw gateway WebSocket endpoint,
 * receives emotion/speech/action events, and exposes state
 * for the VRM renderer to consume.
 *
 * The gateway URL defaults to ws://localhost:4100/ws but can be
 * configured via the VITE_OPENCLAW_WS_URL environment variable.
 */
export function useOpenClaw(): OpenClawState {
  const [connected, setConnected] = useState(false);
  const [emotion, setEmotion] = useState<Emotion>("neutral");
  const [speaking, setSpeaking] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();

  const gatewayUrl =
    import.meta.env.VITE_OPENCLAW_WS_URL ?? "ws://localhost:4100/ws";

  const connect = useCallback(() => {
    // Don't reconnect if already open
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(gatewayUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[ClawBody] Connected to OpenClaw gateway");
        setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg: OpenClawMessage = JSON.parse(event.data);
          handleMessage(msg);
        } catch (err) {
          console.warn("[ClawBody] Failed to parse gateway message:", err);
        }
      };

      ws.onclose = () => {
        console.log("[ClawBody] Disconnected from OpenClaw gateway");
        setConnected(false);
        wsRef.current = null;
        // Auto-reconnect after 3 seconds
        reconnectTimer.current = setTimeout(connect, 3000);
      };

      ws.onerror = (err) => {
        console.error("[ClawBody] WebSocket error:", err);
        ws.close();
      };
    } catch (err) {
      console.error("[ClawBody] Failed to connect:", err);
      reconnectTimer.current = setTimeout(connect, 3000);
    }
  }, [gatewayUrl]);

  const handleMessage = (msg: OpenClawMessage) => {
    switch (msg.type) {
      case "emotion":
        setEmotion(mapToEmotion(msg.payload.emotion as string));
        break;

      case "speak":
        setSpeaking(true);
        // Auto-stop speaking after duration (if provided)
        if (typeof msg.payload.duration === "number") {
          setTimeout(() => setSpeaking(false), msg.payload.duration as number);
        }
        break;

      case "idle":
        setSpeaking(false);
        break;

      case "action":
        // Future: handle gestures, animations, etc.
        console.log("[ClawBody] Action received:", msg.payload);
        break;

      default:
        console.log("[ClawBody] Unknown message type:", msg);
    }
  };

  const send = useCallback((message: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn("[ClawBody] Cannot send — not connected to gateway");
    }
  }, []);

  // Connect on mount, cleanup on unmount
  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { connected, emotion, speaking, send };
}
