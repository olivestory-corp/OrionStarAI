/**
 * AndroidRobotBridge - Android 机器人 SDK 适配器
 * 通过 window.RobotAPI 与 Android Native SDK 通信
 * 纯 TypeScript 实现
 */

import {
  IRobotBridge,
  Pose,
  Battery,
  NavigationStatus,
  PersonDetectionData,
  Place
} from '../../types';

declare global {
  interface Window {
    RobotAPI?: {
      isRobotEstimate: (callbackId: string) => void;
      getPosition: (callbackId: string) => void;
      getLocation: (placeName: string, callbackId: string) => void;
      setLocation: (placeName: string, callbackId: string) => void;
      getPlaceList: (callbackId: string) => void;
      getMapName: (callbackId: string) => void;
      startNavigation: (placeName: string, callbackId: string, statusCallbackId: string | null) => void;
      stopNavigation: (callbackId: string) => void;
      registerStatusListener: (type: string, callbackId: string) => void;
      registerPersonListener: (callbackId: string) => void;
      startAutoCharge: (timeout: number, callbackId: string, statusCallbackId: string | null) => void;
      stopAutoCharge: (callbackId: string) => void;
      leaveChargingPile: (speed: number, distance: number, callbackId: string, statusCallbackId: string | null) => void;
    };
  }
}

export class AndroidRobotBridge implements IRobotBridge {
  private callbackId = 0;
  private callbacks: Map<string, { resolve: Function; reject: Function }> = new Map();

  // 事件回调
  private poseCallback: ((pose: Pose) => void) | null = null;
  private batteryCallback: ((battery: Battery) => void) | null = null;
  private navigationStatusCallback: ((status: NavigationStatus) => void) | null = null;
  private personDetectedCallback: ((data: PersonDetectionData) => void) | null = null;
  private robotPushedCallback: (() => void) | null = null;
  private mapOutsideCallback: (() => void) | null = null;

  constructor() {
    this.initGlobalCallbacks();
  }

  private get isAndroid(): boolean {
    return typeof window !== 'undefined' && typeof window.RobotAPI !== 'undefined';
  }

  private initGlobalCallbacks(): void {
    // 导航状态回调
    (window as any).navigationStatusCallback = (statusData: any) => {
      try {
        const raw = typeof statusData === 'string' ? JSON.parse(statusData) : statusData;
        console.log('[AndroidRobotBridge] 📍 收到导航状态:', raw);

        // 转换为标准 NavigationStatus 格式
        const status: NavigationStatus = {
          type: raw.type || this.inferNavigationType(raw.status),
          status: raw.status,
          message: raw.message,
          destination: raw.destination || raw.data?.destination,
          data: raw.data
        };

        this.navigationStatusCallback?.(status);
      } catch (e) {
        console.error('[AndroidRobotBridge] 解析导航状态失败:', e);
      }
    };
  }

  /**
   * 根据 Android status code 推断导航状态类型
   */
  private inferNavigationType(status: number): 'update' | 'finished' | 'error' {
    // 导航过程中的状态更新 (1014-1051 范围)
    if (status >= 1014 && status <= 1051) {
      return 'update';
    }
    // 导航成功完成 (1, 102, 103, 104)
    if (status === 1 || status === 102 || status === 103 || status === 104) {
      return 'finished';
    }
    // 导航停止 (3 = ACTION_RESPONSE_STOP_SUCCESS)
    if (status === 3) {
      return 'finished';
    }
    // 错误码 (负数)
    if (status < 0) {
      return 'error';
    }
    // 其他失败情况 (2 = RESULT_FAILURE, 1020-1044 等)
    if (status === 2 || status >= 1020) {
      return 'error';
    }
    // 默认作为更新
    return 'update';
  }

  private generateCallbackId(): string {
    return `robotCallback_${++this.callbackId}_${Date.now()}`;
  }

  private callNative<T>(method: string, ...args: any[]): Promise<T> {
    if (!this.isAndroid) {
      return Promise.reject(new Error('不在 Android 环境中'));
    }

    return new Promise((resolve, reject) => {
      const callbackId = this.generateCallbackId();

      (window as any)[callbackId] = (response: any) => {
        try {
          const data = typeof response === 'string' ? JSON.parse(response) : response;
          if (data.success) {
            resolve(data.data || data);
          } else {
            reject(new Error(data.error || data.message || '操作失败'));
          }
        } catch (e: any) {
          reject(new Error(`解析响应失败: ${e.message}`));
        } finally {
          delete (window as any)[callbackId];
          this.callbacks.delete(callbackId);
        }
      };

      this.callbacks.set(callbackId, { resolve, reject });

      try {
        (window.RobotAPI as any)[method](...args, callbackId);
      } catch (e: any) {
        delete (window as any)[callbackId];
        this.callbacks.delete(callbackId);
        reject(new Error(`调用原生方法失败: ${e.message}`));
      }
    });
  }

