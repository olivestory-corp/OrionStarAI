/**
 * Mock Robot API for development in browser
 * 模拟 Android WebView 注入的 RobotAPI 对象
 *
 * 使用统一的 MockRobotState 单例，确保所有 Mock 系统状态同步
 */

import { mockRobotState, MockNavigationStatus } from './MockRobotState';

// ==================== 辅助函数 ====================

/**
 * 模拟异步回调（Android WebView 风格）
 */
function simulateAsyncCallback(callbackId: string, data: any, delay = 100) {
  setTimeout(() => {
    if ((window as any)[callbackId]) {
      (window as any)[callbackId](JSON.stringify(data));
    }
  }, delay);
}

// ==================== 初始化函数 ====================

export function initMockRobotAPI() {
  // 如果已经存在（在真机上），则不处理
  if ((window as any).RobotAPI) return;

  console.log('🚀 初始化 Mock RobotAPI (使用统一 MockRobotState)');

  // 初始化状态管理器
  mockRobotState.initialize();

  // 注册导航状态回调转发到 window.navigationStatusCallback
  mockRobotState.on('navigation_status', (status: MockNavigationStatus) => {
    const callbackName = 'navigationStatusCallback';
    if ((window as any)[callbackName]) {
      const payload = JSON.stringify({
        type: status.type,
        status: status.status,
        message: status.message,
        destination: status.destination,
        data: status.data
      });
      (window as any)[callbackName](payload);
    }
  });

  // 模拟 Android 注入的全局对象
  (window as any).RobotAPI = {
    // ==================== 位置相关 ====================

    getPosition: (callbackId: string) => {
      const pose = mockRobotState.pose;
      simulateAsyncCallback(callbackId, {
        success: true,
        data: { x: pose.x, y: pose.y, theta: pose.theta }
      });
    },

    getPlaceList: (callbackId: string) => {
      simulateAsyncCallback(callbackId, {
        success: true,
        data: mockRobotState.places
      });
    },

    getLocation: (placeName: string, callbackId: string) => {
      const place = mockRobotState.places.find(p => p.name === placeName);
      if (place) {
        simulateAsyncCallback(callbackId, {
          success: true,
          data: { x: place.x, y: place.y, theta: place.theta || 0 }
        });
      } else {
        simulateAsyncCallback(callbackId, {
          success: false,
          error: `未找到位置: ${placeName}`
        });
      }
    },

    getMapName: (callbackId: string) => {
      simulateAsyncCallback(callbackId, { success: true, data: 'Mock Office Map' });
    },

    // ==================== 导航相关 ====================

    startNavigation: (placeName: string, callbackId: string, _statusCallbackName: string) => {
      console.log(`[Mock RobotAPI] 开始导航前往: ${placeName}`);

      // 立即返回指令接收成功
      simulateAsyncCallback(callbackId, { success: true, message: '导航指令已发送' });

      // 启动导航（由 MockRobotState 驱动）
      mockRobotState.startNavigation(placeName);
    },

    stopNavigation: (callbackId: string) => {
      console.log('[Mock RobotAPI] 停止导航');
      mockRobotState.stopNavigation();
      simulateAsyncCallback(callbackId, { success: true, message: '已停止导航' });
    },

    // ==================== 移动控制 ====================

    goForward: (speed: number, distance: number, _avoid: boolean, callbackId: string) => {
      console.log(`[Mock RobotAPI] 前进: speed=${speed}, distance=${distance}`);

      // 立即返回成功（指令已接收）
      simulateAsyncCallback(callbackId, { success: true, message: '前进指令已发送' });

      // 延迟渐进更新位置 - 每 20ms 更新一次
      const startPose = mockRobotState.pose;
      const duration = Math.max(500, distance * 1000 / speed);
      const updateInterval = 20; // 20ms 更新一次
      const steps = Math.max(10, Math.floor(duration / updateInterval));
      const stepDistance = distance / steps;
      let currentStep = 0;

      const interval = setInterval(() => {
        currentStep++;
        const movedDistance = stepDistance * currentStep;
        const newX = startPose.x + Math.cos(startPose.theta) * movedDistance;
        const newY = startPose.y + Math.sin(startPose.theta) * movedDistance;
        mockRobotState.setPosition(newX, newY, startPose.theta);

        if (currentStep >= steps) {
          clearInterval(interval);
          const finalX = startPose.x + Math.cos(startPose.theta) * distance;
          const finalY = startPose.y + Math.sin(startPose.theta) * distance;
          mockRobotState.setPosition(finalX, finalY, startPose.theta);
          console.log(`[Mock RobotAPI] 前进完成: (${finalX.toFixed(2)}, ${finalY.toFixed(2)})`);
        }
      }, updateInterval);
    },

    goBackward: (speed: number, distance: number, callbackId: string) => {
      console.log(`[Mock RobotAPI] 后退: speed=${speed}, distance=${distance}`);

      // 立即返回成功（指令已接收）
      simulateAsyncCallback(callbackId, { success: true, message: '后退指令已发送' });

      // 延迟渐进更新位置 - 每 20ms 更新一次
      const startPose = mockRobotState.pose;
      const duration = Math.max(500, distance * 1000 / speed);
      const updateInterval = 20; // 20ms 更新一次
      const steps = Math.max(10, Math.floor(duration / updateInterval));
      const stepDistance = distance / steps;
      let currentStep = 0;

      const interval = setInterval(() => {
        currentStep++;
        const movedDistance = stepDistance * currentStep;
        const newX = startPose.x - Math.cos(startPose.theta) * movedDistance;
        const newY = startPose.y - Math.sin(startPose.theta) * movedDistance;
        mockRobotState.setPosition(newX, newY, startPose.theta);

        if (currentStep >= steps) {
          clearInterval(interval);
          const finalX = startPose.x - Math.cos(startPose.theta) * distance;
          const finalY = startPose.y - Math.sin(startPose.theta) * distance;
          mockRobotState.setPosition(finalX, finalY, startPose.theta);
          console.log(`[Mock RobotAPI] 后退完成: (${finalX.toFixed(2)}, ${finalY.toFixed(2)})`);
        }
      }, updateInterval);
    },

    turnLeft: (speed: number, angle: number, callbackId: string) => {
      console.log(`[Mock RobotAPI] 左转: speed=${speed}, angle=${angle}`);

      // 立即返回成功（指令已接收）
      simulateAsyncCallback(callbackId, { success: true, message: '左转指令已发送' });

      // 延迟渐进更新角度 - 每 20ms 更新一次
      const startPose = mockRobotState.pose;
      const targetRadians = (angle * Math.PI) / 180;
      const duration = Math.max(300, angle * 20); // 转向更快
      const updateInterval = 20; // 20ms 更新一次
      const steps = Math.max(10, Math.floor(duration / updateInterval));
      const stepAngle = targetRadians / steps;
      let currentStep = 0;

      const interval = setInterval(() => {
        currentStep++;
        const newTheta = startPose.theta + stepAngle * currentStep;
        mockRobotState.setPosition(startPose.x, startPose.y, newTheta);

        if (currentStep >= steps) {
          clearInterval(interval);
          mockRobotState.setPosition(startPose.x, startPose.y, startPose.theta + targetRadians);
          console.log(`[Mock RobotAPI] 左转完成: theta=${(startPose.theta + targetRadians).toFixed(2)}`);
        }
      }, updateInterval);
    },

    turnRight: (speed: number, angle: number, callbackId: string) => {
      console.log(`[Mock RobotAPI] 右转: speed=${speed}, angle=${angle}`);

      // 立即返回成功（指令已接收）
      simulateAsyncCallback(callbackId, { success: true, message: '右转指令已发送' });

      // 延迟渐进更新角度 - 每 20ms 更新一次
      const startPose = mockRobotState.pose;
      const targetRadians = (angle * Math.PI) / 180;
      const duration = Math.max(300, angle * 20); // 转向更快
      const updateInterval = 20; // 20ms 更新一次
      const steps = Math.max(10, Math.floor(duration / updateInterval));
      const stepAngle = targetRadians / steps;
      let currentStep = 0;

      const interval = setInterval(() => {
        currentStep++;
        const newTheta = startPose.theta - stepAngle * currentStep;
        mockRobotState.setPosition(startPose.x, startPose.y, newTheta);

        if (currentStep >= steps) {
          clearInterval(interval);
          mockRobotState.setPosition(startPose.x, startPose.y, startPose.theta - targetRadians);
          console.log(`[Mock RobotAPI] 右转完成: theta=${(startPose.theta - targetRadians).toFixed(2)}`);
        }
      }, updateInterval);
    },

    stopMove: (callbackId: string) => {
      console.log('[Mock RobotAPI] 停止移动');
      simulateAsyncCallback(callbackId, { success: true, message: '已停止移动' });
    },

    // ==================== 电池相关 ====================

    getBatteryInfo: (callbackId: string) => {
      const battery = mockRobotState.battery;
      simulateAsyncCallback(callbackId, {
        success: true,
        data: { level: battery.level, isCharging: battery.isCharging }
      });
    },

    startAutoCharge: (callbackId: string, _statusCallbackName: string) => {
      console.log('[Mock RobotAPI] 开始自动充电');
      simulateAsyncCallback(callbackId, { success: true, message: '开始前往充电桩' });

      // 模拟导航到充电桩
      mockRobotState.startNavigation('充电桩');

      // 到达后开始充电
      const checkArrival = setInterval(() => {
        if (!mockRobotState.isNavigating) {
          clearInterval(checkArrival);
          mockRobotState.setBattery(mockRobotState.battery.level, true);
          console.log('[Mock RobotAPI] 已开始充电');
        }
      }, 500);
    },

    stopAutoCharge: (callbackId: string) => {
      console.log('[Mock RobotAPI] 停止自动充电');
      mockRobotState.setBattery(mockRobotState.battery.level, false);
      simulateAsyncCallback(callbackId, { success: true, message: '已停止充电' });
    },

    leaveChargingPile: (_speed: number, _distance: number, callbackId: string) => {
      console.log('[Mock RobotAPI] 离开充电桩');
      mockRobotState.setBattery(mockRobotState.battery.level, false);
      const pose = mockRobotState.pose;
      mockRobotState.setPosition(pose.x + 1, pose.y);
      simulateAsyncCallback(callbackId, { success: true, message: '已离开充电桩' });
    },

    // ==================== 人脸/跟随相关 ====================

    startFocusFollow: (personId: number, callbackId: string) => {
      console.log(`[Mock RobotAPI] 开始跟随: personId=${personId}`);
      simulateAsyncCallback(callbackId, { success: true, message: '开始跟随' });
    },

    stopFocusFollow: (callbackId: string) => {
      console.log('[Mock RobotAPI] 停止跟随');
      simulateAsyncCallback(callbackId, { success: true, message: '已停止跟随' });
    },

    // ==================== 语音相关 ====================

    speak: (text: string, callbackId: string) => {
      console.log(`[Mock RobotAPI] 语音播放: ${text}`);
      simulateAsyncCallback(callbackId, { success: true });
    },

    stopSpeak: (callbackId: string) => {
      console.log('[Mock RobotAPI] 停止语音');
      simulateAsyncCallback(callbackId, { success: true });
    },

    // ==================== 回调注册 ====================

    setPoseCallback: (callbackName: string) => {
      console.log(`[Mock RobotAPI] 注册位置回调: ${callbackName}`);
      mockRobotState.on('pose', (pose) => {
        if ((window as any)[callbackName]) {
          (window as any)[callbackName](JSON.stringify({
            x: pose.x,
            y: pose.y,
            theta: pose.theta,
            isLocalized: pose.isLocalized
          }));
        }
      });
    },

    setBatteryCallback: (callbackName: string) => {
      console.log(`[Mock RobotAPI] 注册电池回调: ${callbackName}`);
      mockRobotState.on('battery', (battery) => {
        if ((window as any)[callbackName]) {
          (window as any)[callbackName](JSON.stringify({
            level: battery.level,
            isCharging: battery.isCharging
          }));
        }
      });
    },

    setPersonDetectionCallback: (callbackName: string) => {
      console.log(`[Mock RobotAPI] 注册人员检测回调: ${callbackName}`);
      mockRobotState.on('person_detected', (data) => {
        if ((window as any)[callbackName]) {
          (window as any)[callbackName](JSON.stringify({
            type: 'person_detected',
            count: data.count,
            data: data.data
          }));
        }
      });
    }
  };

  console.log('✅ Mock RobotAPI 初始化完成');
}

// 导出状态（兼容旧代码）
export { mockRobotState };