import WebSocket from 'ws';
import { BaseModelAdapter } from './adapters/BaseModelAdapter';
import { ToolDeclaration, UnifiedServerMessage } from '../../shared/types/protocol';

interface ClientConnection {
  ws: WebSocket;
  aiAdapter: BaseModelAdapter | null;  // 🆕 使用适配器替代 aiSession
  currentModel: 'openai';
  clientTools: ToolDeclaration[];      // 🆕 客户端提供的工具列表
  createdAt: Date;
  lastActivity: Date;
  heartbeatInterval?: NodeJS.Timeout;
}

/**
 * WebSocket连接管理器 - 处理所有客户端连接
 */
export class WSManager {
  private clients: Map<string, ClientConnection> = new Map();
  private clientCounter: number = 0;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    // 启动心跳检测（每30秒检查一次僵尸连接）
    this.startHeartbeat();
  }

  /**
   * 添加新客户端
   */
  addClient(ws: WebSocket): string {
    const clientId = `client_${++this.clientCounter}`;
    const connection: ClientConnection = {
      ws,
      aiAdapter: null,  // 🆕 初始化为 null
      currentModel: 'openai',
      clientTools: [],  // 🆕 初始化为空
      createdAt: new Date(),
      lastActivity: new Date()
    };

    this.clients.set(clientId, connection);
    console.log(`[WS] 客户端已连接: ${clientId} (当前连接数: ${this.clients.size})`);
    return clientId;
  }

  /**
   * 获取客户端连接
   */
  getClient(clientId: string): ClientConnection | undefined {
    const connection = this.clients.get(clientId);
    if (connection) {
      connection.lastActivity = new Date();
    }
    return connection;
  }

  /**
   * 设置客户端工具列表
   */
  setClientTools(clientId: string, tools: ToolDeclaration[]): void {
    const connection = this.clients.get(clientId);
    if (connection) {
      connection.clientTools = tools;
      console.log(`[WS] 客户端工具已更新: ${clientId} (${tools.length} 个工具)`);
    }
  }

  /**
   * 删除客户端并清理资源
   */
  removeClient(clientId: string): void {
    const connection = this.clients.get(clientId);
    if (!connection) return;

    console.log(`[WS] 清理客户端资源: ${clientId}`);

    // 清理心跳
    if (connection.heartbeatInterval) {
      clearInterval(connection.heartbeatInterval);
      connection.heartbeatInterval = undefined;
    }

    // 关闭 AI 适配器
    if (connection.aiAdapter) {
      try {
        connection.aiAdapter.close();
      } catch (e) {
        console.error(`[WS] 关闭 AI 适配器失败: ${clientId}`, e);
      }
      connection.aiAdapter = null;
    }

    // 关闭WebSocket
    try {
      if (connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.close(1000, '服务器主动关闭');
      }
    } catch (e) {
      console.error(`[WS] 关闭WebSocket失败: ${clientId}`, e);
    }

    this.clients.delete(clientId);
    console.log(`[WS] 客户端已移除: ${clientId} (当前连接数: ${this.clients.size})`);
  }

  /**
   * 设置客户端 AI 适配器
   */
  setAIAdapter(clientId: string, adapter: BaseModelAdapter | null, modelType: 'openai'): void {
    const connection = this.clients.get(clientId);
    if (!connection) return;

    // 关闭旧适配器（如果存在且不是同一个）
    if (connection.aiAdapter && connection.aiAdapter !== adapter) {
      try {
        connection.aiAdapter.close();
      } catch (e) {
        // 忽略关闭时的错误（WebSocket 可能还没有完全打开）
        console.warn(`[WS] 关闭旧适配器时出现警告: ${clientId}`, e instanceof Error ? e.message : e);
      }
    }

    connection.aiAdapter = adapter;
    connection.currentModel = modelType;
    console.log(`[WS] AI 适配器已设置: ${clientId} (${modelType})`);
  }

  /**
   * 启动心跳检测 - 清理僵尸连接和超时连接
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = new Date();
      const timeout = 5 * 60 * 1000; // 5分钟超时

      let closedCount = 0;

      for (const [clientId, connection] of this.clients.entries()) {
        // 检查WebSocket是否已关闭
        if (connection.ws.readyState !== WebSocket.OPEN) {
          this.removeClient(clientId);
          closedCount++;
          continue;
        }

        // 检查是否超时
        const inactiveTime = now.getTime() - connection.lastActivity.getTime();
        if (inactiveTime > timeout) {
          console.log(`[WS] 客户端超时: ${clientId} (${Math.round(inactiveTime / 1000)}s)`);
          this.removeClient(clientId);
          closedCount++;
          continue;
        }

        // 发送ping保活（每2分钟）
        if (inactiveTime > 2 * 60 * 1000) {
          try {
            connection.ws.ping();
          } catch (e) {
            console.error(`[WS] ping失败: ${clientId}`, e);
            this.removeClient(clientId);
            closedCount++;
          }
        }
      }

      if (closedCount > 0 || this.clients.size > 0) {
        console.log(`[WS心跳] 清理了${closedCount}个死连接, 当前活跃连接: ${this.clients.size}`);
      }
    }, 30 * 1000); // 每30秒检查一次
  }

  /**
   * 获取连接统计
   */
  getStats() {
    const now = new Date();
    const stats = {
      totalConnections: this.clients.size,
      models: { openai: 0 },
      connectionDurations: [] as string[]
    };

    for (const connection of this.clients.values()) {
      stats.models[connection.currentModel]++;
      const duration = Math.round((now.getTime() - connection.createdAt.getTime()) / 1000);
      stats.connectionDurations.push(`${duration}s`);
    }

    return stats;
  }

  /**
   * 广播消息给所有客户端（用于通知）
   */
  broadcastToAll(message: any): void {
    const msg = JSON.stringify(message);
    let sentCount = 0;

    for (const [clientId, connection] of this.clients.entries()) {
      if (connection.ws.readyState === WebSocket.OPEN) {
        try {
          connection.ws.send(msg);
          sentCount++;
        } catch (e) {
          console.error(`[WS] 广播失败: ${clientId}`, e);
          this.removeClient(clientId);
        }
      }
    }

    if (sentCount > 0) {
      console.log(`[WS] 广播消息到${sentCount}个客户端`);
    }
  }

  /**
   * 发送工具执行开始通知
   */
  sendToolExecutionStart(clientId: string, toolCallId: string, toolName: string, args: any): void {
    // 过滤掉 silent
    if (toolName === 'silent') return;

    const client = this.getClient(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      const message: UnifiedServerMessage = {
        type: 'tool_call',
        timestamp: Date.now(),
        toolCall: {
          toolCallId: toolCallId,
          name: toolName,
          arguments: args
        }
      };
      client.ws.send(JSON.stringify(message));
    }
  }

  /**
   * 发送工具执行结果通知
   */
  sendToolExecutionResult(clientId: string, toolCallId: string, result: any, error?: string): void {
    // 过滤掉 silent
    // 注意：这里我们假设 silent 工具不需要发送结果通知，或者客户端不关心
    // 如果需要，可以根据 toolCallId 查找对应的 toolName (需要额外存储)
    // 但目前简单起见，我们只发送结果

    const client = this.getClient(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      const message: UnifiedServerMessage = {
        type: 'tool_result',
        timestamp: Date.now(),
        toolResult: {
          toolCallId: toolCallId,
          result: result,
          error: error
        }
      };
      client.ws.send(JSON.stringify(message));
    }
  }

  /**
   * 优雅关闭所有连接
   */
  gracefulShutdown(): Promise<void> {
    console.log('[WS关闭] 正在关闭所有连接...');

    const clientIds = Array.from(this.clients.keys());
    for (const clientId of clientIds) {
      this.removeClient(clientId);
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    console.log('[WS关闭] 所有连接已关闭');
    return Promise.resolve();
  }
}

// 单例
export const wsManager = new WSManager();
