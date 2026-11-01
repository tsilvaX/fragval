import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "FRAG COURT — Settle it on the scoreboard.",
  description:
    "A private VALORANT court for your friends. Every frag on the record.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
