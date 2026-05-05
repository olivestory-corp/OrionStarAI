/**
 * Robot Base Tools - Robot base tool definitions
 * Pure TypeScript implementation
 *
 * These are common tools for all voice robot scenarios, including:
 * - Navigation: startNavigation, stopNavigation, getPlaceList, getLocation, getPosition
 * - Movement: moveForward, turnRobot
 * - Head Control: moveHead, resetHead
 * - Perception: getPersonList
 */

import { ToolDeclaration } from '../types';

/**
 * Robot base tool name list
 */
export const ROBOT_BASE_TOOL_NAMES = [
  'startNavigation',
  'stopNavigation',
  'getPlaceList',
  'getLocation',
  'getPosition',
  'moveForward',
  'moveBackward',
  'turnRobot',
  'moveHead',
  'resetHead',
  'getPersonList',
  'setLight',
  'startFocusFollow',
  'stopFocusFollow',
  'getMapName',
  'startAutoCharge',
  'stopAutoCharge',
  'leaveChargingPile',
  'enter_maintenance_mode'
];

/**
 * Check if a tool is a robot base tool
 */
export function isRobotBaseTool(toolName: string): boolean {
  return ROBOT_BASE_TOOL_NAMES.includes(toolName);
}

/**
 * Get robot base tool definitions
 */
export async function getRobotBaseTools(
  getPlaceListFn?: () => Promise<{ name: string }[]>
): Promise<ToolDeclaration[]> {
  let placeDescription = "Target place name, must be an existing location on the map.";
  let placeEnum: string[] | undefined = undefined;

  if (getPlaceListFn) {
    try {
      const places = await getPlaceListFn();
      if (Array.isArray(places) && places.length > 0) {
        const placeNames = places.map(p => p.name);
        placeEnum = placeNames;
        placeDescription = `Target place name, must be selected from: [${placeNames.join(', ')}].`;
      }
    } catch (e) {
      console.warn("[RobotBaseTools] Failed to get place list", e);
    }
  }

  return [
    // ========== Navigation ==========
    {
      name: "startNavigation",
      description: `Control robot to navigate to specified location on the map.

**When to call** (user explicitly wants to go somewhere):
- "Take me to XX", "Go to XX", "Navigate to XX"

**Do NOT call** (user is just asking about location):
- "Where is XX?" → Answer verbally first

**Important**: placeName must be an existing location on the map.`,
      parameters: {
        type: "object",
        properties: {
          placeName: {
            type: "string",
            description: placeDescription,
            ...(placeEnum && { enum: placeEnum })
          },
          coordinateDeviation: {
            type: "number",
            description: "Arrival threshold in meters, default 0.2m"
          }
        },
        required: ["placeName"]
      }
    },
    {
      name: "stopNavigation",
      description: `Stop robot's current navigation task.`,
      parameters: { type: "object", properties: {} }
    },
    {
      name: "getPlaceList",
      description: `Get list of locations on the map.`,
      parameters: { type: "object", properties: {} }
    },
    {
      name: "getLocation",
      description: `Query coordinates of a specific location.`,
      parameters: {
        type: "object",
        properties: {
          placeName: { type: "string", description: "Name of the place to query" }
        },
        required: ["placeName"]
      }
    },
    {
      name: "getPosition",
      description: `Get robot's current coordinates.`,
      parameters: { type: "object", properties: {} }
    },
    {
      name: "getMapName",
      description: `Get current map name.`,
      parameters: { type: "object", properties: {} }
    },

    // ========== Movement ==========
    {
      name: "moveForward",
      description: `Control robot to move forward a specified distance.`,
      parameters: {
        type: "object",
        properties: {
          distance: { type: "number", description: "Distance in meters" },
          speed: { type: "number", description: "Speed in m/s, default 0.5" },
          avoid: { type: "boolean", description: "Enable obstacle avoidance, default true" }
        },
        required: ["distance"]
      }
    },
    {
      name: "moveBackward",
      description: `Control robot to move backward a specified distance.`,
      parameters: {
        type: "object",
        properties: {
          distance: { type: "number", description: "Distance in meters" },
          speed: { type: "number", description: "Speed in m/s, default 0.5" }
        },
        required: ["distance"]
      }
    },
    {
      name: "turnRobot",
      description: `Control robot to rotate in place.`,
      parameters: {
        type: "object",
        properties: {
          direction: { type: "string", enum: ["left", "right"], description: "Turn direction" },
          angle: { type: "number", description: "Rotation angle in degrees" },
          speed: { type: "number", description: "Rotation speed in deg/s, default 30" }
        },
        required: ["direction", "angle"]
      }
    },

    // ========== Head Control ==========
    {
      name: "moveHead",
      description: `Control robot head gimbal rotation.`,
      parameters: {
        type: "object",
        properties: {
          hAngle: { type: "number", description: "Horizontal angle (-120 to 120 degrees)" },
          vAngle: { type: "number", description: "Vertical angle (0 to 90 degrees)" }
        },
        required: ["hAngle", "vAngle"]
      }
    },
    {
      name: "resetHead",
      description: `Reset robot head to forward position.`,
      parameters: { type: "object", properties: {} }
    },

    // ========== Perception ==========
    {
      name: "getPersonList",
      description: `Get list of people detected in current view.`,
      parameters: { type: "object", properties: {} }
    },

    // ========== Others ==========
    {
      name: "setLight",
      description: `Set robot light color.`,
      parameters: {
        type: "object",
        properties: {
          color: { type: "string", description: "RGB Hex String (e.g., 'FF0000')" }
        },
        required: ["color"]
      }
    },
    {
      name: "startFocusFollow",
      description: `Start focus following a specific person.`,
      parameters: {
        type: "object",
        properties: {
          personId: { type: "number", description: "Person ID" }
        },
        required: ["personId"]
      }
    },
    {
      name: "stopFocusFollow",
      description: `Stop focus following.`,
      parameters: { type: "object", properties: {} }
    },

    // ========== Charging ==========
    {
      name: "startAutoCharge",
      description: `Robot automatically returns to charging station.`,
      parameters: {
        type: "object",
        properties: {
          timeout: { type: "number", description: "Navigation timeout in ms, default 5 minutes" }
        }
      }
    },
    {
      name: "stopAutoCharge",
      description: `Stop robot's current auto-charge task.`,
      parameters: { type: "object", properties: {} }
    },
    {
      name: "leaveChargingPile",
      description: `Stop charging and leave charging station.`,
      parameters: {
        type: "object",
        properties: {
          speed: { type: "number", description: "Departure speed in m/s, default 0.2" },
          distance: { type: "number", description: "Departure distance in meters, default 0.5" }
        }
      }
    },

    // ========== System ==========
    {
      name: "enter_maintenance_mode",
      description: `Enter maintenance mode, allowing robot configuration changes.`,
      parameters: { type: "object", properties: {} }
    }
  ];
}
