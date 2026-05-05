/**
 * Bridge 接口定义
 * 定义可替换的底层实现接口，支持 Web/Android/Mock 等不同环境
 */

/** 位置信息 */
export interface Pose {
  x: number;
  y: number;
  theta: number;
  isLocalized?: boolean;
  name?: string;
}

/** 电池信息 */
export interface Battery {
  level: number;
  isCharging: boolean;
}

/** 导航状态 */
export interface NavigationStatus {
  type: 'update' | 'finished' | 'error';
  status?: number;
  message?: string;
  destination?: string;
  data?: {
    destination?: string;
    name?: string;
  };
}

/** 人员检测信息 */
export interface PersonInfo {
  id: number;
  distance: number;
  angle: number;
  age?: number;
  gender?: string;
}

/** 人员检测数据 */
export interface PersonDetectionData {
  type: 'person_detected';
  count: number;
  data: PersonInfo[];
}

/** 地点信息 */
export interface Place {
  id: string;
  name: string;
  x: number;
  y: number;
  area_sqm?: number;
  product_types?: string[];
  description?: string;
  brands?: string[];
}

/**
 * VAD 适配器接口
 * 可桥接到 Web MicVAD 或 Android Native VAD
 */
export interface IVADBridge {
  /** 是否已就绪 */
  readonly isReady: boolean;
  /** 是否正在监听 */
  readonly isListening: boolean;

  /** 初始化 VAD */
  init(): Promise<void>;
  /** 开始监听 */
  start(): void;
  /** 停止监听 */
  stop(): void;
  /** 销毁资源 */
  destroy(): void;

  /** VAD 开始检测到语音（确认有效后触发） */
  onVadStart(callback: () => void): void;
  /** VAD 检测到语音结束 */
  onVadEnd(callback: () => void): void;
  /** 原始音频数据回调 (Int16 PCM) */
  onAudioData(callback: (data: Int16Array) => void): void;
  /** 过滤回调 (误触发，filter=true) */
  onFilter?(callback: (reason: string) => void): void;
  /** 有效音频回调 (filter=false)，用于立即打断 LLM */
  onValidAudio?(callback: () => void): void;
  /** VAD 可能开始回调（Android onVadBegin 时立即触发，用于 UI 展示） */
  onVadMaybeStart?(callback: () => void): void;
  /** VAD 可能结束回调（超时丢弃或无效时触发，用于重置 UI 状态） */
  onVadMaybeEnd?(callback: () => void): void;
}

/**
 * 音频播放适配器接口
 * 可桥接到 Web AudioContext 或 Native 播放器
 */
export interface IAudioPlayerBridge {
  /** 是否正在播放 */
  readonly isPlaying: boolean;
  /** 当前音量 0-1 */
  readonly volume: number;

  /** 初始化播放器 */
  init(): Promise<void>;
  /** 播放 Float32 PCM 数据 */
  play(data: Float32Array, turnId?: number): void;
  /** 停止播放并清空队列 */
  stop(newTurnId?: number): void;
  /** 刷新缓冲区 */
  flush(): void;
  /** 设置音量 */
  setVolume(volume: number): void;
  /** 重置播放进度 */
  resetProgress(): void;
  /** 销毁资源 */
  destroy(): void;

  /** 播放进度回调 */
  onPlaybackProgress?(callback: (playedSamples: number, totalSamples: number) => void): void;
  /** 播放状态变化回调 */
  onPlayingChange?(callback: (isPlaying: boolean) => void): void;
}

/**
 * 机器人 SDK 适配器接口
 * 可桥接到 Android Robot SDK 或 Mock 实现
 */
export interface IRobotBridge {
  /** 开始导航到指定地点 */
  navigate(placeName: string): Promise<void>;
  /** 停止导航 */
  stopNavigation(): Promise<void>;
  /** 获取当前位置 */
  getPosition(): Promise<Pose>;
  /** 获取地点列表 */
  getPlaceList(): Promise<Place[]>;
  /** 获取电池信息 */
  getBattery(): Promise<Battery>;

  /** 位置变化回调 */
  onPose(callback: (pose: Pose) => void): void;
  /** 电池状态回调 */
  onBattery(callback: (battery: Battery) => void): void;
  /** 导航状态回调 */
  onNavigationStatus(callback: (status: NavigationStatus) => void): void;
  /** 人员检测回调 */
  onPersonDetected(callback: (data: PersonDetectionData) => void): void;
  /** 机器人被推回调 */
  onRobotPushed?(callback: () => void): void;
  /** 超出地图边界回调 */
  onMapOutside?(callback: () => void): void;

  /** 清除所有回调 */
  clearCallbacks(): void;
}
