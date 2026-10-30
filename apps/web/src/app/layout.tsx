import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { Suspense } from "react";
import Header from "@/components/Header";

export const metadata: Metadata = { title: "Locora — Everything Around You", description: "Shop from local stores in your city." };
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en"><body>
      <AuthProvider>
        <Suspense fallback={<header className="header"><div className="container header-row"><span className="logo">Loc<span>o</span>ra</span></div></header>}><Header /></Suspense>
        <a className="skip" href="#main">Skip to content</a>
        <main id="main">{children}</main>
        <footer className="footer"><div className="container">© Locora — Everything Around You, Your City, Your Store. Development build.</div></footer>
      </AuthProvider>
    </body></html>
  );
}
