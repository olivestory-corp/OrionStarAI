/**
 * AgentSDK - 语音助手核心 SDK
 * 纯 TypeScript 实现，无 React 依赖
 *
 * 整合 WebSocket、音频、VAD、机器人环境等模块
 * 通过 EventEmitter 向外部通知状态变化
 */

import { EventEmitter } from 'events';
import { WebSocketManager } from './core/WebSocketManager';
import { TurnManager } from './core/TurnManager';
import { AudioManager } from './audio/AudioManager';
import { VADManager } from './vad/VADManager';
import { RobotEnvironment } from './robot/RobotEnvironment';
import { getWebSocketUrl } from './utils';
import {
  IVADBridge,
  IAudioPlayerBridge,
  IRobotBridge,
  UnifiedClientMessage,
  UnifiedServerMessage,
  ToolDeclaration,
  ModelType,
  ConnectionStatus,
  ChatMessage,
  RobotEnvironmentState
} from './types';

export interface AgentSDKConfig {
  /** WebSocket URL (可选，默认使用 getWebSocketUrl()) */
  wsUrl?: string;
  /** 模型类型 */
  modelType?: ModelType;
  /** 语音 */
  voice?: string;
  /** 工具声明 */
  tools?: ToolDeclaration[];
  /** 系统提示词 */
  systemPrompt?: string;
  /** 是否自动连接 */
  autoConnect?: boolean;
  /** 是否启用机器人环境监控 */
  enableRobotEnvironment?: boolean;
  /**
   * 输入模式
   * - 'vad': 语音活动检测模式（默认），自动检测用户说话
   * - 'ptt': Push-to-Talk 模式，禁用 VAD，手动控制录音
   */
  inputMode?: 'vad' | 'ptt';

  /** Bridge 注入 */
  bridges?: {
    vad?: IVADBridge;
    audioPlayer?: IAudioPlayerBridge;
    robot?: IRobotBridge;
  };
}

export interface AgentSDKState {
  connectionStatus: ConnectionStatus;
  isReady: boolean;
  userSpeaking: boolean;
  isListening: boolean;
  isVADReady: boolean;
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  currentTurnId: number;
  subtitleText: string;
  subtitleProgress: number;
  robotState: RobotEnvironmentState | null;
}

/**
 * AgentSDK
 *
 * Events:
 * - 'state_change': AgentSDKState
 * - 'connection_status': ConnectionStatus
 * - 'ready': void
 * - 'speech_start': void
 * - 'speech_end': void
 * - 'audio_playing': boolean
 * - 'text_output': { text: string; isFinal: boolean }
 * - 'transcription': { text: string; isFinal: boolean }
 * - 'tool_call': ToolCall
 * - 'turn_complete': { turnId: number; cost?: any }
 * - 'robot_arrived': string
 * - 'error': Error | string
 */
export class AgentSDK extends EventEmitter {
  private config: AgentSDKConfig;
  private wsManager: WebSocketManager;
  private turnManager: TurnManager;
  private audioManager: AudioManager;
  private vadManager: VADManager;
  private robotEnv: RobotEnvironment | null = null;

  private _state: AgentSDKState;
  private _isMuted = false;
  private sendAudioInterval: ReturnType<typeof setInterval> | null = null;
  private vadCooldown = false;
  private muteCooldown = false;
  private setupSent = false;
  private speechIgnored = false; // 标记当前语音是否被忽略（无人或距离过远）
  private firstAudioReceivedForTurn: number | null = null; // 记录已接收 LLM 第一帧音频的 turnId
  private subtitleClearTimer: ReturnType<typeof setTimeout> | null = null; // 字幕延迟清除定时器
  private readonly SUBTITLE_CLEAR_DELAY = 200; // 字幕延迟清除时间(ms)

  // 音频统计
  private audioStatsData = {
    totalDurationMs: 0,
    totalBytes: 0,
    packetCount: 0
  };

