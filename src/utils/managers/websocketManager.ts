import WebSocket from "ws";
import { EventEmitter } from "events";

// Connection states
export enum ConnectionState {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  RECONNECTING = "reconnecting",
  ERROR = "error",
}
export interface WebSocketManagerOptions {
  url: string;
  initialBackoff?: number;
  maxBackoff?: number;
  maxRetries?: number;
  debug?: boolean;
}
export interface WebSocketRequest {
  jsonrpc: string;
  id: number;
  method: string;
  params: unknown[];
}

export class WebSocketManager extends EventEmitter {
  private ws: WebSocket | null = null;
  private state: ConnectionState = ConnectionState.DISCONNECTED;
  private retryCount = 0;
  private backoffTime: number;
  private maxBackoff: number;
  private maxRetries: number;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private url: string;
  private debug: boolean;

  constructor(options: WebSocketManagerOptions) {
    super();
    this.url = options.url;
    this.backoffTime = options.initialBackoff || 1000;
    this.maxBackoff = options.maxBackoff || 30000;
    this.maxRetries = options.maxRetries || Infinity;
    this.debug = options.debug || false;
  }

  // Get current connection state
  public getState(): ConnectionState {
    return this.state;
  }

  // Connect to WebSocket server
  public connect(): void {
    if (this.state === ConnectionState.CONNECTING || this.state === ConnectionState.CONNECTED) {
      return;
    }

    this.setState(ConnectionState.CONNECTING);

    try {
      this.ws = new WebSocket(this.url);
      this.setupEventListeners();
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error("Unknown error during connection"));
    }
  }

  // Send data through the WebSocket
  public send(data: WebSocketRequest | string): boolean {
    if (this.state !== ConnectionState.CONNECTED || !this.ws) {
      return false;
    }

    try {
      const message = typeof data === "string" ? data : JSON.stringify(data);
      this.ws.send(message);
      return true;
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error("Error sending message"));
      return false;
    }
  }

  // Disconnect WebSocket
  public disconnect(): void {
    this.cleanUp();
    this.setState(ConnectionState.DISCONNECTED);
  }

  // Set up WebSocket event listeners
  private setupEventListeners(): void {
    if (!this.ws) return;

    this.ws.on("open", () => {
      this.setState(ConnectionState.CONNECTED);
      this.retryCount = 0;
      this.backoffTime = 1000; // Reset backoff time on successful connection
      this.emit("open");
    });

    this.ws.on("message", (data: WebSocket.Data) => {
      this.emit("message", data);
    });

    this.ws.on("error", (error: Error) => {
      this.handleError(error);
    });

    this.ws.on("close", (code: number, reason: string) => {
      this.cleanUp();

      if (this.state !== ConnectionState.DISCONNECTED) {
        this.attemptReconnect();
      }
    });
  }

  // Handle WebSocket errors
  private handleError(error: Error): void {
    this.setState(ConnectionState.ERROR);
    this.emit("error", error);

    // Don't attempt reconnect here - let the close handler do it
    // as an error is typically followed by a close event
  }

  // Attempt to reconnect with exponential backoff
  private attemptReconnect(): void {
    if (this.retryCount >= this.maxRetries) {
      this.setState(ConnectionState.DISCONNECTED);
      this.emit("max_retries_reached");
      return;
    }

    this.setState(ConnectionState.RECONNECTING);
    this.retryCount++;

    // Calculate backoff with jitter to prevent thundering herd
    const jitter = Math.random() * 0.3 + 0.85; // Random between 0.85 and 1.15
    const delay = Math.min(this.backoffTime * jitter, this.maxBackoff);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
      // Increase backoff for next attempt
      this.backoffTime = Math.min(this.backoffTime * 1.5, this.maxBackoff);
    }, delay);
  }

  // Clean up resources
  private cleanUp(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      // Remove all listeners to prevent memory leaks
      this.ws.removeAllListeners();

      // Close the connection if it's still open
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        try {
          this.ws.close();
        } catch (e) {
          // Ignore errors during close
        }
      }

      this.ws = null;
    }
  }

  // Update connection state and emit event
  private setState(state: ConnectionState): void {
    if (this.state !== state) {
      this.state = state;
      this.emit("state_change", state);
    }
  }
}
