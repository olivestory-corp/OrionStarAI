'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { FaTimes, FaTh, FaList } from 'react-icons/fa';

// Interface should match the structure from the API
interface ProcessedProject {
  id: string;
  owner: string;
  repo: string;
  name: string;
  repo_type: string;
  submittedAt: number;
  language: string;
}

interface ProcessedProjectsProps {
  showHeader?: boolean;
  maxItems?: number;
  className?: string;
  messages?: Record<string, Record<string, string>>; // Translation messages with proper typing
}

export default function ProcessedProjects({
  showHeader = true,
  maxItems,
  className = "",
  messages
}: ProcessedProjectsProps) {
  const [projects, setProjects] = useState<ProcessedProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');

  // Default messages fallback
  const defaultMessages = {
    title: 'Processed Wiki Projects',
    searchPlaceholder: 'Search projects by name, owner, or repository...',
    noProjects: 'No projects found in the server cache. The cache might be empty or the server encountered an issue.',
    noSearchResults: 'No projects match your search criteria.',
    processedOn: 'Processed on:',
    loadingProjects: 'Loading projects...',
    errorLoading: 'Error loading projects:',
    backToHome: 'Back to Home'
  };

  const t = (key: string) => {
    if (messages?.projects?.[key]) {
      return messages.projects[key];
    }
    return defaultMessages[key as keyof typeof defaultMessages] || key;
  };

  useEffect(() => {
    const fetchProjects = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/wiki/projects');
        if (!response.ok) {
          throw new Error(`Failed to fetch projects: ${response.statusText}`);
        }
        const data = await response.json();
        if (data.error) {
          throw new Error(data.error);
        }
        setProjects(data as ProcessedProject[]);
      } catch (e: unknown) {
        console.error("Failed to load projects from API:", e);
        const message = e instanceof Error ? e.message : "An unknown error occurred.";
        setError(message);
        setProjects([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjects();
  }, []);

  // Filter projects based on search query
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) {
      return maxItems ? projects.slice(0, maxItems) : projects;
    }

    const query = searchQuery.toLowerCase();
    const filtered = projects.filter(project =>
      project.name.toLowerCase().includes(query) ||
      project.owner.toLowerCase().includes(query) ||
      project.repo.toLowerCase().includes(query) ||
      project.repo_type.toLowerCase().includes(query)
    );

    return maxItems ? filtered.slice(0, maxItems) : filtered;
  }, [projects, searchQuery, maxItems]);

  // Group projects by owner
  const groupedProjects = useMemo(() => {
    const grouped: Record<string, ProcessedProject[]> = {};
    filteredProjects.forEach(project => {
      if (!grouped[project.owner]) {
        grouped[project.owner] = [];
      }
      grouped[project.owner].push(project);
    });
    return Object.entries(grouped).map(([owner, projects]) => ({ owner, projects }));
  }, [filteredProjects]);

  const clearSearch = () => {
    setSearchQuery('');
  };

  const handleDelete = async (project: ProcessedProject) => {
    if (!confirm(`Are you sure you want to delete project ${project.name}?`)) {
      return;
    }
    try {
      const response = await fetch('/api/wiki/projects', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: project.owner,
          repo: project.repo,
          repo_type: project.repo_type,
          language: project.language,
        }),
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorBody.error || response.statusText);
      }
      setProjects(prev => prev.filter(p => p.id !== project.id));
    } catch (e: unknown) {
      console.error('Failed to delete project:', e);
      alert(`Failed to delete project: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  };

  return (
    <div className={`${className}`}>
      {showHeader && (
        <header className="mb-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-[var(--accent-primary)]">{t('title')}</h1>
            <Link href="/" className="text-[var(--accent-primary)] hover:underline">
              {t('backToHome')}
            </Link>
          </div>
        </header>
      )}

      {/* Search Bar and View Toggle */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 sm:justify-between sm:items-center">
        {/* Search Bar */}
        <div className="relative max-w-sm mx-auto sm:mx-0 group">
          {/* 背景光晕效果 */}
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--accent-primary)]/20 to-[var(--accent-secondary)]/20 rounded-xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 pointer-events-none" />

          <div className="relative bg-[var(--background)] rounded-xl border-2 border-[var(--border-color)] hover:border-[var(--accent-primary)]/50 focus-within:border-[var(--accent-primary)] transition-all duration-200 shadow-sm hover:shadow-md focus-within:shadow-lg focus-within:shadow-[var(--accent-primary)]/20">
            <div className="flex items-center gap-3 px-4 py-3.5">
              <svg className="w-5 h-5 text-[var(--accent-primary)] flex-shrink-0 transition-transform duration-200 group-focus-within:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="flex-1 bg-transparent text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="text-[var(--muted)] hover:text-[var(--accent-primary)] hover:scale-110 transition-all duration-200 flex-shrink-0 p-1 rounded-lg hover:bg-[var(--ios-background-secondary)]"
                  title="清除搜索"
                >
                  <FaTimes className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex items-center bg-[var(--background)] border border-[var(--border-color)] rounded-lg p-1">
          <button
            onClick={() => setViewMode('card')}
            className={`p-2 rounded transition-colors ${
              viewMode === 'card'
                ? 'bg-[var(--accent-primary)] text-white'
                : 'text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card-bg)]'
            }`}
            title="Card View"
          >
            <FaTh className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded transition-colors ${
              viewMode === 'list'
                ? 'bg-[var(--accent-primary)] text-white'
                : 'text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card-bg)]'
            }`}
            title="List View"
          >
            <FaList className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="mb-4">
            <div className="relative w-12 h-12">
              {/* 外层旋转环 */}
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[var(--accent-primary)] border-r-[var(--accent-primary)] animate-spin" />
              {/* 内层反向旋转环 */}
              <div className="absolute inset-2 rounded-full border-2 border-transparent border-b-[var(--accent-secondary)]/60 animate-spin" style={{ animationDirection: 'reverse' }} />
              {/* 中心点 */}
              <div className="absolute inset-4 rounded-full bg-gradient-to-br from-[var(--accent-primary)]/20 to-[var(--accent-secondary)]/20" />
            </div>
          </div>
          <p className="text-[var(--muted)] text-sm mt-2 font-medium">{t('loadingProjects')}</p>
        </div>
      )}
      {error && <p className="text-[var(--highlight)]">{t('errorLoading')} {error}</p>}

      {!isLoading && !error && filteredProjects.length > 0 && (
        <div className="space-y-8">
          {groupedProjects.map(({ owner, projects }) => (
            <div key={owner} className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-[var(--border-color)]">
                <h2 className="text-xl font-bold text-[var(--foreground)]">
                  {owner}
                </h2>
                <span className="text-sm text-[var(--muted)] bg-[var(--card-bg)] px-2 py-0.5 rounded-full border border-[var(--border-color)]">
                  {projects.length}
                </span>
              </div>

              <div className={viewMode === 'card' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-2'}>
                {projects.map((project) => (
                  viewMode === 'card' ? (
                    <div key={project.id} className="relative p-4 border border-[var(--border-color)] rounded-lg bg-[var(--card-bg)] shadow-sm hover:shadow-md transition-all duration-200 hover:scale-[1.02]">
                      <button
                        type="button"
                        onClick={() => handleDelete(project)}
                        className="absolute top-2 right-2 text-[var(--muted)] hover:text-[var(--foreground)]"
                        title="Delete project"
                      >
                        <FaTimes className="h-4 w-4" />
                      </button>
                      <Link
                        href={`/${encodeURIComponent(project.owner)}/${project.repo}?type=${project.repo_type}&language=${project.language}`}
                        className="block"
                      >
                        <h3 className="text-lg font-semibold text-[var(--link-color)] hover:underline mb-2 line-clamp-2">
                          {project.name}
                        </h3>
                        <div className="flex flex-wrap gap-2 mb-3">
                          <span className="px-2 py-1 text-xs bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] rounded-full border border-[var(--accent-primary)]/20">
                            {project.repo_type}
                          </span>
                          <span className="px-2 py-1 text-xs bg-[var(--background)] text-[var(--muted)] rounded-full border border-[var(--border-color)]">
                            {project.language}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--muted)]">
                          {t('processedOn')} {new Date(project.submittedAt).toLocaleDateString()}
                        </p>
                      </Link>
                    </div>
                  ) : (
                    <div key={project.id} className="relative p-3 border border-[var(--border-color)] rounded-lg bg-[var(--card-bg)] hover:bg-[var(--background)] transition-colors">
                      <button
                        type="button"
                        onClick={() => handleDelete(project)}
                        className="absolute top-2 right-2 text-[var(--muted)] hover:text-[var(--foreground)]"
                        title="Delete project"
                      >
                        <FaTimes className="h-4 w-4" />
                      </button>
                      <Link
                        href={`/${encodeURIComponent(project.owner)}/${project.repo}?type=${project.repo_type}&language=${project.language}`}
                        className="flex items-center justify-between"
                      >
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-medium text-[var(--link-color)] hover:underline truncate">
                            {project.name}
                          </h3>
                          <p className="text-xs text-[var(--muted)] mt-1">
                            {t('processedOn')} {new Date(project.submittedAt).toLocaleDateString()} • {project.repo_type} • {project.language}
                          </p>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <span className="px-2 py-1 text-xs bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] rounded border border-[var(--accent-primary)]/20">
                            {project.repo_type}
                          </span>
                        </div>
                      </Link>
                    </div>
                  )
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && !error && projects.length > 0 && filteredProjects.length === 0 && searchQuery && (
        <p className="text-[var(--muted)]">{t('noSearchResults')}</p>
      )}

      {!isLoading && !error && projects.length === 0 && (
        <p className="text-[var(--muted)]">{t('noProjects')}</p>
      )}
    </div>
  );
}