  constructor(config: AgentSDKConfig) {
    super();
    this.config = {
      modelType: 'openai',
      voice: 'alloy',
      autoConnect: false,
      enableRobotEnvironment: true,
      inputMode: 'vad',
      ...config
    };

    // 初始化状态
    this._state = {
      connectionStatus: 'disconnected',
      isReady: false,
      userSpeaking: false,
      isListening: false,
      isVADReady: false,
      isPlaying: false,
      isMuted: false,
      volume: 1.0,
      currentTurnId: 0,
      subtitleText: '',
      subtitleProgress: 0,
      robotState: null
    };

    // 初始化模块
    const wsUrl = config.wsUrl || getWebSocketUrl();
    this.wsManager = new WebSocketManager({ url: wsUrl });
    this.turnManager = new TurnManager();
    this.audioManager = new AudioManager({
      audioPlayer: config.bridges?.audioPlayer
    });
    this.vadManager = new VADManager({
      vadBridge: config.bridges?.vad
    });

    if (this.config.enableRobotEnvironment) {
      this.robotEnv = new RobotEnvironment({
        robotBridge: config.bridges?.robot
      });
    }

    this.setupEventHandlers();
  }

  get state(): AgentSDKState {
    return { ...this._state };
  }

  // ==================== 生命周期 ====================

  /**
   * 初始化 SDK
   */
  async initialize(): Promise<void> {
    const isPTTMode = this.config.inputMode === 'ptt';
    console.log(`[AgentSDK] 🚀 初始化中... (inputMode: ${this.config.inputMode})`);

    // PTT 模式下不需要初始化 VAD
    if (isPTTMode) {
      await this.audioManager.initialize();
      console.log('[AgentSDK] 🎤 PTT 模式: VAD 已禁用');
    } else {
      await Promise.all([
        this.audioManager.initialize(),
        this.vadManager.initialize(),
      ]);
    }

    if (this.robotEnv && this.config.enableRobotEnvironment) {
      this.robotEnv.enable();
    }

    // 注册全局音量控制接口供 Android 调用
    this.registerAndroidVolumeInterface();

    // PTT 模式下 VAD 保持禁用状态
    this.updateState({
      isVADReady: !isPTTMode,
      isListening: !isPTTMode
    });
    console.log('[AgentSDK] ✅ 初始化完成');

    if (this.config.autoConnect) {
      this.connect();
    }
  }

  /**
   * 注册 Android 音量控制接口
   * Android 端可通过 window.__setAudioVolume / window.__getAudioVolume 控制音量
   */
  private registerAndroidVolumeInterface(): void {
    // 读取 Android 传入的初始音量
    const initialVolume = (window as any).__androidInitialVolume;
    if (typeof initialVolume === 'number') {
      console.log(`[AgentSDK] 🔊 使用 Android 初始音量: ${(initialVolume * 100).toFixed(0)}%`);
      this.setVolume(initialVolume);
    }

    // 注册全局音量控制接口
    (window as any).__setAudioVolume = (value: number) => {
      console.log(`[AgentSDK] 🔊 Android 设置音量: ${(value * 100).toFixed(0)}%`);
      this.setVolume(value);
    };

    (window as any).__getAudioVolume = () => {
      return this._state.volume;
    };

    console.log('[AgentSDK] 🔊 Android 音量控制接口已注册');
  }

  /**
   * 注销 Android 音量控制接口
   */
  private unregisterAndroidVolumeInterface(): void {
    if ((window as any).__setAudioVolume) {
      delete (window as any).__setAudioVolume;
    }
    if ((window as any).__getAudioVolume) {
      delete (window as any).__getAudioVolume;
    }
  }

  /**
   * 连接服务器
   */
  connect(): void {
    this.setupSent = false;
    this.wsManager.connect();
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.wsManager.disconnect();
    this.updateState({
      connectionStatus: 'disconnected',
      isReady: false
    });
  }

