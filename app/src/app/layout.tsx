import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Yuki - Your Little Helper for Finances",
  description:
    "A local-first personal finance tracker that accepts the chaos and makes sense of it",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
