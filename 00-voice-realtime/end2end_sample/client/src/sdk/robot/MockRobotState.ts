/**
 * MockRobotState - Unified mock robot state management
 *
 * This is the only Mock state source, all Mock systems should use this module:
 * - mockRobotApi.ts (provides window.RobotAPI for robotSDK)
 * - MockRobotBridge.ts (provides IRobotBridge for RobotEnvironment)
 *
 * Event-driven: state changes trigger callbacks asynchronously, simulating real Android environment
 */

import { EventEmitter } from 'events';

// Mock delay constants
const ASYNC_DELAY = 50; // Async event delay (ms)

// ==================== Type Definitions ====================

export interface MockPose {
  x: number;
  y: number;
  theta: number;
  isLocalized: boolean;
  name?: string;
}

export interface MockBattery {
  level: number;
  isCharging: boolean;
}

export interface MockPlace {
  id: string;
  name: string;
  x: number;
  y: number;
  theta?: number;
  status?: number;
}

export interface MockNavigationStatus {
  type: 'update' | 'finished' | 'error';
  status?: number;
  message?: string;
  destination?: string;
  data?: any;
}

export interface MockPersonData {
  id: number;
  distance: number;
  angle: number;
  age?: number;
  gender?: string;
}

// ==================== Singleton State Management ====================

class MockRobotStateManager extends EventEmitter {
  // Position state
  private _pose: MockPose = {
    x: 10,
    y: 5,
    theta: 0,
    isLocalized: true,
    name: 'Reception'
  };

  // Battery state
  private _battery: MockBattery = {
    level: 85,
    isCharging: false
  };

  // Navigation state
  private _isNavigating = false;
  private _navigationDestination: string | null = null;
  private _navigationInterval: ReturnType<typeof setInterval> | null = null;

  // Place list
  private _places: MockPlace[] = [
    { name: 'Reception', x: 10, y: 5, theta: 0, id: 'p1', status: 0 },
    { name: 'Meeting Room', x: 20, y: 15, theta: 1.5, id: 'p2', status: 0 },
    { name: 'Charging Station', x: 0, y: 0, theta: 0, id: 'p3', status: 0 },
    { name: 'R&D Department', x: 15, y: 25, theta: 0.5, id: 'p4', status: 0 },
    { name: 'Marketing Department', x: 25, y: 5, theta: -0.5, id: 'p5', status: 0 },
    { name: 'CEO Office', x: 30, y: 30, theta: 3.14, id: 'p6', status: 0 },
    { name: 'Pantry', x: 5, y: 20, theta: 1.0, id: 'p7', status: 0 },
    { name: 'Restroom', x: 5, y: 30, theta: 1.57, id: 'p8', status: 0 },
    { name: 'Lounge', x: 15, y: 10, theta: 0, id: 'p9', status: 0 },
    { name: 'Print Area', x: 22, y: 22, theta: -1.0, id: 'p10', status: 0 }
  ];

  // People state (for immediate return when callback is registered)
  private _currentPeople: { count: number; data: MockPersonData[] } = {
    count: 1,
    data: [{ id: 1, distance: 0.8, angle: 0, age: 30, gender: 'male' }]
  };

  // Timers
  private _batteryTimer: ReturnType<typeof setInterval> | null = null;
  private _personTimer: ReturnType<typeof setInterval> | null = null;
  private _initialized = false;

  constructor() {
    super();
    this.setMaxListeners(20);
  }

  /**
   * Emit event asynchronously (simulating real Android environment async callbacks)
   */
  private emitAsync(event: string, data: any, delay = ASYNC_DELAY): void {
    setTimeout(() => {
      this.emit(event, data);
    }, delay);
  }

  // ==================== Getters ====================

  get pose(): MockPose {
    return { ...this._pose };
  }

  get battery(): MockBattery {
    return { ...this._battery };
  }

  get places(): MockPlace[] {
    return [...this._places];
  }