  /**
   * 销毁 SDK
   */
  destroy(): void {
    this.disconnect();
    this.stopAudioSendInterval();
    this.unregisterAndroidVolumeInterface();
    // 清理字幕延迟定时器
    if (this.subtitleClearTimer) {
      clearTimeout(this.subtitleClearTimer);
      this.subtitleClearTimer = null;
    }
    this.audioManager.destroy();
    this.vadManager.destroy();
    this.robotEnv?.destroy();
    this.removeAllListeners();
    console.log('[AgentSDK] ♻️ 已销毁');
  }

  // ==================== 语音控制 ====================

  /**
   * 开始监听
   */
  startListening(): void {
    this.vadManager.start();
    this.updateState({ isListening: true });
  }

  /**
   * 停止监听
   */
  stopListening(): void {
    this.vadManager.stop();
    this.updateState({ isListening: false, userSpeaking: false });
  }

  /**
   * 切换静音
   */
  toggleMute(): void {
    if (this._isMuted) {
      this._isMuted = false;
      this.muteCooldown = true;
      setTimeout(() => { this.muteCooldown = false; }, 500);
      this.audioManager.clearEncoderQueue();
      console.log('[AgentSDK] 🔊 已取消静音');
    } else {
      this._isMuted = true;
      this.stopAudio(this.turnManager.currentTurnId + 1);
      this.interruptCurrentTurn();
      this.stopAudioSendInterval();
      this.audioManager.stopRetentionMode();
      console.log('[AgentSDK] 🔇 已静音');
    }
    this.updateState({ isMuted: this._isMuted });
  }

  /**
   * 设置静音状态
   */
  setMuted(muted: boolean): void {
    if (this._isMuted !== muted) {
      this.toggleMute();
    }
  }

  // ==================== PTT (Push-to-Talk) ====================

  /**
   * PTT 开始 - 按住说话时调用
   * 1. 立即打断 LLM 输出
   * 2. 开始录音
   */
  startPTT(): void {
    if (this._isMuted) {
      console.log('[AgentSDK] 🔇 静音状态，忽略 PTT');
      return;
    }

    // 开始新的 turn
    const turnId = this.turnManager.startTurn();

    // 立即打断当前 LLM 输出
    this.stopAudio(turnId);
    this.interruptCurrentTurn();

    // 开始录音
    this.updateState({ currentTurnId: turnId, userSpeaking: true });
    this.turnManager.updateTurnStatus(turnId, 'encoding');
    this.audioManager.startRetentionMode();

    this.emit('speech_start');
    console.log(`[AgentSDK] 🎤 PTT 开始录音, Turn: ${turnId}`);

    // 开始定时发送音频
    this.startAudioSendInterval();
  }

  /**
   * PTT 结束 - 松开按钮时调用
   * 停止录音并发送音频给 LLM
   */
  async stopPTT(): Promise<void> {
    if (!this._state.userSpeaking) {
      console.log('[AgentSDK] 🛑 PTT 结束（未在录音状态）');
      return;
    }

    console.log('[AgentSDK] 🛑 PTT 结束录音');

    const turnId = this.turnManager.currentTurnId;
    if (turnId) {
      this.turnManager.updateTurnStatus(turnId, 'waiting_llm');
    }

    this.updateState({ userSpeaking: false });
    this.stopAudioSendInterval();

    // 发送剩余音频
    await this.audioManager.flushEncoder();
    const remainingFrames = this.audioManager.getEncodedFrames();

    if (remainingFrames.length > 0 && turnId) {
      remainingFrames.forEach((opusBase64, index) => {
        const isFinal = index === remainingFrames.length - 1;
        this.wsManager.send({
          type: 'audio_input',
          turnId,
          timestamp: Date.now(),
          audioInput: {
            format: 'opus',
            sampleRate: 48000,
            channels: 1,
            chunks: [{ data: opusBase64, sequence: index }],
            isFinal
          }
        } as UnifiedClientMessage);
      });
    } else if (turnId) {
      // 发送空的 final 帧
      this.wsManager.send({
        type: 'audio_input',
        turnId,
        timestamp: Date.now(),
        audioInput: {
          format: 'opus',
          sampleRate: 48000,
          channels: 1,
          chunks: [],
          isFinal: true
        }
      } as UnifiedClientMessage);
    }

    this.audioManager.stopRetentionMode();
    this.emit('speech_end');
  }

