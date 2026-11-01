import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "FRAG COURT — Settle it on the scoreboard.",
  description: "A VALORANT court for your friends. Every frag on the record.",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#141a16",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark">
      <body>{children}</body>
    </html>
  );
}
