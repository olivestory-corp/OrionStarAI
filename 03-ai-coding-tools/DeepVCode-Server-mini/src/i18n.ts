/**
 * Internationalization (i18n) Module
 * 国际化 (i18n) 模块
 *
 * Auto-detects language based on system locale
 * 根据系统区域设置自动检测语言
 */

type Language = 'en' | 'zh';

interface Messages {
  success: string;
  separator: string;
  localAccess: string;
  lanAccess: string;
  environment: string;
  bindAddress: string;
  clientGuide: string;
  readmeSection: string;
  cliConfig: string;
  vscodeConfig: string;
  serverUrl: string;
  lanAddress: string;
  configValidationFailed: string;
  enterpriseTitle: string;
  enterpriseDescription: string;
  enterpriseFeatures: string;
  enterpriseContact: string;
  enterpriseLearnMore: string;
  starSupport: string;
  forkContribute: string;
}

const messages: Record<Language, Messages> = {
  en: {
    success: '✅ Mini Server for DeepV Code started successfully',
    separator: '='.repeat(70),
    localAccess: '📍 Local Access URL: ',
    lanAccess: '📍 LAN Access URL: ',
    environment: '🔧 Environment: ',
    bindAddress: '🌍 Bind Address: ',
    clientGuide: '🚀 Client Configuration Guide:',
    readmeSection: '   Please refer to the "Client Connection" section in README.md:',
    cliConfig: '   - DeepV Code CLI: Edit ~/.deepv/settings.json, add customProxyServerUrl field',
    vscodeConfig: '   - VSCode Extension: Search for Custom Proxy Server Url setting',
    serverUrl: '   - Server URL: ',
    lanAddress: '   - LAN Address: ',
    configValidationFailed: '\n❌ Configuration validation failed:\n',
    enterpriseTitle: '💡 Enterprise-Grade API Key Solution',
    enterpriseDescription: 'If you don\'t have an API Key, please contact us to provide enterprise cloud solutions.',
    enterpriseFeatures: 'We are a Google Cloud certified partner and can provide cost-effective enterprise-grade API KEYs, including:\n  • Claude Series\n  • Gemini Series\n  • OpenAI\n  • Other open-source large models',
    enterpriseContact: '📞 Contact Us: http://cmcm.bot/',
    enterpriseLearnMore: '📖 Learn More: https://www.polymericcloud.com/',
    starSupport: 'If you find this project helpful, please give us a star! Your support motivates our development.',
    forkContribute: 'Want to contribute? Fork and submit a pull request! We welcome bug fixes, improvements, and new features.'
  },
  zh: {
    success: '✅ Mini Server for DeepV Code 启动成功',
    separator: '='.repeat(70),
    localAccess: '📍 本地访问地址: ',
    lanAccess: '📍 局域网访问地址: ',
    environment: '🔧 环境: ',
    bindAddress: '🌍 绑定地址: ',
    clientGuide: '🚀 客户端配置指南:',
    readmeSection: '   请参考 README.md 中的"客户端连接"章节:',
    cliConfig: '   - DeepV Code CLI: 编辑 ~/.deepv/settings.json，增加 customProxyServerUrl 字段',
    vscodeConfig: '   - VSCode 扩展: 搜索 Custom Proxy Server Url 设置',
    serverUrl: '   - 服务器启动在: ',
    lanAddress: '   - 局域网地址: ',
    configValidationFailed: '\n❌ 配置验证失败:\n',
    enterpriseTitle: '💡 企业级 API KEY 解决方案',
    enterpriseDescription: '如果您没有 API Key，请联系我们提供企业云方案。',
    enterpriseFeatures: '我们是 Google Cloud 认证合作伙伴，能为您提供物美价廉的企业级 API KEY，包括：\n  • Claude 系列\n  • Gemini 系列\n  • OpenAI\n  • 其他开源大模型',
    enterpriseContact: '📞 联系我们: http://cmcm.bot/',
    enterpriseLearnMore: '📖 了解更多: https://www.polymericcloud.com/',
    starSupport: '如果这个项目对你有帮助，请给我们一个 Star！您的支持是我们继续开发的动力。',
    forkContribute: '想要贡献代码？Fork 我们的项目，提交 Pull Request！无论是 Bug 修复、功能改进还是新特性，我们都期待您的参与。'
  }
};

/**
 * Detect system language from locale
 * 从区域设置检测系统语言
 *
 * Checks LANG, LANGUAGE, LC_ALL environment variables
 * Also checks process.platform and Intl.DateTimeFormat
 * 检查 LANG、LANGUAGE、LC_ALL 环境变量、process.platform 和 Intl.DateTimeFormat
 */
export function detectLanguage(): Language {
  // Check environment variables (works on Linux, macOS, WSL)
  // 检查环境变量（适用于 Linux、macOS、WSL）
  const langEnv = process.env.LANG || process.env.LANGUAGE || process.env.LC_ALL || '';
  if (langEnv.toLowerCase().startsWith('zh')) {
    return 'zh';
  }

  // Check Windows locale (e.g., "Chinese (Simplified)")
  // 检查 Windows 区域设置（例如 "Chinese (Simplified)"）
  if (process.platform === 'win32') {
    try {
      // Use Intl API to get system language
      // 使用 Intl API 获取系统语言
      const locale = new Intl.DateTimeFormat().resolvedOptions().locale;
      if (locale.startsWith('zh')) {
        return 'zh';
      }
    } catch (e) {
      // Fallback if Intl API fails
      // Intl API 失败时回退
    }
  }

  // Default to English
  // 默认为英文
  return 'en';
}

/**
 * Get messages for the detected language
 * 获取检测到的语言的消息
 */
export function getMessages(): Messages {
  const language = detectLanguage();
  return messages[language];
}

/**
 * Get specific message by key
 * 通过键获取特定消息
 */
export function getMessage(key: keyof Messages): string {
  const language = detectLanguage();
  return messages[language][key];
}

/**
 * Get all messages for a specific language
 * 获取特定语言的所有消息
 */
export function getMessagesForLanguage(language: Language): Messages {
  return messages[language];
}

/**
 * Get detected language
 * 获取检测到的语言
 */
export { Language };
