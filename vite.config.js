import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // GitHub Pages project repo uses '/repo-name/'; personal site uses '/'.
  // For GitHub Pages deployment, set this to your repo name.
  base: "/Alive-PDF/",

  build: {
    outDir: "dist",
    // PDF.js is now bundled locally — raise the warning ceiling for its chunk.
    chunkSizeWarningLimit: 1200,
  },

  server: {
    port: 5173,
  },

  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      workbox: {
        // Precache the app shell + bundled fonts/worker so it opens fully offline.
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff,woff2}"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024, // PDF.js worker is large
      },
      manifest: {
        name: "Alive PDF — Urdu Story Reader",
        short_name: "Alive PDF",
        description:
          "PDF reader where your highlights come alive as you scroll.",
        theme_color: "#070610",
        background_color: "#070610",
        display: "standalone",
        icons: [
          {
            src: "favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
});
