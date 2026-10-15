import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TravelFlow",
  description: "Planificá, compará y organizá tu viaje de punta a punta.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
