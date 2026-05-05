/**
 * Progress parser utility for wiki generation tasks
 *
 * Parses messages like "Generating page 3/13: 架构概览" to extract
 * real progress (current/total pages) and calculates accurate percentage
 */

export interface ParsedProgress {
  currentPage?: number;
  totalPages?: number;
  pagePercentage?: number; // calculated from pages (0-100)
  message: string;
}

/**
 * Parse progress message from backend
 *
 * Extracts page generation progress from messages like:
 * - "Generating page 3/13: 架构概览"
 * - "Generating page 1/11: Introduction"
 *
 * @param message The message from backend task status
 * @returns Parsed progress information
 */
export function parseProgressMessage(message: string): ParsedProgress {
  const result: ParsedProgress = {
    message,
  };

  // Match pattern: "Generating page X/Y" or similar
  const pageMatch = message.match(/Generating page\s+(\d+)\s*\/\s*(\d+)/i);

  if (pageMatch) {
    const currentPage = parseInt(pageMatch[1], 10);
    const totalPages = parseInt(pageMatch[2], 10);

    if (!isNaN(currentPage) && !isNaN(totalPages) && totalPages > 0) {
      result.currentPage = currentPage;
      result.totalPages = totalPages;
      // Calculate percentage based on pages generated
      result.pagePercentage = Math.round((currentPage / totalPages) * 100);
    }
  }

  return result;
}

/**
 * Calculate smart progress for progress bar
 *
 * Combines multiple progress signals:
 * - If we have page progress from message, use that as base
 * - Otherwise use the progress field from API
 * - Ensures monotonic increase (progress never decreases)
 *
 * @param apiProgress Progress value from API (0-100)
 * @param message Message from backend
 * @param lastProgress Previously calculated progress (to ensure monotonic)
 * @returns Final progress percentage (0-100)
 */
export function calculateSmartProgress(
  apiProgress: number,
  message: string,
  lastProgress?: number
): number {
  const parsed = parseProgressMessage(message);

  // If we have page-based progress, use it as the source of truth
  if (parsed.pagePercentage !== undefined) {
    let finalProgress = parsed.pagePercentage;

    // Ensure progress doesn't decrease (monotonic)
    if (lastProgress !== undefined && finalProgress < lastProgress) {
      finalProgress = lastProgress;
    }

    return finalProgress;
  }

  // Fall back to API progress
  let finalProgress = apiProgress;

  // Ensure progress doesn't decrease
  if (lastProgress !== undefined && finalProgress < lastProgress) {
    finalProgress = lastProgress;
  }

  return finalProgress;
}
