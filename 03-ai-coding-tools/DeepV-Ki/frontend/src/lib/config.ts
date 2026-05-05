/**
 * 统一的环境变量和配置管理
 * 集中管理所有环境变量，避免分散在各个文件中
 */

// 环境变量类型定义
interface EnvironmentConfig {
  // 服务器配置
  nodeEnv: string;
  port: number;

  // 后端服务配置
  pythonBackendHost: string;

  // 前端公共配置
  nextPublicApiUrl: string;

  // 开发模式标识
  isDevelopment: boolean;
  isProduction: boolean;

  // API配置
  apiTimeout: number;
  maxRetries: number;
}

/**
 * 获取环境变量的安全方法
 * @param key 环境变量名
 * @param defaultValue 默认值
 * @returns 环境变量值或默认值
 */
function getEnvVar(key: string, defaultValue: string = ""): string {
  // 在浏览器端，只能访问 NEXT_PUBLIC_ 开头的环境变量
  if (typeof window !== "undefined") {
    // 浏览器端：只能访问 NEXT_PUBLIC_ 变量
    if (key.startsWith("NEXT_PUBLIC_")) {
      return process.env[key] || defaultValue;
    }
    return defaultValue;
  }

  // 服务器端：可以访问所有环境变量
  if (typeof process !== "undefined" && process.env) {
    return process.env[key] || defaultValue;
  }
  return defaultValue;
}

/**
 * 获取数字类型的环境变量
 * @param key 环境变量名
 * @param defaultValue 默认值
 * @returns 数字值
 */
function getEnvNumber(key: string, defaultValue: number): number {
  const value = getEnvVar(key);
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * 获取布尔类型的环境变量
 * @param key 环境变量名
 * @param defaultValue 默认值
 * @returns 布尔值
 */
function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = getEnvVar(key).toLowerCase();
  if (value === "true" || value === "1" || value === "yes") return true;
  if (value === "false" || value === "0" || value === "no") return false;
  return defaultValue;
}

/**
 * 智能获取后端URL
 * 根据环境和配置自动选择合适的后端地址
 */
function getBackendUrl(): string {
  // 优先级：PYTHON_BACKEND_HOST > 默认值
  const pythonBackendHost = getEnvVar("PYTHON_BACKEND_HOST");
  if (pythonBackendHost) {
    return pythonBackendHost;
  }

  // 统一使用默认值，不再支持SERVER_BASE_URL
  return "http://localhost:8001";
}

/**
 * 创建环境配置对象
 */
function createConfig(): EnvironmentConfig {
  const nodeEnv = getEnvVar("NODE_ENV", "development");

  return {
    // 基础环境配置
    nodeEnv,
    port: getEnvNumber("PORT", 3000),

    // 后端服务配置
    pythonBackendHost: getBackendUrl(),

    // 前端公共配置
    nextPublicApiUrl: getEnvVar("NEXT_PUBLIC_API_URL", "http://localhost:3000"),

    // 环境标识
    isDevelopment: nodeEnv === "development",
    isProduction: nodeEnv === "production",

    // API配置
    apiTimeout: getEnvNumber("API_TIMEOUT", 30000), // 30秒
    maxRetries: getEnvNumber("API_MAX_RETRIES", 3),
  };
}

// 导出配置实例
export const config = createConfig();

// 导出配置类型
export type { EnvironmentConfig };

// 导出工具函数
export { getEnvVar, getEnvNumber, getEnvBoolean };

/**
 * 验证必要的环境变量是否存在
 * @returns 验证结果和缺失的变量列表
 */
export function validateEnvironment(): {
  isValid: boolean;
  missingVars: string[];
  warnings: string[];
} {
  const requiredVars: string[] = [
    // 暂时没有严格必需的环境变量，都有默认值
  ];

  const recommendedVars: string[] = [
    "PYTHON_BACKEND_HOST",
    "NEXT_PUBLIC_API_URL",
  ];

  const missingVars: string[] = [];
  const warnings: string[] = [];

  // 检查必需的环境变量
  requiredVars.forEach((varName) => {
    if (!getEnvVar(varName)) {
      missingVars.push(varName);
    }
  });

  // 检查推荐的环境变量
  recommendedVars.forEach((varName) => {
    if (!getEnvVar(varName)) {
      warnings.push(`Recommended environment variable ${varName} is not set`);
    }
  });

  return {
    isValid: missingVars.length === 0,
    missingVars,
    warnings,
  };
}