  async navigate(placeName: string): Promise<void> {
    if (!placeName) {
      throw new Error('目标位置名称不能为空');
    }

    if (!this.isAndroid) {
      throw new Error('不在 Android 环境中');
    }

    const callbackId = this.generateCallbackId();
    const statusCallbackName = 'navigationStatusCallback';

    return new Promise((resolve, reject) => {
      (window as any)[callbackId] = (response: any) => {
        try {
          const data = typeof response === 'string' ? JSON.parse(response) : response;
          if (data.success) {
            resolve();
          } else {
            reject(new Error(data.error || '导航失败'));
          }
        } finally {
          delete (window as any)[callbackId];
        }
      };

      window.RobotAPI!.startNavigation(placeName, callbackId, statusCallbackName);
    });
  }

  async stopNavigation(): Promise<void> {
    await this.callNative('stopNavigation');
  }

  async getPosition(): Promise<Pose> {
    return this.callNative<Pose>('getPosition');
  }

  async getPlaceList(): Promise<Place[]> {
    return this.callNative<Place[]>('getPlaceList');
  }

  async getBattery(): Promise<Battery> {
    // Android 端通常通过回调推送电量，这里提供一个查询接口
    // 实际可能需要根据 Android 端实现调整
    return { level: 100, isCharging: false };
  }

  onPose(callback: (pose: Pose) => void): void {
    this.poseCallback = callback;

    const callbackId = 'statusListener_pose';
    (window as any)[callbackId] = (event: any) => {
      try {
        const data = typeof event === 'string' ? JSON.parse(event) : event;
        let value = data.value;
        if (typeof value === 'string') {
          value = JSON.parse(value);
        }
        callback({
          x: value.px,
          y: value.py,
          theta: value.theta,
          isLocalized: true
        });
      } catch (e) {
        console.error('[AndroidRobotBridge] 解析位置数据失败:', e);
      }
    };

    if (this.isAndroid) {
      window.RobotAPI!.registerStatusListener('pose', callbackId);
    }
  }

  onBattery(callback: (battery: Battery) => void): void {
    this.batteryCallback = callback;

    const callbackId = 'statusListener_battery';
    (window as any)[callbackId] = (event: any) => {
      try {
        const data = typeof event === 'string' ? JSON.parse(event) : event;
        let value = data.value;
        if (typeof value === 'string') {
          value = JSON.parse(value);
        }

        const level = value.level ?? value.batteryLevel ?? value.capacity ?? 100;
        const isCharging = value.isCharging ?? (value.status === 1);

        callback({
          level: Number(level),
          isCharging: Boolean(isCharging)
        });
      } catch (e) {
        console.error('[AndroidRobotBridge] 解析电量数据失败:', e);
      }
    };

    if (this.isAndroid) {
      window.RobotAPI!.registerStatusListener('battery', callbackId);
    }
  }

  onNavigationStatus(callback: (status: NavigationStatus) => void): void {
    this.navigationStatusCallback = callback;
    // 注意：导航状态回调是通过 startNavigation 的 statusCallbackName 参数传递的
    // 不是通过 registerStatusListener，因为 Android 端不支持 'navigation' 类型
    console.log('[AndroidRobotBridge] ✅ 已设置导航状态回调');
  }

  onPersonDetected(callback: (data: PersonDetectionData) => void): void {
    this.personDetectedCallback = callback;

    const callbackId = 'personDetectionCallback';
    (window as any)[callbackId] = (data: any) => {
      try {
        const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
        callback(parsedData);
      } catch (e) {
        console.error('[AndroidRobotBridge] 解析人员检测数据失败:', e);
      }
    };

    if (this.isAndroid && window.RobotAPI && 'registerPersonListener' in window.RobotAPI) {
      (window.RobotAPI as any).registerPersonListener(callbackId);
    }
  }

  onRobotPushed(callback: () => void): void {
    this.robotPushedCallback = callback;

    const callbackId = 'statusListener_robot_pushed';
    (window as any)[callbackId] = () => {
      callback();
    };

    if (this.isAndroid) {
      window.RobotAPI!.registerStatusListener('robot_pushed', callbackId);
    }
  }

  onMapOutside(callback: () => void): void {
    this.mapOutsideCallback = callback;

    const callbackId = 'statusListener_map_outside';
    (window as any)[callbackId] = () => {
      callback();
    };

    if (this.isAndroid) {
      window.RobotAPI!.registerStatusListener('map_outside', callbackId);
    }
  }

  clearCallbacks(): void {
    // 清理所有回调
    const callbackIds = [
      'navigationStatusCallback',
      'personDetectionCallback',
      'statusListener_pose',
      'statusListener_battery',
      'statusListener_robot_pushed',
      'statusListener_map_outside'
    ];

    callbackIds.forEach(id => {
      if ((window as any)[id]) {
        delete (window as any)[id];
      }
    });

    this.callbacks.forEach((_, key) => {
      if ((window as any)[key]) {
        delete (window as any)[key];
      }
    });
    this.callbacks.clear();

    this.poseCallback = null;
    this.batteryCallback = null;
    this.navigationStatusCallback = null;
    this.personDetectedCallback = null;
    this.robotPushedCallback = null;
    this.mapOutsideCallback = null;
  }
}
