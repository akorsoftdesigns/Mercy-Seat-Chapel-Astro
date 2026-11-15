/* sitemap.xml for search engines, written at every build from the pages in src/pages/.
   Same address as before (robots.txt points to it), so nothing changes for search engines.
   Left out automatically: the not-found page and any page marked `hidden` or with a
   noindex robots setting (membership form, job application pages).
   lastmod = the date the page file last changed in Git (left out if Git isn't available).
   PRIORITY: how important each page is relative to the others (0.6 if not listed). */
import { execFileSync } from "node:child_process";
import { SITE } from "../data/site.js";

const PRIORITY = {
  "index.html": "1.0", "plan-a-visit.html": "0.9",
  "about.html": "0.8", "become-a-member.html": "0.8", "contact.html": "0.8", "events.html": "0.8",
  "give.html": "0.8", "live.html": "0.8", "sermons.html": "0.8",
  "our-vision-values.html": "0.7",
  "cookies.html": "0.3", "privacy.html": "0.3", "terms.html": "0.3"
};

const sources = import.meta.glob("./*.astro", { query: "?raw", import: "default", eager: true });

function lastChanged(file) {
  try {
    return execFileSync("git", ["log", "-1", "--format=%cs", "--", `src/pages/${file}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch { return ""; }
}

export function GET() {
  const pages = Object.entries(sources)
    .map(([path, src]) => ({ file: path.slice(2), name: path.slice(2).replace(/\.astro$/, ".html"), src }))
    .filter(({ name, src }) => name !== "404.html" && !/^\s*hidden\s*$/m.test(src) && !/robots="[^"]*noindex/.test(src))
    .sort((a, b) => (a.name === "index.html" ? -1 : b.name === "index.html" ? 1 : a.name.localeCompare(b.name)));

  const urls = pages.map(({ file, name }) => {
    const loc = `${SITE.website}/${name === "index.html" ? "" : name}`;
    const lastmod = lastChanged(file);
    return `  <url><loc>${loc}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}<priority>${PRIORITY[name] || "0.6"}</priority></url>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Public pages for search engines, written at every build (src/pages/sitemap.xml.js). Private pages are left out on purpose. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>
`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
