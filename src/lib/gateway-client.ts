/**
 * OpenClaw Gateway WebSocket Client
 *
 * Implements the OpenClaw Gateway WS protocol (v3).
 * Handshake: wait for connect.challenge → send req:connect → receive res:hello-ok
 * Then: req/res JSON-RPC + streamed events.
 */

type RequestId = number | string;

interface PendingRequest {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: number;
}

export interface ChatAttachment {
  /** MIME type (e.g., "image/jpeg") */
  type: string;
  /** Base64-encoded data (without data URL prefix) or data URL */
  data: string;
  /** Optional filename */
  name?: string;
}

export interface ChatEvent {
  type: "chat";
  /** Streamed text chunk */
  text?: string;
  /** Full accumulated text so far */
  fullText?: string;
  /** Whether this is the final chunk */
  done?: boolean;
  /** Run ID */
  runId?: string;
  /** Session key */
  sessionKey?: string;
  /** Emotion detected in response (custom extension) */
  emotion?: string;
}

export interface GatewayClientOptions {
  url: string;
  token?: string;
  sessionKey?: string;
  onChat?: (event: ChatEvent) => void;
  onConnect?: () => void;
  onDisconnect?: (reason?: string) => void;
  onError?: (error: Error) => void;
  autoReconnect?: boolean;
  reconnectDelayMs?: number;
}

export class GatewayClient {
  private ws: WebSocket | null = null;
  private options: Required<GatewayClientOptions>;
  private nextId: RequestId = 1;
  private pending = new Map<RequestId, PendingRequest>();
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private intentionalClose = false;
  private _connected = false;
  private handshakeCompleted = false;

  constructor(opts: GatewayClientOptions) {
    this.options = {
      token: "",
      sessionKey: "clawbody:main",
      onChat: () => {},
      onConnect: () => {},
      onDisconnect: () => {},
      onError: () => {},
      autoReconnect: true,
      reconnectDelayMs: 3000,
      ...opts,
    };
  }

  get connected(): boolean {
    return this._connected && this.handshakeCompleted;
  }

  /**
   * Connect to the Gateway WebSocket.
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.intentionalClose = false;
    this.handshakeCompleted = false;

    try {
      this.ws = new WebSocket(this.options.url);

      this.ws.onopen = () => {
        console.log("[ClawBody] Gateway WS TCP connected, waiting for challenge...");
        this._connected = true;
        // Don't call onConnect yet — wait for successful handshake
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(String(event.data));
          this.handleMessage(data);
        } catch (err) {
          console.warn("[ClawBody] Failed to parse gateway message:", err);
        }
      };

      this.ws.onclose = (event) => {
        const wasHandshaked = this.handshakeCompleted;
        this._connected = false;
        this.handshakeCompleted = false;
        console.log("[ClawBody] Gateway WS closed:", event.code, event.reason);
        if (wasHandshaked) {
          this.options.onDisconnect(event.reason || `code ${event.code}`);
        }

        // Reject all pending requests
        for (const [, req] of this.pending) {
          clearTimeout(req.timeout);
          req.reject(new Error("Connection closed"));
        }
        this.pending.clear();

        // Auto-reconnect
        if (this.options.autoReconnect && !this.intentionalClose) {
          this.reconnectTimer = setTimeout(() => {
            console.log("[ClawBody] Reconnecting to gateway...");
            this.connect();
          }, this.options.reconnectDelayMs);
        }
      };

      this.ws.onerror = () => {
        this.options.onError(new Error("WebSocket error"));
      };
    } catch (err) {
      this.options.onError(err instanceof Error ? err : new Error(String(err)));
      if (this.options.autoReconnect) {
        this.reconnectTimer = setTimeout(() => this.connect(), this.options.reconnectDelayMs);
      }
    }
  }

  /**
   * Disconnect from the Gateway.
   */
  disconnect(): void {
    this.intentionalClose = true;
    this.handshakeCompleted = false;
    clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
    this._connected = false;
  }