  // ==================== 音频控制 ====================

  /**
   * 设置音量
   */
  setVolume(volume: number): void {
    this.audioManager.setVolume(volume);
    this.updateState({ volume });
  }

  /**
   * 停止音频播放
   */
  stopAudio(newTurnId?: number): void {
    this.audioManager.stopAudio(newTurnId);
    this.updateState({
      subtitleText: '',
      subtitleProgress: 0
    });
  }

  // ==================== 消息发送 ====================

  /**
   * 发送文本消息
   */
  sendText(text: string, role: 'user' | 'system' = 'user'): void {
    if (!text.trim() || !this._state.isReady) {
      console.warn('[AgentSDK] 无法发送: 消息为空或未就绪');
      return;
    }

    // 生成新 turn
    const turnId = this.turnManager.startTurn();
    this.stopAudio(turnId);
    this.interruptCurrentTurn();

    this.turnManager.updateTurnStatus(turnId, 'sending');
    this.updateState({ currentTurnId: turnId });

    this.wsManager.send({
      type: 'text_input',
      turnId,
      timestamp: Date.now(),
      textInput: { text: text.trim(), role }
    } as UnifiedClientMessage);

    this.turnManager.updateTurnStatus(turnId, 'waiting_llm');
    console.log(`[AgentSDK] 📤 发送文本: ${text.substring(0, 50)}...`);
  }

  /**
   * 发送文本消息（带打断）
   */
  sendTextWithInterrupt(text: string, role: 'user' | 'system' = 'user'): void {
    this.sendText(text, role);
  }

  /**
   * 发送上下文信息（不触发 LLM 回复）
   * 用于同步 UI 状态等场景
   */
  sendContext(text: string): void {
    if (!text.trim() || !this._state.isReady) {
      console.warn('[AgentSDK] 无法发送上下文: 消息为空或未就绪');
      return;
    }

    this.wsManager.send({
      type: 'text_input',
      turnId: 0,  // 不创建新 turn
      timestamp: Date.now(),
      textInput: { text: text.trim(), role: 'system', silent: true }
    } as unknown as UnifiedClientMessage);

    console.log(`[AgentSDK] 📤 发送上下文 (silent): ${text.substring(0, 50)}...`);
  }

  /**
   * 获取当前 Turn ID
   */
  getCurrentTurnId(): number {
    return this.turnManager.getCurrentTurnId();
  }

  /**
   * 发送原始消息（用于工具响应等）
   */
  sendRawMessage(msg: UnifiedClientMessage): void {
    if (this.wsManager) {
      this.wsManager.send(msg);
      console.log('[AgentSDK] 📤 发送原始消息:', msg.type, msg.toolResult ? `toolCallId=${msg.toolResult.toolCallId}` : '');
    } else {
      console.warn('[AgentSDK] ⚠️ WebSocket 未连接，无法发送消息');
    }
  }

  // ==================== 机器人控制 ====================

  /**
   * 导航到指定位置
   */
  async navigate(placeName: string): Promise<void> {
    if (!this.robotEnv) {
      throw new Error('机器人环境未启用');
    }
    return this.robotEnv.navigate(placeName);
  }

  /**
   * 停止导航
   */
  async stopNavigation(): Promise<void> {
    if (!this.robotEnv) {
      throw new Error('机器人环境未启用');
    }
    return this.robotEnv.stopNavigation();
  }

