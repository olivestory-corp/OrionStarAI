/**
 * Wiki 展示页面 - 轻量级版本
 * 只负责展示已生成的 Wiki，不负责生成
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FaBook, FaComments, FaChevronLeft } from 'react-icons/fa';
import Header from '@/components/Header';
import Loading from '@/components/common/Loading';
import ErrorMessage from '@/components/common/ErrorMessage';
import Ask from '@/components/Ask';
import Markdown from '@/components/Markdown';
import type { RepoInfo } from '@/types/repoinfo';
import type { GitLabProject } from '@/types/gitlab';
import { CacheManager } from '@/lib/cache';

// 全局样式注入
if (typeof window !== 'undefined') {
  const styleId = 'wiki-custom-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      /* Wiki 内容自定义样式 */
      .prose .highlight {
        margin: 1.5rem 0;
        border-radius: 0.75rem;
        overflow: hidden;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
      }

      .prose .highlight pre {
        margin: 0;
        padding: 1.5rem;
        background: linear-gradient(135deg, #1f2937 0%, #111827 100%) !important;
      }

      .prose .highlight code {
        background: transparent !important;
        color: #e5e7eb;
        font-family: 'Fira Code', 'Consolas', monospace;
        font-size: 0.9em;
        line-height: 1.7;
      }

      /* Mermaid 图表样式 */
      .prose .mermaid {
        background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
        border-radius: 1rem;
        padding: 2rem;
        margin: 2rem 0;
        box-shadow: 0 10px 30px rgba(59, 130, 246, 0.1);
        border: 2px solid #93c5fd;
      }

      .dark .prose .mermaid {
        background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%);
        border-color: #3b82f6;
      }

      /* 表格样式增强 */
      .prose table {
        width: 100%;
        border-collapse: separate; /* 使用 separate 允许 border-spacing 和圆角 */
        border-spacing: 0; /* 移除单元格间距 */
        margin: 2rem 0;
        font-size: 0.9rem;
        line-height: 1.5;
        color: var(--foreground);
        border: 1px solid var(--border-color); /* 整体边框 */
        border-radius: 0.75rem; /* 圆角 */
        overflow: hidden; /* 确保圆角生效 */
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
      }

      .prose th,
      .prose td {
        padding: 0.75rem 1rem;
        border-bottom: 1px solid var(--border-color);
        border-right: 1px solid var(--border-color);
        text-align: left;
      }

      .prose th:last-child,
      .prose td:last-child {
        border-right: none; /* 移除最右侧边框 */
      }

      .prose tr:last-child td {
        border-bottom: none; /* 移除最底部边框 */
      }

      .prose thead th {
        background-color: var(--ios-background-secondary); /* 表头背景 */
        color: var(--foreground); /* 表头文字颜色 */
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .prose tbody tr:nth-child(odd) {
        background-color: var(--card-bg); /* 奇数行背景 */
      }

      .prose tbody tr:nth-child(even) {
        background-color: var(--ios-background-secondary); /* 偶数行背景 */
      }

      .prose tbody tr:hover {
        background-color: var(--accent-primary-light); /* 悬停效果 */
        color: var(--accent-primary-dark);
      }

      /* 暗黑模式下的表格样式 */
      .dark .prose table {
        border: 1px solid var(--border-color);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      }

      .dark .prose th,
      .dark .prose td {
        border-bottom: 1px solid var(--border-color);
        border-right: 1px solid var(--border-color);
      }

      .dark .prose thead th {
        background-color: var(--ios-background-secondary); /* 暗黑模式表头背景 */
        color: var(--foreground);
      }

      .dark .prose tbody tr:nth-child(odd) {
        background-color: var(--card-bg); /* 暗黑模式奇数行背景 */
      }

      .dark .prose tbody tr:nth-child(even) {
        background-color: var(--ios-background-secondary); /* 暗黑模式偶数行背景 */
      }

      .dark .prose tbody tr:hover {
        background-color: var(--accent-primary-dark); /* 暗黑模式悬停效果 */
        color: var(--foreground);
      }

      /* 列表样式增强 */
      .prose ul {
        list-style: none; /* 移除默认子弹头 */
        padding-left: 1.5rem; /* 留出空间给自定义子弹头 */
      }

      .prose ul li {
        position: relative;
        margin-bottom: 0.5rem;
        padding-left: 0.5rem;
      }

      .prose ul li::before {
        content: '\u2022'; /* Unicode bullet point */
        color: var(--accent-primary); /* 使用主题色 */
        font-weight: bold;
        display: inline-block;
        width: 1em;
        margin-left: -1em;
      }

      .prose ol li::marker {
        font-weight: normal; /* 调整为正常字重 */
        color: var(--muted); /* 使用更低调的灰色 */
      }

      /* 链接悬停效果 */
      .prose a {
        transition: all 0.3s ease;
        color: #6b7280; /* 默认低调灰色 */
        font-size: 0.75rem; /* 小字号 */
        text-decoration: none; /* 无下划线 */
        background-image: none; /* 移除背景渐变 */
        background-size: 0; /* 移除背景渐变 */
      }

      .prose a:hover {
        color: #111827; /* 悬停时变深 */
        text-decoration: underline; /* 悬停时显示下划线 */
      }

      /* 暗黑模式下的链接样式 */
      .dark .prose a {
        color: #9ca3af; /* 暗黑模式低调灰色 */
      }

      .dark .prose a:hover {
        color: #e5e7eb; /* 暗黑模式悬停时变亮 */
      }
    `;
    document.head.appendChild(style);
  }
}

interface WikiPage {
  id: string;
  title: string;
  importance: string;
}

interface WikiStructure {
  title: string;
  description: string;
  pages: WikiPage[];
}

interface PageData {
  page_id: string;
  title: string;
  markdown: string;
  rendered_at: string;
}

export default function WikiViewPage() {
  const params = useParams();
  const router = useRouter();

  // Catch-all 路由返回数组，需要拼接
  const projectKeyArray = params.projectKey as string[];
  // 拼接后需要解码 URL 编码的字符（例如 %3A -> :）
  const projectKey = (projectKeyArray?.join('/') || '') ? decodeURIComponent(projectKeyArray.join('/')) : '';

  const [structure, setStructure] = useState<WikiStructure | null>(null);
  const [currentPageId, setCurrentPageId] = useState<string>('');
  const [pageData, setPageData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isForbidden, setIsForbidden] = useState(false);
  const [isNotGenerated, setIsNotGenerated] = useState(false);
  const [isAskPanelOpen, setIsAskPanelOpen] = useState(false);
  const [isAskCollapsed, setIsAskCollapsed] = useState(false);
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [fullRepoUrl, setFullRepoUrl] = useState<string | null>(null);

  // Get token from localStorage
  const [token, setToken] = useState('');
  useEffect(() => {
    const storedToken = localStorage.getItem('deepwiki_token');
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  const getAuthHeaders = React.useCallback(() => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    // Prefer state token, fallback to localStorage directly to avoid race conditions
    const currentToken = token || (typeof window !== 'undefined' ? localStorage.getItem('deepwiki_token') : '');
    if (currentToken) {
      headers['Authorization'] = `Bearer ${currentToken}`;
    }
    return headers;
  }, [token]);

  // 尝试获取完整的 GitLab URL (修复 subgroup URL 问题)
  useEffect(() => {
    const fetchFullGitLabUrl = async () => {
      if (!projectKey) return;

      const parts = projectKey.split(':');
      const typePrefix = parts[0];

      if (typePrefix !== 'gitlab') return;

      const ownerRepo = parts.slice(1).join(':');
      const [owner, repo] = ownerRepo.split('/');

      if (!owner || !repo) return;

      // 1. 尝试从本地缓存查找 (优先)
      const cachedProject = CacheManager.findProjectInCache(owner, repo);
      if (cachedProject && cachedProject.web_url) {
        console.log('Found full GitLab URL in cache:', cachedProject.web_url);
        setFullRepoUrl(cachedProject.web_url);
        return;
      }

      // 2. 如果缓存没有，再调用 API (作为兜底)
      try {
        console.log('Full URL not in cache, fetching from API...');
        // 获取用户项目列表（通常已缓存）
        const response = await fetch('/api/gitlab/projects', {
          headers: getAuthHeaders()
        });
        if (!response.ok) return;

        const data = await response.json();
        if (!data.success || !data.projects) return;

        // 查找匹配的项目
        // 匹配逻辑：path 等于 repo，且 path_with_namespace 以 owner 开头
        // 注意：owner 可能是 group 名，repo 是 project path
        // 例如：owner="ai_native", repo="DeepVcodeClient"
        // 匹配：path="DeepVcodeClient", path_with_namespace="ai_native/DeepVCode/DeepVcodeClient"
        const project = data.projects.find((p: GitLabProject) => {
          return p.path === repo && p.path_with_namespace.startsWith(owner);
        });

        if (project && project.web_url) {
          console.log('Found full GitLab URL from API:', project.web_url);
          setFullRepoUrl(project.web_url);
        }
      } catch (err) {
        console.error('Failed to fetch GitLab projects for URL resolution:', err);
      }
    };

    fetchFullGitLabUrl();
  }, [projectKey, getAuthHeaders]);

  // 构建 repoInfo 对象用于 Ask 组件
  const buildRepoInfo = (): RepoInfo => {
    // projectKey 格式: "type:owner/repo" (例如: "gitlab:konghaifeng/test_project")
    const parts = projectKey.split(':');
    const typePrefix = parts[0]; // "gitlab", "github", etc.
    const ownerRepo = parts.slice(1).join(':'); // "konghaifeng/test_project"
    const [owner, repo] = ownerRepo.split('/');

    // 根据类型前缀确定 repo 类型
    let type = 'github';
    let repoUrl = '';

    if (typePrefix === 'gitlab') {
      type = 'gitlab';
      // 构建完整的 GitLab URL
      // 优先使用获取到的完整 URL (包含 subgroup)，否则使用构建的 URL (可能缺少 subgroup)
      repoUrl = fullRepoUrl || `https://gitlab.example.net/${owner}/${repo}`;
    } else if (typePrefix === 'bitbucket') {
      type = 'bitbucket';
      repoUrl = `https://bitbucket.org/${owner}/${repo}`;
    } else {
      // GitHub
      repoUrl = `https://github.com/${owner}/${repo}`;
    }

    return {
      owner: owner || '',
      repo: repo || '',
      repoUrl: repoUrl,
      type: type,
      localPath: '',
      token: ''
    };
  };

  const repoInfo = buildRepoInfo();

  // 加载 Wiki 结构
  useEffect(() => {
    const loadStructure = async () => {
      try {
        setLoading(true);
        // projectKey 已经是正确格式，直接使用（由路由解析）
        const response = await fetch(`/api/wiki/projects/${projectKey}/structure`, {
          headers: getAuthHeaders()
        });

        if (response.status === 403 || response.status === 401) {
          setIsForbidden(true);
          throw new Error('Access Denied');
        }

        if (response.status === 400) {
          const errorData = await response.json();
          if (errorData.detail && errorData.detail.includes('Wiki not generated yet')) {
            setIsNotGenerated(true);
            throw new Error('Wiki Not Generated');
          }
        }

        if (!response.ok) {
          const errorData = await response.json();
          // 优先使用 detail (FastAPI 默认)，其次是 error (自定义)，最后是默认消息
          throw new Error(errorData.detail || errorData.error || 'Failed to load wiki structure');
        }

        const data = await response.json();
        setStructure(data);

        // 默认加载第一个页面
        if (data.pages && data.pages.length > 0) {
          setCurrentPageId(data.pages[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load wiki');
        console.error('Failed to load wiki structure:', err);
      } finally {
        setLoading(false);
      }
    };

    loadStructure();
  }, [projectKey, getAuthHeaders]);

  // 加载页面内容
  useEffect(() => {
    if (!currentPageId) return;

    const loadPage = async () => {
      try {
        setPageLoading(true);
        // projectKey 和 pageId 都直接使用，不需要再次编码
        const response = await fetch(
          `/api/wiki/projects/${projectKey}/html/${currentPageId}`, {
            headers: getAuthHeaders()
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to load page');
        }

        const data = await response.json();
        setPageData(data);
      } catch (err) {
        console.error('Failed to load page:', err);
        setPageData(null);
      } finally {
        setPageLoading(false);
      }
    };

    loadPage();
  }, [projectKey, currentPageId, getAuthHeaders]);

  // 🎉 Mermaid 图表已由后端预渲染为 SVG，不再需要前端初始化
  // Wiki 生成时，后端会将 Mermaid 代码转换为 SVG 并嵌入到 HTML 中

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Loading size="lg" text="加载 Wiki..." />
      </div>
    );
  }

  if (isForbidden) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-10 text-center border border-gray-100 dark:border-gray-700">
          <div className="w-24 h-24 bg-gray-50 dark:bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
            <svg className="w-12 h-12 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>

          <h2 className="text-xl font-medium text-gray-900 dark:text-white mb-3">
            暂无访问权限
          </h2>

          <p className="text-gray-500 dark:text-gray-400 leading-relaxed text-sm">
            您当前无法查看此 Wiki 项目。<br/>
            可能是因为您尚未登录，或者您的账号没有该代码仓库的访问权限。
          </p>
        </div>
      </div>
    );
  }

  if (isNotGenerated) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-10 text-center border border-gray-100 dark:border-gray-700">
          <div className="w-24 h-24 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-amber-500 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>

          <h2 className="text-xl font-medium text-gray-900 dark:text-white mb-3">
            Wiki 尚未生成
          </h2>

          <p className="text-gray-500 dark:text-gray-400 leading-relaxed text-sm mb-8">
            该项目的 Wiki 文档暂时还未生成。<br/>
            请联系项目 <strong>Owner</strong> 或 <strong>Maintainer</strong> 生成文档。
          </p>

          <button
            onClick={() => router.push('/')}
            className="w-full px-6 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
          >
            <FaChevronLeft size={14} />
            返回首页
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          <ErrorMessage
            message={error}
            onRetry={() => window.location.reload()}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden">
      {/* 使用统一的顶部导航栏 */}
      <Header
        centerContent={
          <div className="flex items-center gap-3">
            <FaBook className="text-gray-400 dark:text-gray-500 flex-shrink-0" size={18} />
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate max-w-[600px]">
              {structure?.title || 'Wiki'}
            </h1>
          </div>
        }
        onMenuClick={() => setIsMobileNavOpen(true)}
        showMenuButton={true}
      />

      <div className="flex-1 flex gap-0 overflow-hidden">
        {/* 侧边栏导航 */}
        <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto hidden lg:block flex-shrink-0">
          <div className="p-4">
            {/* 返回按钮 */}
            <button
              onClick={() => router.push('/')}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg mb-4 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer text-sm"
            >
              <FaChevronLeft size={16} />
              <span>返回</span>
            </button>

            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3">
              页面列表
            </h2>

            <nav className="space-y-1">
              {structure?.pages.map(page => (
                <button
                  key={page.id}
                  onClick={() => setCurrentPageId(page.id)}
                  className={`
                    w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-sm cursor-pointer
                    ${currentPageId === page.id
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 font-medium'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }
                  `}
                >
                  <span className="truncate">
                    {page.title}
                  </span>
                  {page.importance === 'high' && <span className="ml-2 flex-shrink-0 text-sm">🔥</span>}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* 主内容区 */}
        <main className="flex-1 overflow-y-auto hidden lg:flex lg:flex-col relative">
          <div className="max-w-4xl mx-auto p-8 w-full relative">
            {/* 下载 MD 浮动按钮 - 固定在视口右下角 */}
            {pageData && !pageLoading && (
              <button
                onClick={() => {
                  const element = document.createElement('a');
                  const file = new Blob([pageData.markdown || ''], { type: 'text/markdown' });
                  element.href = URL.createObjectURL(file);
                  element.download = `${pageData.title}.md`;
                  document.body.appendChild(element);
                  element.click();
                  document.body.removeChild(element);
                  URL.revokeObjectURL(element.href);
                }}
                className="fixed bottom-20 right-24 px-3 py-1.5 rounded-lg border border-gray-300/40 dark:border-gray-600/40 text-gray-700 dark:text-gray-300 bg-white/50 dark:bg-gray-900/50 hover:bg-white/80 dark:hover:bg-gray-900/80 hover:cursor-pointer transition-all duration-200 flex items-center justify-center gap-1.5 group z-40 pointer-events-auto backdrop-blur-sm lg:right-[calc(340px+1.5rem)]"
                style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}
                title="下载页面为 Markdown 文件"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span className="text-xs font-medium">下载 .md</span>
                <span className="absolute bottom-full mb-2 right-0 px-2 py-1 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                  下载 Markdown
                </span>
              </button>
            )}

            {pageLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loading text="加载页面..." />
              </div>
            ) : pageData ? (
              <article>
                {/* 页面元信息 */}
                <div className="mb-6 pb-4 border-b border-gray-200 dark:border-gray-700 text-center">
                  <h1 className="text-2xl font-bold text-gray-600 dark:text-gray-300 mb-2">
                    {pageData.title}
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    最后更新: {new Date(pageData.rendered_at).toLocaleString('zh-CN')}
                  </p>
                </div>

                {/* 页面内容 */}
                <div
                  className="
                    prose prose-lg dark:prose-invert max-w-none
                    prose-headings:font-bold
                    prose-h1:text-4xl prose-h1:mb-6 prose-h1:text-blue-700 dark:prose-h1:text-blue-400 prose-h1:border-b-4 prose-h1:border-blue-500 prose-h1:pb-3
                    prose-h2:text-3xl prose-h2:mb-4 prose-h2:mt-10 prose-h2:text-indigo-700 dark:prose-h2:text-indigo-400 prose-h2:border-l-4 prose-h2:border-indigo-500 prose-h2:pl-4
                    prose-h3:text-2xl prose-h3:mb-3 prose-h3:mt-8 prose-h3:text-purple-700 dark:prose-h3:text-purple-400
                    prose-h4:text-xl prose-h4:mb-2 prose-h4:mt-6 prose-h4:text-pink-700 dark:prose-h4:text-pink-400
                    prose-p:text-gray-800 dark:prose-p:text-gray-200 prose-p:leading-relaxed prose-p:my-4
                    prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline prose-a:font-semibold
                    prose-strong:text-gray-900 dark:prose-strong:text-gray-100 prose-strong:font-bold
                    prose-code:bg-gradient-to-r prose-code:from-blue-50 prose-code:to-indigo-50
                    dark:prose-code:from-blue-900 dark:prose-code:to-indigo-900
                    prose-code:text-blue-800 dark:prose-code:text-blue-200
                    prose-code:px-2 prose-code:py-1 prose-code:rounded-md prose-code:font-mono prose-code:text-sm
                    prose-pre:bg-gradient-to-br prose-pre:from-gray-800 prose-pre:via-gray-900 prose-pre:to-black
                    prose-pre:shadow-2xl prose-pre:rounded-xl prose-pre:border prose-pre:border-gray-700
                    prose-pre:p-6 prose-pre:overflow-x-auto
                    prose-blockquote:border-l-4 prose-blockquote:border-blue-500
                    prose-blockquote:bg-blue-50 dark:prose-blockquote:bg-blue-900/20
                    prose-blockquote:italic prose-blockquote:pl-6 prose-blockquote:py-3 prose-blockquote:rounded-r-lg
                    prose-ul:my-6 prose-ul:space-y-2
                    prose-ol:my-6 prose-ol:space-y-2
                    prose-li:text-gray-800 dark:prose-li:text-gray-200
                    prose-li:marker:text-blue-600 dark:prose-li:marker:text-blue-400
                    prose-table:border-collapse prose-table:w-full prose-table:my-8
                    prose-thead:bg-gradient-to-r prose-thead:from-blue-600 prose-thead:to-indigo-600
                    prose-thead:text-white
                    prose-th:px-6 prose-th:py-4 prose-th:text-left prose-th:font-semibold
                    prose-td:px-6 prose-td:py-4 prose-td:border-b prose-td:border-gray-200 dark:prose-td:border-gray-700
                    prose-tr:hover:bg-gray-50 dark:prose-tr:hover:bg-gray-800/50
                    prose-img:rounded-xl prose-img:shadow-2xl prose-img:border-4 prose-img:border-white dark:prose-img:border-gray-800
                    prose-hr:border-2 prose-hr:border-gradient-to-r prose-hr:from-blue-500 prose-hr:via-purple-500 prose-hr:to-pink-500 prose-hr:my-12
                  "
                  style={{
                    // 为代码块添加额外样式
                    ['--tw-prose-pre-code' as string]: 'rgb(229, 231, 235)',
                    ['--tw-prose-invert-pre-code' as string]: 'rgb(209, 213, 219)'
                  }}
                  >
                  <Markdown
                    content={pageData.markdown || ''}
                    repoUrl={repoInfo.repoUrl}
                    repoType={repoInfo.type}
                    defaultBranch="main"
                  />
                </div>
              </article>
            ) : (
              <div className="text-center py-20">
                <p className="text-gray-500 dark:text-gray-400">
                  无法加载页面内容
                </p>
              </div>
            )}
          </div>
        </main>

        {/* 对话面板 - 桌面端 (使用 CSS 隐藏而非条件渲染，保留聊天记录) */}
        <aside className={`hidden lg:flex flex-col relative ${isChatExpanded ? 'w-[50vw]' : 'w-[340px]'} bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 overflow-hidden flex-shrink-0 transition-all duration-300 ease-in-out ${isAskCollapsed ? '!hidden' : ''}`}>
          {/* 折叠按钮 - 左边缘隐藏一半 */}
          <button
            onClick={() => setIsAskCollapsed(true)}
            className="absolute -left-3 top-1/2 -translate-y-1/2 z-10 p-2 rounded-lg bg-white/80 dark:bg-gray-800/80 border border-gray-200/50 dark:border-gray-700/50 hover:bg-gray-100/90 dark:hover:bg-gray-700/90 transition-colors shadow-lg backdrop-blur-sm"
            title="折叠面板"
          >
            <svg className="w-4 h-4 text-gray-600 dark:text-gray-400 hover:text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* 对话面板内容 */}
          <div className="flex-1 overflow-hidden">
            {projectKey && repoInfo && repoInfo.repoUrl ? (
              <Ask
                repoInfo={repoInfo}
                provider=""
                model=""
                isCustomModel={false}
                customModel=""
                language="zh"
                onCollapse={() => setIsAskCollapsed(true)}
                isExpanded={isChatExpanded}
                onToggleExpand={() => setIsChatExpanded(!isChatExpanded)}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                加载中...
              </div>
            )}
          </div>
        </aside>

        {/* 展开按钮 - 桌面端 */}
        {isAskCollapsed && (
          <button
            onClick={() => setIsAskCollapsed(false)}
            className="hidden lg:flex items-center justify-center flex-shrink-0 w-12 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="展开 Ask"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400 hover:text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {/* 移动端布局 */}
        <main className="flex-1 overflow-y-auto lg:hidden">
          <div className="max-w-4xl mx-auto p-8">
            {pageLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loading text="加载页面..." />
              </div>
            ) : pageData ? (
              <article>
                {/* 页面元信息 */}
                <div className="mb-6 pb-4 border-b border-gray-200 dark:border-gray-700 text-center">
                  <h1 className="text-2xl font-bold text-gray-600 dark:text-gray-300 mb-2">
                    {pageData.title}
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    最后更新: {new Date(pageData.rendered_at).toLocaleString('zh-CN')}
                  </p>
                </div>

                {/* 页面内容 */}
                <div
                  className="
                    prose prose-lg dark:prose-invert max-w-none
                    prose-headings:font-bold
                    prose-h1:text-4xl prose-h1:mb-6 prose-h1:text-blue-700 dark:prose-h1:text-blue-400 prose-h1:border-b-4 prose-h1:border-blue-500 prose-h1:pb-3
                    prose-h2:text-3xl prose-h2:mb-4 prose-h2:mt-10 prose-h2:text-indigo-700 dark:prose-h2:text-indigo-400 prose-h2:border-l-4 prose-h2:border-indigo-500 prose-h2:pl-4
                    prose-h3:text-2xl prose-h3:mb-3 prose-h3:mt-8 prose-h3:text-purple-700 dark:prose-h3:text-purple-400
                    prose-h4:text-xl prose-h4:mb-2 prose-h4:mt-6 prose-h4:text-pink-700 dark:prose-h4:text-pink-400
                    prose-p:text-gray-800 dark:prose-p:text-gray-200 prose-p:leading-relaxed prose-p:my-4
                    prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline prose-a:font-semibold
                    prose-strong:text-gray-900 dark:prose-strong:text-gray-100 prose-strong:font-bold
                    prose-code:bg-gradient-to-r prose-code:from-blue-50 prose-code:to-indigo-50
                    dark:prose-code:from-blue-900 dark:prose-code:to-indigo-900
                    prose-code:text-blue-800 dark:prose-code:text-blue-200
                    prose-code:px-2 prose-code:py-1 prose-code:rounded-md prose-code:font-mono prose-code:text-sm
                    prose-pre:bg-gradient-to-br prose-pre:from-gray-800 prose-pre:via-gray-900 prose-pre:to-black
                    prose-pre:shadow-2xl prose-pre:rounded-xl prose-pre:border prose-pre:border-gray-700
                    prose-pre:p-6 prose-pre:overflow-x-auto
                    prose-blockquote:border-l-4 prose-blockquote:border-blue-500
                    prose-blockquote:bg-blue-50 dark:prose-blockquote:bg-blue-900/20
                    prose-blockquote:italic prose-blockquote:pl-6 prose-blockquote:py-3 prose-blockquote:rounded-r-lg
                    prose-ul:my-6 prose-ul:space-y-2
                    prose-ol:my-6 prose-ol:space-y-2
                    prose-li:text-gray-800 dark:prose-li:text-gray-200
                    prose-li:marker:text-blue-600 dark:prose-li:marker:text-blue-400
                    prose-table:border-collapse prose-table:w-full prose-table:my-8
                    prose-thead:bg-gradient-to-r prose-thead:from-blue-600 prose-thead:to-indigo-600
                    prose-thead:text-white
                    prose-th:px-6 prose-th:py-4 prose-th:text-left prose-th:font-semibold
                    prose-td:px-6 prose-td:py-4 prose-td:border-b prose-td:border-gray-200 dark:prose-td:border-gray-700
                    prose-tr:hover:bg-gray-50 dark:prose-tr:hover:bg-gray-800/50
                    prose-img:rounded-xl prose-img:shadow-2xl prose-img:border-4 prose-img:border-white dark:prose-img:border-gray-800
                    prose-hr:border-2 prose-hr:border-gradient-to-r prose-hr:from-blue-500 prose-hr:via-purple-500 prose-hr:to-pink-500 prose-hr:my-12
                  "
                  style={{
                    ['--tw-prose-pre-code' as string]: 'rgb(229, 231, 235)',
                    ['--tw-prose-invert-pre-code' as string]: 'rgb(209, 213, 219)'
                  }}
                >
                  <Markdown
                    content={pageData.markdown || ''}
                    repoUrl={repoInfo.repoUrl}
                    repoType={repoInfo.type}
                    defaultBranch="main"
                  />
                </div>

                {/* 移动端对话按钮 */}
                <div className="mt-8 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setIsAskPanelOpen(true)}
                    className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg font-medium transition-all"
                  >
                    <FaComments size={18} />
                    提出问题
                  </button>
                </div>
              </article>
            ) : (
              <div className="text-center py-20">
                <p className="text-gray-500 dark:text-gray-400">
                  无法加载页面内容
                </p>
              </div>
            )}
          </div>
        </main>

        {/* 移动端对话 Modal (使用 CSS 隐藏而非条件渲染，保留聊天记录) */}
        <div className={`fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 lg:hidden transition-opacity duration-300 ${isAskPanelOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
            {/* Modal 头部 */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <FaComments className="text-blue-600 dark:text-blue-400" size={18} />
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Ask</h3>
              </div>
              <button
                onClick={() => setIsAskPanelOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-xl"
              >
                ✕
              </button>
            </div>

            {/* Modal 内容 */}
            <div className="flex-1 overflow-hidden">
              {projectKey && repoInfo && repoInfo.repoUrl ? (
                <Ask
                  repoInfo={repoInfo}
                  provider=""
                  model=""
                  isCustomModel={false}
                  customModel=""
                  language="zh"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  加载中...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 移动端导航抽屉 */}
        {isMobileNavOpen && (
          <>
            {/* 背景遮罩 */}
            <div
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={() => setIsMobileNavOpen(false)}
            />
            {/* 抽屉 */}
            <div className="fixed left-0 top-0 h-screen w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 z-50 lg:hidden overflow-y-auto transform transition-transform duration-300 flex flex-col">
              <div className="flex-1 p-4 overflow-y-auto">
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3">
                  文件列表
                </h2>

                <nav className="space-y-1">
                  {structure?.pages.map(page => (
                    <button
                      key={page.id}
                      onClick={() => {
                        setCurrentPageId(page.id);
                        setIsMobileNavOpen(false);
                      }}
                      className={`
                        w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-sm cursor-pointer
                        ${currentPageId === page.id
                          ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 font-medium'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }
                      `}
                    >
                      <span className="truncate">
                        {page.title}
                      </span>
                      {page.importance === 'high' && <span className="ml-2 flex-shrink-0 text-sm">🔥</span>}
                    </button>
                  ))}
                </nav>
              </div>

              {/* 返回按钮 - 放在底部 */}
              <div className="border-t border-gray-200 dark:border-gray-700 p-4">
                <button
                  onClick={() => router.push('/')}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer text-sm"
                >
                  <FaChevronLeft size={16} />
                  <span>返回首页</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
