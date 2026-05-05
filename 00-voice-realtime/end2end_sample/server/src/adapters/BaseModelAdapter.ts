import { UnifiedClientMessage, UnifiedServerMessage, ToolDeclaration } from '../../../shared/types/protocol';

/**
 * 模型适配器基类
 * 所有模型适配器（Gemini, OpenAI 等）都需要继承此类
 *
 * 打断逻辑：
 * - turnId: 递增的对话轮次 ID，用于标识和过滤消息
 * - isInterrupted: 当前轮次是否被打断，打断后的消息会被忽略
 * - 新 turnId 来时自动重置 isInterrupted
 */
export abstract class BaseModelAdapter {
  protected clientId: string;
  protected turnId: number | null = null;
  protected isInterrupted: boolean = false;  // 是否已被打断
  protected onMessageCallback: ((message: UnifiedServerMessage) => void) | null = null;
  protected clientTools: ToolDeclaration[] = [];

  constructor(clientId: string) {
    this.clientId = clientId;
  }

  /**
   * 设置客户端工具
   * @param tools 工具列表
   */
  setClientTools(tools: ToolDeclaration[]): void {
    this.clientTools = tools;
  }

  /**
   * 处理客户端工具执行结果
   * @param toolCallId 工具调用 ID
   * @param result 执行结果
   */
  abstract handleClientToolResult(toolCallId: string, result: any): void;

  /**
   * 建立 AI 连接
   * @param config 模型配置
   * @returns AI 会话对象
   */
  abstract connect(config: any): Promise<any>;

  /**
   * 关闭 AI 连接
   */
  abstract close(): void;

  /**
   * 统一消息 → 模型特定格式
   * @param message 统一客户端消息
   * @returns 模型特定格式的消息
   */
  abstract transformClientMessage(message: UnifiedClientMessage): any;

  /**
   * 模型特定格式 → 统一消息
   * @param message 模型特定格式的消息
   * @returns 统一服务端消息（如果无法转换返回 null）
   */
  abstract transformServerMessage(message: any): UnifiedServerMessage | null;

  /**
   * 发送消息到 AI
   * @param message 模型特定格式的消息
   */
  abstract send(message: any): void;

  /**
   * 中断当前对话
   * 清除队列并发送中断信号
   */
  abstract interrupt(): void;

  /**
   * 设置当前 Turn-ID
   * @param turnId Turn-ID
   */
  setTurnId(turnId: number): void {
    // 新的 turnId 来时，重置打断状态
    if (turnId !== this.turnId) {
      this.isInterrupted = false;
    }
    this.turnId = turnId;
    //console.log(`[${this.constructor.name}][${this.clientId}] 📌 Turn-ID: ${turnId}`);
  }

  /**
   * 获取当前 Turn-ID
   */
  getTurnId(): number | null {
    return this.turnId;
  }

  /**
   * 检查是否已被打断
   */
  isCurrentlyInterrupted(): boolean {
    return this.isInterrupted;
  }

  /**
   * 标记为已打断
   */
  markAsInterrupted(): void {
    this.isInterrupted = true;
    console.log(`[${this.constructor.name}][${this.clientId}] 🛑 标记为已打断, Turn-ID: ${this.turnId}`);
  }

  /**
   * 设置消息回调
   * @param callback 回调函数
   */
  onMessage(callback: (message: UnifiedServerMessage) => void): void {
    this.onMessageCallback = callback;
  }

  /**
   * 触发消息回调
   * @param message 统一服务端消息
   */
  protected emitMessage(message: UnifiedServerMessage): void {
    if (this.onMessageCallback) {
      this.onMessageCallback(message);
    }
  }
}