  get isNavigating(): boolean {
    return this._isNavigating;
  }

  get navigationDestination(): string | null {
    return this._navigationDestination;
  }

  get currentPeople(): { count: number; data: MockPersonData[] } {
    return { ...this._currentPeople, data: [...this._currentPeople.data] };
  }

  // ==================== Initialization ====================

  initialize(): void {
    if (this._initialized) return;
    this._initialized = true;

    console.log('[MockRobotState] 🤖 Initializing unified Mock state management');
    console.log('[MockRobotState] 👥 Initial people state:', this._currentPeople.count, 'people, distance', this._currentPeople.data[0]?.distance, 'm');

    // Start battery simulation
    this._batteryTimer = setInterval(() => {
      if (!this._battery.isCharging && this._battery.level > 10) {
        this._battery.level -= 1;
        this.emitAsync('battery', { ...this._battery });
      } else if (this._battery.isCharging && this._battery.level < 100) {
        this._battery.level += 1;
        this.emitAsync('battery', { ...this._battery });
      }
    }, 30000);

    // Start people detection simulation (detect every 1 second, simulating real-time detection)
    this._personTimer = setInterval(() => {
      // Simulate small changes in people positions (distance fluctuates between 0.5-1.5m)
      const count = this._currentPeople.count;
      if (count > 0) {
        const people: MockPersonData[] = [];
        for (let i = 0; i < count; i++) {
          // Make small random changes based on current position
          const currentDist = this._currentPeople.data[i]?.distance ?? 0.8;
          // Distance change ±0.1m
          const newDist = Math.max(0.3, Math.min(2.0, currentDist + (Math.random() - 0.5) * 0.2));
          people.push({
            id: i + 1,
            distance: newDist,
            angle: (Math.random() - 0.5) * Math.PI * 0.5,
            age: this._currentPeople.data[i]?.age ?? 30,
            gender: this._currentPeople.data[i]?.gender ?? 'male'
          });
        }

        // Check if distance has significant change (>0.1m)
        const oldMinDist = Math.min(...this._currentPeople.data.map(p => p.distance));
        const newMinDist = Math.min(...people.map(p => p.distance));

        if (Math.abs(oldMinDist - newMinDist) > 0.1) {
          console.log(`[MockRobotState] 👥 People distance changed: ${oldMinDist.toFixed(2)}m -> ${newMinDist.toFixed(2)}m`);
          this._currentPeople = { count, data: people };
          this.emit('person_detected', { count, data: people });
        }
      }
    }, 1000);
  }

  // ==================== Navigation Control ====================

