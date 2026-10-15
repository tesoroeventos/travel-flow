import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // App con datos por usuario: se usa el modelo de renderizado dinámico clásico.
  cacheComponents: false,
  async redirects() {
    return [
      {
        source: "/viajes/:id/:old(transporte|alojamiento|actividades)",
        destination: "/viajes/:id/opciones",
        permanent: false,
      },
      {
        source: "/viajes/:id/comparador",
        destination: "/viajes/:id/propuestas",
        permanent: false,
      },
    ];
  },
  serverExternalPackages: ["@electric-sql/pglite", "@node-rs/argon2"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
