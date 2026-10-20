import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clipcademy",
  description: "Short-video Python lessons with personalized practice",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
