/**
 * Tool State Manager - Tool state management
 *
 * Provides unified tool execution state management for UI display:
 * - Tool execution start
 * - Tool execution progress
 * - Tool execution complete/failed
 */

import { EventEmitter } from 'events';

/**
 * Tool execution duration category
 */
export type ToolDuration = 'instant' | 'fast' | 'medium' | 'long';

/**
 * Tool execution status
 */
export type ToolExecutionStatus = 'pending' | 'running' | 'success' | 'error' | 'cancelled';

/**
 * Tool state information
 */
export interface ToolState {
  /** Tool call ID */
  toolCallId: string;
  /** Tool name */
  name: string;
  /** Tool arguments */
  args: Record<string, any>;
  /** Execution status */
  status: ToolExecutionStatus;
  /** Start time */
  startTime: number;
  /** End time */
  endTime?: number;
  /** Progress (0-100) */
  progress?: number;
  /** Progress message */
  progressMessage?: string;
  /** Result */
  result?: any;
  /** Error message */
  error?: string;
  /** Expected duration category */
  duration: ToolDuration;
  /** Whether to show UI feedback */
  showFeedback: boolean;
  /** UI feedback type */
  feedbackType: 'none' | 'toast' | 'overlay' | 'inline';
  /** User-friendly description */
  displayName: string;
  /** Running hint text */
  runningText: string;
}

/**
 * Tool metadata configuration
 */
export interface ToolMetadata {
  duration: ToolDuration;
  showFeedback: boolean;
  feedbackType: 'none' | 'toast' | 'overlay' | 'inline';
  displayName: string;
  runningText: string;
  /** Whether cancellation is supported */
  cancellable?: boolean;
  /** Whether progress update is supported */
  supportsProgress?: boolean;
  /** Special flag: no response needed for LLM */
  noResponse?: boolean;
}

/**
 * Tool metadata configuration table
 */
export const TOOL_METADATA: Record<string, ToolMetadata> = {
  // ==================== Special Tools ====================
  // silent: Special tool, no response to LLM, directly interrupt conversation
  silent: {
    duration: 'instant',
    showFeedback: false,
    feedbackType: 'none',
    displayName: 'Silent',
    runningText: '',
    // Special flag: no response needed
    noResponse: true
  },
  getPlaceList: {
    duration: 'instant',
    showFeedback: false,
    feedbackType: 'none',
    displayName: 'Get Place List',
    runningText: ''
  },
  getPosition: {
    duration: 'instant',
    showFeedback: false,
    feedbackType: 'none',
    displayName: 'Get Position',
    runningText: ''
  },
  getMapName: {
    duration: 'instant',
    showFeedback: false,
    feedbackType: 'none',
    displayName: 'Get Map',
    runningText: ''
  },
  getLocation: {
    duration: 'instant',
    showFeedback: false,
    feedbackType: 'none',
    displayName: 'Query Location',
    runningText: ''
  },
  getPersonList: {
    duration: 'instant',
    showFeedback: false,
    feedbackType: 'none',
    displayName: 'Detect People',
    runningText: ''
  },

  // ==================== Fast Tools (toast feedback) ====================
  moveHead: {
    duration: 'fast',
    showFeedback: true,
    feedbackType: 'toast',
    displayName: 'Move Head',
    runningText: 'Moving head...'
  },
  resetHead: {
    duration: 'fast',
    showFeedback: true,
    feedbackType: 'toast',
    displayName: 'Reset Head',
    runningText: 'Resetting head...'
  },
  setLight: {
    duration: 'fast',
    showFeedback: true,
    feedbackType: 'toast',
    displayName: 'Set Light',
    runningText: 'Setting light...'
  },
  startFocusFollow: {
    duration: 'fast',
    showFeedback: true,
    feedbackType: 'toast',
    displayName: 'Start Following',
    runningText: 'Starting follow mode...'
  },
  stopFocusFollow: {
    duration: 'fast',
    showFeedback: true,
    feedbackType: 'toast',
    displayName: 'Stop Following',
    runningText: 'Stopping follow mode...'
  },

  // ==================== Medium Duration Tools (inline feedback) ====================
  moveForward: {
    duration: 'medium',
    showFeedback: true,
    feedbackType: 'inline',
    displayName: 'Move Forward',
    runningText: 'Moving forward...',
    cancellable: true,
    supportsProgress: true
  },
  moveBackward: {
    duration: 'medium',
    showFeedback: true,
    feedbackType: 'inline',
    displayName: 'Move Backward',
    runningText: 'Moving backward...',
    cancellable: true,
    supportsProgress: true
  },
  turnRobot: {
    duration: 'medium',
    showFeedback: true,
    feedbackType: 'inline',
    displayName: 'Turn',
    runningText: 'Turning...',
    cancellable: true,
    supportsProgress: true
  },
  stopNavigation: {
    duration: 'fast',
    showFeedback: true,
    feedbackType: 'toast',
    displayName: 'Stop Navigation',
    runningText: 'Stopping navigation...'
  },
  stopAutoCharge: {
    duration: 'fast',
    showFeedback: true,
    feedbackType: 'toast',
    displayName: 'Stop Charging',
    runningText: 'Stopping charging...'
  },
  leaveChargingPile: {
    duration: 'medium',
    showFeedback: true,
    feedbackType: 'inline',
    displayName: 'Leave Charger',
    runningText: 'Leaving charging station...'
  },

  // ==================== Long Duration Tools (overlay feedback) ====================
  startNavigation: {
    duration: 'long',
    showFeedback: true,
    feedbackType: 'overlay',
    displayName: 'Navigation',
    runningText: 'Navigating...',
    cancellable: true,
    supportsProgress: true
  },
  startAutoCharge: {
    duration: 'long',
    showFeedback: true,
    feedbackType: 'overlay',
    displayName: 'Auto Charge',
    runningText: 'Returning to charger...',
    cancellable: true,
    supportsProgress: true
  }
};

