// Astro settings for the Mercy Seat Chapel website.
// Plan and progress: docs/astro-migration-plan.md
import { defineConfig } from "astro/config";

export default defineConfig({
  // Live address: used for canonical links, Open Graph tags and the sitemap
  site: "https://www.mercyseatchapel.org",

  // Static files only (uploaded to SiteGround); no server needed
  output: "static",

  // Keep today's page addresses: src/pages/about.astro → about.html (not about/index.html).
  // The mobile app links to several of these, so they must not change.
  build: { format: "file" },
  trailingSlash: "never",

  // Everything in public/ is copied as-is. During the migration the not-yet-converted
  // pages live there too; each one moves to src/pages/ when it is converted.
  publicDir: "public",
  outDir: "dist",

  // Hide Astro's developer overlay in the local preview (it is never in the built site)
  devToolbar: { enabled: false }
});
