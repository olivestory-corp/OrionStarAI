/**
 * Maintenance Mode - localStorage storage management
 * Pure TypeScript implementation
 */

import { SceneOverrides, ToolOverride } from './types';

const STORAGE_PREFIX = 'maintenance_overrides_';

/**
 * Get scene override configuration
 */
export function getSceneOverrides(sceneId: string): SceneOverrides | null {
  try {
    const key = `${STORAGE_PREFIX}${sceneId}`;
    const data = localStorage.getItem(key);
    if (!data) return null;
    return JSON.parse(data) as SceneOverrides;
  } catch (e) {
    console.error('[Maintenance] Failed to read config:', e);
    return null;
  }
}

/**
 * Save scene override configuration
 */
export function saveSceneOverrides(overrides: SceneOverrides): void {
  try {
    const key = `${STORAGE_PREFIX}${overrides.sceneId}`;
    overrides.updatedAt = Date.now();
    localStorage.setItem(key, JSON.stringify(overrides));
    console.log('[Maintenance] Config saved:', overrides.sceneId);
  } catch (e) {
    console.error('[Maintenance] Failed to save config:', e);
  }
}

/**
 * Append System Prompt
 */
export function appendPrompt(sceneId: string, content: string): SceneOverrides {
  let overrides = getSceneOverrides(sceneId);

  if (!overrides) {
    overrides = {
      sceneId,
      promptAdditions: [],
      toolOverrides: {},
      updatedAt: Date.now(),
    };
  }

  overrides.promptAdditions.push(content);
  saveSceneOverrides(overrides);

  return overrides;
}

/**
 * Remove appended Prompt
 */
export function removePromptAddition(sceneId: string, index: number): SceneOverrides | null {
  const overrides = getSceneOverrides(sceneId);
  if (!overrides) return null;

  overrides.promptAdditions.splice(index, 1);
  saveSceneOverrides(overrides);

  return overrides;
}

/**
 * Modify tool description
 */
export function setToolOverride(
  sceneId: string,
  toolName: string,
  override: ToolOverride
): SceneOverrides {
  let overrides = getSceneOverrides(sceneId);

  if (!overrides) {
    overrides = {
      sceneId,
      promptAdditions: [],
      toolOverrides: {},
      updatedAt: Date.now(),
    };
  }

  overrides.toolOverrides[toolName] = override;
  saveSceneOverrides(overrides);

  return overrides;
}

/**
 * Remove tool description override
 */
export function removeToolOverride(sceneId: string, toolName: string): SceneOverrides | null {
  const overrides = getSceneOverrides(sceneId);
  if (!overrides) return null;

  delete overrides.toolOverrides[toolName];
  saveSceneOverrides(overrides);

  return overrides;
}

/**
 * Reset scene configuration
 */
export function resetSceneOverrides(sceneId: string): void {
  try {
    const key = `${STORAGE_PREFIX}${sceneId}`;
    localStorage.removeItem(key);
    console.log('[Maintenance] Config reset:', sceneId);
  } catch (e) {
    console.error('[Maintenance] Failed to reset config:', e);
  }
}

/**
 * Merge original Prompt and appended content
 */
export function mergePrompt(originalPrompt: string | undefined, overrides: SceneOverrides | null): string {
  if (!overrides || overrides.promptAdditions.length === 0) {
    return originalPrompt || '';
  }

  const additions = overrides.promptAdditions.join('\n');
  return `${originalPrompt || ''}\n\n[User Additional Config]\n${additions}`;
}

/**
 * Merge original Tools and override configuration
 */
export function mergeTools<T extends { name: string; description?: string }>(
  originalTools: T[],
  overrides: SceneOverrides | null
): T[] {
  if (!overrides || Object.keys(overrides.toolOverrides).length === 0) {
    return originalTools;
  }

  return originalTools.map(tool => {
    const override = overrides.toolOverrides[tool.name];
    if (override) {
      return {
        ...tool,
        description: override.description,
      };
    }
    return tool;
  });
}
