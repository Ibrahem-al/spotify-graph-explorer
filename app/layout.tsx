import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spotify Graph Explorer",
  description:
    "Ask natural-language questions about a Spotify music graph and get interactive Neo4j visualizations.",
  icons: { icon: "/favicon.ico" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full overscroll-contain touch-manipulation">{children}</body>
    </html>
  );
}