  /**
   * 获取地点列表
   */
  async getPlaceList() {
    if (!this.robotEnv) {
      throw new Error('机器人环境未启用');
    }
    return this.robotEnv.getPlaceList();
  }

  /**
   * 暂停 VAD
   */
  pauseVAD(): void {
    this.vadManager.pause();
    console.log('[AgentSDK] ⏸️ VAD 已暂停');
  }

  /**
   * 恢复 VAD
   */
  resumeVAD(): void {
    this.vadManager.resume();
    console.log('[AgentSDK] ▶️ VAD 已恢复');
  }

  // ==================== 内部方法 ====================

  private setupEventHandlers(): void {
    // WebSocket 事件
    this.wsManager.on('status_change', (status) => {
      const connectionStatus: ConnectionStatus = status === 'connected' ? 'connected' : status;
      this.updateState({ connectionStatus });
      this.emit('connection_status', connectionStatus);
    });

    this.wsManager.on('open', () => {
      this.sendSetupMessage();
    });

    this.wsManager.on('close', () => {
      this.updateState({ connectionStatus: 'disconnected', isReady: false });
      this.setupSent = false;
    });

    this.wsManager.on('message', (msg: UnifiedServerMessage) => {
      this.handleServerMessage(msg);
    });

    this.wsManager.on('error', (error) => {
      this.emit('error', error);
    });

    // VAD 事件
    this.vadManager.on('speech_start', () => {
      this.handleSpeechStart();
    });

    this.vadManager.on('speech_end', () => {
      this.handleSpeechEnd();
    });

    this.vadManager.on('audio_data', (data: Int16Array) => {
      this.handleAudioData(data);
    });

    // VAD Filter 事件：当检测到回声/噪音等需要过滤时，立即打断 LLM
    this.vadManager.on('filter', (reason: string) => {
      this.handleVadFilter(reason);
    });

    // VAD 有效音频事件：首次检测到有效音频时，立即打断 LLM
    this.vadManager.on('valid_audio', () => {
      this.handleValidAudio();
    });

    // VAD 可能开始事件：用于 UI 展示"说话中"状态
    this.vadManager.on('maybe_speech_start', () => {
      this.handleMaybeSpeechStart();
    });

    // VAD 可能结束事件：超时丢弃时重置 UI 状态
    this.vadManager.on('maybe_speech_end', () => {
      this.handleMaybeSpeechEnd();
    });

    // 音频事件
    this.audioManager.on('playing_change', (isPlaying: boolean) => {
      this.updateState({ isPlaying });
      this.emit('audio_playing', isPlaying);

      // 播放状态变化时处理字幕清除
      if (isPlaying) {
        // 开始播放时，取消之前的清除定时器
        if (this.subtitleClearTimer) {
          clearTimeout(this.subtitleClearTimer);
          this.subtitleClearTimer = null;
        }
      } else {
        // 停止播放时，延迟清除字幕（避免闪烁）
        if (this.subtitleClearTimer) {
          clearTimeout(this.subtitleClearTimer);
        }
        this.subtitleClearTimer = setTimeout(() => {
          this.updateState({ subtitleText: '', subtitleProgress: 0 });
          this.audioManager.setSubtitleText('');
          this.subtitleClearTimer = null;
        }, this.SUBTITLE_CLEAR_DELAY);
      }
    });

    this.audioManager.on('progress', ({ playedSamples, totalSamples }) => {
      const progress = totalSamples > 0 ? playedSamples / totalSamples : 0;
      this.updateState({ subtitleProgress: progress });
    });

    // 机器人环境事件
    if (this.robotEnv) {
      this.robotEnv.on('state_change', (state: RobotEnvironmentState, syncToLLM: boolean) => {
        // 更新 UI 状态（每次都更新）
        this.updateState({ robotState: state });

        // 发送环境状态给大模型（仅在 syncToLLM=true 时）
        if (syncToLLM && this._state.isReady && this.config.modelType === 'openai') {
          console.log('[AgentSDK] 🌍 同步环境状态给大模型');
          const prompt = this.robotEnv!.formatStateToPrompt();
          this.wsManager.send({
            type: 'text_input',
            turnId: 0,
            timestamp: Date.now(),
            textInput: { text: prompt, role: 'system', silent: true }
          } as unknown as UnifiedClientMessage);
        }
      });

      this.robotEnv.on('arrived', (destination: string) => {
        this.emit('robot_arrived', destination);
        // 通知大模型
        if (this._state.isReady) {
          this.sendText(`(System Notification) I have arrived at ${destination}.`, 'user');
        }
      });
    }
  }



