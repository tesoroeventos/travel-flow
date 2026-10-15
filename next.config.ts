import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // App con datos por usuario: se usa el modelo de renderizado dinámico clásico.
  cacheComponents: false,
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
