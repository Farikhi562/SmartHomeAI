import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "SmartHomeAI",
    template: "%s — SmartHomeAI",
  },
  description: "Ingatan bertenaga AI untuk barang-barang pribadi Anda",
  applicationName: "SmartHomeAI",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

/**
 * Applies the saved theme before first paint (DESIGN_SYSTEM §6.1: no flash).
 * Light is the default; "SYSTEM" resolves against prefers-color-scheme.
 * Kept tiny and inline so it runs before React hydrates (CSP allows 'unsafe-inline').
 */
const THEME_INIT_SCRIPT = `(function(){try{var t=window.localStorage.getItem("shai-theme");var d=t==="DARK"||(t==="SYSTEM"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
