/**
 * Robot Base Tool Executor - Robot base tool executor
 * Pure TypeScript implementation
 */

import { isRobotBaseTool } from './baseTools';
import { IRobotBridge, ToolCall, UnifiedClientMessage } from '../types';
import robotSDK from './robotSDK';

export interface RobotToolExecutorConfig {
  robotBridge: IRobotBridge;
  sendMessage: (msg: UnifiedClientMessage) => void;
}

/**
 * Robot base tool executor
 */
export class RobotToolExecutor {
  private robotBridge: IRobotBridge;
  private sendMessage: (msg: UnifiedClientMessage) => void;

  constructor(config: RobotToolExecutorConfig) {
    this.robotBridge = config.robotBridge;
    this.sendMessage = config.sendMessage;
  }

  /**
   * Execute robot base tool
   * @returns true if tool was handled, false if not a base tool
   */
  async execute(toolCall: ToolCall, turnId: number): Promise<boolean> {
    const { toolCallId, name, arguments: args } = toolCall;

    if (!isRobotBaseTool(name)) {
      return false;
    }

    console.log(`[RobotToolExecutor] Executing tool ${toolCallId}: ${name}`, args);

    try {
      let result: any;

      switch (name) {
        // ========== Navigation ==========
        case 'startNavigation':
          await this.robotBridge.navigate(args.placeName);
          result = { success: true, message: `Starting navigation to ${args.placeName}` };
          break;

        case 'stopNavigation':
          await this.robotBridge.stopNavigation();
          result = { success: true, message: 'Navigation stopped' };
          break;

        case 'getPlaceList':
          result = await this.robotBridge.getPlaceList();
          break;

        case 'getPosition':
          result = await this.robotBridge.getPosition();
          break;

        // ========== System ==========
        case 'enter_maintenance_mode':
          console.log('[RobotToolExecutor] Triggering maintenance mode');
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('enter_maintenance_mode'));
          }
          result = { success: true, message: 'Entered maintenance mode' };
          break;

        default:
          // Unimplemented tool
          console.warn(`[RobotToolExecutor] Unimplemented tool: ${name}`);
          result = { success: false, message: `Tool ${name} not implemented` };
      }

      // Send success result
      this.sendMessage({
        type: 'tool_result',
        turnId,
        timestamp: Date.now(),
        toolResult: {
          toolCallId,
          result: { result }
        }
      } as UnifiedClientMessage);

      return true;

    } catch (error: any) {
      console.error(`[RobotToolExecutor] Tool execution failed: ${name}`, error);

      this.sendMessage({
        type: 'tool_result',
        turnId,
        timestamp: Date.now(),
        toolResult: {
          toolCallId,
          result: null,
          error: error.message || 'Unknown error'
        }
      } as UnifiedClientMessage);

      return true;
    }
  }
}

/**
 * Execute robot base tool (compatible functional API)
 * Uses global robotSDK instance
 * @returns true if tool was handled, false if not a base tool
 */
export const executeRobotBaseTool = async (
  toolCall: ToolCall,
  sendMessage: (msg: UnifiedClientMessage) => void,
  turnId: number
): Promise<boolean> => {
  const { toolCallId, name, arguments: args } = toolCall;

  // Check if it's a base tool
  if (!isRobotBaseTool(name)) {
    return false;
  }

  console.log(`[RobotBaseTool] Executing tool ${toolCallId}: ${name}`, args);

  try {
    let result: any;

    switch (name) {
      // ========== Navigation ==========
      case 'startNavigation':
        result = await robotSDK.startNavigation(args.placeName);
        break;

      case 'stopNavigation':
        result = await robotSDK.stopNavigation();
        break;

      case 'getPlaceList':
        result = await robotSDK.getPlaceList();
        break;

      case 'getLocation':
        result = await robotSDK.getLocation(args.placeName);
        break;

      case 'getPosition':
        result = await robotSDK.getPosition();
        break;

      case 'getMapName':
        result = await robotSDK.getMapName();
        break;

      // ========== Movement ==========
      case 'moveForward':
        result = await robotSDK.goForward(args.distance, args.speed, args.avoid);
        break;

      case 'moveBackward':
        result = await robotSDK.goBackward(args.distance, args.speed);
        break;

      case 'turnRobot':
        if (args.direction === 'left') {
          result = await robotSDK.turnLeft(args.angle, args.speed);
        } else {
          result = await robotSDK.turnRight(args.angle, args.speed);
        }
        break;

      // ========== Head Control ==========
      case 'moveHead':
        result = await robotSDK.moveHead(args.hAngle, args.vAngle);
        break;

      case 'resetHead':
        result = await robotSDK.resetHead();
        break;

      // ========== Perception ==========
      case 'getPersonList':
        result = await robotSDK.getPersonList();
        break;

      // ========== Others ==========
      case 'setLight':
        result = await robotSDK.setLight(args.color);
        break;

      case 'startFocusFollow':
        result = await robotSDK.startFocusFollow(args.personId);
        break;

      case 'stopFocusFollow':
        result = await robotSDK.stopFocusFollow();
        break;

      // ========== Charging ==========
      case 'startAutoCharge':
        result = await robotSDK.startAutoCharge(args?.timeout);
        break;

      case 'stopAutoCharge':
        result = await robotSDK.stopAutoCharge();
        break;

      case 'leaveChargingPile':
        result = await robotSDK.leaveChargingPile(args?.speed, args?.distance);
        break;

      // ========== System ==========
      case 'enter_maintenance_mode':
        console.log('[RobotBaseTool] Triggering maintenance mode');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('enter_maintenance_mode'));
        }
        result = { success: true, message: 'Entered maintenance mode. Please modify configuration in the UI.' };
        break;

      default:
        console.warn(`[RobotBaseTool] Unimplemented base tool: ${name}`);
        return false;
    }

    // Send success result
    sendMessage({
      type: 'tool_result',
      turnId: turnId,
      timestamp: Date.now(),
      toolResult: {
        toolCallId: toolCallId,
        result: { result: result }
      }
    } as UnifiedClientMessage);

    console.log(`[RobotBaseTool] Tool execution succeeded ${toolCallId}: ${name}`);
    return true;

  } catch (error: any) {
    console.error(`[RobotBaseTool] Tool execution failed: ${name}`, error);

    sendMessage({
      type: 'tool_result',
      turnId: turnId,
      timestamp: Date.now(),
      toolResult: {
        toolCallId: toolCallId,
        result: null,
        error: error.message || 'Unknown error'
      }
    } as UnifiedClientMessage);

    return true;
  }
};
