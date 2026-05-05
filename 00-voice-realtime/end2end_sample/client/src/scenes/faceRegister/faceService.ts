/**
 * Face Register Scene - 人脸识别服务
 * 基于 face-api.js 实现人脸检测和特征提取
 */

import * as faceapi from 'face-api.js';
import * as tf from '@tensorflow/tfjs-core';
import { FaceRecord, getFaceRecords } from './storage';

/** 人脸匹配阈值（欧氏距离），越小越严格 */
const MATCH_THRESHOLD = 0.4;

/** 模型文件路径 */
const MODELS_URL = '/models';

/**
 * 人脸识别服务类
 */
class FaceService {
  private initialized = false;
  private initializing = false;
  private videoElement: HTMLVideoElement | null = null;
  private backendName: string = 'unknown';

  /**
   * 获取当前使用的计算后端
   */
  getBackend(): string {
    return this.backendName;
  }

  /**
   * 初始化 face-api.js 模型
   */
  async init(): Promise<void> {
    if (this.initialized || this.initializing) return;

    this.initializing = true;
    console.log('[FaceService] 🚀 开始加载模型...');

    try {
      // 检查并打印 TensorFlow.js 后端信息
      await tf.ready();
      this.backendName = tf.getBackend() || 'unknown';

      console.log('[FaceService] 🔧 TensorFlow.js 后端信息:');
      console.log(`  - 当前后端: ${this.backendName}`);
      console.log(`  - 可用后端: ${Object.keys(tf.engine().registryFactory).join(', ')}`);

      // 后端说明
      const backendDescriptions: Record<string, string> = {
        'webgl': '🎮 WebGL (GPU 加速)',
        'webgpu': '🚀 WebGPU (最新 GPU API)',
        'wasm': '📦 WebAssembly (CPU)',
        'cpu': '🐢 纯 JavaScript CPU (最慢)',
      };
      console.log(`  - 说明: ${backendDescriptions[this.backendName] || '未知后端'}`);

      // 加载必需的模型
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL),
      ]);

      this.initialized = true;
      console.log('[FaceService] ✅ 模型加载完成');
    } catch (error) {
      console.error('[FaceService] ❌ 模型加载失败:', error);
      throw error;
    } finally {
      this.initializing = false;
    }
  }

  /**
   * 检查是否已初始化
   */
  isReady(): boolean {
    return this.initialized;
  }

  /**
   * 设置视频源
   */
  setVideoElement(video: HTMLVideoElement): void {
    this.videoElement = video;
    console.log('[FaceService] 📹 视频源已设置');
  }

  /**
   * 清除视频源
   */
  clearVideoElement(): void {
    this.videoElement = null;
  }

  /**
   * 从当前视频帧检测人脸并提取特征向量
   * @returns 128维特征向量，或 null 如果未检测到人脸
   */
  async detectAndDescribe(): Promise<Float32Array | null> {
    if (!this.initialized) {
      console.warn('[FaceService] ⚠️ 模型未初始化');
      return null;
    }

    if (!this.videoElement) {
      console.warn('[FaceService] ⚠️ 视频源未设置');
      return null;
    }

    try {
      const detection = await faceapi
        .detectSingleFace(
          this.videoElement,
          new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 })
        )
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        console.log('[FaceService] 😔 未检测到人脸');
        return null;
      }

      console.log('[FaceService] 😊 检测到人脸，置信度:', detection.detection.score.toFixed(2));
      return detection.descriptor;
    } catch (error) {
      console.error('[FaceService] ❌ 人脸检测失败:', error);
      return null;
    }
  }

  /**
   * 从视频帧捕获缩略图
   * @returns base64 图片数据
   */
  captureThumbnail(): string | null {
    if (!this.videoElement) return null;

    try {
      const canvas = document.createElement('canvas');
      const size = 100; // 缩略图大小
      canvas.width = size;
      canvas.height = size;

      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      // 居中裁剪
      const video = this.videoElement;
      const minDim = Math.min(video.videoWidth, video.videoHeight);
      const sx = (video.videoWidth - minDim) / 2;
      const sy = (video.videoHeight - minDim) / 2;

      ctx.drawImage(video, sx, sy, minDim, minDim, 0, 0, size, size);
      return canvas.toDataURL('image/jpeg', 0.8);
    } catch (error) {
      console.error('[FaceService] 截图失败:', error);
      return null;
    }
  }

  /**
   * 在已注册的人脸记录中查找匹配
   * @param descriptor 待匹配的特征向量
   * @param records 人脸记录列表
   * @returns 匹配的名字和距离，或 null 如果未找到匹配
   */
  findMatch(
    descriptor: Float32Array,
    records?: FaceRecord[]
  ): { name: string; distance: number } | null {
    const faceRecords = records || getFaceRecords();

    if (faceRecords.length === 0) {
      console.log('[FaceService] 📭 没有已注册的人脸记录');
      return null;
    }

    let bestMatch: { name: string; distance: number } | null = null;

    for (const record of faceRecords) {
      const storedDescriptor = new Float32Array(record.descriptor);
      const distance = faceapi.euclideanDistance(descriptor, storedDescriptor);

      console.log(`[FaceService] 🔍 与 ${record.name} 的距离: ${distance.toFixed(3)}`);

      if (distance < MATCH_THRESHOLD) {
        if (!bestMatch || distance < bestMatch.distance) {
          bestMatch = { name: record.name, distance };
        }
      }
    }

    if (bestMatch) {
      console.log(`[FaceService] ✅ 最佳匹配: ${bestMatch.name} (距离: ${bestMatch.distance.toFixed(3)})`);
    } else {
      console.log('[FaceService] ❌ 未找到匹配的人脸');
    }

    return bestMatch;
  }

  /**
   * 实时检测人脸（用于 UI 显示检测框）
   * @returns 检测结果，包含人脸位置信息
   */
  async detectFace(): Promise<faceapi.FaceDetection | null> {
    if (!this.initialized || !this.videoElement) return null;

    try {
      const detection = await faceapi.detectSingleFace(
        this.videoElement,
        new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 })
      );
      return detection || null;
    } catch {
      return null;
    }
  }
}

// 导出单例
export const faceService = new FaceService();
