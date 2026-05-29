import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "大学生 AI 任务管家",
  description: "本地运行的大学生任务中枢",
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
