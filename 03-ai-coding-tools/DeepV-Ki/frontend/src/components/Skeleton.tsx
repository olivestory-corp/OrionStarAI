'use client';

/**
 * Skeleton loading components for better perceived performance
 * Shows placeholder content while data is being loaded
 */

/**
 * Basic skeleton element with pulse animation
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`} />
  );
}

/**
 * Text skeleton - simulates a line of text
 */
export function TextSkeleton({
  width = 'w-full',
  height = 'h-4',
  className = ''
}: {
  width?: string;
  height?: string;
  className?: string;
}) {
  return <Skeleton className={`${width} ${height} ${className}`} />;
}

/**
 * Paragraph skeleton - simulates multiple lines of text
 */
export function ParagraphSkeleton({
  lines = 3,
  className = ''
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, index) => (
        <TextSkeleton
          key={index}
          width={index === lines - 1 ? 'w-4/5' : 'w-full'}
          height="h-3"
        />
      ))}
    </div>
  );
}

/**
 * Avatar skeleton - circular skeleton for profile images
 */
export function AvatarSkeleton({
  size = 'w-10 h-10',
  className = ''
}: {
  size?: string;
  className?: string;
}) {
  return (
    <Skeleton className={`rounded-full ${size} ${className}`} />
  );
}

/**
 * Card skeleton - simulates a content card
 */
export function CardSkeleton({
  className = ''
}: {
  className?: string;
}) {
  return (
    <div className={`space-y-4 p-4 bg-white dark:bg-gray-800 rounded-lg ${className}`}>
      <TextSkeleton height="h-6" width="w-3/4" />
      <ParagraphSkeleton lines={3} />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>
    </div>
  );
}

/**
 * Table skeleton - simulates a table loading state
 */
export function TableSkeleton({
  rows = 5,
  columns = 4,
  className = ''
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      {/* Header */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={`header-${index}`} className="h-4 w-full" />
        ))}
      </div>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={`row-${rowIndex}`}
          className="grid gap-4"
          style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={`cell-${rowIndex}-${colIndex}`} className="h-4 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Chat message skeleton - simulates a chat message loading
 */
export function ChatMessageSkeleton({
  align = 'left',
  className = ''
}: {
  align?: 'left' | 'right';
  className?: string;
}) {
  const containerClass = align === 'right' ? 'justify-end' : 'justify-start';
  const bubbleClass = align === 'right'
    ? 'bg-blue-100 dark:bg-blue-900'
    : 'bg-gray-100 dark:bg-gray-700';

  return (
    <div className={`flex ${containerClass} mb-4 ${className}`}>
      <div className={`${bubbleClass} rounded-lg p-4 max-w-xs`}>
        <ParagraphSkeleton lines={2} />
      </div>
    </div>
  );
}

/**
 * List skeleton - simulates a list of items
 */
export function ListSkeleton({
  items = 5,
  className = ''
}: {
  items?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: items }).map((_, index) => (
        <div key={index} className="flex items-center space-x-4">
          <AvatarSkeleton />
          <div className="flex-1">
            <TextSkeleton height="h-4" width="w-1/2" className="mb-2" />
            <TextSkeleton height="h-3" width="w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Wiki page skeleton - simulates the wiki page loading state
 */
export function WikiPageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <TextSkeleton height="h-8" width="w-3/4" />
        <TextSkeleton height="h-4" width="w-1/2" />
      </div>

      {/* Navigation */}
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-20" />
        ))}
      </div>

      {/* Content Sections */}
      {Array.from({ length: 3 }).map((_, sectionIndex) => (
        <div key={sectionIndex} className="space-y-3">
          <TextSkeleton height="h-6" width="w-1/3" />
          <ParagraphSkeleton lines={4} />
        </div>
      ))}
    </div>
  );
}

/**
 * Response skeleton - simulates an API response loading
 */
export function ResponseSkeleton({
  className = ''
}: {
  className?: string;
}) {
  return (
    <div className={`space-y-4 p-4 ${className}`}>
      <TextSkeleton height="h-4" width="w-full" />
      <TextSkeleton height="h-4" width="w-5/6" />
      <TextSkeleton height="h-4" width="w-4/6" />
      <div className="pt-4">
        <Skeleton className="h-20 w-full" />
      </div>
    </div>
  );
}

/**
 * Form skeleton - simulates a form with inputs
 */
export function FormSkeleton({
  fields = 3,
  className = ''
}: {
  fields?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: fields }).map((_, index) => (
        <div key={index} className="space-y-2">
          <TextSkeleton height="h-4" width="w-1/4" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <Skeleton className="h-10 w-full mt-6" />
    </div>
  );
}

/**
 * Grid skeleton - simulates a grid of items
 */
export function GridSkeleton({
  items = 6,
  className = ''
}: {
  items?: number;
  className?: string;
}) {
  return (
    <div
      className={`grid gap-4 ${className}`}
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(200px, 1fr))` }}
    >
      {Array.from({ length: items }).map((_, index) => (
        <div key={index} className="space-y-3">
          <Skeleton className="h-40 w-full rounded-lg" />
          <TextSkeleton height="h-4" width="w-3/4" />
          <TextSkeleton height="h-3" width="w-1/2" />
        </div>
      ))}
    </div>
  );
}

const skeletonExports = {
  Skeleton,
  TextSkeleton,
  ParagraphSkeleton,
  AvatarSkeleton,
  CardSkeleton,
  TableSkeleton,
  ChatMessageSkeleton,
  ListSkeleton,
  WikiPageSkeleton,
  ResponseSkeleton,
  FormSkeleton,
  GridSkeleton
};

export default skeletonExports;
