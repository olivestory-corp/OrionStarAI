/**
 * RobotEnvironment - 机器人环境感知管理器
 * 纯 TypeScript 实现，无 React 依赖
 */

import { EventEmitter } from 'events';
import {
  IRobotBridge,
  Pose,
  Battery,
  NavigationStatus,
  PersonDetectionData,
  RobotEnvironmentState
} from '../types';
import { AndroidRobotBridge } from './adapters/AndroidRobotBridge';
import { MockRobotBridge } from './adapters/MockRobotBridge';

export interface RobotEnvironmentConfig {
  /** 自定义机器人 Bridge */
  robotBridge?: IRobotBridge;
  /** 最小状态同步间隔 (ms) */
  minSyncInterval?: number;
}

// 默认初始状态
const INITIAL_STATE: RobotEnvironmentState = {
  timestamp: 0,
  battery: { level: 100, isCharging: false },
  pose: { x: 0, y: 0, theta: 0, isLocalized: false },
  navigation: { status: 'idle' },
  emergency: { isStopPressed: false, isPushed: false, isOutsideMap: false },
  people: { count: 0, list: [] }
};

/**
 * 机器人环境感知管理器
 *
 * Events:
 * - 'state_change': (state, syncToLLM) 状态变化，syncToLLM 表示是否需要同步给大模型
 * - 'arrived': 到达目的地
 * - 'person_detected': 检测到人
 * - 'emergency': 紧急状态
 */