  /**
   * Send a JSON-RPC-style request to the Gateway.
   */
  async request<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.handshakeCompleted) {
        reject(new Error("Not connected"));
        return;
      }

      const id = this.nextId++;
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, 30000);

      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timeout });

      this.sendRaw({ type: "req", id, method, params });
    });
  }

  /**
   * Send a chat message to the AI, optionally with image attachments.
   */
  async sendChat(message: string, attachments?: ChatAttachment[]): Promise<string> {
    const params: Record<string, unknown> = {
      sessionKey: this.options.sessionKey,
      message,
      deliver: false,
    };

    if (attachments && attachments.length > 0) {
      params.attachments = attachments;
    }

    const result = await this.request<{ runId: string; status: string }>("chat.send", params);
    return result.runId;
  }

  /**
   * Get chat history.
   */
  async getHistory(limit = 20): Promise<ChatMessage[]> {
    const result = await this.request<{ messages: ChatMessage[] }>("chat.history", {
      sessionKey: this.options.sessionKey,
      limit,
    });
    return result.messages ?? [];
  }

  /**
   * Abort current chat run.
   */
  async abortChat(): Promise<void> {
    await this.request("chat.abort", {
      sessionKey: this.options.sessionKey,
    });
  }

  /**
   * Send the connect handshake to the Gateway.
   */
  private sendConnectHandshake(nonce?: string, ts?: number): void {
    const id = String(this.nextId++);

    const connectParams: Record<string, unknown> = {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: "openclaw-control-ui",
        version: "0.1.0",
        platform: "web",
        mode: "webchat",
        instanceId: this.getOrCreateDeviceId(),
      },
      role: "operator",
      scopes: ["operator.read", "operator.write"],
      caps: [],
      locale: navigator.language || "en-US",
      userAgent: `ClawBody/0.1.0`,
    };

    // Auth
    if (this.options.token) {
      connectParams.auth = { token: this.options.token };
    }

    // Note: device identity omitted for localhost/tunnel connections
    // (allowInsecureAuth enabled on gateway for this use case)

    this.pending.set(id, {
      resolve: (result: unknown) => {
        const payload = result as Record<string, unknown>;
        if (payload?.type === "hello-ok" || payload) {
          console.log("[ClawBody] Gateway handshake OK:", payload);
          this.handshakeCompleted = true;
          this.options.onConnect();

          // Store device token if issued
          const auth = payload?.auth as Record<string, unknown> | undefined;
          if (auth?.deviceToken) {
            try {
              localStorage.setItem("clawbody:deviceToken", String(auth.deviceToken));
              console.log("[ClawBody] Device token stored");
            } catch { /* ignore */ }
          }
        }
      },
      reject: (error: Error) => {
        console.error("[ClawBody] Gateway handshake failed:", error);
        this.options.onError(error);
        this.ws?.close();
      },
      timeout: setTimeout(() => {
        this.pending.delete(id);
        console.error("[ClawBody] Gateway handshake timeout");
        this.options.onError(new Error("Handshake timeout"));
        this.ws?.close();
      }, 15000),
    });

    this.sendRaw({ type: "req", id, method: "connect", params: connectParams });
  }

  /**
   * Get or create a stable device ID for this ClawBody instance.
   */
  private getOrCreateDeviceId(): string {
    const key = "clawbody:deviceId";
    let deviceId: string | null = null;
    try {
      deviceId = localStorage.getItem(key);
    } catch { /* ignore */ }
    if (!deviceId) {
      deviceId = `clawbody-${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`;
      try {
        localStorage.setItem(key, deviceId);
      } catch { /* ignore */ }
    }
    return deviceId;
  }

  /**
   * Handle an incoming message from the Gateway.
   */
  private handleMessage(data: Record<string, unknown>): void {
    const frameType = data.type as string;

    // --- Event frames ---
    if (frameType === "event") {
      const eventName = data.event as string;
      const payload = (data.payload ?? {}) as Record<string, unknown>;

      // connect.challenge — server wants us to authenticate
      if (eventName === "connect.challenge") {
        console.log("[ClawBody] Received connect challenge");
        this.sendConnectHandshake(
          payload.nonce as string | undefined,
          payload.ts as number | undefined,
        );
        return;
      }

      // agent — streamed AI response
      if (eventName === "agent") {
        const chatEvent: ChatEvent = {
          type: "chat",
          text: payload.text as string | undefined,
          fullText: payload.fullText as string | undefined,
          done: payload.done as boolean | undefined,
          runId: payload.runId as string | undefined,
          sessionKey: payload.sessionKey as string | undefined,
        };
        this.options.onChat(chatEvent);
        return;
      }

      // tick — keepalive, ignore
      if (eventName === "tick") return;

      // shutdown — gateway restarting
      if (eventName === "shutdown") {
        console.log("[ClawBody] Gateway shutting down:", payload.reason);
        return;
      }

      console.log("[ClawBody] Unhandled event:", eventName, payload);
      return;
    }

    // --- Response frames ---
    if (frameType === "res") {
      const id = data.id as RequestId;
      const pending = this.pending.get(id);
      if (pending) {
        this.pending.delete(id);
        clearTimeout(pending.timeout);
        if (data.ok) {
          pending.resolve(data.payload);
        } else {
          const errPayload = (data.error ?? data.payload ?? {}) as Record<string, unknown>;
          pending.reject(new Error(String(errPayload.message ?? errPayload.code ?? "Unknown error")));
        }
      }
      return;
    }

    // --- Legacy / unknown frames ---
    // Some older gateway versions may send chat events directly
    if (frameType === "chat" || data.method === "chat") {
      const chatEvent: ChatEvent = {
        type: "chat",
        text: data.text as string | undefined,
        fullText: data.fullText as string | undefined,
        done: data.done as boolean | undefined,
        runId: data.runId as string | undefined,
        sessionKey: data.sessionKey as string | undefined,
      };
      this.options.onChat(chatEvent);
      return;
    }

    console.log("[ClawBody] Unknown frame:", data);
  }

  /**
   * Send raw JSON to the WebSocket.
   */
  private sendRaw(data: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
}
