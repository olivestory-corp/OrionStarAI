/**
 * Utility to generate file URLs for different repository providers
 */

interface GenerateFileUrlParams {
  repoUrl: string | null;
  repoType: string;
  defaultBranch: string;
  filePath: string;
}

/**
 * Parses a file path string that might contain line numbers (e.g., "src/main.ts:10-20")
 * Returns the clean file path and the line number fragment
 */
const parseFilePathAndLines = (path: string, repoType: string): { cleanPath: string; lineFragment: string } => {
  // Match patterns like: file.ts:10, file.ts:10-20
  const match = path.match(/^(.*?):(\d+)(?:-(\d+))?$/);

  if (!match) {
    return { cleanPath: path, lineFragment: '' };
  }

  const [, filePath, startLine, endLine] = match;
  let fragment = '';

  // Generate line number fragment based on repo type
  if (repoType === 'github' || repoType === 'gitlab') {
    // GitHub/GitLab: #L10 or #L10-L20
    fragment = `#L${startLine}`;
    if (endLine) {
      fragment += `-L${endLine}`;
    }
  } else if (repoType === 'bitbucket') {
    // Bitbucket: #lines-10 or #lines-10:20
    fragment = `#lines-${startLine}`;
    if (endLine) {
      fragment += `:${endLine}`;
    }
  }

  return { cleanPath: filePath, lineFragment: fragment };
};

export const generateFileUrl = ({
  repoUrl,
  repoType,
  defaultBranch,
  filePath,
}: GenerateFileUrlParams): string => {
  if (repoType === 'local' || !repoUrl) {
    return filePath;
  }

  // Parse file path and line numbers
  const { cleanPath, lineFragment } = parseFilePathAndLines(filePath, repoType);

  // Normalize path separators
  const normalizedPath = cleanPath.replace(/\\/g, '/');

  try {
    const url = new URL(repoUrl);
    const hostname = url.hostname;

    let baseUrl = '';

    if (hostname === 'github.com' || hostname.includes('github')) {
      // GitHub URL format: https://github.com/owner/repo/blob/branch/path
      baseUrl = `${repoUrl}/blob/${defaultBranch}/${normalizedPath}`;
    } else if (hostname === 'gitlab.com' || hostname.includes('gitlab')) {
      // GitLab URL format: https://gitlab.com/owner/repo/-/blob/branch/path
      baseUrl = `${repoUrl}/-/blob/${defaultBranch}/${normalizedPath}`;
    } else if (hostname === 'bitbucket.org' || hostname.includes('bitbucket')) {
      // Bitbucket URL format: https://bitbucket.org/owner/repo/src/branch/path
      baseUrl = `${repoUrl}/src/${defaultBranch}/${normalizedPath}`;
    } else {
      // Default fallback
      baseUrl = `${repoUrl}/blob/${defaultBranch}/${normalizedPath}`;
    }

    return baseUrl + lineFragment;
  } catch (error) {
    console.warn('Error generating file URL:', error);
  }

  return filePath;
};