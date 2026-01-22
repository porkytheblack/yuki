import type { Metadata } from "next";
import { Sora } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
});

export const metadata: Metadata = {
  title: "Yuki",
  description:
    "A local-first personal finance tracker that accepts the chaos and makes sense of it",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={sora.variable}>
      <body className="antialiased min-h-screen transition-colors duration-150 font-sora">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
