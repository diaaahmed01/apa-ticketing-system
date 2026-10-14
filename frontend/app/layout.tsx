import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ATS · APA Ticketing System", template: "%s · ATS" },
  description: "APA Ticketing System — Port of Alexandria",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <head>
        {/* Loaded by the browser at runtime: next/font would need to download at build time, which the proxy blocks. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Cairo:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