  private sendSetupMessage(): void {
    if (this.setupSent) return;
    this.setupSent = true;

    console.log(`[AgentSDK] 🎉 发送 setup, 模型: ${this.config.modelType}`);

    const setupConfig: any = {
      tools: this.config.tools || [],
      voice: this.config.voice
    };

    if (this.config.systemPrompt) {
      setupConfig.systemInstruction = this.config.systemPrompt;
    }

    this.wsManager.send({
      type: 'setup',
      turnId: 0,
      timestamp: Date.now(),
      setup: {
        modelType: this.config.modelType,
        config: setupConfig
      }
    } as UnifiedClientMessage);
  }

  private handleServerMessage(msg: UnifiedServerMessage): void {
    const turnId = msg.turnId;

    switch (msg.type) {
      case 'ready':
        this.updateState({ isReady: true, connectionStatus: 'ready' });
        this.emit('ready');
        console.log('[AgentSDK] ✅ AI 就绪');
        break;

      case 'audio_output':
        if (this._isMuted || !msg.audioOutput) return;

        const audioTurnId = msg.turnId ?? 0;

        // 检查是否是该 turn 的第一帧 LLM 音频响应
        if (audioTurnId && this.firstAudioReceivedForTurn !== audioTurnId) {
          this.firstAudioReceivedForTurn = audioTurnId;
          console.log(`[AgentSDK] 🔊 Turn ${audioTurnId} 收到 LLM 第一帧音频, 时间: ${new Date().toISOString()}`);
        }

        msg.audioOutput.chunks.forEach((chunk: { data: string; sequence: number }) => {
          if (msg.audioOutput!.format === 'opus') {
            this.audioManager.decodeOpus(chunk.data, audioTurnId);

            // 更新音频统计
            const chunkBytes = chunk.data.length * 0.75; // base64 to bytes 近似
            this.audioStatsData.totalBytes += chunkBytes;
            this.audioStatsData.packetCount++;
            // 假设每个 opus 帧 20ms
            this.audioStatsData.totalDurationMs += 20;
          }
        });

        // 发送统计更新
        this.emit('audio_stats', { ...this.audioStatsData });

        if (msg.audioOutput.isFinal) {
          this.audioManager.flushDecoder().then(() => {
            setTimeout(() => this.audioManager.flushBuffer(), 50);
          });
        }
        break;

      case 'text_output':
        if (msg.textOutput && !msg.textOutput.isFinal) {
          const newText = this._state.subtitleText + msg.textOutput.text;
          this.updateState({ subtitleText: newText });
          this.audioManager.appendSubtitleText(msg.textOutput.text);
          this.emit('text_output', msg.textOutput);
        }
        break;

      case 'transcription':
        if (msg.transcription) {
          this.emit('transcription', msg.transcription);
        }
        break;

      case 'tool_call':
        if (msg.toolCall) {
          // 传递 toolCall 和 turnId
          this.emit('tool_call', msg.toolCall, msg.turnId ?? this.turnManager.currentTurnId);
        }
        break;

      case 'turn_complete':
        if (turnId) {
          this.turnManager.completeTurn(turnId);
        }
        this.emit('turn_complete', { turnId, cost: msg.cost });
        break;

      case 'error':
        const errorMsg = typeof msg.error === 'string' ? msg.error : (msg.error as any)?.message;
        console.error('[AgentSDK] 服务器错误:', errorMsg);
        this.emit('error', new Error(errorMsg));

        // 自动重连
        if (errorMsg?.includes('setup')) {
          setTimeout(() => this.sendSetupMessage(), 1000);
        }
        break;

      case 'ai_disconnected':
        this.updateState({ isReady: false });
        this.emit('error', new Error('AI 连接已断开'));
        break;
    }
  }

