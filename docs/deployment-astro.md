# Publishing the Astro version

How this version of the Mercy Seat Chapel website gets from GitHub to the web.
Plan and progress: [astro-migration-plan.md](astro-migration-plan.md).

## How a build works

1. `npm ci`: installs Astro (exact versions from `package-lock.json`).
2. `npm run content`: reads the published dashboard content (Sanity, read-only), saves it to
   `src/data/cms-snapshot.json`, downloads new pictures to `public/assets/cms/`, refreshes the
   YouTube lists and the Site Settings copy in `public/assets/js/main.js`.
   If Sanity can't be reached, the last saved content is used.
3. `npm run build`: writes the finished site to `dist/` (30 pages plus assets).

On this computer: `npm run content`, then `npm run build`, then `npm run preview` → http://localhost:4322.

## The preview link (now)

**https://akorsoftdesigns.github.io/Mercy-Seat-Chapel-Astro/**

- Workflow: `.github/workflows/preview.yml` ("Publish preview").
- Runs on every push to `main`, every 30 minutes, on demand (Actions → Publish preview → Run workflow),
  and when the dashboard sends a `sanity-publish` signal (optional, below).
- Built with `SITE_BASE=/Mercy-Seat-Chapel-Astro/` (the preview lives in a sub-folder) and
  `SITE_PREVIEW=1` (every page gets `noindex`, so search engines leave it out).
- One-time setting: GitHub → this repository → **Settings → Pages → Source: GitHub Actions**.
- It never uploads to SiteGround.

### Optional: update the preview the moment something is published in the dashboard

Without this, the preview catches up within 30 minutes. To make it instant, a second webhook can be
added in Sanity (manage.sanity.io → project → API → Webhooks), copying the live site's webhook but
pointing at `https://api.github.com/repos/akorsoftdesigns/Mercy-Seat-Chapel-Astro/dispatches`
with body `{"event_type": "sanity-publish"}` and a GitHub token that can only access this repository.
This is a change to the dashboard's settings, so it is made from the live site's side, only if wanted.

## The live site (at switchover only)

Workflow: `.github/workflows/publish-live.yml` ("Publish live site"). **Switched off.** It only runs when
pressed by hand, and only if the repository variable `LIVE_UPLOAD` is `true` and the SiteGround secrets
exist in this repository. None of that is set up, so it cannot upload anything today.

Switchover, when you decide (Phase 8):

1. Approve the preview link page by page.
2. Copy across any changes made to the live site since 2026-11-15 (its Git history lists them).
3. In this repository: add the SiteGround secrets (same values as the original repository) and,
   optionally, `YOUTUBE_API_KEY`; set the variable `LIVE_UPLOAD` = `true`.
4. In the original repository: switch off its "Update website from dashboard" workflow
   (Actions → workflow → ⋯ → Disable workflow). Don't delete it.
5. Here: add the push / schedule / dashboard triggers listed at the top of `publish-live.yml`, push,
   and run "Publish live site" once by hand. Spot-check www.mercyseatchapel.org.
6. Point the Sanity webhook at this repository (or keep both while checking).

The upload sends only changed files and never deletes anything on the server, so files the old site
uploaded stay in place and the server's own `.htaccess` (with `ErrorDocument 404 /404.html`) is untouched.

### Going back after switchover

Switch the original repository's workflow back on and run it (it re-uploads the old pages over the new
ones: same file names), then set `LIVE_UPLOAD` to `false` here.
