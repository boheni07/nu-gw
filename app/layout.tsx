import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "nuGW 업무관리 플랫폼",
  description: "연차관리 + 결재 시스템 + 일일/주간 업무보고",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
