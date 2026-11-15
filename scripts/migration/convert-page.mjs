// Migration helper (temporary; delete after the migration): converts public/<name>.html (standard
// page shape) into src/pages/<name>.astro using BaseLayout and, where the banner is standard, PageHero.
// Keeps the page text exactly as it was; data-site attributes stay and are filled in the browser by
// main.js until Phase 5. Remove public/<name>.html afterwards (Astro can't have both).
// Usage (from the repository folder): node scripts/migration/convert-page.mjs . <name> [<name> ...]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const [root, ...names] = process.argv.slice(2);
const SITE_URL = "https://www.mercyseatchapel.org/";
const decode = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const js = (s) => JSON.stringify(s);
const pv = (s) => (/["{}]/.test(s) ? "{" + JSON.stringify(s) + "}" : `"${s}"`); // prop value
const attr = (tag, name) => { const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`)); return m ? decode(m[1]) : undefined; };
const meta = (html, re) => { const m = html.match(re); return m ? decode(m[1]) : undefined; };

// Braces start expressions in Astro; escape them outside <script>/<style>, and make those inline (no processing)
function astroSafe(html) {
  return html.split(/(<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>)/i).map((part, i) => {
    if (i % 2) return part.replace(/^<(script|style)\b(?![^>]*is:inline)/i, "<$1 is:inline");
    return part.replace(/\{/g, "&#123;").replace(/\}/g, "&#125;");
  }).join("");
}

const STD_HEAD = /charset|name="viewport"|<title>|name="description"|rel="canonical"|Link previews|og:type|og:site_name|og:title|og:description|og:url|og:image"|og:image:alt|twitter:card|preconnect|fonts\.googleapis\.com\/css2|style\.css|Browser-tab icon|rel="icon"|apple-touch-icon|name="robots"/;

for (const name of names) {
  const src = readFileSync(path.join(root, "public", `${name}.html`), "utf8").replace(/\r\n/g, "\n");
  const head = src.slice(src.indexOf("<head>") + 6, src.indexOf("</head>"));
  const title = meta(head, /<title>([^<]*)<\/title>/).replace(/ – Mercy Seat Chapel$/, "");
  const description = meta(head, /<meta name="description" content="([^"]*)"/);
  const image = meta(head, /<meta property="og:image" content="([^"]*)"/)?.replace(SITE_URL, "");
  const imageAlt = meta(head, /<meta property="og:image:alt" content="([^"]*)"/);
  const robots = meta(head, /<meta name="robots" content="([^"]*)"/);

  // Head extras: keep comments/tags/scripts that aren't part of the standard head, in order
  const headLines = head.split("\n");
  const robotsNote = head.match(/<!--\s*([^\n]*?)\s*-->\s*\n\s*<meta name="robots"/)?.[1];
  const extras = []; let inBlock = null;
  for (const line of headLines) {
    const t = line.trim();
    if (inBlock) { extras.push(line); if (t.includes(inBlock)) inBlock = null; continue; }
    if (!t || STD_HEAD.test(t) || (robotsNote && t === `<!-- ${robotsNote} -->`)) continue;
    extras.push(line);
    if (t.startsWith("<!--") && !t.includes("-->")) inBlock = "-->";
    else if (/^<script\b/.test(t) && !t.includes("</script>")) inBlock = "</script>";
  }

  const body = src.slice(src.indexOf("<body>") + 6, src.indexOf("</body>"));
  let main = body.slice(body.indexOf("<main id=\"main\">") + 16, body.lastIndexOf("</main>"));
  const after = body.slice(body.lastIndexOf("</main>"));
  const extraScripts = [...after.matchAll(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/g)].map((m) => m[1]).filter((s) => !/lucide|main\.js/.test(s));

  // Standard page hero → <PageHero>
  let hero = "";
  const hm = main.match(/^\s*<section class="page-hero">\s*(<div class="page-hero__bg"[^>]*><\/div>)\s*<div class="container">\s*<ol class="crumbs">([\s\S]*?)<\/ol>\s*<h1>([^<]*)<\/h1>([\s\S]*?)<\/div>\s*<\/section>\n?/);
  if (hm) {
    const [whole, bg, crumbsHtml, h1, rest] = hm;
    const style = attr(bg, "style") || "";
    const img = style.match(/background-image:url\('([^']+)'\)/)?.[1];
    const pos = style.match(/background-position:\s*([^;]+)/)?.[1]?.trim();
    const leftover = style.replace(/background-image:url\('[^']+'\);?/, "").replace(/background-position:\s*[^;]+;?/, "").trim();
    const label = attr(bg, "aria-label");
    const crumbs = [...crumbsHtml.matchAll(/<li>(?:<a href="([^"]+)">([^<]*)<\/a>|([^<]*))<\/li>/g)].map((m) => (m[1] ? { label: decode(m[2]), href: m[1] } : { label: decode(m[3]) }));
    const crumbsOk = crumbs.length && crumbsHtml.replace(/<li>(?:<a href="[^"]+">[^<]*<\/a>|[^<]*)<\/li>/g, "").trim() === "";
    if (img && !leftover && crumbsOk && (!bg.includes("role=") || label)) {
      const restLines = rest.replace(/^\n/, "").replace(/\s+$/, "").split("\n").map((l) => l.replace(/^ {8}/, "    ")).join("\n");
      hero = [
        `  <PageHero`,
        `    title=${pv(decode(h1))}`,
        `    image=${js(img)}`,
        pos ? `    imagePosition=${js(pos)}` : null,
        label ? `    imageLabel=${pv(label)}` : null,
        `    crumbs={${JSON.stringify(crumbs)}}`,
        restLines.trim() ? `  >\n${astroSafe(restLines)}\n  </PageHero>` : `  />`
      ].filter(Boolean).join("\n");
      main = main.slice(whole.length);
    } else console.warn(`${name}: hero kept as plain HTML`);
  } else console.warn(`${name}: no standard hero`);

  const mainOut = astroSafe(main.replace(/^\n/, "").replace(/\s+$/, "")).split("\n").map((l) => l.replace(/^  /, "")).join("\n");
  const props = [
    `  page=${js(`${name}.html`)}`,
    `  title=${pv(title)}`,
    `  description=${pv(description)}`,
    image ? `  image=${js(image)}` : `  hidden`,
    imageAlt && imageAlt !== "Mercy Seat Chapel" ? `  imageAlt=${pv(imageAlt)}` : null,
    robots ? `  robots=${js(robots)}` : null
  ].filter(Boolean).join("\n");

  const out = [
    `---`,
    `/* ${title}. Page text is plain HTML below; the shared head, header and footer come from BaseLayout.${robotsNote ? `\n   ${robotsNote.replace(/this line/, "the robots line below")}` : ""} */`,
    `import BaseLayout from "../layouts/BaseLayout.astro";`,
    hero ? `import PageHero from "../components/PageHero.astro";` : null,
    `---`,
    `<BaseLayout\n${props}\n>`,
    extras.length ? `  <Fragment slot="head">\n${astroSafe(extras.join("\n"))}\n  </Fragment>\n` : null,
    hero ? hero + "\n" : null,
    mainOut,
    extraScripts.length ? `\n  <Fragment slot="scripts">\n${extraScripts.map((s) => `    <script is:inline src=${js(s)}></script>`).join("\n")}\n  </Fragment>` : null,
    `</BaseLayout>`,
    ``
  ].filter((x) => x !== null).join("\n");
  mkdirSync(path.join(root, "src/pages"), { recursive: true });
  writeFileSync(path.join(root, "src/pages", `${name}.astro`), out);
  console.log(`${name}: converted${hero ? " (PageHero)" : ""}${extras.length ? `, ${extras.length} head lines` : ""}${extraScripts.length ? `, scripts: ${extraScripts.join(", ")}` : ""}`);
}
