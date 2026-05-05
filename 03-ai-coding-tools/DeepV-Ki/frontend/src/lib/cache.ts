/**
 * 缓存管理器
 * 统一管理 localStorage 和内存缓存
 */

import type { WikiProjectStatus, GitLabProject } from '@/types/gitlab';
import type { GroupedProjects } from './api';

// 缓存 key 前缀
const CACHE_PREFIX = 'deepwiki_';
const PROJECTS_KEY = 'projects';
const WIKI_STATUS_KEY = 'wiki_statuses';

/**
 * 缓存管理器
 */
export class CacheManager {
  // 内存缓存（用于 Wiki 状态）
  private static wikiStatusCache = new Map<string, WikiProjectStatus>();

  /**
   * 生成用户相关的缓存 key
   */
  private static getUserKey(key: string, userEmail: string): string {
    return `${CACHE_PREFIX}${key}_${userEmail}`;
  }

  // ==================== 项目缓存 ====================

  /**
   * 获取缓存的项目数据
   */
  static getProjects(userEmail: string): GroupedProjects | null {
    if (typeof window === 'undefined') return null;

    try {
      const key = this.getUserKey(PROJECTS_KEY, userEmail);
      const cached = localStorage.getItem(key);

      if (!cached) return null;

      const data = JSON.parse(cached);

      // 检查缓存是否过期（24 小时）
      const now = Date.now();
      const cacheTime = data.timestamp || 0;
      const maxAge = 24 * 60 * 60 * 1000; // 24 小时

      if (now - cacheTime > maxAge) {
        this.clearProjects(userEmail);
        return null;
      }

      return data.projects;
    } catch (error) {
      console.error('Error reading projects cache:', error);
      return null;
    }
  }

  /**
   * 保存项目数据到缓存
   */
  static setProjects(userEmail: string, projects: GroupedProjects): void {
    if (typeof window === 'undefined') return;

    try {
      const key = this.getUserKey(PROJECTS_KEY, userEmail);
      const data = {
        projects,
        timestamp: Date.now(),
      };

      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving projects cache:', error);
    }
  }

  /**
   * 清除项目缓存
   */
  static clearProjects(userEmail: string): void {
    if (typeof window === 'undefined') return;

    try {
      const key = this.getUserKey(PROJECTS_KEY, userEmail);
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Error clearing projects cache:', error);
    }
  }

  /**
   * 在所有缓存中查找项目
   * 遍历所有用户的项目缓存，查找匹配的项目
   */
  static findProjectInCache(owner: string, repo: string): GitLabProject | null {
    if (typeof window === 'undefined') return null;

    try {
      // 遍历 localStorage 中所有以 deepwiki_projects_ 开头的 key
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`${CACHE_PREFIX}${PROJECTS_KEY}_`)) {
          const cached = localStorage.getItem(key);
          if (!cached) continue;

          const data = JSON.parse(cached);
          const projects = data.projects as GroupedProjects;

          if (!projects) continue;

          // 收集所有项目
          const allProjects: GitLabProject[] = [
            ...Object.values(projects.member || {}).flat(),
            ...Object.values(projects.inherited || {}).flat(),
          ];

          // 查找匹配的项目
          const project = allProjects.find(p =>
            p.path === repo && p.path_with_namespace.startsWith(owner)
          );

          if (project) {
            return project;
          }
        }
      }
    } catch (error) {
      console.error('Error searching project in cache:', error);
    }

    return null;
  }

  // ==================== Wiki 状态缓存 ====================

  /**
   * 从 sessionStorage 加载 Wiki 状态
   */
  private static loadWikiStatusesFromStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const cached = sessionStorage.getItem(CACHE_PREFIX + WIKI_STATUS_KEY);
      if (cached) {
        const statuses = JSON.parse(cached);
        Object.entries(statuses).forEach(([key, status]) => {
          this.wikiStatusCache.set(key, status as WikiProjectStatus);
        });
      }
    } catch (error) {
      console.error('Error loading wiki statuses from storage:', error);
    }
  }

  /**
   * 保存 Wiki 状态到 sessionStorage
   */
  private static saveWikiStatusesToStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const statuses: Record<string, WikiProjectStatus> = {};
      this.wikiStatusCache.forEach((status, key) => {
        statuses[key] = status;
      });
      sessionStorage.setItem(CACHE_PREFIX + WIKI_STATUS_KEY, JSON.stringify(statuses));
    } catch (error) {
      console.error('Error saving wiki statuses to storage:', error);
    }
  }

  /**
   * 获取 Wiki 状态
   */
  static getWikiStatus(projectKey: string): WikiProjectStatus | null {
    // 先从内存加载，如果空则从 sessionStorage 加载
    if (this.wikiStatusCache.size === 0) {
      this.loadWikiStatusesFromStorage();
    }
    return this.wikiStatusCache.get(projectKey) || null;
  }

  /**
   * 获取所有 Wiki 状态
   */
  static getAllWikiStatuses(): Map<string, WikiProjectStatus> {
    // 先从内存加载，如果空则从 sessionStorage 加载
    if (this.wikiStatusCache.size === 0) {
      this.loadWikiStatusesFromStorage();
    }
    return new Map(this.wikiStatusCache);
  }

  /**
   * 保存 Wiki 状态
   */
  static setWikiStatus(projectKey: string, status: WikiProjectStatus): void {
    this.wikiStatusCache.set(projectKey, status);
    this.saveWikiStatusesToStorage();
  }

  /**
   * 批量保存 Wiki 状态
   */
  static setWikiStatuses(statuses: Record<string, WikiProjectStatus>): void {
    Object.entries(statuses).forEach(([key, status]) => {
      this.wikiStatusCache.set(key, status);
    });
    this.saveWikiStatusesToStorage();
  }

  /**
   * 清除 Wiki 状态缓存
   */
  static clearWikiStatuses(): void {
    this.wikiStatusCache.clear();
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(CACHE_PREFIX + WIKI_STATUS_KEY);
    }
  }

  /**
   * 清除特定项目的 Wiki 状态
   */
  static clearWikiStatus(projectKey: string): void {
    this.wikiStatusCache.delete(projectKey);
    this.saveWikiStatusesToStorage();
  }

  // ==================== 全局清除 ====================

  /**
   * 清除指定用户的所有缓存
   */
  static clearUser(userEmail: string): void {
    this.clearProjects(userEmail);
    this.clearWikiStatuses();
  }

  /**
   * 清除所有缓存
   */
  static clearAll(): void {
    if (typeof window === 'undefined') return;

    try {
      // 清除所有 deepwiki 相关的 sessionStorage
      const keys = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith(CACHE_PREFIX)) {
          keys.push(key);
        }
      }

      keys.forEach(key => sessionStorage.removeItem(key));

      // 清除所有 deepwiki 相关的 localStorage
      const localKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CACHE_PREFIX)) {
          localKeys.push(key);
        }
      }
      localKeys.forEach(key => localStorage.removeItem(key));

      // 清除内存缓存
      this.clearWikiStatuses();
    } catch (error) {
      console.error('Error clearing all cache:', error);
    }
  }
}

