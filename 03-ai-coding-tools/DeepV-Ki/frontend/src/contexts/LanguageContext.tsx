/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { locales } from '@/i18n';

type Messages = Record<string, any>;
type LanguageContextType = {
  language: string;
  setLanguage: (lang: string) => void;
  messages: Messages;
  supportedLanguages: Record<string, string>;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Initialize with 'en' or get from localStorage if available
  const [language, setLanguageState] = useState<string>('en');
  const [messages, setMessages] = useState<Messages>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [supportedLanguages, setSupportedLanguages] = useState({})
  const [defaultLanguage, setDefaultLanguage] = useState('en')

  // Helper function to detect browser language
  const detectBrowserLanguage = (): string => {
    try {
      if (typeof window === 'undefined' || typeof navigator === 'undefined') {
        return 'en'; // Default to English on server-side
      }

      // Get browser language (navigator.language returns full locale like 'en-US')
      const browserLang = navigator.language || (navigator as any).userLanguage || '';
      console.log('Detected browser language:', browserLang);

      if (!browserLang) {
        return 'en'; // Default to English if browser language is not available
      }

      // Extract the language code (first 2 characters)
      const langCode = browserLang.split('-')[0].toLowerCase();
      console.log('Extracted language code:', langCode);

      // Check if the detected language is supported
      if (locales.includes(langCode as any)) {
        console.log('Language supported, using:', langCode);
        return langCode;
      }

      // Special case for Chinese variants
      if (langCode === 'zh') {
        console.log('Chinese language detected');
        // Check for traditional Chinese variants
        if (browserLang.includes('TW') || browserLang.includes('HK')) {
          console.log('Traditional Chinese variant detected');
          return 'zh'; // Use Mandarin for traditional Chinese
        }
        return 'zh'; // Use Mandarin for simplified Chinese
      }

      console.log('Language not supported, defaulting to English');
      return 'en'; // Default to English if not supported
    } catch (error) {
      console.error('Error detecting browser language:', error);
      return 'en'; // Default to English on error
    }
  };

  useEffect(() => {
    const getSupportedLanguages = async () => {
      try {
        const response = await fetch('/api/lang/config');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setSupportedLanguages(data.supported_languages);
        setDefaultLanguage(data.default);
      } catch (err) {
        console.error("Failed to fetch auth status:", err);
        // Assuming auth is required if fetch fails to avoid blocking UI for safety
        const defaultSupportedLanguages = {
          "en": "English",
          "ja": "Japanese (日本語)",
          "zh": "Mandarin Chinese (中文)",
          "zh-tw": "Traditional Chinese (繁體中文)",
          "es": "Spanish (Español)",
          "kr": "Korean (한국어)",
          "vi": "Vietnamese (Tiếng Việt)",
          "pt-br": "Brazilian Portuguese (Português Brasileiro)",
          "fr": "Français (French)",
          "ru": "Русский (Russian)"
        };
        setSupportedLanguages(defaultSupportedLanguages);
        setDefaultLanguage("en");
      }
    }
    getSupportedLanguages();
  }, []);

  useEffect(() => {
    if (supportedLanguages && Object.keys(supportedLanguages).length > 0) {
      const loadLanguage = async () => {
        try {
          // Only access localStorage in the browser
          let storedLanguage;
          if (typeof window !== 'undefined') {
            storedLanguage = localStorage.getItem('language');

            // If no language is stored, detect browser language
            if (!storedLanguage) {
              console.log('No language in localStorage, detecting browser language');
              storedLanguage = detectBrowserLanguage();

              // Store the detected language
              localStorage.setItem('language', storedLanguage);
            }
          } else {
            console.log('Running on server-side, using default language');
            storedLanguage = 'en';
          }

          console.log('Supported languages loaded, validating language:', storedLanguage);
          const validLanguage = Object.keys(supportedLanguages).includes(storedLanguage as any) ? storedLanguage : defaultLanguage;
          console.log('Valid language determined:', validLanguage);

          // Load messages for the language
          const langMessages = (await import(`../messages/${validLanguage}.json`)).default;

          setLanguageState(validLanguage);
          setMessages(langMessages);

          // Update HTML lang attribute (only in browser)
          if (typeof document !== 'undefined') {
            document.documentElement.lang = validLanguage;
          }
        } catch (error) {
          console.error('Failed to load language:', error);
          // Fallback to English
          console.log('Falling back to English due to error');
          const enMessages = (await import('../messages/en.json')).default;
          setMessages(enMessages);
        } finally {
          setIsLoading(false);
        }
      };

      loadLanguage();
    } else {
      setIsLoading(false);
    }
  }, [supportedLanguages, defaultLanguage]);

  // Update language and load new messages
  const setLanguage = async (lang: string) => {
    try {
      console.log('Setting language to:', lang);
      const validLanguage = supportedLanguages && Object.keys(supportedLanguages).includes(lang as any) ? lang : defaultLanguage;

      // Load messages for the new language
      const langMessages = (await import(`../messages/${validLanguage}.json`)).default;

      setLanguageState(validLanguage);
      setMessages(langMessages);

      // Store in localStorage (only in browser)
      if (typeof window !== 'undefined') {
        localStorage.setItem('language', validLanguage);
      }

      // Update HTML lang attribute (only in browser)
      if (typeof document !== 'undefined') {
        document.documentElement.lang = validLanguage;
      }
    } catch (error) {
      console.error('Failed to set language:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-white via-gray-50 to-white dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 overflow-hidden relative">
        {/* 背景装饰光晕 */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-200 dark:bg-emerald-900/30 rounded-full blur-3xl opacity-20 dark:opacity-10 animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-200 dark:bg-blue-900/30 rounded-full blur-3xl opacity-20 dark:opacity-10 animate-pulse" style={{ animationDelay: '1s' }}></div>
        </div>

        <div className="text-center relative z-10">
          {/* 双轨道旋转加载器 */}
          <div className="w-20 h-20 mx-auto mb-6 relative">
            <style>{`
              @keyframes orbit {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
              @keyframes orbitInner {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(-360deg); }
              }
              .orbit-outer {
                animation: orbit 3s linear infinite;
              }
              .orbit-inner {
                animation: orbitInner 4s linear infinite;
              }
            `}</style>
            {/* 外层轨道 - 翠绿色 */}
            <div className="orbit-outer absolute inset-0 rounded-full border-2 border-transparent border-t-emerald-500 border-r-emerald-400 dark:border-t-emerald-400 dark:border-r-emerald-300 opacity-80"></div>
            {/* 中层轨道 - 蓝色 */}
            <div className="orbit-inner absolute inset-3 rounded-full border-2 border-transparent border-b-blue-500 border-l-blue-400 dark:border-b-blue-400 dark:border-l-blue-300 opacity-60"></div>
            {/* 中心发光核心 */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-gradient-to-r from-emerald-500 to-blue-500 dark:from-emerald-400 dark:to-blue-400 shadow-lg shadow-emerald-500/50 dark:shadow-emerald-400/30"></div>
            </div>
          </div>

          {/* 文字和点动画 */}
          <div className="mt-4">
            <p className="text-base font-medium text-gray-700 dark:text-gray-200 tracking-wide">
              好事即将发生
            </p>
            <div className="mt-3 flex justify-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-bounce"></span>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-bounce" style={{ animationDelay: '0.1s' }}></span>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-bounce" style={{ animationDelay: '0.2s' }}></span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, messages, supportedLanguages }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
