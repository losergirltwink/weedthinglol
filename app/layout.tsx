import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { connection } from "next/server";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

import { SITE_DESCRIPTION, SITE_NAME, siteUrl } from "./lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  return {
    metadataBase: siteUrl(),
    title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
    description: SITE_DESCRIPTION,
    applicationName: SITE_NAME,
    openGraph: { type: "website", siteName: SITE_NAME },
    twitter: { card: "summary_large_image" },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Render every page per request: the CSP nonce (proxy.ts) can only be stamped
  // onto scripts during dynamic rendering — a prerendered page would ship
  // un-nonced scripts that the policy blocks.
  await connection();

  return (
    <html
      lang="en"
      // Browser extensions (e.g. Dark Reader) inject attributes onto <html>
      // before React hydrates, causing a benign top-level hydration mismatch.
      // Suppress only that — real mismatches inside components still warn.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        {/* Cookieless, privacy-friendly page analytics (no-op outside Vercel). */}
        <Analytics />
      </body>
    </html>
  );
}
