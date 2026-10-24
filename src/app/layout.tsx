import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { SiteHeader, SiteHeaderFallback } from "@/components/site-header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const bebas = Bebas_Neue({
  variable: "--font-bebas",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Focus volleyball clips",
  description: "Vertical Meta-glasses volleyball clips, browsable by day and game.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#07080d",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${bebas.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <Suspense fallback={<SiteHeaderFallback />}>
          <SiteHeader />
        </Suspense>
        <main className="relative mx-auto w-full max-w-lg px-4 pb-16 pt-6">
          {children}
        </main>
      </body>
    </html>
  );
}
