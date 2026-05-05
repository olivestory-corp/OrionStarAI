import type { NextConfig } from "next";

const TARGET_SERVER_BASE_URL = process.env.SERVER_BASE_URL || 'http://localhost:8001';

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone',
  // Optimize build for Docker
  experimental: {
    optimizePackageImports: ['@mermaid-js/mermaid', 'react-syntax-highlighter'],
  },
  // Reduce memory usage during build
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }

    // Fix "self is not defined" error during SSR
    if (isServer) {
      const originalEntry = config.entry;
      config.entry = async () => {
        const entries = await originalEntry();
        // Polyfill self for server-side
        if (entries['main.js'] && !entries['main.js'].includes('./polyfills/self-polyfill.js')) {
          entries['main.js'].unshift('./polyfills/self-polyfill.js');
        }
        return entries;
      };
    }

    // Optimize bundle size - only for client-side to avoid SSR issues
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
            },
          },
        },
      };
    }
    return config;
  },
  async rewrites() {
    return [
      {
        source: '/api/wiki_cache/:path*',
        destination: `${TARGET_SERVER_BASE_URL}/api/wiki_cache/:path*`,
      },
      {
        source: '/export/wiki/:path*',
        destination: `${TARGET_SERVER_BASE_URL}/export/wiki/:path*`,
      },
      {
        source: '/api/wiki_cache',
        destination: `${TARGET_SERVER_BASE_URL}/api/wiki_cache`,
      },
      {
        source: '/local_repo/structure',
        destination: `${TARGET_SERVER_BASE_URL}/local_repo/structure`,
      },
      {
        source: '/api/auth/status',
        destination: `${TARGET_SERVER_BASE_URL}/auth/status`,
      },
      {
        source: '/api/auth/validate',
        destination: `${TARGET_SERVER_BASE_URL}/auth/validate`,
      },
      {
        source: '/api/lang/config',
        destination: `${TARGET_SERVER_BASE_URL}/lang/config`,
      },
      // GitLab OAuth routes
      {
        source: '/api/auth/gitlab/login',
        destination: `${TARGET_SERVER_BASE_URL}/api/auth/gitlab/login`,
      },
      {
        source: '/api/auth/gitlab/callback',
        destination: `${TARGET_SERVER_BASE_URL}/api/auth/gitlab/callback`,
      },
      {
        source: '/api/auth/gitlab/user',
        destination: `${TARGET_SERVER_BASE_URL}/api/auth/gitlab/user`,
      },
      {
        source: '/api/auth/gitlab/logout',
        destination: `${TARGET_SERVER_BASE_URL}/api/auth/gitlab/logout`,
      },
      // Debug route
      {
        source: '/api/debug/routes',
        destination: `${TARGET_SERVER_BASE_URL}/api/debug/routes`,
      },
      // GitLab integration routes
      {
        source: '/api/gitlab/projects',
        destination: `${TARGET_SERVER_BASE_URL}/gitlab/projects`,
      },
      {
        source: '/api/gitlab/projects/grouped',
        destination: `${TARGET_SERVER_BASE_URL}/gitlab/projects/grouped`,
      },
      {
        source: '/api/gitlab/cache',
        destination: `${TARGET_SERVER_BASE_URL}/gitlab/cache`,
      },
      {
        source: '/api/gitlab/health',
        destination: `${TARGET_SERVER_BASE_URL}/gitlab/health`,
      },
      {
        source: '/api/gitlab/file-content',
        destination: `${TARGET_SERVER_BASE_URL}/gitlab/file-content`,
      },
      // Public projects routes
      {
        source: '/api/gitlab/public-projects',
        destination: `${TARGET_SERVER_BASE_URL}/gitlab/public-projects`,
      },
      {
        source: '/api/gitlab/public-projects/sync',
        destination: `${TARGET_SERVER_BASE_URL}/gitlab/public-projects/sync`,
      },
      // GitLab project structure route
      {
        source: '/gitlab/project-structure',
        destination: `${TARGET_SERVER_BASE_URL}/gitlab/project-structure`,
      },
      // Wiki API routes
      {
        source: '/api/wiki/:path*',
        destination: `${TARGET_SERVER_BASE_URL}/api/wiki/:path*`,
      },
      // Task API routes
      {
        source: '/api/tasks/:path*',
        destination: `${TARGET_SERVER_BASE_URL}/api/tasks/:path*`,
      },
    ];
  },
};

export default nextConfig;