/**
 * Get tool metadata
 */
export function getToolMetadata(toolName: string): ToolMetadata {
  return TOOL_METADATA[toolName] || {
    duration: 'fast',
    showFeedback: true,
    feedbackType: 'toast',
    displayName: toolName,
    runningText: `Executing ${toolName}...`
  };
}

/**
 * Tool state manager
 */
class ToolStateManager extends EventEmitter {
  private states: Map<string, ToolState> = new Map();

  /**
   * Start tool execution
   */
  start(toolCallId: string, name: string, args: Record<string, any>): ToolState {
    const metadata = getToolMetadata(name);

    const state: ToolState = {
      toolCallId,
      name,
      args,
      status: 'running',
      startTime: Date.now(),
      duration: metadata.duration,
      showFeedback: metadata.showFeedback,
      feedbackType: metadata.feedbackType,
      displayName: metadata.displayName,
      runningText: this.formatRunningText(metadata.runningText, args)
    };

    this.states.set(toolCallId, state);
    this.emit('tool_start', state);
    this.emit('state_change', this.getActiveStates());

    console.log(`[ToolState] 🔧 Started: ${name} (${metadata.duration})`);

    return state;
  }

  /**
   * Update tool progress
   */
  updateProgress(toolCallId: string, progress: number, message?: string): void {
    const state = this.states.get(toolCallId);
    if (state) {
      state.progress = Math.min(100, Math.max(0, progress));
      if (message) {
        state.progressMessage = message;
      }
      this.emit('tool_progress', state);
      this.emit('state_change', this.getActiveStates());
    }
  }

  /**
   * Complete tool execution
   */
  complete(toolCallId: string, result: any): void {
    const state = this.states.get(toolCallId);
    if (state) {
      state.status = 'success';
      state.endTime = Date.now();
      state.result = result;
      state.progress = 100;

      this.emit('tool_complete', state);
      this.emit('state_change', this.getActiveStates());

      const duration = state.endTime - state.startTime;
      console.log(`[ToolState] ✅ Completed: ${state.name} (${duration}ms)`);

      // Delayed cleanup (let UI have time to show completion status)
      setTimeout(() => this.cleanup(toolCallId), 2000);
    }
  }

  /**
   * Tool execution failed
   */
  fail(toolCallId: string, error: string): void {
    const state = this.states.get(toolCallId);
    if (state) {
      state.status = 'error';
      state.endTime = Date.now();
      state.error = error;

      this.emit('tool_error', state);
      this.emit('state_change', this.getActiveStates());

      console.error(`[ToolState] ❌ Failed: ${state.name} - ${error}`);

      // Delayed cleanup
      setTimeout(() => this.cleanup(toolCallId), 3000);
    }
  }

  /**
   * Cancel tool execution
   */
  cancel(toolCallId: string): void {
    const state = this.states.get(toolCallId);
    if (state) {
      state.status = 'cancelled';
      state.endTime = Date.now();

      this.emit('tool_cancelled', state);
      this.emit('state_change', this.getActiveStates());

      console.log(`[ToolState] 🚫 Cancelled: ${state.name}`);

      this.cleanup(toolCallId);
    }
  }

  /**
   * Get tool state
   */
  get(toolCallId: string): ToolState | undefined {
    return this.states.get(toolCallId);
  }

  /**
   * Get all active tool states
   */
  getActiveStates(): ToolState[] {
    return Array.from(this.states.values())
      .filter(s => s.status === 'running' || s.status === 'pending');
  }

  /**
   * Check if there are long running tools
   */
  hasLongRunningTool(): boolean {
    return this.getActiveStates().some(s => s.duration === 'long');
  }

  /**
   * Cleanup state
   */
  private cleanup(toolCallId: string): void {
    this.states.delete(toolCallId);
    this.emit('state_change', this.getActiveStates());
  }

  /**
   * Format running text
   */
  private formatRunningText(template: string, args: Record<string, any>): string {
    let text = template;

    // Replace specific parameters
    if (args.placeName) {
      text = text.replace('...', ` to ${args.placeName}...`);
    }
    if (args.query) {
      text = text.replace('...', `: "${args.query}"...`);
    }
    if (args.distance) {
      text = text.replace('...', ` ${args.distance}m...`);
    }
    if (args.angle) {
      const dir = args.direction === 'left' ? 'left' : 'right';
      text = text.replace('...', ` ${dir} ${args.angle}°...`);
    }

    return text;
  }
}

// Singleton export
export const toolStateManager = new ToolStateManager();

/**
 * Helper types for React Hook
 */
export interface ToolStateHookResult {
  activeTools: ToolState[];
  hasLongRunning: boolean;
}