  startNavigation(placeName: string): { success: boolean; message: string } {
    console.log(`[MockRobotState] 🚀 Starting navigation to: ${placeName}`);

    const target = this._places.find(p => p.name === placeName);
    if (!target) {
      console.warn(`[MockRobotState] ❌ Target not found: ${placeName}`);
      return { success: false, message: `Target location not found: ${placeName}` };
    }

    // Stop previous navigation
    if (this._navigationInterval) {
      clearInterval(this._navigationInterval);
      this._navigationInterval = null;
    }

    this._isNavigating = true;
    this._navigationDestination = placeName;

    // Trigger navigation start event (immediately, ensure timely UI response)
    console.log('[MockRobotState] 🚀 Triggering navigation start event:', placeName);
    this.emit('navigation_status', {
      type: 'update',
      status: 1014,
      message: 'Navigation started',
      destination: placeName
    } as MockNavigationStatus);

    // Start simulating movement
    const startX = this._pose.x;
    const startY = this._pose.y;
    const totalSteps = 20;
    let currentStep = 0;

    const deltaX = target.x - startX;
    const deltaY = target.y - startY;
    const targetTheta = Math.atan2(deltaY, deltaX);

    this._navigationInterval = setInterval(() => {
      // If navigation has been stopped, no more processing
      if (!this._isNavigating) {
        if (this._navigationInterval) {
          clearInterval(this._navigationInterval);
          this._navigationInterval = null;
        }
        return;
      }

      currentStep++;
      const progress = currentStep / totalSteps;

      // Check if arrived (check first to avoid subsequent event confusion)
      if (currentStep >= totalSteps) {
        // Stop timer first
        if (this._navigationInterval) {
          clearInterval(this._navigationInterval);
          this._navigationInterval = null;
        }

        // Update final position
        this._pose.x = target.x;
        this._pose.y = target.y;
        this._pose.theta = targetTheta;
        this._pose.name = placeName;
        this._isNavigating = false;
        this._navigationDestination = null;

        // Trigger final position update
        this.emit('pose', { ...this._pose });

        // Trigger navigation complete event
        console.log('[MockRobotState] 🎉 Triggering navigation complete event:', placeName);
        this.emit('navigation_status', {
          type: 'finished',
          status: 1002,
          message: 'Navigation succeeded',
          destination: placeName,
          data: { destination: placeName }
        } as MockNavigationStatus);

        console.log(`[MockRobotState] 🎉 Arrived at: ${placeName}`);
        return;
      }

      // Update position (moving)
      this._pose.x = startX + deltaX * progress;
      this._pose.y = startY + deltaY * progress;
      this._pose.theta = targetTheta;

      // Trigger position update event
      this.emit('pose', { ...this._pose });

      // Trigger navigation progress event (no emitAsync, ensure order)
      const remainingDist = Math.sqrt(
        Math.pow(target.x - this._pose.x, 2) +
        Math.pow(target.y - this._pose.y, 2)
      );
      this.emit('navigation_status', {
        type: 'update',
        status: 1050,
        message: 'Navigating',
        destination: placeName,
        data: { remainingDistance: remainingDist }
      } as MockNavigationStatus);
    }, 500);

    return { success: true, message: 'Navigation command sent' };
  }

  stopNavigation(): { success: boolean; message: string } {
    console.log('[MockRobotState] ⏹️ Stopping navigation');

    if (this._navigationInterval) {
      clearInterval(this._navigationInterval);
      this._navigationInterval = null;
    }

    const wasNavigating = this._isNavigating;
    const destination = this._navigationDestination;

    this._isNavigating = false;
    this._navigationDestination = null;

    if (wasNavigating) {
      console.log('[MockRobotState] ⏹️ Triggering navigation stop event:', destination);
      this.emit('navigation_status', {
        type: 'finished',
        status: 1003,
        message: 'User stopped navigation',
        destination: destination || undefined,
        data: { statusCode: 1003 }
      } as MockNavigationStatus);
    }

    return { success: true, message: 'Navigation stopped' };
  }

  // ==================== Position Control ====================

  setPosition(x: number, y: number, theta?: number): void {
    this._pose.x = x;
    this._pose.y = y;
    if (theta !== undefined) {
      this._pose.theta = theta;
    }
    this.emitAsync('pose', { ...this._pose });
  }

  // ==================== Battery Control ====================

  setBattery(level: number, isCharging?: boolean): void {
    this._battery.level = Math.max(0, Math.min(100, level));
    if (isCharging !== undefined) {
      this._battery.isCharging = isCharging;
    }
    this.emitAsync('battery', { ...this._battery });
  }

  // ==================== Cleanup ====================

  destroy(): void {
    if (this._navigationInterval) {
      clearInterval(this._navigationInterval);
      this._navigationInterval = null;
    }
    if (this._batteryTimer) {
      clearInterval(this._batteryTimer);
      this._batteryTimer = null;
    }
    if (this._personTimer) {
      clearInterval(this._personTimer);
      this._personTimer = null;
    }
    this.removeAllListeners();
    this._initialized = false;
    console.log('[MockRobotState] ♻️ Destroyed');
  }
}

// Export singleton
export const mockRobotState = new MockRobotStateManager();

// Backward compatible export (deprecated)
/** @deprecated Use mockRobotState singleton instead */
export const mockPlaces = mockRobotState.places;
