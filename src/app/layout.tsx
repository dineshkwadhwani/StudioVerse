import type { Metadata } from "next";
import "./globals.css";
import { TenantProvider } from "@/lib/tenant/context";

export const metadata: Metadata = {
  title: "Coaching Studio",
  description: "Your transformation starts here",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <TenantProvider>
          {children}
        </TenantProvider>
      </body>
    </html>
  );
}