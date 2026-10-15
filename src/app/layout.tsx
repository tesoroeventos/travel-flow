import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TravelFlow",
  description: "Compará alternativas, calculá el costo real del viaje y armá tu itinerario de punta a punta.",
  applicationName: "TravelFlow",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0f6b5c" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1a1f" },
  ],
};

/** Fija el tema antes de pintar para evitar el parpadeo (preferencia guardada o la del sistema). */
const themeScript = `(function(){try{var t=localStorage.getItem("tf-theme");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="light"}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
