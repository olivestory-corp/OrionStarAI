/**
 * TurnManager - 对话轮次管理器
 * 纯 TypeScript 实现，负责生成、追踪和管理对话轮次
 */

import { TurnStatus, TurnInfo } from '../types';

/**
 * Turn-ID 管理器
 *
 * 核心概念：
 * - turnId: 递增的对话轮次 ID，用于标识和过滤消息
 * - 打断时：旧 turnId 的消息会被丢弃（turnId < currentTurnId）
 */
export class TurnManager {
  private activeTurns: Map<number, TurnInfo> = new Map();
  private turnIdCounter: number = 0;
  private _currentTurnId: number = 0;

  /** 当前 Turn ID */
  get currentTurnId(): number {
    return this._currentTurnId;
  }

  /** 获取当前 Turn ID（方法形式） */
  getCurrentTurnId(): number {
    return this._currentTurnId;
  }

  /** 活跃的 Turn 数量 */
  get activeTurnCount(): number {
    return this.activeTurns.size;
  }

  /**
   * 开始新轮次
   * @returns 新的 Turn ID
   */
  startTurn(): number {
    const turnId = ++this.turnIdCounter;

    const turnInfo: TurnInfo = {
      turnId,
      status: 'encoding',
      startTime: Date.now(),
      audioChunksCount: 0,
      receivedChunksCount: 0,
    };

    this.activeTurns.set(turnId, turnInfo);
    this._currentTurnId = turnId;

    console.log(`[TurnManager] 🆕 开始新轮次: ${turnId}`);
    return turnId;
  }

  /**
   * 检查 turnId 是否有效
   * 只有 turnId >= currentTurnId 的消息才有效
   */
  isTurnValid(turnId: number): boolean {
    return turnId >= this._currentTurnId;
  }

  /**
   * 更新轮次状态
   */
  updateTurnStatus(turnId: number, status: TurnStatus): void {
    const turn = this.activeTurns.get(turnId);
    if (turn) {
      turn.status = status;
    }
  }

  /**
   * 增加音频分片计数
   */
  incrementAudioChunks(turnId: number, sent: boolean = true): void {
    const turn = this.activeTurns.get(turnId);
    if (turn) {
      if (sent) {
        turn.audioChunksCount++;
      } else {
        turn.receivedChunksCount++;
      }
    }
  }

  /**
   * 完成轮次
   */
  completeTurn(turnId: number): void {
    const turn = this.activeTurns.get(turnId);
    if (turn) {
      const duration = Date.now() - turn.startTime;
      console.log(`[TurnManager] ✅ 完成轮次: ${turnId}, 耗时: ${duration}ms`);
      this.activeTurns.delete(turnId);
    }
  }

  /**
   * 中断轮次
   */
  interruptTurn(turnId: number): void {
    const turn = this.activeTurns.get(turnId);
    if (turn) {
      turn.status = 'interrupted';
      console.log(`[TurnManager] ⚠️ 中断轮次: ${turnId}`);
    }
  }

  /**
   * 获取轮次信息
   */
  getTurnInfo(turnId: number): TurnInfo | undefined {
    return this.activeTurns.get(turnId);
  }

  /**
   * 清除所有轮次
   */
  clearAllTurns(): void {
    console.log(`[TurnManager] 🧹 清除所有轮次 (共 ${this.activeTurns.size} 个)`);
    this.activeTurns.clear();
    this._currentTurnId = 0;
  }

  /**
   * 重置管理器
   */
  reset(): void {
    this.activeTurns.clear();
    this.turnIdCounter = 0;
    this._currentTurnId = 0;
  }
}