/**
 * 打印当前配置信息（用于调试）
 * 注意：不会打印敏感信息
 */
export function printConfig(): void {
  console.log("🔧 Environment Configuration:");
  console.log(`  Node Environment: ${config.nodeEnv}`);
  console.log(`  Port: ${config.port}`);
  console.log(`  Python Backend: ${config.pythonBackendHost}`);
  console.log(`  Public API URL: ${config.nextPublicApiUrl}`);
  console.log(`  API Timeout: ${config.apiTimeout}ms`);
  console.log(`  Max Retries: ${config.maxRetries}`);

  const validation = validateEnvironment();
  if (validation.warnings.length > 0) {
    console.log("⚠️  Configuration Warnings:");
    validation.warnings.forEach((warning) => console.log(`  - ${warning}`));
  }

  if (!validation.isValid) {
    console.log("❌ Missing Required Environment Variables:");
    validation.missingVars.forEach((varName) => console.log(`  - ${varName}`));
  } else {
    console.log("✅ All required environment variables are set");
  }
}

/**
 * 获取WebSocket URL
 * 根据当前环境生成正确的WebSocket连接地址
 */
export function getWebSocketUrl(): string {
  let wsUrl: string;

  // 检查是否在浏览器环境中
  if (typeof window !== "undefined") {
    // 浏览器环境：在开发环境中直接连接到Python后端，生产环境使用当前域名
    if (config.isProduction) {
      // 生产环境：根据当前页面的协议和域名构建WebSocket URL
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      wsUrl = `${protocol}//${host}/ws/chat`;
    } else {
      // 开发环境：直接连接到Python后端
      const backendUrl = config.pythonBackendHost;
      if (backendUrl.startsWith("https://")) {
        wsUrl = backendUrl.replace(/^https/, "wss") + "/ws/chat";
      } else if (backendUrl.startsWith("http://")) {
        wsUrl = backendUrl.replace(/^http/, "ws") + "/ws/chat";
      } else {
        wsUrl = `ws://${backendUrl}/ws/chat`;
      }
    }

    console.log(`🔗 WebSocket URL构建 (浏览器环境):`);
    console.log(`  当前页面: ${window.location.origin}`);
    console.log(`  环境: ${config.isProduction ? "生产" : "开发"}`);
    console.log(`  WebSocket URL: ${wsUrl}`);
  } else {
    // 服务器环境：用于SSR或其他服务器端逻辑
    let baseUrl: string;

    if (config.isProduction) {
      // 生产环境：使用配置的域名
      baseUrl = config.nextPublicApiUrl || config.pythonBackendHost;
    } else {
      // 开发环境：直接连接到Python后端
      baseUrl = config.pythonBackendHost;
    }

    // 转换HTTP协议为WebSocket协议
    if (baseUrl.startsWith("https://")) {
      wsUrl = baseUrl.replace(/^https/, "wss") + "/ws/chat";
    } else if (baseUrl.startsWith("http://")) {
      wsUrl = baseUrl.replace(/^http/, "ws") + "/ws/chat";
    } else {
      // 如果没有协议前缀，假设是http
      wsUrl = `ws://${baseUrl}/ws/chat`;
    }

    console.log(`🔗 WebSocket URL构建 (服务器环境):`);
    console.log(`  环境: ${config.isProduction ? "生产" : "开发"}`);
    console.log(`  基础URL: ${baseUrl}`);
    console.log(`  WebSocket URL: ${wsUrl}`);
  }

  return wsUrl;
}

/**
 * 获取API基础URL
 * 用于前端API调用
 */
export function getApiBaseUrl(): string {
  return config.nextPublicApiUrl;
}

/**
 * 检查是否为开发环境
 */
export function isDevelopment(): boolean {
  return config.isDevelopment;
}

/**
 * 检查是否为生产环境
 */
export function isProduction(): boolean {
  return config.isProduction;
}

// 在开发环境下自动打印配置信息
if (config.isDevelopment && typeof window === "undefined") {
  // 只在服务器端打印，避免在浏览器控制台显示
  printConfig();
}
