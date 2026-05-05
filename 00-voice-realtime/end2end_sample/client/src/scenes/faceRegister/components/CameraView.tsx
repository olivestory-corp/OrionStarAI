/**
 * CameraView - 摄像头预览组件
 * 显示实时摄像头画面和人脸检测框
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { faceService } from '../faceService';

interface CameraViewProps {
  /** 模型加载完成回调 */
  onModelLoaded?: () => void;
  /** 模型加载失败回调 */
  onModelError?: (error: Error) => void;
  /** 是否显示检测框 */
  showDetectionBox?: boolean;
}

interface FaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function CameraView({
  onModelLoaded,
  onModelError,
  showDetectionBox = true,
}: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [faceBox, setFaceBox] = useState<FaceBox | null>(null);
  const [modelReady, setModelReady] = useState(false);

  // 初始化摄像头和模型
  useEffect(() => {
    let mounted = true;
    let stream: MediaStream | null = null;

    const init = async () => {
      try {
        // 1. 请求摄像头权限
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });

        if (!mounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();

          // 设置视频源到 faceService
          faceService.setVideoElement(videoRef.current);
        }

        // 2. 初始化 face-api 模型
        await faceService.init();

        if (!mounted) return;

        setModelReady(true);
        setIsLoading(false);
        onModelLoaded?.();
        console.log('[CameraView] ✅ 摄像头和模型初始化完成');
      } catch (err) {
        if (!mounted) return;

        const errorMessage = err instanceof Error ? err.message : '初始化失败';
        console.error('[CameraView] ❌ 初始化失败:', err);
        setError(errorMessage);
        setIsLoading(false);
        onModelError?.(err instanceof Error ? err : new Error(errorMessage));
      }
    };

    init();

    return () => {
      mounted = false;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      faceService.clearVideoElement();
    };
  }, [onModelLoaded, onModelError]);

  // 实时人脸检测（用于显示检测框）
  useEffect(() => {
    if (!modelReady || !showDetectionBox) return;

    let animationId: number;
    let lastDetectionTime = 0;
    const DETECTION_INTERVAL = 200; // 每200ms检测一次

    const detectLoop = async () => {
      const now = Date.now();
      if (now - lastDetectionTime >= DETECTION_INTERVAL) {
        lastDetectionTime = now;

        const detection = await faceService.detectFace();
        if (detection && videoRef.current) {
          const video = videoRef.current;
          const scaleX = video.clientWidth / video.videoWidth;
          const scaleY = video.clientHeight / video.videoHeight;

          setFaceBox({
            x: detection.box.x * scaleX,
            y: detection.box.y * scaleY,
            width: detection.box.width * scaleX,
            height: detection.box.height * scaleY,
          });
        } else {
          setFaceBox(null);
        }
      }

      animationId = requestAnimationFrame(detectLoop);
    };

    detectLoop();

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [modelReady, showDetectionBox]);

  // 绘制检测框
  const drawDetectionBox = useCallback(() => {
    if (!faceBox || !canvasRef.current || !videoRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = videoRef.current.clientWidth;
    canvas.height = videoRef.current.clientHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 绘制人脸框
    ctx.strokeStyle = '#10b981'; // 绿色
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(faceBox.x, faceBox.y, faceBox.width, faceBox.height);

    // 角落装饰
    const cornerSize = 15;
    ctx.setLineDash([]);
    ctx.lineWidth = 4;

    // 左上角
    ctx.beginPath();
    ctx.moveTo(faceBox.x, faceBox.y + cornerSize);
    ctx.lineTo(faceBox.x, faceBox.y);
    ctx.lineTo(faceBox.x + cornerSize, faceBox.y);
    ctx.stroke();

    // 右上角
    ctx.beginPath();
    ctx.moveTo(faceBox.x + faceBox.width - cornerSize, faceBox.y);
    ctx.lineTo(faceBox.x + faceBox.width, faceBox.y);
    ctx.lineTo(faceBox.x + faceBox.width, faceBox.y + cornerSize);
    ctx.stroke();

    // 左下角
    ctx.beginPath();
    ctx.moveTo(faceBox.x, faceBox.y + faceBox.height - cornerSize);
    ctx.lineTo(faceBox.x, faceBox.y + faceBox.height);
    ctx.lineTo(faceBox.x + cornerSize, faceBox.y + faceBox.height);
    ctx.stroke();

    // 右下角
    ctx.beginPath();
    ctx.moveTo(faceBox.x + faceBox.width - cornerSize, faceBox.y + faceBox.height);
    ctx.lineTo(faceBox.x + faceBox.width, faceBox.y + faceBox.height);
    ctx.lineTo(faceBox.x + faceBox.width, faceBox.y + faceBox.height - cornerSize);
    ctx.stroke();
  }, [faceBox]);

  useEffect(() => {
    drawDetectionBox();
  }, [drawDetectionBox]);

  if (error) {
    return (
      <div className="relative w-full h-full bg-slate-900 rounded-2xl flex items-center justify-center">
        <div className="text-center p-6">
          <div className="text-5xl mb-4">📷</div>
          <p className="text-red-400 text-lg mb-2">摄像头初始化失败</p>
          <p className="text-slate-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-slate-900 rounded-2xl overflow-hidden">
      {/* 视频流 */}
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        autoPlay
        playsInline
        muted
        style={{ transform: 'scaleX(-1)' }} // 镜像显示
      />

      {/* 检测框 Canvas */}
      {showDetectionBox && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 pointer-events-none"
          style={{ transform: 'scaleX(-1)' }}
        />
      )}

      {/* 加载状态 */}
      {isLoading && (
        <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center backdrop-blur-sm">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent mb-4" />
            <p className="text-slate-300">正在初始化摄像头和人脸识别模型...</p>
          </div>
        </div>
      )}

      {/* 人脸检测状态指示 */}
      {modelReady && !isLoading && (
        <div className="absolute top-4 left-4">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium backdrop-blur-sm ${
              faceBox
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-slate-700/50 text-slate-400 border border-slate-600/30'
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full ${
                faceBox ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
              }`}
            />
            {faceBox ? '已检测到人脸' : '未检测到人脸'}
          </div>
        </div>
      )}
    </div>
  );
}

export default CameraView;
