import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "砚时",
  description: "于书砚之间，理清每日之事。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
