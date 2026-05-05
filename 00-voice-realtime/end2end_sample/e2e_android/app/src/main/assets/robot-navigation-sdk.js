/**
 * Robot Navigation SDK
 * JavaScript SDK for OrionStar Robot Navigation API
 * Version: 1.0.0
 *
 * 提供机器人地图导航功能的JavaScript封装
 * 可在Android WebView或其他支持RobotAPI桥接的环境中使用
 */

(function(window) {
    'use strict';

    /**
     * RobotNavigation SDK 主类
     */
    class RobotNavigationSDK {
        constructor() {
            this.version = '1.0.0';
            this.callbackId = 0;
            this.callbacks = {};
            this.navigationStatusCallback = null;

            // 检查是否在Android WebView环境中
            this.isAndroid = typeof window.RobotAPI !== 'undefined';

            if (!this.isAndroid) {
                console.warn('RobotNavigation SDK: 未检测到Android WebView环境，部分功能可能不可用');
            }

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
        _registerCallback(callbackId, resolve, reject) {
            window[callbackId] = (response) => {
                try {
                    const data = typeof response === 'string' ? JSON.parse(response) : response;

                    if (data.success) {
                        resolve(data.data || data);
                    } else {
                        reject(new Error(data.error || data.message || '操作失败'));
                    }
                } catch (e) {
                    reject(new Error(`解析响应失败: ${e.message}`));
                } finally {
                    // 清理回调函数
                    delete window[callbackId];
                }
            };

            this.callbacks[callbackId] = true;
        }

        /**
         * 调用Android原生方法
         * @private
         */
        _callNative(method, ...args) {
            if (!this.isAndroid) {
                return Promise.reject(new Error('不在Android环境中'));
            }

            return new Promise((resolve, reject) => {
                try {
                    const callbackId = this._generateCallbackId();
                    this._registerCallback(callbackId, resolve, reject);

                    // 调用Android方法
                    window.RobotAPI[method](...args, callbackId);
                } catch (e) {
                    reject(new Error(`调用原生方法失败: ${e.message}`));
                }
            });
        }

        /**
         * 判断机器人是否已定位
         * @returns {Promise<boolean>} 是否已定位
         *
         * @example
         * const isEstimated = await robotSDK.isRobotEstimate();
         * console.log('机器人已定位:', isEstimated);
         */
        async isRobotEstimate() {
            return this._callNative('isRobotEstimate');
        }

        /**
         * 获取机器人当前坐标点
         * @returns {Promise<{x: number, y: number, theta: number}>} 机器人位置
         *
         * @example
         * const position = await robotSDK.getPosition();
         * console.log('当前位置:', position);
         * // 输出: { x: 1.5, y: 2.3, theta: 0.5 }
         */
        async getPosition() {
            return this._callNative('getPosition');
        }

        /**
         * 根据位置名称获取坐标点
         * @param {string} placeName - 位置名称
         * @returns {Promise<{exist: boolean, name: string, x?: number, y?: number, theta?: number}>} 位置信息
         *
         * @example
         * const location = await robotSDK.getLocation('接待点');
         * if (location.exist) {
         *   console.log('位置坐标:', location.x, location.y);
         * }
         */
        async getLocation(placeName) {
            if (!placeName || typeof placeName !== 'string') {
                throw new Error('位置名称必须是非空字符串');
            }
            return this._callNative('getLocation', placeName);
        }

        /**
         * 设置当前位置名称（设点）
         * @param {string} placeName - 位置名称
         * @returns {Promise<{placeName: string, message: string}>} 设置结果
         *
         * @example
         * const result = await robotSDK.setLocation('新位置点');
         * console.log(result.message); // '位置保存成功'
         */
        async setLocation(placeName) {
            if (!placeName || typeof placeName !== 'string') {
                throw new Error('位置名称必须是非空字符串');
            }
            return this._callNative('setLocation', placeName);
        }

        /**
         * 获取当前地图所有位置点列表
         * @returns {Promise<Array<{name: string, x: number, y: number, theta: number, id: string, time: number, status: number}>>} 位置点列表
         *
         * status说明:
         * - 0: 正常区域，可以到达
         * - 1: 禁行区，不可以到达
         * - 2: 地图外，不可以到达
         *
         * @example
         * const places = await robotSDK.getPlaceList();
         * places.forEach(place => {
         *   console.log(`位置: ${place.name}, 坐标: (${place.x}, ${place.y})`);
         * });
         */
        async getPlaceList() {
            return this._callNative('getPlaceList');
        }

        /**
         * 获取当前地图名称
         * @returns {Promise<string>} 地图名称
         *
         * @example
         * const mapName = await robotSDK.getMapName();
         * console.log('当前地图:', mapName);
         */
        async getMapName() {
            return this._callNative('getMapName');
        }

        /**
         * 设置导航状态更新回调
         * @param {function} callback - 状态更新回调函数
         *
         * 回调函数参数: {status: number, message: string, data?: any, extraData?: any}
         *
         * 常见状态码:
         * - 1014: 导航开始
         * - 1045: 定位丢失
         * - 1018: 避障
         * - 1019: 避障结束
         * - 1050: 距目的地距离
         *
         * @example
         * robotSDK.setNavigationStatusCallback((status) => {
         *   console.log('导航状态:', status.message);
         *   if (status.status === 1050) {
         *     console.log('距离目的地:', status.extraData, '米');
         *   }
         * });
         */
        setNavigationStatusCallback(callback) {
            if (typeof callback !== 'function') {
                throw new Error('回调必须是函数');
            }

            const callbackId = 'navigationStatusCallback';
            window[callbackId] = (statusData) => {
                try {
                    const data = typeof statusData === 'string' ? JSON.parse(statusData) : statusData;
                    callback(data);
                } catch (e) {
                    console.error('解析导航状态失败:', e);
                }
            };

            this.navigationStatusCallback = callback;
        }

        /**
         * 开始导航到指定位置
         * @param {string} placeName - 目标位置名称
         * @returns {Promise<{status: number, message: string, statusCode: number, destination: string}>} 导航结果
         *
         * 结果状态码:
         * - 1: 导航成功
         * - 102: 已到达目的地
         * - 3: 导航已停止
         *
         * 错误码:
         * - -116: 机器人未定位
         * - -108: 目的地不存在
         * - -113: 已经在目的地
         * - -109: 目的地不可达
         *
         * @example
         * try {
         *   const result = await robotSDK.startNavigation('接待点');
         *   console.log('导航结果:', result.message);
         * } catch (error) {
         *   console.error('导航失败:', error.message);
         * }
         */
        async startNavigation(placeName) {
            if (!placeName || typeof placeName !== 'string') {
                throw new Error('目标位置名称必须是非空字符串');
            }

            const statusCallbackName = this.navigationStatusCallback ? 'navigationStatusCallback' : null;

            return new Promise((resolve, reject) => {
                try {
                    const callbackId = this._generateCallbackId();
                    this._registerCallback(callbackId, resolve, reject);

                    // 调用Android方法，传递状态回调
                    window.RobotAPI.startNavigation(placeName, callbackId, statusCallbackName);
                } catch (e) {
                    reject(new Error(`启动导航失败: ${e.message}`));
                }
            });
        }

        /**
         * 停止导航
         * @returns {Promise<{success: boolean, message: string}>} 停止结果
         *
         * @example
         * const result = await robotSDK.stopNavigation();
         * console.log(result.message); // '停止导航指令已发送'
         */
        async stopNavigation() {
            return this._callNative('stopNavigation');
        }

        /**
         * 清理所有回调函数
         * 在页面卸载时调用，避免内存泄漏
         *
         * @example
         * window.addEventListener('beforeunload', () => {
         *   robotSDK.cleanup();
         * });
         */
        cleanup() {
            // 清理所有注册的回调
            for (const callbackId in this.callbacks) {
                if (window[callbackId]) {
                    delete window[callbackId];
                }
            }
            this.callbacks = {};

            // 清理导航状态回调
            if (window.navigationStatusCallback) {
                delete window.navigationStatusCallback;
            }
            this.navigationStatusCallback = null;

            console.log('RobotNavigation SDK 已清理');
        }
    }

    // 创建全局实例
    const robotSDK = new RobotNavigationSDK();

    // 导出到全局
    if (typeof module !== 'undefined' && module.exports) {
        // CommonJS
        module.exports = robotSDK;
    } else if (typeof define === 'function' && define.amd) {
        // AMD
        define(function() { return robotSDK; });
    } else {
        // 浏览器全局变量
        window.RobotNavSDK = robotSDK;
    }

    // 页面卸载时自动清理
    window.addEventListener('beforeunload', () => {
        robotSDK.cleanup();
    });

})(window);
