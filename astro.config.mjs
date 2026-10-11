import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

// Canonical origin for the built site.  Change this one value when the
// deployment domain changes — everything else, including canonical and
// OpenGraph URLs, derives from it.
export const SITE = "https://msmcp.dev";

export default defineConfig({
  site: SITE,
  vite: {
    plugins: [tailwindcss()],
  },
});
