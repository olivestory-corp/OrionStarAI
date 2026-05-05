/**
 * MockRobotBridge - 模拟机器人 SDK
 *
 * 使用统一的 MockRobotState 单例，确保与 robotSDK 状态同步
 */

import {
  IRobotBridge,
  Pose,
  Battery,
  NavigationStatus,
  PersonDetectionData,
  Place
} from '../../types';
import { mockRobotState, MockNavigationStatus, MockPose, MockBattery } from '../MockRobotState';

export class MockRobotBridge implements IRobotBridge {
  private poseCallback: ((pose: Pose) => void) | null = null;
  private batteryCallback: ((battery: Battery) => void) | null = null;
  private navigationStatusCallback: ((status: NavigationStatus) => void) | null = null;
  private personDetectedCallback: ((data: PersonDetectionData) => void) | null = null;
  private robotPushedCallback: (() => void) | null = null;
  private mapOutsideCallback: (() => void) | null = null;

  constructor() {
    console.log('[MockRobotBridge] 🤖 使用统一 MockRobotState');

    // 初始化 MockRobotState（如果尚未初始化）
    mockRobotState.initialize();

    // 注册事件监听
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // 监听位置变化
    mockRobotState.on('pose', (pose: MockPose) => {
      if (this.poseCallback) {
        this.poseCallback({
          x: pose.x,
          y: pose.y,
          theta: pose.theta,
          isLocalized: pose.isLocalized,
          name: pose.name
        });
      }
    });

    // 监听电池变化
    mockRobotState.on('battery', (battery: MockBattery) => {
      if (this.batteryCallback) {
        this.batteryCallback({
          level: battery.level,
          isCharging: battery.isCharging
        });
      }
    });

    // 监听导航状态
    mockRobotState.on('navigation_status', (status: MockNavigationStatus) => {
      console.log('[MockRobotBridge] 📍 收到导航状态:', status.type, status.message,
        'callback:', !!this.navigationStatusCallback);
      if (this.navigationStatusCallback) {
        this.navigationStatusCallback({
          type: status.type,
          status: status.status,
          message: status.message,
          destination: status.destination,
          data: status.data
        });
      }
    });

    // 监听人员检测
    mockRobotState.on('person_detected', (data: { count: number; data: any[] }) => {
      if (this.personDetectedCallback) {
        this.personDetectedCallback({
          type: 'person_detected',
          count: data.count,
          data: data.data
        });
      }
    });
  }

  async navigate(placeName: string): Promise<void> {
    const result = mockRobotState.startNavigation(placeName);
    if (!result.success) {
      throw new Error(result.message);
    }
  }

  async stopNavigation(): Promise<void> {
    mockRobotState.stopNavigation();
  }

  async getPosition(): Promise<Pose> {
    const pose = mockRobotState.pose;
    return {
      x: pose.x,
      y: pose.y,
      theta: pose.theta,
      isLocalized: pose.isLocalized,
      name: pose.name
    };
  }

  async getPlaceList(): Promise<Place[]> {
    return mockRobotState.places.map(p => ({
      id: p.id,
      name: p.name,
      x: p.x,
      y: p.y
    }));
  }

  async getBattery(): Promise<Battery> {
    return { ...mockRobotState.battery };
  }

  onPose(callback: (pose: Pose) => void): void {
    this.poseCallback = callback;
    // 立即发送当前位置
    const pose = mockRobotState.pose;
    callback({
      x: pose.x,
      y: pose.y,
      theta: pose.theta,
      isLocalized: pose.isLocalized,
      name: pose.name
    });
  }

  onBattery(callback: (battery: Battery) => void): void {
    this.batteryCallback = callback;
    callback({ ...mockRobotState.battery });
  }

  onNavigationStatus(callback: (status: NavigationStatus) => void): void {
    this.navigationStatusCallback = callback;
  }

  onPersonDetected(callback: (data: PersonDetectionData) => void): void {
    this.personDetectedCallback = callback;
    // 立即发送当前人员状态
    const current = mockRobotState.currentPeople;
    console.log('[MockRobotBridge] 👥 注册人员检测回调，立即发送当前状态:', current.count, '人');
    callback({
      type: 'person_detected',
      count: current.count,
      data: current.data
    });
  }

  onRobotPushed(callback: () => void): void {
    this.robotPushedCallback = callback;
  }

  onMapOutside(callback: () => void): void {
    this.mapOutsideCallback = callback;
  }

  clearCallbacks(): void {
    this.poseCallback = null;
    this.batteryCallback = null;
    this.navigationStatusCallback = null;
    this.personDetectedCallback = null;
    this.robotPushedCallback = null;
    this.mapOutsideCallback = null;
    console.log('[MockRobotBridge] ♻️ 已清理回调');
  }
}