  private handleSpeechStart(): void {
    if (this.vadCooldown || this._isMuted || this.muteCooldown) return;

    // 检测是否有人：如果没有人，忽略语音输入
    const peopleCount = this._state.robotState?.people?.count ?? 0;
    if (peopleCount === 0) {
      console.log('[AgentSDK] 👻 未检测到人，忽略语音输入');
      this.speechIgnored = true;
      return;
    }

    // 检测最近的人的距离：必须在 1.2 米以内
    const peopleList = this._state.robotState?.people?.list ?? [];
    const minDistance = peopleList.length > 0
      ? Math.min(...peopleList.map(p => p.distance))
      : Infinity;

    if (minDistance > 1.2) {
      console.log(`[AgentSDK] 📏 最近的人距离 ${minDistance.toFixed(2)}m > 1.2m，忽略语音输入`);
      this.speechIgnored = true;
      return;
    }

    // 正常开始录音
    this.speechIgnored = false;

    const turnId = this.turnManager.startTurn();
    this.stopAudio(turnId);
    this.interruptCurrentTurn();

    this.updateState({ currentTurnId: turnId, userSpeaking: true });
    this.turnManager.updateTurnStatus(turnId, 'encoding');
    this.audioManager.startRetentionMode();

    this.emit('speech_start');
    console.log(`[AgentSDK] 🎤 开始录音, Turn: ${turnId}, 面前有 ${peopleCount} 人, 最近距离 ${minDistance.toFixed(2)}m`);

    // 开始定时发送音频
    this.startAudioSendInterval();
  }

  private async handleSpeechEnd(): Promise<void> {
    // 如果这次语音被忽略了（无人或距离过远），直接返回
    if (this.speechIgnored) {
      console.log('[AgentSDK] 🛑 语音结束（已忽略，不处理）');
      this.speechIgnored = false;
      return;
    }

    console.log('[AgentSDK] 🛑 语音结束');

    const turnId = this.turnManager.currentTurnId;
    if (turnId) {
      this.turnManager.updateTurnStatus(turnId, 'waiting_llm');
    }

    this.updateState({ userSpeaking: false });
    this.stopAudioSendInterval();

    // 发送剩余音频
    await this.audioManager.flushEncoder();
    const remainingFrames = this.audioManager.getEncodedFrames();

    if (remainingFrames.length > 0 && turnId) {
      remainingFrames.forEach((opusBase64, index) => {
        const isFinal = index === remainingFrames.length - 1;
        this.wsManager.send({
          type: 'audio_input',
          turnId,
          timestamp: Date.now(),
          audioInput: {
            format: 'opus',
            sampleRate: 48000,
            channels: 1,
            chunks: [{ data: opusBase64, sequence: index }],
            isFinal
          }
        } as UnifiedClientMessage);
      });
    } else if (turnId) {
      this.wsManager.send({
        type: 'audio_input',
        turnId,
        timestamp: Date.now(),
        audioInput: {
          format: 'opus',
          sampleRate: 48000,
          channels: 1,
          chunks: [],
          isFinal: true
        }
      } as UnifiedClientMessage);
    }

    this.audioManager.stopRetentionMode();
    this.emit('speech_end');

    // VAD 冷却
    this.vadCooldown = true;
    setTimeout(() => { this.vadCooldown = false; }, 1000);
  }

