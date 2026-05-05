/**
 * usePresenceStatus - 人员感知状态 Hook
 *
 * 根据 robotState.people 计算感知状态：
 * - idle: 无人
 * - detected: 有人但距离 > 1.2m
 * - ready: 有人且距离 <= 1.2m，可以交互
 */

import { useMemo } from 'react';
import type { RobotEnvironmentState } from '../../sdk/types';
import type { PresenceStatus } from '../components/PresenceIndicator';

/** 可交互的最大距离（米） */
const INTERACTION_DISTANCE = 1.2;

export interface UsePresenceStatusResult {
  /** 感知状态 */
  status: PresenceStatus;
  /** 人数 */
  count: number;
  /** 最近的人的距离（米），无人时为 null */
  minDistance: number | null;
  /** 是否可以交互（有人且距离足够近） */
  canInteract: boolean;
}

export function usePresenceStatus(
  robotState: RobotEnvironmentState | null
): UsePresenceStatusResult {
  return useMemo(() => {
    const count = robotState?.people?.count ?? 0;
    const list = robotState?.people?.list ?? [];

    if (count === 0 || list.length === 0) {
      return {
        status: 'idle' as PresenceStatus,
        count: 0,
        minDistance: null,
        canInteract: false,
      };
    }

    const minDistance = Math.min(...list.map(p => p.distance));
    const canInteract = minDistance <= INTERACTION_DISTANCE;

    return {
      status: canInteract ? 'ready' : 'detected',
      count,
      minDistance,
      canInteract,
    };
  }, [robotState?.people?.count, robotState?.people?.list]);
}

export default usePresenceStatus;
