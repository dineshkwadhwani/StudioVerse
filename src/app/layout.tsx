import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StudioVerse — One Platform, Every Studio",
  description: "StudioVerse powers professional studios across coaching, training, recruitment, HR, fitness, and teaching.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}