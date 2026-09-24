import type { MetadataRoute } from "next";

import { APP_DESCRIPTION, APP_NAME, APP_TAGLINE } from "@/config/app";

/**
 * Web app manifest (MVP #29, ADR-055) — makes LifeOS installable. One SVG icon at `sizes: "any"`
 * is enough for Chromium and avoids shipping a raster icon pipeline.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_NAME} — ${APP_TAGLINE}`,
    short_name: APP_NAME,
    description: APP_DESCRIPTION,
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#1a1b26",
    theme_color: "#1a1b26",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
