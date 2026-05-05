/**
 * WebSocketManager - WebSocket 连接管理器
 * 纯 TypeScript 实现，负责 WebSocket 连接、消息收发
 */

import { EventEmitter } from 'events';
import { UnifiedClientMessage, UnifiedServerMessage } from '../types';

export type WebSocketStatus = 'disconnected' | 'connecting' | 'connected';

export interface WebSocketManagerConfig {
  /** WebSocket URL */
  url: string;
  /** 自动重连 */
  autoReconnect?: boolean;
  /** 重连间隔 (ms) */
  reconnectInterval?: number;
  /** 最大重连次数 */
  maxReconnectAttempts?: number;
}

/**
 * WebSocket 管理器
 *
 * Events:
 * - 'open': 连接打开
 * - 'close': 连接关闭
 * - 'error': 错误
 * - 'message': 收到消息 (UnifiedServerMessage)
 * - 'status_change': 状态变化
 */
export class WebSocketManager extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: Required<WebSocketManagerConfig>;
  private _status: WebSocketStatus = 'disconnected';
  private reconnectAttempts: number = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isConnecting: boolean = false;

  constructor(config: WebSocketManagerConfig) {
    super();
    this.config = {
      url: config.url,
      autoReconnect: config.autoReconnect ?? false,
      reconnectInterval: config.reconnectInterval ?? 3000,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 5,
    };
  }

  /** 当前连接状态 */
  get status(): WebSocketStatus {
    return this._status;
  }

  /** 是否已连接 */
  get isConnected(): boolean {
    return this._status === 'connected' && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * 建立连接
   */
  connect(): void {
    // 防止重复连接
    if (this.isConnecting) {
      console.log('[WebSocketManager] 正在连接中，跳过重复请求');
      return;
    }
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[WebSocketManager] 已连接');
      return;
    }
    if (this.ws?.readyState === WebSocket.CONNECTING) {
      console.log('[WebSocketManager] 正在连接中');
      return;
    }

    // 清理旧连接
    this.cleanup();

    this.isConnecting = true;
    this.setStatus('connecting');
    console.log('[WebSocketManager] 正在连接:', this.config.url);

    try {
      const ws = new WebSocket(this.config.url);
      this.ws = ws;

      ws.onopen = () => {
        if (this.ws !== ws) {
          console.log('[WebSocketManager] 旧连接的 onopen，忽略');
          ws.close();
          return;
        }

        console.log('[WebSocketManager] ✅ 连接成功');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.setStatus('connected');
        this.emit('open');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as UnifiedServerMessage;
          this.emit('message', data);
        } catch (error) {
          console.error('[WebSocketManager] 解析消息失败:', error);
        }
      };

      ws.onerror = (error) => {
        if (this.ws !== ws) return;
        console.error('[WebSocketManager] 错误:', error);
        this.isConnecting = false;
        this.emit('error', error);
      };

      ws.onclose = () => {
        if (this.ws !== ws) return;
        console.log('[WebSocketManager] 连接关闭');
        this.isConnecting = false;
        this.setStatus('disconnected');
        this.emit('close');

        // 自动重连
        if (this.config.autoReconnect && this.reconnectAttempts < this.config.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      };
    } catch (error) {
      console.error('[WebSocketManager] 创建连接失败:', error);
      this.isConnecting = false;
      this.setStatus('disconnected');
      this.emit('error', error);
    }
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.cancelReconnect();
    this.cleanup();
    this.setStatus('disconnected');
  }

  /**
   * 发送消息
   */
  send(message: UnifiedClientMessage): boolean {
    if (!this.isConnected) {
      console.warn('[WebSocketManager] 未连接，无法发送消息');
      return false;
    }

    try {
      this.ws!.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('[WebSocketManager] 发送消息失败:', error);
      return false;
    }
  }

  /**
   * 更新 URL（需要重新连接）
   */
  setUrl(url: string): void {
    this.config.url = url;
  }

  private setStatus(status: WebSocketStatus): void {
    if (this._status !== status) {
      this._status = status;
      this.emit('status_change', status);
    }
  }

  private cleanup(): void {
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;

      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }
  }

  private scheduleReconnect(): void {
    this.cancelReconnect();

    this.reconnectAttempts++;
    console.log(`[WebSocketManager] 🔄 ${this.config.reconnectInterval}ms 后尝试重连 (${this.reconnectAttempts}/${this.config.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, this.config.reconnectInterval);
  }

  private cancelReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    this.disconnect();
    this.removeAllListeners();
  }
}
