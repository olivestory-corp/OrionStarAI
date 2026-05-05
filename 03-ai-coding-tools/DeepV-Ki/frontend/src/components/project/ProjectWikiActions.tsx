/**
 * ProjectWikiActions 组件
 * Wiki 操作按钮（生成、查看、刷新）
 */

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { FaBook, FaEye, FaSync } from 'react-icons/fa';
import Button from '@/components/common/Button';
import AlertModal from '@/components/common/AlertModal';
import { useWiki } from '@/contexts/WikiContext';
import WikiTypeSelectionModal from '@/components/WikiTypeSelectionModal';
import type { GitLabProject, WikiProjectStatus } from '@/types/gitlab';

interface ProjectWikiActionsProps {
  project: GitLabProject;
  wikiStatus: WikiProjectStatus | null;
}

export default function ProjectWikiActions({
  project,
  wikiStatus
}: ProjectWikiActionsProps) {
  const router = useRouter();
  const { generateWiki } = useWiki();
  const [generating, setGenerating] = React.useState(false);
  const [showTypeModal, setShowTypeModal] = React.useState(false);
  const [viewing, setViewing] = React.useState(false);
  const [alertModal, setAlertModal] = React.useState<{
    isOpen: boolean;
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
  }>({
    isOpen: false,
    type: 'info',
    title: '',
    message: '',
  });
  const [confirmModal, setConfirmModal] = React.useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm?: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
  });

  const statusType = wikiStatus?.status || 'not_generated';

  // 解析项目信息
  // 适配后端逻辑：只取根组名作为 owner，最后一部分作为 repo
  const parts = project.path_with_namespace.split('/');
  const namespace = parts.length > 0 ? parts[0] : '';
  const repoName = parts.length > 0 ? parts[parts.length - 1] : '';

  // 构建 project key (格式: gitlab:namespace/repoName)
  // 注意：这里必须使用适配后的 namespace 和 repoName，不能直接用 path_with_namespace
  const projectKey = `gitlab:${namespace}/${repoName}`;

  // 权限检查（MAINTAINER 及以上）
  const canGenerate = project.access_level >= 40;

  /**
   * 打开类型选择 Modal
   */
  const handleOpenTypeModal = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!canGenerate) {
      setAlertModal({
        isOpen: true,
        type: 'warning',
        title: '权限不足',
        message: '需要 Maintainer 或更高权限才能生成 Wiki',
      });
      return;
    }

    setShowTypeModal(true);
  };

  /**
   * 生成 Wiki（从 Modal 选择后调用）
   */
  const handleGenerateWithType = async (isComprehensive: boolean, forceRefresh: boolean) => {
    setGenerating(true);

    try {
      await generateWiki({
        repo_url: project.web_url,
        repo_type: 'gitlab',
        owner: namespace,
        repo_name: repoName,
        // 不指定 provider 和 model，让后端使用默认配置
        language: 'zh',
        is_comprehensive: isComprehensive,  // 传递类型参数
        force_refresh: forceRefresh,  // 用户选择是否强制刷新代码
      });

      setAlertModal({
        isOpen: true,
        type: 'success',
        title: '任务已提交',
        message: 'Wiki 生成任务已提交！请查看卡片进度条。',
      });
    } catch (err) {
      console.error('生成失败:', err);
      setAlertModal({
        isOpen: true,
        type: 'error',
        title: '生成失败',
        message: `生成失败: ${err instanceof Error ? err.message : '未知错误'}`,
      });
    } finally {
      setGenerating(false);
    }
  };

  /**
   * 查看 Wiki
   */
  const handleView = async (e: React.MouseEvent) => {
    e.stopPropagation();

    setViewing(true);
    try {
      // 跳转到新的轻量级 Wiki 页面
      // 不需要 encodeURIComponent，Next.js catch-all 路由会自动处理
      await router.push(`/wiki/${projectKey}`);
    } finally {
      setViewing(false);
    }
  };

  /**
   * 刷新 Wiki
   */
  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();

    setConfirmModal({
      isOpen: true,
      title: '确认刷新',
      message: `确认刷新 "${project.name}" 的 Wiki？\n\n这将重新生成 Wiki，现有内容将被覆盖。`,
      onConfirm: () => {
        setShowTypeModal(true);
      },
    });
  };

  // 根据状态显示不同按钮
  const renderButtons = () => {
    if (statusType === 'not_generated' && canGenerate) {
      return (
        <>
          <Button
            variant="ghost"
            size="sm"
            icon={<FaBook size={14} />}
            onClick={handleOpenTypeModal}
            loading={generating}
          >
            生成Wiki
          </Button>

          {/* 类型选择 Modal */}
          <WikiTypeSelectionModal
            isOpen={showTypeModal}
            onClose={() => setShowTypeModal(false)}
            onSelect={handleGenerateWithType}
            projectName={project.name}
            isRefresh={false}
          />
        </>
      );
    }

    if (statusType === 'generating') {
      const isQueued = wikiStatus?.message?.includes('Task created and queued');
      return (
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <FaSync className="animate-spin" size={14} />
          <span>{isQueued ? '排队中' : '分析中...'}</span>
        </div>
      );
    }

    // 已生成状态：所有用户都可以查看，有权限的可以重新生成
    if (statusType === 'generated') {
      return (
        <>
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              icon={<FaEye size={14} />}
              onClick={handleView}
              loading={viewing}
            >
              查看Wiki
            </Button>

            {canGenerate && (
              <Button
                variant="ghost"
                size="sm"
                icon={<FaSync size={14} />}
                onClick={handleRefresh}
                loading={generating}
              >
                重新生成
              </Button>
            )}
          </div>

          {/* 类型选择 Modal */}
          {canGenerate && (
            <WikiTypeSelectionModal
              isOpen={showTypeModal}
              onClose={() => setShowTypeModal(false)}
              onSelect={handleGenerateWithType}
              projectName={project.name}
              isRefresh={true}
            />
          )}
        </>
      );
    }

    // 生成失败：有权限的用户可以重新生成
    if (statusType === 'failed' && canGenerate) {
      return (
        <>
          <Button
            variant="ghost"
            size="sm"
            icon={<FaSync size={14} />}
            onClick={handleOpenTypeModal}
            loading={generating}
          >
            重新生成
          </Button>

          {/* 类型选择 Modal */}
          <WikiTypeSelectionModal
            isOpen={showTypeModal}
            onClose={() => setShowTypeModal(false)}
            onSelect={handleGenerateWithType}
            projectName={project.name}
            isRefresh={false}
          />
        </>
      );
    }

    return null;
  };

  return (
    <>
      {renderButtons()}

      {/* 提示 Modal */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
      />

      {/* 确认 Modal */}
      <AlertModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        type="warning"
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText="确认"
        onConfirm={confirmModal.onConfirm}
        showCancel={true}
        cancelText="取消"
      />
    </>
  );
}
