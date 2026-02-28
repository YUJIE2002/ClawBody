import { useState, useEffect, useRef, useCallback } from "react";
import type { Emotion } from "../lib/emotion";
import { GatewayClient, type ChatEvent } from "../lib/gateway-client";

interface OpenClawState {
  connected: boolean;
  emotion: Emotion;
  speaking: boolean;
  /** Last AI response text */
  lastResponse: string;
  /** Whether AI is currently generating */
  thinking: boolean;
  /** Send a text message to the AI */
  sendMessage: (message: string) => Promise<void>;
  /** Abort current generation */
  abort: () => Promise<void>;
}

/**
 * useOpenClaw — Bridge between ClawBody and the OpenClaw Gateway.
 *
 * Connects via WebSocket, sends user messages, receives streamed AI responses,
 * and extracts emotions from the response text to drive the VRM character.
 */
export function useOpenClaw(gatewayUrl?: string, token?: string): OpenClawState {
  const [connected, setConnected] = useState(false);
  const [emotion, setEmotion] = useState<Emotion>("neutral");
  const [speaking, setSpeaking] = useState(false);
  const [lastResponse, setLastResponse] = useState("");
  const [thinking, setThinking] = useState(false);
  const clientRef = useRef<GatewayClient | null>(null);
  const responseBuffer = useRef("");

  // Detect emotion from AI response text
  const detectEmotion = useCallback((text: string): Emotion => {
    const lower = text.toLowerCase();
    // Simple keyword-based emotion detection
    // TODO: Use AI-powered emotion detection or explicit emotion tags
    if (/[😂🤣😄😁😊😀laugh|haha|lol|funny]/i.test(lower)) return "happy";
    if (/[😢😭😞sad|sorry|unfortunat|regret]/i.test(lower)) return "sad";
    if (/[😠😤angry|frustrat|annoy|damn]/i.test(lower)) return "angry";
    if (/[😲😮🤯surprise|wow|amazing|incredible|whoa]/i.test(lower)) return "surprised";
    if (/[🤔think|consider|hmm|let me|analyz|ponder]/i.test(lower)) return "thinking";
    if (/[😳blush|embarrass|shy|awkward]/i.test(lower)) return "embarrassed";
    if (/[😴💤sleep|tired|yawn|exhausted]/i.test(lower)) return "sleepy";
    return "neutral";
  }, []);

  // Initialize gateway client
  useEffect(() => {
    if (!gatewayUrl) return;

    const client = new GatewayClient({
      url: gatewayUrl,
      token: token ?? "",
      sessionKey: "clawbody:main",
      autoReconnect: true,

      onConnect: () => {
        setConnected(true);
        setEmotion("happy");
        // Briefly show happy emotion on connect, then return to neutral
        setTimeout(() => setEmotion("neutral"), 2000);
      },

      onDisconnect: () => {
        setConnected(false);
        setSpeaking(false);
        setThinking(false);
      },

      onChat: (event: ChatEvent) => {
        if (event.done) {
          // Response complete
          const finalText = event.fullText ?? responseBuffer.current;
          setLastResponse(finalText);
          setEmotion(detectEmotion(finalText));
          setSpeaking(false);
          setThinking(false);
          responseBuffer.current = "";
        } else if (event.text) {
          // Streaming chunk
          responseBuffer.current += event.text;
          setSpeaking(true);
          setThinking(false);
          // Update emotion periodically during streaming
          if (responseBuffer.current.length % 100 < event.text.length) {
            setEmotion(detectEmotion(responseBuffer.current));
          }
        }
      },

      onError: (err) => {
        console.error("[ClawBody] Gateway error:", err);
      },
    });

    clientRef.current = client;
    client.connect();

    return () => {
      client.disconnect();
      clientRef.current = null;
    };
  }, [gatewayUrl, token, detectEmotion]);

  const sendMessage = useCallback(async (message: string) => {
    const client = clientRef.current;
    if (!client?.connected) {
      console.warn("[ClawBody] Cannot send — not connected to gateway");
      return;
    }
    setThinking(true);
    setEmotion("thinking");
    responseBuffer.current = "";
    try {
      await client.sendChat(message);
    } catch (err) {
      console.error("[ClawBody] Failed to send message:", err);
      setThinking(false);
      setEmotion("neutral");
    }
  }, []);

  const abort = useCallback(async () => {
    const client = clientRef.current;
    if (!client?.connected) return;
    try {
      await client.abortChat();
      setSpeaking(false);
      setThinking(false);
      setEmotion("neutral");
    } catch (err) {
      console.error("[ClawBody] Failed to abort:", err);
    }
  }, []);

  return {
    connected,
    emotion,
    speaking,
    lastResponse,
    thinking,
    sendMessage,
    abort,
  };
}
