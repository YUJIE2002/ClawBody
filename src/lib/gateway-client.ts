/**
 * OpenClaw Gateway WebSocket Client
 *
 * Implements the JSON-RPC-style protocol used by the OpenClaw Gateway.
 * Supports: chat.send, chat.history, chat.abort, and streaming chat events.
 */

type RequestId = number;

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
    return this._connected;
  }

  /**
   * Connect to the Gateway WebSocket.
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.intentionalClose = false;

    try {
      this.ws = new WebSocket(this.options.url);

      this.ws.onopen = () => {
        console.log("[ClawBody] Gateway WS connected");
        // Authenticate with token
        if (this.options.token) {
          this.sendRaw({
            type: "connect",
            params: {
              auth: { token: this.options.token },
            },
          });
        }
        this._connected = true;
        this.options.onConnect();
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
        this._connected = false;
        console.log("[ClawBody] Gateway WS closed:", event.code, event.reason);
        this.options.onDisconnect(event.reason || `code ${event.code}`);

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
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error("Not connected"));
        return;
      }

      const id = this.nextId++;
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, 30000);

      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timeout });

      this.sendRaw({ id, method, params });
    });
  }

  /**
   * Send a chat message to the AI.
   */
  async sendChat(message: string): Promise<string> {
    const result = await this.request<{ runId: string; status: string }>("chat.send", {
      sessionKey: this.options.sessionKey,
      message,
      deliver: false,
    });
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
   * Handle an incoming message from the Gateway.
   */
  private handleMessage(data: Record<string, unknown>): void {
    // Response to a request
    if (typeof data.id === "number" && this.pending.has(data.id)) {
      const req = this.pending.get(data.id)!;
      this.pending.delete(data.id);
      clearTimeout(req.timeout);

      if (data.error) {
        req.reject(new Error(String((data.error as Record<string, unknown>)?.message ?? data.error)));
      } else {
        req.resolve(data.result);
      }
      return;
    }

    // Chat event (streamed response)
    if (data.type === "chat" || data.method === "chat") {
      const event: ChatEvent = {
        type: "chat",
        text: data.text as string | undefined,
        fullText: data.fullText as string | undefined,
        done: data.done as boolean | undefined,
        runId: data.runId as string | undefined,
        sessionKey: data.sessionKey as string | undefined,
      };
      this.options.onChat(event);
      return;
    }

    // Connection ack
    if (data.type === "connected" || data.type === "connect.ack") {
      console.log("[ClawBody] Gateway authenticated");
      return;
    }

    // Other events — log for debugging
    console.log("[ClawBody] Gateway event:", data);
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
