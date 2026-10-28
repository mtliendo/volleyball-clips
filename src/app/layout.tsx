import type { Metadata, Viewport } from "next";
import { Onest, Tektur } from "next/font/google";
import { Suspense, type ReactNode } from "react";
import { Auth0Provider } from "@auth0/nextjs-auth0/client";
import { SiteChrome } from "@/components/site-chrome";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader, SiteHeaderFallback } from "@/components/site-header";
import "./globals.css";

const tektur = Tektur({
  variable: "--font-tektur",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "VB POV",
  description: "Volleyball clips from the glasses. Pick a night, open a session, swipe.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2b1614",
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${tektur.variable} ${onest.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-paper font-body text-ink">
        <Auth0Provider>
          <SiteChrome
            header={
              <Suspense fallback={<SiteHeaderFallback />}>
                <SiteHeader />
              </Suspense>
            }
            footer={<SiteFooter />}
          >
            {children}
          </SiteChrome>
        </Auth0Provider>
      </body>
    </html>
  );
}
