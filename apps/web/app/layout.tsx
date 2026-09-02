import type { Metadata } from "next";
import { AnalyticsInit } from "@/components/analytics-init";
import "./globals.css";

const description = "AI chatbots trained on your content, with human escalation built in.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://velobot.techfen.com"),
  title: {
    default: "VeloBot",
    template: "%s · VeloBot",
  },
  description,
  openGraph: {
    title: "VeloBot",
    description,
    siteName: "VeloBot",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "VeloBot",
    description,
  },
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
