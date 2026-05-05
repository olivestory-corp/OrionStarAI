/**
 * useToolStatus - Tool execution status Hook
 *
 * Listens to tool_start / tool_end events, provides tool execution status
 * Tool status displays for at least 1 second, even if tool ends immediately
 */

import { useState, useEffect, useRef } from 'react';
import type { ToolExecutionEvent } from '../../sdk/tools';

/** Minimum tool status display duration (milliseconds) */
const MIN_DISPLAY_DURATION = 1000;

/**
 * Tool status information
 */
export interface ToolStatus {
  /** Whether tool is running */
  isRunning: boolean;
  /** Tool name */
  name: string | null;
  /** Tool arguments */
  args: Record<string, any> | null;
  /** Tool call ID */
  toolCallId: string | null;
}

/**
 * Tool name to display name mapping
 */
const TOOL_DISPLAY_NAMES: Record<string, string> = {
  // Navigation
  startNavigation: 'Navigating',
  stopNavigation: 'Stopping Navigation',
  getPlaceList: 'Getting Places',
  getLocation: 'Querying Location',
  getPosition: 'Getting Position',
  getMapName: 'Getting Map',

  // Movement
  moveForward: 'Moving Forward',
  moveBackward: 'Moving Backward',
  turnRobot: 'Turning',

  // Head Control
  moveHead: 'Moving Head',
  resetHead: 'Resetting Head',

  // Perception
  getPersonList: 'Detecting People',

  // Charging
  startAutoCharge: 'Returning to Charger',
  stopAutoCharge: 'Stopping Charge',
  leaveChargingPile: 'Leaving Charger',

  // System
  setLight: 'Setting Light',
  startFocusFollow: 'Starting Follow',
  stopFocusFollow: 'Stopping Follow',
  silent: 'Silent'
};

/**
 * Get tool display name
 */
export function getToolDisplayName(name: string, args?: Record<string, any>): string {
  const baseName = TOOL_DISPLAY_NAMES[name] || name;

  // Add more detailed info based on arguments
  if (args) {
    if (name === 'startNavigation' && args.placeName) {
      return `Going to ${args.placeName}`;
    }
    if (name === 'moveForward' && args.distance) {
      return `Forward ${args.distance}m`;
    }
    if (name === 'turnRobot' && args.direction && args.angle) {
      return `Turn ${args.direction} ${args.angle}°`;
    }
  }

  return baseName;
}

/**
 * Tool execution status Hook
 */
export function useToolStatus(): ToolStatus & {
  displayName: string | null;
} {
  const [status, setStatus] = useState<ToolStatus>({
    isRunning: false,
    name: null,
    args: null,
    toolCallId: null
  });

  // Track tool start time and pending clear status
  const startTimeRef = useRef<number>(0);
  const pendingClearRef = useRef<ToolStatus | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleToolStart = (e: Event) => {
      const { toolCallId, name, args } = (e as CustomEvent<ToolExecutionEvent>).detail;
      console.log(`[useToolStatus] 🔧 Tool started: ${name}`);

      // Clear previous timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      pendingClearRef.current = null;

      // Record start time
      startTimeRef.current = Date.now();

      setStatus({
        isRunning: true,
        name,
        args,
        toolCallId
      });
    };

    const handleToolEnd = (e: Event) => {
      const { name } = (e as CustomEvent<ToolExecutionEvent>).detail;
      console.log(`[useToolStatus] ✅ Tool ended: ${name}`);

      const elapsed = Date.now() - startTimeRef.current;
      const remaining = MIN_DISPLAY_DURATION - elapsed;

      const clearStatus: ToolStatus = {
        isRunning: false,
        name: null,
        args: null,
        toolCallId: null
      };

      if (remaining > 0) {
        // Haven't reached minimum display duration, delay clearing
        console.log(`[useToolStatus] ⏳ Clearing status after ${remaining}ms`);
        pendingClearRef.current = clearStatus;
        timerRef.current = setTimeout(() => {
          setStatus(clearStatus);
          pendingClearRef.current = null;
          timerRef.current = null;
        }, remaining);
      } else {
        // Already exceeded minimum display duration, clear immediately
        setStatus(clearStatus);
      }
    };

    window.addEventListener('tool_start', handleToolStart);
    window.addEventListener('tool_end', handleToolEnd);

    return () => {
      window.removeEventListener('tool_start', handleToolStart);
      window.removeEventListener('tool_end', handleToolEnd);
      // Cleanup timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const displayName = status.name
    ? getToolDisplayName(status.name, status.args || undefined)
    : null;

  return {
    ...status,
    displayName
  };
}

export default useToolStatus;