export class RobotEnvironment extends EventEmitter {
  private robotBridge: IRobotBridge;
  private currentState: RobotEnvironmentState;
  private lastSentState: RobotEnvironmentState;
  private lastSentTime: number = 0;
  private minSyncInterval: number;
  private enabled: boolean = false;
  private checkTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: RobotEnvironmentConfig = {}) {
    super();
    this.robotBridge = config.robotBridge ?? this.detectDefaultBridge();
    this.minSyncInterval = config.minSyncInterval ?? 15000;
    this.currentState = { ...INITIAL_STATE };
    this.lastSentState = { ...INITIAL_STATE };
  }

  private detectDefaultBridge(): IRobotBridge {
    // 检查是否是真正的 Android 环境（Mock 不会有 registerStatusListener）
    if (typeof window !== 'undefined' &&
        typeof (window as any).RobotAPI !== 'undefined' &&
        typeof (window as any).RobotAPI.registerStatusListener === 'function') {
      console.log('[RobotEnvironment] 检测到真实 Android 环境');
      return new AndroidRobotBridge();
    }
    console.log('[RobotEnvironment] 使用 Mock 机器人');
    return new MockRobotBridge();
  }

  get state(): RobotEnvironmentState {
    return { ...this.currentState };
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * 启用环境监控
   */
  enable(): void {
    if (this.enabled) return;
    this.enabled = true;
    this.registerCallbacks();
    this.startPeriodicCheck();
    console.log('[RobotEnvironment] ✅ 已启用');
  }

  /**
   * 禁用环境监控
   */
  disable(): void {
    if (!this.enabled) return;
    this.enabled = false;
    this.stopPeriodicCheck();
    console.log('[RobotEnvironment] ❌ 已禁用');
  }

  private registerCallbacks(): void {
    // 位置更新
    this.robotBridge.onPose((pose: Pose) => {
      this.updateState({
        pose: {
          x: pose.x,
          y: pose.y,
          theta: pose.theta,
          isLocalized: pose.isLocalized !== false,
          name: pose.name
        }
      });
    });

    // 电量更新
    this.robotBridge.onBattery((battery: Battery) => {
      this.updateState({ battery });
    });

    // 导航状态
    this.robotBridge.onNavigationStatus((status: NavigationStatus) => {
      console.log('[RobotEnvironment] 🧭 导航状态:', status);

      if (status.type === 'update') {
        const dest = status.destination || status.data?.destination || status.data?.name;
        this.updateState({
          navigation: { status: 'navigating', destination: dest }
        });
      } else if (status.type === 'finished') {
        const dest = status.data?.destination || status.destination;
        this.updateState({
          navigation: { status: 'idle', destination: undefined }
        });

        // 检查是否成功到达
        if (status.message === '导航成功' || status.status === 1002) {
          console.log(`[RobotEnvironment] 🎉 到达: ${dest}`);
          this.emit('arrived', dest);
        }
      } else if (status.type === 'error') {
        this.updateState({
          navigation: { status: 'idle', destination: undefined }
        });
      }
    });

    // 人员检测
    this.robotBridge.onPersonDetected((data: PersonDetectionData) => {
      this.updateState({
        people: { count: data.count, list: data.data }
      });

      if (data.count > 0) {
        this.emit('person_detected', data);
      }
    });

    // 机器人被推
    if (this.robotBridge.onRobotPushed) {
      this.robotBridge.onRobotPushed(() => {
        this.updateState({
          emergency: { ...this.currentState.emergency, isPushed: true }
        });
        this.emit('emergency', { type: 'pushed' });
      });
    }

    // 出地图
    if (this.robotBridge.onMapOutside) {
      this.robotBridge.onMapOutside(() => {
        this.updateState({
          emergency: { ...this.currentState.emergency, isOutsideMap: true }
        });
        this.emit('emergency', { type: 'outside_map' });
      });
    }
  }

  private updateState(partial: Partial<RobotEnvironmentState>): void {
    const oldState = this.currentState;
    const newState: RobotEnvironmentState = {
      ...this.currentState,
      ...partial,
      timestamp: Date.now()
    };

    this.currentState = newState;

    // 导航状态变化立即触发（UI + LLM 都需要）
    const navigationChanged =
      oldState.navigation.status !== newState.navigation.status ||
      oldState.navigation.destination !== newState.navigation.destination;

    if (navigationChanged) {
      console.log('[RobotEnvironment] 🚀 导航状态变化 (syncToLLM=true)');
      this.lastSentState = newState;
      this.lastSentTime = Date.now();
      this.emit('state_change', newState, true); // syncToLLM = true
      return;
    }

    // 人员检测变化立即触发（仅 UI 需要，LLM 不需要）
    const peopleCountChanged = oldState.people.count !== newState.people.count;
    const oldMinDist = oldState.people.list.length > 0
      ? Math.min(...oldState.people.list.map(p => p.distance))
      : Infinity;
    const newMinDist = newState.people.list.length > 0
      ? Math.min(...newState.people.list.map(p => p.distance))
      : Infinity;
    const distanceChanged = Math.abs(oldMinDist - newMinDist) > 0.1;

    if (peopleCountChanged || distanceChanged) {
      //console.log('[RobotEnvironment] 👥 人员状态变化 (syncToLLM=false):',
      //  `count: ${oldState.people.count} -> ${newState.people.count}`,
      //  `minDist: ${oldMinDist.toFixed(2)} -> ${newMinDist.toFixed(2)}`);
      // 人员变化仅更新 UI，不同步给 LLM，不更新 lastSentTime
      this.emit('state_change', newState, false); // syncToLLM = false
      return;
    }

    // 其他状态变化：节流处理（给大模型同步用）
    const now = Date.now();
    const timeSinceLastSend = now - this.lastSentTime;

    if (timeSinceLastSend >= this.minSyncInterval && this.hasSignificantChange(this.lastSentState, newState)) {
      console.log('[RobotEnvironment] 📡 定期状态同步 (syncToLLM=true)');
      this.lastSentState = newState;
      this.lastSentTime = now;
      this.emit('state_change', newState, true); // syncToLLM = true
    }
  }

  private hasSignificantChange(old: RobotEnvironmentState, now: RobotEnvironmentState): boolean {
    // 紧急状态变化
    if (old.emergency.isStopPressed !== now.emergency.isStopPressed) return true;
    if (old.emergency.isPushed !== now.emergency.isPushed) return true;
    if (old.emergency.isOutsideMap !== now.emergency.isOutsideMap) return true;

    // 导航状态变化
    if (old.navigation.status !== now.navigation.status) return true;
    if (old.navigation.destination !== now.navigation.destination) return true;

    // 电量变化 > 1% 或充电状态改变
    if (old.battery.isCharging !== now.battery.isCharging) return true;
    if (Math.abs(old.battery.level - now.battery.level) >= 1) return true;

    // 位置变化 > 2米 或定位状态改变
    if (old.pose.isLocalized !== now.pose.isLocalized) return true;
    const dist = Math.sqrt(
      Math.pow(old.pose.x - now.pose.x, 2) +
      Math.pow(old.pose.y - now.pose.y, 2)
    );
    if (dist > 2.0) return true;

    // 人员数量变化
    // if (old.people.count !== now.people.count) return true;

    // 时间变化（分钟级别）
    const oldMinute = Math.floor(old.timestamp / 60000);
    const newMinute = Math.floor(now.timestamp / 60000);
    if (oldMinute !== newMinute) return true;

    return false;
  }

  private startPeriodicCheck(): void {
    // 每分钟强制检查一次
    this.checkTimer = setInterval(() => {
      this.updateState({});
    }, 60000);
  }

  private stopPeriodicCheck(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }

  /**
   * 格式化状态为 Prompt
   */
  formatStateToPrompt(): string {
    const state = this.currentState;
    const timeString = new Date(state.timestamp).toLocaleTimeString();
    const parts = [`[System Environment Update at ${timeString}]`];

    // 紧急状态
    if (state.emergency.isStopPressed) parts.push("⚠️ EMERGENCY STOP PRESSED");
    if (state.emergency.isPushed) parts.push("⚠️ ROBOT IS BEING PUSHED");
    if (state.emergency.isOutsideMap) parts.push("⚠️ ROBOT OUTSIDE MAP");

    // 导航状态
    if (state.navigation.status !== 'idle') {
      parts.push(`Navigation: ${state.navigation.status.toUpperCase()}${state.navigation.destination ? ` to "${state.navigation.destination}"` : ''}`);
    }

    // 位置
    const loc = state.pose.name
      ? `at "${state.pose.name}"`
      : `at (${state.pose.x.toFixed(1)}, ${state.pose.y.toFixed(1)})`;
    parts.push(`Location: ${state.pose.isLocalized ? loc : 'Not Localized'}`);

    // 电量
    parts.push(`Battery: ${state.battery.level}%${state.battery.isCharging ? ' (Charging)' : ''}`);

    // 人员
    // if (state.people.count > 0) {
    //   const peopleList = state.people.list.slice(0, 3).map(p =>
    //     `[ID:${p.id}, ${p.distance.toFixed(1)}m]`
    //   ).join(', ');
    //   parts.push(`People: ${state.people.count} (${peopleList})`);
    // }

    return parts.join(' | ');
  }

  // ==================== 机器人控制 API ====================

  async navigate(placeName: string): Promise<void> {
    return this.robotBridge.navigate(placeName);
  }

  async stopNavigation(): Promise<void> {
    return this.robotBridge.stopNavigation();
  }

  async getPosition(): Promise<Pose> {
    return this.robotBridge.getPosition();
  }

  async getPlaceList() {
    return this.robotBridge.getPlaceList();
  }

  async getBattery(): Promise<Battery> {
    return this.robotBridge.getBattery();
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    this.disable();
    this.robotBridge.clearCallbacks();
    this.removeAllListeners();
    console.log('[RobotEnvironment] ♻️ 已销毁');
  }
}
