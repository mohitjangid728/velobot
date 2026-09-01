import type { Metadata } from "next";
import { AnalyticsInit } from "@/components/analytics-init";
import "./globals.css";

export const metadata: Metadata = {
  title: "VeloBot",
  description: "AI chatbots trained on your content, with human escalation built in.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <AnalyticsInit />
        {children}
      </body>
    </html>
  );
}