  private handleAudioData(int16Data: Int16Array): void {
    if (this._isMuted || this.muteCooldown) return;

    // Int16 -> Float32
    const float32Data = new Float32Array(int16Data.length);
    for (let i = 0; i < int16Data.length; i++) {
      float32Data[i] = int16Data[i] / 32768.0;
    }

    this.audioManager.encodePCM(float32Data);
  }

  /**
   * 处理 VAD Filter 事件
   * 当检测到回声/噪音等需要过滤的音频时（filter=true），仅记录日志
   * 注意：不打断 LLM，打断逻辑在 handleValidAudio 中处理（filter=false 时）
   */
  private handleVadFilter(reason: string): void {
    console.log(`[AgentSDK] 🚫 VAD Filter: ${reason} (不打断 LLM)`);

    // 触发 filter 事件供外部监听
    this.emit('vad_filter', reason);
  }

  /**
   * 处理有效音频事件
   * 当首次检测到有效音频时（filter=false），立即打断 LLM 输出
   */
  private handleValidAudio(): void {
    console.log('[AgentSDK] 🎯 检测到有效音频，立即打断 LLM 输出');

    // 停止当前音频播放
    const newTurnId = this.turnManager.currentTurnId + 1;
    this.stopAudio(newTurnId);

    // 发送打断信号给服务器
    this.interruptCurrentTurn();

    // 触发事件供外部监听
    this.emit('valid_audio_detected');
  }

  /**
   * 处理 VAD 可能开始事件
   * 用于立即更新 UI 展示"说话中"状态
   */
  private handleMaybeSpeechStart(): void {
    if (this.vadCooldown || this._isMuted || this.muteCooldown) return;

    console.log('[AgentSDK] 🎤 VAD Maybe Start (UI 展示)');

    // 仅更新 UI 状态，不做其他处理
    this.updateState({ userSpeaking: true });

    // 触发事件供外部监听
    this.emit('maybe_speech_start');
  }

  /**
   * 处理 VAD 可能结束事件
   * 超时丢弃时重置 UI 状态
   */
  private handleMaybeSpeechEnd(): void {
    console.log('[AgentSDK] 🛑 VAD Maybe End (超时丢弃，重置 UI)');

    // 重置 UI 状态
    this.updateState({ userSpeaking: false });

    // 触发事件供外部监听
    this.emit('maybe_speech_end');
  }

  private startAudioSendInterval(): void {
    if (this.sendAudioInterval) return;

    this.sendAudioInterval = setInterval(() => {
      if (!this._state.isReady) return;

      const frames = this.audioManager.getEncodedFrames();
      const turnId = this.turnManager.currentTurnId;

      if (frames.length > 0 && turnId) {
        this.turnManager.updateTurnStatus(turnId, 'sending');

        frames.forEach((opusBase64) => {
          this.wsManager.send({
            type: 'audio_input',
            turnId,
            timestamp: Date.now(),
            audioInput: {
              format: 'opus',
              sampleRate: 48000,
              channels: 1,
              chunks: [{ data: opusBase64, sequence: 0 }]
            }
          } as UnifiedClientMessage);
        });
      }
    }, 50);
  }

  private stopAudioSendInterval(): void {
    if (this.sendAudioInterval) {
      clearInterval(this.sendAudioInterval);
      this.sendAudioInterval = null;
    }
  }

  private interruptCurrentTurn(): void {
    const prevTurnId = this.turnManager.currentTurnId;
    if (prevTurnId && this._state.isReady) {
      this.wsManager.send({
        type: 'interrupt',
        turnId: prevTurnId,
        timestamp: Date.now(),
        interrupt: { interruptedTurnId: prevTurnId }
      } as UnifiedClientMessage);
      this.turnManager.interruptTurn(prevTurnId);
    }
  }

  private updateState(partial: Partial<AgentSDKState>): void {
    this._state = { ...this._state, ...partial };
    this.emit('state_change', this._state);
  }
}
