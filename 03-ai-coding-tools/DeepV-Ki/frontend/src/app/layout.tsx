import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Use Google Fonts with fallbacks for better typography
const fontClassNames = "font-sans";

export const metadata: Metadata = {
  title: "DeepV-Ki | AI-Powered Wiki Generator",
  description: "AI-powered documentation for code repositories",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${fontClassNames} antialiased`}
      >
        <ErrorBoundary>
          <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem>
            <LanguageProvider>
              {children}
            </LanguageProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
