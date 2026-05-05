/**
 * SafeHtml Component
 * Renders HTML content with XSS protection
 * Sanitizes dangerous elements and attributes
 */

import React, { useMemo } from 'react';
import { sanitizeMarkdownContent } from '@/lib/markdown-sanitizer';

interface SafeHtmlProps {
  html: string;
  className?: string;
}

export const SafeHtml: React.FC<SafeHtmlProps> = ({ html, className = '' }) => {
  // Sanitize HTML content once on mount/update
  const sanitizedHtml = useMemo(() => {
    return sanitizeMarkdownContent(html);
  }, [html]);

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      // Content is sanitized, but include data attributes for tracking
      data-content-type="sanitized-html"
    />
  );
};

export default SafeHtml;
