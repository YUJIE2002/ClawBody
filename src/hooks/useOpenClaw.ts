import { useState, useEffect, useRef, useCallback } from "react";
import type { Emotion } from "../lib/emotion";
import { extractEmotion } from "../lib/emotion";
import { GatewayClient, type ChatEvent, type ChatAttachment } from "../lib/gateway-client";

interface OpenClawState {
  connected: boolean;
  emotion: Emotion;
  speaking: boolean;
  /** Last AI response text */
  lastResponse: string;
  /** Whether AI is currently generating */
  thinking: boolean;
  /** Send a text message to the AI, optionally with attachments */
  sendMessage: (message: string, attachments?: ChatAttachment[]) => Promise<void>;
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

  // Extract emotion and clean text from AI response
  const processResponse = useCallback((text: string): { emotion: Emotion; cleanText: string } => {
    return extractEmotion(text);
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
        setTimeout(() => setEmotion("neutral"), 2000);
      },

      onDisconnect: () => {
        setConnected(false);
        setSpeaking(false);
        setThinking(false);
      },

      onChat: (event: ChatEvent) => {
        if (event.done) {
          // Response complete — extract emotion and clean text
          const rawText = event.fullText ?? responseBuffer.current;
          const { emotion: detectedEmotion, cleanText } = processResponse(rawText);
          setLastResponse(cleanText);
          setEmotion(detectedEmotion);
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
            const { emotion: streamEmotion } = processResponse(responseBuffer.current);
            setEmotion(streamEmotion);
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
  }, [gatewayUrl, token, processResponse]);

  const sendMessage = useCallback(async (message: string, attachments?: ChatAttachment[]) => {
    const client = clientRef.current;
    if (!client?.connected) {
      console.warn("[ClawBody] Cannot send — not connected to gateway");
      return;
    }
    setThinking(true);
    setEmotion("thinking");
    responseBuffer.current = "";
    try {
      await client.sendChat(message, attachments);
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
