import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NASDAQ 一年滚动同比趋势",
  description: "纳斯达克综合指数过去一年逐日同比涨跌幅趋势图",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
