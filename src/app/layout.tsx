import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Inter } from "next/font/google";
import "./globals.css";

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "700"],
});

const machine = Inter({
  subsets: ["latin"],
  variable: "--font-machine",
  weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
  title: "The Understudy",
  description: "It learns your calls, and makes them when you are away.",
};

export const viewport: Viewport = {
  themeColor: "#0A0B0D",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${mono.variable} ${machine.variable}`}>
      <body className="console-vignette">{children}</body>
    </html>
  );
}
