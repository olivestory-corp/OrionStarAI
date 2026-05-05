/**
 * Robot Navigation SDK
 * JavaScript SDK for OrionStar Robot Navigation API
 * Version: 1.0.0
 *
 * 提供机器人地图导航功能的JavaScript封装
 * 可在Android WebView或其他支持RobotAPI桥接的环境中使用
 */

class RobotNavigationSDK {
    version: string;
    callbackId: number;
    callbacks: Record<string, boolean>;
    isAndroid: boolean;

    constructor() {
        this.version = '1.0.0';
        this.callbackId = 0;
        this.callbacks = {};

        // 检查是否在Android WebView环境中 (或者 Mock 环境)
        this.isAndroid = typeof (window as any).RobotAPI !== 'undefined';

        if (!this.isAndroid) {
            console.warn('RobotNavigation SDK: 未检测到Android WebView环境，部分功能可能不可用');
        }

        // 注意: 导航状态回调由 AndroidRobotBridge + RobotEnvironment 统一管理
        // 不再在这里注册 window.navigationStatusCallback

        console.log(`RobotNavigation SDK v${this.version} 已初始化`);
    }

    /**
     * 生成唯一的回调ID
     * @private
     */
    _generateCallbackId() {
        return `robotCallback_${++this.callbackId}_${Date.now()}`;
    }

