import type { Metadata } from "next";
import "./globals.css";

import { AuthProvider } from "@/components/auth-provider";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Model Hub",
  description: "模型与数据集托管平台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <SiteHeader />
          <div className="flex-1">{children}</div>
        </AuthProvider>
      </body>
    </html>
  );
}
