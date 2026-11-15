// Phase 7 checks over dist/: internal links, anchors, files, SEO tags, accessibility basics, page weight.
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import path from "node:path";

const dist = process.argv[2];
const pages = readdirSync(dist).filter((f) => f.endsWith(".html"));
const html = Object.fromEntries(pages.map((p) => [p, readFileSync(path.join(dist, p), "utf8")]));
const ids = Object.fromEntries(pages.map((p) => [p, new Set([...html[p].matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]))]));
const problems = [];
const warn = (p, msg) => problems.push(`${p}: ${msg}`);
const PRIVATE = /^(membership-form|job-[a-z-]+-(coordinator|assistant)|404)\.html$/;

for (const p of pages) {
  const h = html[p];
  // ---- links and files ----
  const refs = [...h.matchAll(/\s(href|src|poster|data-src|data-full)="([^"]*)"/g)].map((m) => [m[1], m[2]]);
  const srcsets = [...h.matchAll(/\ssrcset="([^"]*)"/g)].flatMap((m) => m[1].split(",").map((s) => ["srcset", s.trim().split(/\s+/)[0]]));
  const bgs = [...h.matchAll(/url\(['"]?([^'")]+)['"]?\)/g)].map((m) => ["url()", m[1]]);
  for (const [kind, raw] of [...refs, ...srcsets, ...bgs]) {
    const url = raw.replace(/&amp;/g, "&");
    if (!url || /^(https?:|mailto:|tel:|data:|javascript:|\/\/)/.test(url)) continue;
    if (url === "#") continue;
    const [file, hash] = url.split("#");
    const target = file ? file.split("?")[0] : p;
    if (file && !existsSync(path.join(dist, decodeURI(target)))) { warn(p, `${kind} → missing file ${url}`); continue; }
    if (hash && target.endsWith(".html") && html[target] && !ids[target].has(hash)) warn(p, `${kind} → ${url}: no #${hash} on that page`);
  }
  // ---- SEO ----
  const h1 = (h.match(/<h1[\s>]/g) || []).length;
  if (h1 !== 1) warn(p, `${h1} <h1> headings`);
  const title = h.match(/<title>([^<]*)<\/title>/)?.[1];
  if (!title) warn(p, "no <title>");
  if (!/<meta name="description" content="[^"]{30,}"/.test(h)) warn(p, "missing or very short description");
  if (!PRIVATE.test(p)) {
    for (const t of ['rel="canonical"', 'property="og:title"', 'property="og:description"', 'property="og:image"', 'property="og:url"', 'name="twitter:card"'])
      if (!h.includes(t)) warn(p, `missing ${t}`);
    if (/name="robots" content="[^"]*noindex/.test(h)) warn(p, "public page is noindex");
    const canon = h.match(/rel="canonical" href="([^"]+)"/)?.[1];
    const expect = `https://www.mercyseatchapel.org/${p === "index.html" ? "" : p}`;
    if (canon && canon !== expect) warn(p, `canonical ${canon} (expected ${expect})`);
    const og = h.match(/property="og:image" content="https:\/\/www\.mercyseatchapel\.org\/([^"]+)"/)?.[1];
    if (og && !existsSync(path.join(dist, og))) warn(p, `og:image file missing: ${og}`);
  } else if (!/name="robots" content="[^"]*noindex/.test(h)) warn(p, "private page is not noindex");
  if (!/viewport-fit=cover/.test(h)) warn(p, "viewport meta without viewport-fit=cover");
  // ---- accessibility basics ----
  for (const m of h.matchAll(/<img\b[^>]*>/g)) if (!/\salt="/.test(m[0])) warn(p, `img without alt: ${m[0].slice(0, 90)}`);
  for (const m of h.matchAll(/<(input|select|textarea)\b([^>]*)>/g)) {
    const a = m[2];
    if (/type="(hidden|submit|button)"/.test(a)) continue;
    const id = a.match(/\sid="([^"]+)"/)?.[1];
    const before = h.slice(0, m.index); const wrapped = before.lastIndexOf("<label") > before.lastIndexOf("</label>");
    const labelled = wrapped || /aria-label(ledby)?="/.test(a) || (id && new RegExp(`<label[^>]*for="${id}"`).test(h));
    if (!labelled) warn(p, `${m[1]} without a label: ${m[0].slice(0, 100)}`);
  }
  for (const m of h.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
    const text = m[2].replace(/<[^>]+>/g, "").trim();
    if (!text && !/aria-label="/.test(m[1])) warn(p, `button without a name: ${m[0].slice(0, 100)}`);
  }
  for (const m of h.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)) {
    const text = m[2].replace(/<(?!img)[^>]+>/g, "").replace(/<img[^>]*alt="([^"]*)"[^>]*>/g, "$1").trim();
    if (!text && !/aria-label="/.test(m[1])) warn(p, `link without a name: ${m[0].slice(0, 100)}`);
  }
  const dupIds = [...h.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]).filter((v, i, a) => a.indexOf(v) !== i);
  if (dupIds.length) warn(p, `duplicate ids: ${[...new Set(dupIds)].join(", ")}`);
  if (!/<html lang="en"/.test(h)) warn(p, "no lang on <html>");
}

const kb = (n) => Math.round(n / 1024);
const weights = pages.map((p) => `${p}: ${kb(statSync(path.join(dist, p)).size)} KB`);
console.log(JSON.stringify({ pages: pages.length, problems, weights }, null, 1));
