import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

/** Departure Mono, de Helena Zhang, bajo SIL Open Font License 1.1.
    Se sirve desde el propio dominio: una tipografía de mapa de bits pesa 22 kB
    y no compensa una petición a un tercero para traerla. */
const departure = localFont({
  src: "./fuentes/DepartureMono-Regular.woff2",
  variable: "--fuente-departure",
  display: "swap",
  weight: "400",
});

const sitio =
  process.env.NEXT_PUBLIC_SITIO_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(sitio),
  title: "Epicentro · Estación de rastreo sísmico",
  description:
    "Sismos de todo el mundo, en vivo desde el USGS, sobre un mapa rasterizado a píxeles. Pregunta en español y el modelo arma la consulta.",
  openGraph: {
    title: "Epicentro · Estación de rastreo sísmico",
    description: "Sismos del mundo en vivo, y una consulta que entiende español.",
    locale: "es_MX",
    type: "website",
    siteName: "Epicentro",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-MX" className={departure.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
