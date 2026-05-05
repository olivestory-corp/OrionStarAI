/**
 * GitLab Project Types
 */

export type ProjectRole = 'OWNER' | 'MAINTAINER' | 'DEVELOPER' | 'REPORTER' | 'GUEST';
export type MemberType = 'member' | 'inherited';
export type ProjectVisibility = 'public' | 'internal' | 'private';
export type WikiStatus = 'not_generated' | 'generating' | 'generated' | 'failed';

export interface GitLabProject {
  id: number;
  name: string;
  name_with_namespace: string;
  description: string;
  web_url: string;
  avatar_url?: string;
  path: string;
  path_with_namespace: string;
  visibility: ProjectVisibility;
  access_level: number;
  role: ProjectRole;
  member_type: MemberType;

  // Wiki 相关字段
  wiki_status?: WikiStatus;
  wiki_pages_count?: number;
  wiki_task_id?: string;
  wiki_progress?: number;
  wiki_message?: string;
  wiki_last_generated_at?: string;
}

export interface ProjectsResponse {
  success: boolean;
  projects: GitLabProject[];
  total: number;
  grouped_by_role: Record<ProjectRole, GitLabProject[]>;
  message: string;
}

export interface GroupedProjectsResponse {
  success: boolean;
  member: Record<ProjectRole, GitLabProject[]>;
  inherited: Record<ProjectRole, GitLabProject[]>;
  total: number;
  member_count: number;
  inherited_count: number;
}

export interface GitLabHealthResponse {
  status: 'healthy' | 'configured' | 'error';
  gitlab_url?: string;
  message: string;
}

// ==================== Wiki 相关类型 ====================

export interface WikiProjectStatus {
  project_key: string;
  status: WikiStatus;
  current_task_id?: string;
  pages_count?: number;
  documents_count?: number;
  last_generated_at?: string;
  generation_count?: number;
  progress?: number;  // 生成进度百分比 (0-100)
  message?: string;   // 当前阶段的说明文字
}

export interface WikiGenerateRequest {
  repo_url: string;
  repo_type: 'gitlab' | 'github' | 'bitbucket' | 'gerrit';
  owner: string;
  repo_name: string;
  provider?: string;
  model?: string;
  language?: string;
  is_comprehensive?: boolean;  // Wiki 类型：true=全面型, false=简洁型
  access_token?: string;
  force_refresh?: boolean;  // 强制刷新：重新下载代码，跳过缓存
}

export interface WikiGenerateResponse {
  task_id: string;
  status: 'started' | 'already_generating';
  message?: string;
}

export interface WikiTaskProgress {
  task_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  message: string;
  error_message?: string;
}
