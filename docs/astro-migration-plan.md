# Astro migration plan

Status: **approved 2026-11-15.** The Astro version is an independent duplicate: its own folder (`Mercy Seat Chapel Astro`), its own Git repository and its own preview link. The live site (folder `Mercy Seat Chapel`, its `main` branch, SiteGround) is not touched.

## Progress

| Phase | Status |
|---|---|
| 1. Set-up | **Done 2026-11-15.** Own folder and repository (copied from the live site's history, then separated; the live-site workflow removed so this copy can never upload to SiteGround). Astro 7.4.12 (pinned); pages, `assets/`, `admin/`, `robots.txt`, `sitemap.xml` moved into `public/` (same addresses); `npm run build` copies all 30 pages and 201 files into `dist/`. `scripts/cms-build.mjs` now writes into `public/`. Astro's anonymous usage data is switched off on this computer. Local preview: `npm run dev` (port 4321) or `npm run preview` for the built site (port 4322). |
| 2. Shared layout + proof page | **Done 2026-11-15.** `src/data/site.js` (SITE + NAV), `src/layouts/BaseLayout.astro` (head, header, footer, scripts), `src/components/` (`Header`, `Footer`, `PageHero`, `SocialLinks`). `privacy.html` converted to `src/pages/privacy.astro`: after the scripts run it is identical to the original (whole page compared), head tags identical, checked at desktop, tablet and phone width. Contact details on the page are now written at build time. Temporary: SITE/NAV also stay in `main.js` for the unconverted pages until Phase 5, so change both. |
| 3. Static pages | **Done 2026-11-15.** 16 pages converted with `scripts/migration/convert-page.mjs`: terms, cookies, rccg, foundation-academy, seeking-his-presence, marriage-counselling, contact, give, testimonies, gallery, first-timer, membership-form, the three job pages, 404. Every page compared with its original after the scripts run: identical (gallery: same 36 photos; it shuffles on each load), menu highlight correct, one `<h1>` each, no sideways scroll at 375/768/1280 px. BaseLayout gained `robots`, `hidden` (private pages: no canonical or link-preview tags, as before), `baseHref` (404) and a `scripts` slot (form pages load `job-application.js` after `main.js`). The job pages stay three independent files. `data-site` links on these pages are still filled by `main.js`; Phase 5 fills them at build time. |
| 4. Dashboard-driven pages | **Done 2026-11-15.** All 30 pages are now Astro pages. `npm run content` (`scripts/fetch-content.mjs`) saves the published dashboard content to `src/data/cms-snapshot.json`, downloads new pictures, refreshes the YouTube lists and the Site Settings copy in `main.js`. `src/lib/cms-core.js` turns it into the same sections as before, with the same templates as the dashboard Preview (`studio/shared/render.js`, unchanged); pages show them with `<Fragment set:html={regions["name"]} />`. The events slider is built into Home and Events (no more `assets/partials/upcoming-events.html` download). `SITE` contact details now come from the dashboard's Site Settings. Retired: `scripts/cms-build.mjs` and the `<!-- cms:… -->` markers. All 13 pages compared with originals refreshed from today's content: identical (homepage: only invisible whitespace left by the old markers differs); one `<h1>` each; no sideways scroll at 375/768/1280 px; no broken images. |
| 5. Clean-up of browser scripts | **Done 2026-11-15.** `data-site` contact details are filled while the site is built (`src/lib/fill-site.js`, run on every page's content by BaseLayout), so they are in the HTML without JavaScript. Removed from `main.js` (1,110 → 906 lines): `NAV`, header/footer drawing, `fillSiteData`, `loadIncludes`, social-icon helpers. `SITE` stays in `main.js` (video players, form messages) and is kept current by `npm run content`. Search keeps reading pages in the browser; its extra page list comes from the menu in `src/data/site.js` (`data-pages` on the search panel), so `main.js` no longer repeats the menu. A build-time search index was not needed. All 30 pages compared with the Phase 4 build after the scripts run: identical. Search, dropdowns and the phone menu tested. |
| 6. Automatic updates and the preview link | **Done 2026-11-15** (guide: `docs/deployment-astro.md`). `preview.yml` ("Publish preview"): content → build → GitHub Pages, on push, every 30 minutes, on demand and on a dashboard `sanity-publish` signal; current action versions (checkout v7, setup-node v7, upload-pages-artifact v5, deploy-pages v5); preview pages are `noindex`. `publish-live.yml` ("Publish live site"): content → build → rsync `dist/` to SiteGround, **switched off** (manual only, needs `LIVE_UPLOAD=true` and SiteGround secrets in this repository, none set). Pages switched on (Source = GitHub Actions) on 2026-11-15; the preview link is live. |
| 7. Full check | **Done 2026-11-15.** **Sitemap:** now written at every build by `src/pages/sitemap.xml.js` at the same address `robots.txt` points to (instead of the add-on, which would have changed the address). The same 25 public pages and priorities as before; private pages left out automatically; dates from each page's Git history (the workflows fetch full history). **Links:** every internal link, picture, background image and `#section` on all 30 pages resolves. **SEO:** one `<h1>`, title and description on every page; canonical, Open Graph and Twitter tags on all 25 public pages, with existing preview images; the 5 private pages are `noindex`; `viewport-fit=cover` everywhere. **Accessibility:** every image has alt text, every form field a label, every button and link a name; no duplicate ids; `lang="en"`. **Forms (all 9):** Contact message, Prayer request, Marriage counselling and Testimony block empty sends and show their confirmation; First Timer (4 steps), Membership (5) and the three job applications (6, with a résumé) block empty steps, can be completed to the review step, and keep Submit off with the "contact the church office" note, as before. **Weight:** HTML is about 7.5 KB larger per page (header and footer are now in the page; roughly 2 KB after the server's compression), `main.js` is 12 KB smaller and Home/Events no longer download the slider file, so a first visit loads about the same and paints sooner. **Mobile app:** all 16 pages it opens exist, including `contact.html#prayer`. **Live site since 2026-11-15:** one automatic dashboard update only (picked up by `npm run content`); no hand edits to copy. Not covered: a Lighthouse score (no tool here) and a visual check on real phones, which is best done on the preview link once Pages is on. |
| 8. Switchover | Only when you decide |


Decision 2 below (sitemap add-on) is taken as recommended unless you say otherwise. Decisions 3 and 4 no longer apply: the live site is independent, so no edit freeze, and its GitHub Pages setting is not touched.

## Goal

Rebuild the Mercy Seat Chapel website with [Astro](https://astro.build) so that:

- the header, footer, `<head>` tags and page banner are written once and shared by every page;
- dashboard (Sanity) content is read straight into the pages when the site is built, instead of being pasted between `<!-- cms:… -->` markers;
- pages arrive complete from the server (faster first paint, no header "flash", better for search engines).

What must **not** change for visitors: the look, every page address (`about.html`, `give.html`, …), the forms' behaviour, the dashboard, and the mobile app's links.

## Ground rules

1. **Independent duplicate.** All work happens in the separate folder `Mercy Seat Chapel Astro`, its own Git repository (GitHub: `akorsoftdesigns/Mercy-Seat-Chapel-Astro`, public, published 2026-11-15) with its own preview link on GitHub Pages. The live site's folder, repository and SiteGround upload keep running exactly as now.
2. **Same addresses.** Astro is set to output `about.html` style files (`build.format: "file"`). Every current page keeps its file name.
3. **Same design.** `style.css`, the design tokens and `design-system.md` carry over unchanged. Visual changes are out of scope.
4. **Same dashboard.** The Sanity schemas and Studio are untouched. The HTML templates in `studio/shared/render.js` are reused by Astro, so the dashboard's live Preview and the website keep producing identical HTML.
5. **No new services.** Hosting stays SiteGround (live) and GitHub Pages (staging). Astro is a build tool only; it adds no server, analytics or paid service.
6. **One page at a time, compared against the original** before the next batch starts.

## What each current piece becomes

| Today | In Astro |
|---|---|
| 30 `.html` files in the root | `src/pages/*.astro` (same names; mostly the same HTML) |
| `<head>` copied into every page (SEO, Open Graph, favicon, fonts) | One `BaseLayout.astro`; each page passes only its title, description, banner image and `noindex` if needed. Canonical URL is worked out from the page address. |
| Header and footer drawn by `main.js` after load | `Header.astro` and `Footer.astro`, written into the HTML at build time |
| `SITE` / `NAV` at the top of `main.js` | `src/data/site.js` (single source of truth). Used by the layout at build time and passed to the browser for the few scripts that still need it. Dashboard **Site Settings** are merged in at build time. |
| `data-site="phone"` etc. filled by JavaScript | Filled at build time (works even with JavaScript off) |
| `<!-- cms:name -->` regions + `scripts/cms-build.mjs` | `src/lib/cms.js` fetches the published content once per build; pages call the existing `render.js` functions. The markers disappear. |
| `assets/partials/upcoming-events.html` loaded with `fetch` | `UpcomingEvents.astro`, included at build time (no extra request) |
| Sanity images downloaded into `assets/cms/` | Same downloader, kept as a pre-build step (no new external requests from visitors' browsers) |
| YouTube lists (`youtube-*.json`, refreshed from RSS) | Same refresh, split into `scripts/youtube-refresh.mjs`, run before the build |
| Site search fetches pages in the browser | A small search index (`search.json`) generated at build time |
| `assets/js/main.js` (1,110 lines) | Kept, minus header/footer/`data-site` rendering. Sliders, gallery, flipbook, forms, animations stay as they are. |
| `assets/js/job-application.js`, `FORM_SETTINGS` | Unchanged. The three `job-*.html` pages stay three **independent** pages, as now. |
| `assets/css/style.css` | Unchanged (moves to `public/assets/css/`, same address) |
| `assets/images/`, `assets/data/` | `public/assets/…` (same addresses) |
| `sitemap.xml`, `robots.txt` | Sitemap generated at build from the public pages (private/noindex pages left out automatically); `robots.txt` unchanged |
| `404.html` with `<base href="/">` | `src/pages/404.astro` (no `<base>` trick needed) |
| `.claude/serve.js` on port 5527 | `npm run dev` (Astro dev server, auto-refresh) and `npm run preview` for the built site |

## Phases

### 1. Set-up (half a day)
- Create branch `astro` from `main`.
- Add `package.json` in the root with Astro (exact version pinned) and the official sitemap integration. Nothing else.
- `astro.config.mjs`: static output, `build.format: "file"`, site `https://www.mercyseatchapel.org`.
- Move `assets/` into `public/assets/` (addresses unchanged).
- Add `msc-astro` to `.claude/launch.json`.

**Done when:** `npm run build` produces a `dist/` folder and the old `.html` pages still open from it.

### 2. Shared layout + one proof page (1 day)
- `BaseLayout.astro`, `Head.astro`, `Header.astro`, `Footer.astro`, `PageHero.astro`, `src/data/site.js`.
- Convert `privacy.html` (simple page) and compare with the original at desktop, tablet and phone width.

**Done when:** the new `privacy.html` looks and behaves the same, with identical SEO tags, and the menu, search, phone menu and gesture-bar spacing work.

### 3. Static pages (2–3 days)
Batches, each checked before the next:
- **a.** `terms`, `cookies`, `rccg`, `foundation-academy`, `seeking-his-presence`, `marriage-counselling`, `contact`, `give`, `testimonies`
- **b.** `gallery`, `first-timer`, `membership-form` (noindex, never linked), the three `job-*` pages
- **c.** `404`

### 4. Dashboard-driven pages (2–3 days)
- `src/lib/cms.js`: the same Sanity queries `cms-build.mjs` uses today, run once per build.
- Convert `index`, `about`, `our-vision-values`, `become-a-member`, `leadership`, `ministries`, `departments`, `outreach`, `events`, `plan-a-visit`, `sermons`, `live`, `job-center`.
- Homepage schema.org `Church` data, hero slider, "What's happening" slider, next-date badges and the Plan a Visit gatherings sentence all come from the same `render.js` functions.

**Done when:** publishing a change in the dashboard and rebuilding shows it on the right page, and the dashboard Preview still matches.

### 5. Clean-up of browser scripts (1 day)
- Remove header/footer/`data-site` rendering and the partial `fetch` from `main.js`; switch search to `search.json`.
- Remove `scripts/cms-build.mjs` and the markers (kept in Git history).

### 6. Automatic updates and the preview link (1 day)
Until switchover, this repository's Action only builds and publishes the **preview link** (GitHub Pages of this repository, `https://akorsoftdesigns.github.io/Mercy-Seat-Chapel-Astro/`; Astro's `base` setting handles that sub-folder; the preview carries a "don't index" tag so search engines leave it out). It never uploads to SiteGround. At switchover the same Action gains the SiteGround upload:
- Same triggers: dashboard publish (webhook), **every 30 minutes** (keeps the slider, next-date badges and YouTube lists current), push to `main`, manual run.
- Steps: refresh YouTube lists → download dashboard images → `astro build` → upload `dist/` to SiteGround with rsync (only changed files are sent; nothing deleted on the server).
- Generated pages are **no longer committed back** to GitHub (no more "Website update from the content dashboard" commits to merge around).
- GitHub Pages staging deploys `dist/` from the Action. One setting changes: GitHub → Settings → Pages → Source = "GitHub Actions" (done at switchover, by you or with you).
- The Sanity webhook stays exactly as it is.

### 7. Full check (1–2 days)
- Every page at desktop, tablet and phone width against the live site, including dark-mode favicon and the phone gesture bar.
- Every form: validation, steps, confirmation message (they still send nothing until a form handler is chosen).
- Link check across the site; SEO tags, canonical, Open Graph and sitemap per page; one `<h1>` per page; accessibility spot checks (keyboard, focus, alt text).
- Page weight and Lighthouse score before vs after.
- Mobile app: every link it opens (`contact.html#prayer`, `first-timer.html`, `privacy.html`, `terms.html`, `give.html`, `marriage-counselling.html`, `leadership.html`, `our-vision-values.html`, `become-a-member.html`) still resolves.

### 8. Switchover (only when you decide)
1. You approve the Astro preview link.
2. SiteGround secrets are added to this repository; the old repository's Action stops uploading (its workflow is switched off, not deleted).
3. This repository's Action builds and uploads. Spot-check the live site.
4. Update `CLAUDE.md`, `docs/cms/*`, `design-system.md` references and the editing guide. The old repository is kept as an archive.

**Rough total: 9–12 working days**, spread over sessions.

## During the migration

- **Dashboard edits:** carry on as normal. Both versions read the same Sanity content.
- **Hand edits to the live site:** carry on as needed; the live site stays fully independent. Before switchover, changes made there since 2026-11-15 are copied across to this version (Git history of the live repository lists them).
- **Dashboard (Studio) itself:** deployed only from the live site's folder. This copy reads Sanity and never writes to it.
- **Mobile app:** no change needed. Addresses stay the same and the app reads Sanity directly. If a page address ever has to change, the app's `src/lib/config.ts` is updated in the same piece of work.

## How to reverse

- **Before switchover:** delete this folder (and its GitHub repository). The live site is untouched.
- **After switchover:** switch the old repository's workflow back on and run it; it uploads the old pages (same file names, so they simply overwrite). Switch off this repository's SiteGround upload.

## Editing after the move (non-developers)

- Most updates stay in the dashboard, unchanged.
- Page text that isn't in the dashboard lives in `src/pages/<page>.astro`, which is still plain HTML below a short header block. A one-page "how to edit a page" guide will be added to `docs/`.
- Phone, email, address, social links, service times, giving URL: `src/data/site.js` (or Site Settings in the dashboard), one place, as now.
- Gallery photos: still a plain list in `gallery.astro`; copy an `<li>` to add one.
- Every edit now goes through a build. The GitHub Action does this automatically on push, so the workflow from GitHub Desktop stays the same.

## Decisions for you

1. **Approve this plan** (or tell me what to change).
2. **Sitemap integration:** OK to use Astro's official sitemap add-on instead of the hand-written `sitemap.xml`? (Recommended: it can't fall out of date.)
3. **Hand-edit freeze:** OK to avoid hand edits to page HTML on `main` while the migration runs?
4. **GitHub Pages setting:** OK to switch staging to "GitHub Actions" at switchover?
