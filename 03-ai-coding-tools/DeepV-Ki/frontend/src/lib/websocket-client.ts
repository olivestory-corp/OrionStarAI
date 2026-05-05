/**
 * WebSocket客户端工具
 * 用于连接到后端WebSocket服务
 */

import { config } from "./config";

export interface WebSocketMessage {
  type: string;
  data: unknown;
  timestamp?: string;
}

export interface WebSocketOptions {
  onOpen?: (event: Event) => void;
  onMessage?: (message: WebSocketMessage) => void;
  onError?: (error: Event) => void;
  onClose?: (event: CloseEvent) => void;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private options: WebSocketOptions;
  private reconnectAttempts = 0;
  private isConnecting = false;

  constructor(endpoint: string = "/ws/chat", options: WebSocketOptions = {}) {
    // 构建WebSocket URL
    const baseUrl = config.pythonBackendHost;
    const wsUrl = baseUrl.replace(/^http/, "ws");
    this.url = `${wsUrl}${endpoint}`;

    this.options = {
      reconnect: true,
      reconnectInterval: 3000,
      maxReconnectAttempts: 5,
      ...options,
    };
  }

  /**
   * 连接WebSocket
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      if (this.isConnecting) {
        reject(new Error("Connection already in progress"));
        return;
      }

      this.isConnecting = true;

      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = (event) => {
          console.log("WebSocket connected:", this.url);
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.options.onOpen?.(event);
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.options.onMessage?.(message);
          } catch (error) {
            console.error("Failed to parse WebSocket message:", error);
            // 如果不是JSON，直接传递原始数据
            this.options.onMessage?.({
              type: "raw",
              data: event.data,
              timestamp: new Date().toISOString(),
            });
          }
        };

        this.ws.onerror = (error) => {
          console.error("WebSocket error:", error);
          this.isConnecting = false;
          this.options.onError?.(error);
          reject(error);
        };

        this.ws.onclose = (event) => {
          console.log("WebSocket closed:", event.code, event.reason);
          this.isConnecting = false;
          this.options.onClose?.(event);

          // 自动重连
          if (
            this.options.reconnect &&
            this.reconnectAttempts < (this.options.maxReconnectAttempts || 5)
          ) {
            this.reconnectAttempts++;
            console.log(
              `Attempting to reconnect (${this.reconnectAttempts}/${this.options.maxReconnectAttempts})...`
            );

            setTimeout(() => {
              this.connect().catch(console.error);
            }, this.options.reconnectInterval);
          }
        };
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * 发送消息
   */
  send(message: WebSocketMessage | string): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.error("WebSocket is not connected");
      return false;
    }

    try {
      const data =
        typeof message === "string" ? message : JSON.stringify(message);
      this.ws.send(data);
      return true;
    } catch (error) {
      console.error("Failed to send WebSocket message:", error);
      return false;
    }
  }

  /**
   * 关闭连接
   */
  close(code?: number, reason?: string): void {
    this.options.reconnect = false; // 禁用自动重连
    this.ws?.close(code, reason);
    this.ws = null;
  }

  /**
   * 获取连接状态
   */
  get readyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }

  /**
   * 检查是否已连接
   */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * 获取WebSocket URL
   */
  get websocketUrl(): string {
    return this.url;
  }
}

/**
 * 创建聊天WebSocket客户端的便捷函数
 */
export function createChatWebSocket(
  options: WebSocketOptions = {}
): WebSocketClient {
  return new WebSocketClient("/ws/chat", options);
}

/**
 * WebSocket状态常量
 */
export const WebSocketState = {
  CONNECTING: WebSocket.CONNECTING,
  OPEN: WebSocket.OPEN,
  CLOSING: WebSocket.CLOSING,
  CLOSED: WebSocket.CLOSED,
} as const;

/**
 * 获取WebSocket状态描述
 */
export function getWebSocketStateDescription(state: number): string {
  switch (state) {
    case WebSocket.CONNECTING:
      return "Connecting";
    case WebSocket.OPEN:
      return "Open";
    case WebSocket.CLOSING:
      return "Closing";
    case WebSocket.CLOSED:
      return "Closed";
    default:
      return "Unknown";
  }
}
