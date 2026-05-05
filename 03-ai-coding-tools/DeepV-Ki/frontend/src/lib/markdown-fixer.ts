/**
 * Markdown Content Fixer
 * Improves robustness of markdown parsing by fixing common formatting issues
 * that may be handled differently by VS Code vs react-markdown
 */

/**
 * 修复 Markdown 内容的格式问题
 *
 * 主要处理：
 * 1. 代码块边界不清晰的问题（``` 后面直接跟其他元素）
 * 2. HTML 标签的清理
 * 3. 空行规范化
 */
export const fixMarkdownContent = (content: string): string => {
  if (!content) return '';

  let fixed = content;

  // 1. 移除 HTML 注释
  fixed = fixed.replace(/<!--[\s\S]*?-->/g, '');

  // 2. 移除可能的 HTML 标签（保留 Markdown 格式）
  fixed = fixed.replace(/<details>[\s\S]*?<\/details>/g, '');
  fixed = fixed.replace(/<summary>[\s\S]*?<\/summary>/g, '');

  // 3. 修复代码块边界：确保 ``` 后面至少有一个空行
  // 处理：``` 后面直接跟非空行的情况
  fixed = fixed.replace(/```\n(?![\n\s])/g, '```\n\n');

  // 4. 修复代码块后紧跟其他元素的问题
  // 例如：```\nSources: ... 或 ```\n### 标题
  fixed = fixed.replace(/```\n([^\n])/g, '```\n\n$1');

  // 5. 修复代码块开始处的问题
  fixed = fixed.replace(/\n```([^\n])/g, '\n\n```$1');

  // 6. 修复多个连续空行（3个及以上变为2个）
  fixed = fixed.replace(/\n\n\n+/g, '\n\n');

  return fixed;
};

/**
 * 检查 Markdown 内容是否需要修复
 */
export const needsMarkdownFix = (content: string): boolean => {
  // 检查是否有代码块直接跟其他元素的问题
  const hasCodeBlockIssues = /```\n[^\n]/.test(content);
  const hasHTMLTags = /<details|<summary|<!--/.test(content);

  return hasCodeBlockIssues || hasHTMLTags;
};