    /**
     * 注册回调函数
     * @private
     */
    _registerCallback(callbackId: string, resolve: Function, reject: Function) {
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
                // 清理回调函数
                delete (window as any)[callbackId];
            }
        };

        (this.callbacks as any)[callbackId] = true;
    }

    /**
     * 调用Android原生方法
     * @private
     */
    _callNative(method: string, ...args: any[]) {
        // 重新检查环境 (因为 Mock 可能延迟注入)
        this.isAndroid = typeof (window as any).RobotAPI !== 'undefined';

        if (!this.isAndroid) {
            return Promise.reject(new Error('不在Android环境中'));
        }

        return new Promise((resolve, reject) => {
            try {
                const callbackId = this._generateCallbackId();
                this._registerCallback(callbackId, resolve, reject);

                // 调用Android方法
                (window as any).RobotAPI[method](...args, callbackId);
            } catch (e: any) {
                reject(new Error(`调用原生方法失败: ${e.message}`));
            }
        });
    }

    /**
     * 判断机器人是否已定位
     */
    async isRobotEstimate() {
        return this._callNative('isRobotEstimate');
    }

    /**
     * 获取机器人当前坐标点
     */
    async getPosition() {
        return this._callNative('getPosition');
    }

    /**
     * 根据位置名称获取坐标点
     */
    async getLocation(placeName: string) {
        if (!placeName || typeof placeName !== 'string') {
            throw new Error('位置名称必须是非空字符串');
        }
        return this._callNative('getLocation', placeName);
    }

    /**
     * 设置当前位置名称（设点）
     */
    async setLocation(placeName: string) {
        if (!placeName || typeof placeName !== 'string') {
            throw new Error('位置名称必须是非空字符串');
        }
        return this._callNative('setLocation', placeName);
    }

    /**
     * 获取当前地图所有位置点列表
     */
    async getPlaceList() {
        return this._callNative('getPlaceList');
    }

    /**
     * 获取当前地图名称
     */
    async getMapName() {
        return this._callNative('getMapName');
    }

    /**
     * 设置导航状态更新回调
     * @deprecated 导航状态回调现在由 AndroidRobotBridge + RobotEnvironment 统一管理
     */
    setNavigationStatusCallback(_callback: Function) {
        console.warn('[RobotSDK] ⚠️ setNavigationStatusCallback 已废弃，导航状态由 RobotEnvironment 统一管理');
    }

    /**
     * 注册状态监听器 (通用)
     * @param type 监听类型 ('pose' | 'battery' | 'emergency')
     * @param callback 回调函数
     */
    registerStatusListener(type: string, callback: Function) {
        if (typeof callback !== 'function') {
            throw new Error('回调必须是函数');
        }

        const callbackId = `statusListener_${type}`;

        // 注册全局回调
        (window as any)[callbackId] = (event: any) => {
            try {
                // Android 传回来的 event 可能是字符串也可能是对象
                const data = typeof event === 'string' ? JSON.parse(event) : event;

                // 解析 value 字段 (通常也是 JSON 字符串)
                let parsedValue = data.value;
                try {
                    if (typeof data.value === 'string') {
                        parsedValue = JSON.parse(data.value);
                    }
                } catch (e) {
                    // value 可能不是 JSON，保持原样
                }

                callback(parsedValue, data.timestamp);
            } catch (e) {
                console.error(`解析状态监听数据失败 (${type}):`, e);
            }
        };

        // 调用 Android 注册接口
        if (this.isAndroid) {
            (window as any).RobotAPI.registerStatusListener(type, callbackId);
        } else {
            console.warn(`[Mock] 注册监听器: ${type} (RobotAPI未定义)`);
        }
    }

    /**
     * 设置位置更新回调
     */
    setPoseCallback(callback: Function) {
        this.registerStatusListener('pose', (pose: any) => {
            // 适配数据结构
            callback({
                x: pose.px,
                y: pose.py,
                theta: pose.theta,
                isLocalized: true // 假设有数据就是已定位
            });
        });
    }

    /**
     * 设置电量更新回调
     */
    setBatteryCallback(callback: Function) {
        this.registerStatusListener('battery', (battery: any) => {
            console.log('[RobotSDK] 🔋 Raw Battery Data:', battery);

            // 尝试兼容不同的字段名
            const level = battery.level ?? battery.batteryLevel ?? battery.capacity ?? 100;
            const isCharging = battery.isCharging ?? (battery.status === 1);

            callback({
                level: Number(level),
                isCharging: Boolean(isCharging)
            });
        });
    }

    /**
     * 设置机器人被推状态回调
     */
    setRobotPushedCallback(callback: Function) {
        this.registerStatusListener('robot_pushed', (data: any) => {
            console.log('[RobotSDK] ⚠️ Robot Pushed:', data);
            callback(true);
        });
    }

    /**
     * 设置机器人出地图状态回调
     */
    setMapOutsideCallback(callback: Function) {
        this.registerStatusListener('map_outside', (data: any) => {
            console.log('[RobotSDK] ⚠️ Robot Outside Map:', data);
            callback(true);
        });
    }

    /**
     * 设置人员检测回调
     */
    setPersonDetectionCallback(callback: Function) {
        if (typeof callback !== 'function') {
            throw new Error('回调必须是函数');
        }

        const callbackId = 'personDetectionCallback';
        (window as any)[callbackId] = (data: any) => {
            try {
                const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
                callback(parsedData);
            } catch (e) {
                console.error('解析人员检测数据失败:', e);
            }
        };

        if (this.isAndroid) {
            if (typeof (window as any).RobotAPI.registerPersonListener === 'function') {
                (window as any).RobotAPI.registerPersonListener(callbackId);
            } else {
                console.warn('RobotNavigation SDK: registerPersonListener method not found in RobotAPI bridge.');
            }
        } else {
            console.warn('[Mock] 注册人员检测监听 (RobotAPI未定义)');
        }
    }

    /**
     * 获取当前检测到的人员列表
     */
    async getPersonList() {
        return this._callNative('getPersonList');
    }

    /**
     * 控制头部运动
     * @param hAngle 水平角度 (-120 ~ 120)
     * @param vAngle 垂直角度 (0 ~ 45)
     */
    async moveHead(hAngle: number, vAngle: number) {
        return this._callNative('moveHead', hAngle, vAngle);
    }

    /**
     * 头部复位
     */
    async resetHead() {
        return this._callNative('resetHead');
    }

    /**
     * 设置灯光
     * @param color RGB Hex String (e.g., "FF0000")
     */
    async setLight(color: string) {
        return this._callNative('setLight', 0, color);
    }

    /**
     * 开始焦点跟随
     * @param personId 人员ID
     */
    async startFocusFollow(personId: number) {
        return this._callNative('startFocusFollow', personId);
    }

    /**
     * 停止焦点跟随
     */
    async stopFocusFollow() {
        return this._callNative('stopFocusFollow');
    }

    /**
     * 机器人前进
     * @param distance 距离 (米)
     * @param speed 速度 (m/s, 默认 0.5)
     * @param avoid 是否避障 (默认 true)
     */
    async goForward(distance: number, speed: number = 0.5, avoid: boolean = true) {
        return this._callNative('goForward', speed, distance, avoid);
    }

    /**
     * 机器人后退
     * @param distance 距离 (米)
     * @param speed 速度 (m/s, 默认 0.5)
     */
    async goBackward(distance: number, speed: number = 0.5) {
        return this._callNative('goBackward', speed, distance);
    }

    /**
     * 机器人左转
     * @param angle 角度 (度)
     * @param speed 速度 (度/s, 默认 30)
     */
    async turnLeft(angle: number, speed: number = 30) {
        return this._callNative('turnLeft', speed, angle);
    }

    /**
     * 机器人右转
     * @param angle 角度 (度)
     * @param speed 速度 (度/s, 默认 30)
     */
    async turnRight(angle: number, speed: number = 30) {
        return this._callNative('turnRight', speed, angle);
    }

    /**
     * 开始导航到指定位置
     */
    async startNavigation(placeName: string) {
        if (!placeName || typeof placeName !== 'string') {
            throw new Error('目标位置名称必须是非空字符串');
        }

        // 重新检查环境
        this.isAndroid = typeof (window as any).RobotAPI !== 'undefined';
        if (!this.isAndroid) {
             return Promise.reject(new Error('不在Android环境中'));
        }

        // 总是传递 'navigationStatusCallback'，由 AndroidRobotBridge 的全局回调统一处理
        const statusCallbackName = 'navigationStatusCallback';

        return new Promise((resolve, reject) => {
            try {
                const callbackId = this._generateCallbackId();
                this._registerCallback(callbackId, resolve, reject);

                // 调用Android方法，传递状态回调
                (window as any).RobotAPI.startNavigation(placeName, callbackId, statusCallbackName);
            } catch (e: any) {
                reject(new Error(`启动导航失败: ${e.message}`));
            }
        });
    }

    /**
     * 停止导航
     */
    async stopNavigation() {
        return this._callNative('stopNavigation');
    }

    /**
     * 开始自动回充
     * 机器人会自动导航到充电桩并开始充电
     * @param timeout 导航超时时间(毫秒)，默认5分钟
     */
    async startAutoCharge(timeout: number = 300000) {
        // 重新检查环境
        this.isAndroid = typeof (window as any).RobotAPI !== 'undefined';
        if (!this.isAndroid) {
            return Promise.reject(new Error('不在Android环境中'));
        }

        // 总是传递 'navigationStatusCallback'，由 AndroidRobotBridge 的全局回调统一处理
        const statusCallbackName = 'navigationStatusCallback';

        return new Promise((resolve, reject) => {
            try {
                const callbackId = this._generateCallbackId();
                this._registerCallback(callbackId, resolve, reject);

                // 调用Android方法，传递状态回调
                (window as any).RobotAPI.startAutoCharge(timeout, callbackId, statusCallbackName);
            } catch (e: any) {
                reject(new Error(`启动自动回充失败: ${e.message}`));
            }
        });
    }

    /**
     * 停止自动回充
     */
    async stopAutoCharge() {
        return this._callNative('stopAutoCharge');
    }

    /**
     * 停止充电并脱离充电桩
     * @param speed 离桩速度 (m/s, 建议 0.1~0.3)
     * @param distance 离桩距离 (m, 建议 0.5~1.0)
     */
    async leaveChargingPile(speed: number = 0.2, distance: number = 0.5) {
        return new Promise((resolve, reject) => {
            const callbackId = this._generateCallbackId();
            this._registerCallback(callbackId, resolve, reject);
            const statusCallbackName = `leaveChargingPileStatus_${Date.now()}`;

            // 注册状态回调 (转发给全局 navigationStatusCallback)
            (window as any)[statusCallbackName] = (data: any) => {
                const payload = typeof data === 'string' ? JSON.parse(data) : data;
                console.log('[RobotSDK] 离桩状态更新:', payload);

                // 转发给全局导航状态回调 (由 AndroidRobotBridge 注册)
                if (typeof (window as any).navigationStatusCallback === 'function') {
                    (window as any).navigationStatusCallback(payload);
                }
            };

            try {
                (window as any).RobotAPI.leaveChargingPile(speed, distance, callbackId, statusCallbackName);
            } catch (e: any) {
                reject(new Error(`离桩失败: ${e.message}`));
            }
        });
    }

    /**
     * 订阅位置变化（仅 Mock 模式有效）
     * @param callback 位置变化回调
     * @returns 取消订阅函数
     */
    subscribePose(callback: (pose: { x: number; y: number; theta: number }) => void): () => void {
        // 动态导入 mockRobotState 避免循环依赖
        try {
            const { mockRobotState } = require('./MockRobotState');
            if (mockRobotState) {
                mockRobotState.on('pose', callback);
                console.log('[RobotSDK] 📍 已订阅位置变化');
                return () => {
                    mockRobotState.off('pose', callback);
                    console.log('[RobotSDK] 📍 已取消订阅位置变化');
                };
            }
        } catch (e) {
            console.warn('[RobotSDK] Mock 模式不可用，位置订阅无效');
        }
        return () => {};
    }

    /**
     * 清理所有回调函数
     */
    cleanup() {
        // 清理所有注册的回调
        for (const callbackId in this.callbacks) {
            if ((window as any)[callbackId]) {
                delete (window as any)[callbackId];
            }
        }
        this.callbacks = {};

        // 注意: 不再清理 window.navigationStatusCallback，由 AndroidRobotBridge 管理

        console.log('RobotNavigation SDK 已清理');
    }
}

// 创建全局实例
const robotSDK = new RobotNavigationSDK();

export default robotSDK;
