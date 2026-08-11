import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { ThemeProvider } from "@/components/theme/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CHALLENGE_HOST, CHALLENGE_NAME, UNIVERSITY_NAME } from "@/domain/challenge/constants";
import { APP_NAME, APP_URL } from "@/lib/env";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description: `Online application portal for the ${CHALLENGE_NAME}, ${CHALLENGE_HOST}, ${UNIVERSITY_NAME}.`,
  applicationName: APP_NAME,
  // The portal is private; there is nothing here for a search engine.
  robots: { index: false, follow: false },
};

/*
 * The browser chrome (Android address bar, iOS status bar, Windows title bar)
 * is tinted to the top of the app's own gradient, so the frame around the page
 * continues the maroon rather than cutting it off with a grey band. The values
 * are the first stops of `--gradient-brand` in `globals.css`; keep them in step.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#5c0022" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1418" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* Keyboard users should be able to jump past the navigation. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg focus:ring-2 focus:ring-ring"
        >
          Skip to main content
        </a>

        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {/*
            Required by the collapsed sidebar, whose menu buttons render a
            tooltip. Radix's Tooltip throws rather than degrading when no
            provider is in scope, so this has to sit above every route that
            uses the app shell — which is all of them.
          */}
          <TooltipProvider delayDuration={300}>
            {children}
            <Toaster richColors closeButton position="top-right" />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
