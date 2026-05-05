import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Vertex AI Configuration
 * Vertex AI 配置
 */
export interface VertexConfig {
  enabled: boolean;
  defaultLocation: string;
  credentials: {
    projectId: string;
    credentialsPath: string;
    credentialsData?: Record<string, any>;
  }[];
}

/**
 * OpenRouter Configuration
 * OpenRouter 配置
 */
export interface OpenRouterConfig {
  enabled: boolean;
  apiKey: string;
  baseUrl: string;
  defaultModel: string;
}

/**
 * Server Configuration
 * 服务器配置
 */
export interface ServerConfig {
  port: number;
  host: string;
  env: 'development' | 'production' | 'test';
  corsOrigin: string | string[];
  requestTimeout: number;
  maxRequestSize: string;
}

/**
 * Application Configuration
 * 应用程序配置
 */
export interface AppConfig {
  server: ServerConfig;
  vertex: VertexConfig;
  openRouter: OpenRouterConfig;
  debug: boolean;
}

/**
 * Load and validate configuration
 * 加载并验证配置
 */
class ConfigManager {
  private config: AppConfig;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): AppConfig {
    const env = process.env.NODE_ENV || 'development';

    // Load Vertex credentials from file
    const vertexConfig = this.loadVertexConfig();

    // Load OpenRouter config from environment variables
    const openRouterConfig = this.loadOpenRouterConfig();

    // Server configuration
    const serverConfig: ServerConfig = {
      port: parseInt(process.env.PORT || '3001', 10),
      host: process.env.HOST || '0.0.0.0',
      env: (env as 'development' | 'production' | 'test'),
      corsOrigin: this.parseCorsOrigin(process.env.CORS_ORIGIN || '*'),
      requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '30000', 10),
      maxRequestSize: process.env.MAX_REQUEST_SIZE || '50mb'
    };

    return {
      server: serverConfig,
      vertex: vertexConfig,
      openRouter: openRouterConfig,
      debug: process.env.DEBUG === 'true'
    };
  }

  /**
   * Load Vertex AI configuration from credentials files
   * 从凭证文件加载 Vertex AI 配置
   */
  private loadVertexConfig(): VertexConfig {
    // Check if Vertex is explicitly enabled via environment variable
    const vertexExplicitlyEnabled = process.env.VERTEX_ENABLED === 'true';

    const credentials: VertexConfig['credentials'] = [];

    // Only load credentials if Vertex is explicitly enabled
    if (vertexExplicitlyEnabled) {
      const credentialsPaths = this.parseCredentialsPaths();
      console.log('[CONFIG] Loading Vertex credentials from:', credentialsPaths);

      for (const credPath of credentialsPaths) {
        try {
          const absolutePath = this.resolveCredentialsPath(credPath);
          console.log(`[CONFIG] Resolving credentials path: "${credPath}" -> "${absolutePath}"`);

          if (fs.existsSync(absolutePath)) {
            console.log(`[CONFIG] Credentials file found at: ${absolutePath}`);
            const credentialsData = JSON.parse(fs.readFileSync(absolutePath, 'utf-8'));
            const projectId = credentialsData.project_id;

            if (!projectId) {
              console.log('[CONFIG] Warning: No project_id found in credentials file');
              continue;
            }

            console.log(`[CONFIG] Successfully loaded credentials for project: ${projectId}`);
            credentials.push({
              projectId,
              credentialsPath: absolutePath,
              credentialsData
            });
          } else {
            console.log(`[CONFIG] Credentials file NOT found at: ${absolutePath}`);
          }
        } catch (error) {
          console.log(`[CONFIG] Error loading credentials from "${credPath}":`, error instanceof Error ? error.message : String(error));
        }
      }
    } else {
      console.log('[CONFIG] Vertex AI not explicitly enabled (set VERTEX_ENABLED=true)');
    }

    return {
      enabled: vertexExplicitlyEnabled && credentials.length > 0,
      defaultLocation: process.env.VERTEX_DEFAULT_LOCATION || 'global',
      credentials
    };
  }

  /**
   * Load OpenRouter configuration from environment variables
   * 从环境变量加载 OpenRouter 配置
   */
  private loadOpenRouterConfig(): OpenRouterConfig {
    // Check if OpenRouter is explicitly enabled via environment variable
    const openRouterExplicitlyEnabled = process.env.OPENROUTER_ENABLED === 'true';

    const apiKey = process.env.OPENROUTER_API_KEY || '';
    const enabled = openRouterExplicitlyEnabled && apiKey.length > 0;

    return {
      enabled,
      apiKey,
      baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      defaultModel: process.env.OPENROUTER_DEFAULT_MODEL || 'openai/gpt-4'
    };
  }

  /**
   * Parse credentials paths from environment variable
   * Format: VERTEX_CREDENTIALS_PATHS="path1,path2,path3"
   */
  private parseCredentialsPaths(): string[] {
    const pathsEnv = process.env.VERTEX_CREDENTIALS_PATHS || '';
    if (!pathsEnv) {
      // Try default locations
      return [
        './key/cd-1.json',
      ];
    }
    return pathsEnv.split(',').map(p => p.trim());
  }

  /**
   * Resolve credentials file path (relative to project root or absolute)
   */
  private resolveCredentialsPath(credPath: string): string {
    if (path.isAbsolute(credPath)) {
      return credPath;
    }
    // Relative to project root (dvcode-prox directory)
    const projectRoot = path.resolve(__dirname, '..');
    return path.join(projectRoot, credPath);
  }

  /**
   * Parse CORS origin configuration
   */
  private parseCorsOrigin(origin: string): string | string[] {
    if (origin === '*') {
      return '*';
    }
    if (origin.includes(',')) {
      return origin.split(',').map(o => o.trim());
    }
    return origin;
  }

  /**
   * Get the full configuration
   */
  getConfig(): Readonly<AppConfig> {
    return Object.freeze(this.config);
  }

  /**
   * Get Vertex configuration
   */
  getVertexConfig(): Readonly<VertexConfig> {
    return Object.freeze(this.config.vertex);
  }

  /**
   * Get OpenRouter configuration
   */
  getOpenRouterConfig(): Readonly<OpenRouterConfig> {
    return Object.freeze(this.config.openRouter);
  }

  /**
   * Get server configuration
   */
  getServerConfig(): Readonly<ServerConfig> {
    return Object.freeze(this.config.server);
  }

  /**
   * Print enterprise solution banner
   */
  private async printEnterpriseBanner(): Promise<void> {
    const i18n = (await import('./i18n.js')).getMessages();
    console.error('\n' + i18n.separator);
    console.error(i18n.enterpriseTitle);
    console.error(i18n.separator);
    console.error(i18n.enterpriseDescription);
    console.error(i18n.enterpriseFeatures);
    console.error('');
    console.error(i18n.enterpriseContact);
    console.error(i18n.enterpriseLearnMore);
    console.error(i18n.separator + '\n');
  }

  /**
   * Validate configuration
   */
  async validate(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Check if at least one provider is configured (regardless of explicit enabled flag)
    const hasVertexCredentials = this.config.vertex.credentials.length > 0;
    const hasOpenRouterKey = this.config.openRouter.apiKey.length > 0;

    if (!hasVertexCredentials && !hasOpenRouterKey) {
      errors.push('At least one provider (Vertex AI or OpenRouter) must be configured');
      errors.push('  - Vertex AI: Set VERTEX_CREDENTIALS_PATHS environment variable');
      errors.push('  - OpenRouter: Set OPENROUTER_API_KEY environment variable');
    }

    if (this.config.vertex.enabled && this.config.vertex.credentials.length === 0) {
      errors.push('Vertex AI is enabled but no valid credentials found. Please set VERTEX_CREDENTIALS_PATHS');
    }

    if (this.config.openRouter.enabled && !this.config.openRouter.apiKey) {
      errors.push('OpenRouter is enabled but no API key provided. Please set OPENROUTER_API_KEY');
    }

    if (errors.length > 0) {
      await this.printEnterpriseBanner();
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Print configuration summary (safe for logging - omits sensitive keys)
   */
  printSummary(): void {
    // Configuration summary logging removed
  }
}

// Export singleton instance
export const configManager = new ConfigManager();
