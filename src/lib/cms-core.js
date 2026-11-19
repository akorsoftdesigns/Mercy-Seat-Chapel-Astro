/* ==========================================================================
   Mercy Seat Chapel: dashboard content for the pages
   Turns the saved dashboard content (src/data/cms-snapshot.json, written by
   scripts/fetch-content.mjs) into the HTML sections the pages show, using the
   same templates as the dashboard's Preview (studio/shared/render.js).

   Pages don't use this file directly: they import src/lib/cms.js.
   scripts/fetch-content.mjs uses it to find pictures to download.

   The same logic was previously in scripts/cms-build.mjs, which pasted these
   sections between <!-- cms:name --> markers; the section names are unchanged.
   ========================================================================== */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import * as R from "../../studio/shared/render.js";
import { todayInChurchTz } from "../../studio/shared/schedule.js";
import { youtubeId } from "../../studio/shared/youtube.js";

export const ROOT = process.cwd();
export const PUBLIC = path.join(ROOT, "public");
export const SNAPSHOT = path.join(ROOT, "src/data/cms-snapshot.json");
const readJson = (file, fallback) => (existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : fallback);

/* ---------- Site Settings (dashboard) → SITE values ---------- */
export function siteSettings(s) {
  const digits = (v) => String(v || "").replace(/\D/g, "");
  const phone = digits(s.phone);
  const [dial, code] = String(s.prayerLineDial || "").split(",").map(digits);
  const social = Object.fromEntries(["youtube", "instagram", "facebook", "twitter", "tiktok"].map((k) => [k, s.social?.[k] || "#"]));
  return {
    phone: s.phone || "",
    phoneHref: phone ? `tel:+${phone.length === 10 ? "1" + phone : phone}` : "",
    prayerLine: s.prayerLine || "",
    prayerLineHref: dial ? `tel:+${dial}${code ? `,,${code}#` : ""}` : "",
    email: s.email || "",
    address: s.address || "",
    mailingAddress: s.mailingAddress || "",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=" + String(s.address || "").replace(/,/g, "").trim().split(/\s+/).map(encodeURIComponent).join("+"),
    givingUrl: s.givingUrl || "",
    appStoreUrl: s.appStoreUrl || "#",
    playStoreUrl: s.playStoreUrl || "#",
    youtubeChannelId: s.youtubeChannelId || "",
    liveVideoId: youtubeId(s.liveVideo),
    youtubeLiveUrl: s.youtubeLiveUrl || "",
    social,
    times: (s.serviceTimes || []).map(({ label, time }) => ({ label, time }))
  };
}

/* ---------- Pictures and files ----------
   A picture already in public/assets/images (same file contents) is used from there.
   Other uploads are saved once in public/assets/cms/ by scripts/fetch-content.mjs
   ("pending" lists the ones it still has to download). */
function localIndex() {
  const out = {}, dir = path.join(PUBLIC, "assets/images");
  for (const f of readdirSync(dir)) {
    try { out[createHash("sha1").update(readFileSync(path.join(dir, f))).digest("hex")] = `assets/images/${f}`; } catch { /* folder */ }
  }
  return out;
}

function makeResolver(assets, localBySha1) {
  const cache = new Map(), pending = [];
  const resolve = (ref, crop, kind) => {
    if (!ref) return "";
    if (typeof ref === "string" && ref.startsWith("local:")) return ref.slice(6); // seed files point at local pictures
    const key = ref + JSON.stringify(crop || {});
    if (cache.has(key)) return cache.get(key);
    const a = assets[ref];
    if (!a) { cache.set(key, ""); return ""; }
    let out = !crop && localBySha1[a.sha1hash];
    if (!out) {
      const isImage = kind === "image" && !["svg", "gif"].includes(a.extension);
      const name = `${ref.replace(/^(image|file)-/, "").slice(0, 40)}${crop ? "-c" + createHash("sha1").update(JSON.stringify(crop)).digest("hex").slice(0, 6) : ""}.${isImage ? "webp" : a.extension}`;
      out = `assets/cms/${name}`;
      let src = a.url;
      if (isImage) {
        const p = new URLSearchParams({ w: "1600", fit: "max", fm: "webp", q: "80" });
        if (crop) p.set("rect", crop);
        src += "?" + p;
      }
      pending.push({ src, out });
    }
    cache.set(key, out);
    return out;
  };
  return { resolve, pending };
}

// Sanity stores crops as fractions; the image service wants a pixel rectangle
function cropRect(img, assets) {
  const c = img?.crop, a = assets[img?.asset?._ref];
  if (!c || !a || !(c.top || c.bottom || c.left || c.right)) return null;
  const m = a._id.match(/-(\d+)x(\d+)-/);
  if (!m) return null;
  const [w, h] = [Number(m[1]), Number(m[2])];
  const x = Math.round(c.left * w), y = Math.round(c.top * h);
  return `${x},${y},${Math.round(w - x - c.right * w)},${Math.round(h - y - c.bottom * h)}`;
}

// Seed files point at pictures as "image@file:///…/assets/images/x.jpg"
function localPathFromSeed(s) {
  const p = decodeURI(String(s).replace(/^(image|file)@file:\/\//, "")).replace(/\\/g, "/");
  const i = p.lastIndexOf("/assets/");
  return i >= 0 ? p.slice(i + 1) : p;
}

/* ---------- All page sections from one snapshot ----------
   snapshot: { docs, assets, youtubeLive? }   youtube: { uploads, streams }
   Returns { site, regions, pending }. A section is left out (undefined) when there is no content for it. */
export function buildCms(snapshot, youtube = {}, today = todayInChurchTz()) {
  const { docs = [], assets = {} } = snapshot || {};
  const regions = {};
  const byType = (t) => docs.filter((d) => d._type === t);
  const byId = Object.fromEntries(docs.map((d) => [d._id, d]));
  const deref = (refs) => (refs || []).map((r) => byId[r?._ref]).filter((d) => d && !d.archived);
  const sorted = (list) => [...list].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

  const { resolve, pending } = makeResolver(assets, localIndex());
  const site = byId.siteSettings ? siteSettings(byId.siteSettings) : null;
  // Live stream chosen by scripts/fetch-content.mjs (live now → starting soon → dashboard link → latest)
  if (site && snapshot.youtubeLive?.liveVideoId !== undefined) site.liveVideoId = snapshot.youtubeLive.liveVideoId;

  const c = {
    site: site || {},
    img: (image) => {
      if (!image) return { src: "" };
      const ref = image.asset?._ref || (image._sanityAsset ? "local:" + localPathFromSeed(image._sanityAsset) : "");
      return { src: resolve(ref, cropRect(image, assets), "image"), pos: R.cssPosition(image.hotspot) };
    },
    link: (l) => {
      if (!l) return { href: "#" };
      if (l.page) return { href: l.page, newTab: !!l.newTab };
      if (l.url) return { href: l.url, newTab: l.newTab ?? /^https?:/.test(l.url) };
      const f = l.file?.asset?._ref || (l.file?._sanityAsset ? "local:" + localPathFromSeed(l.file._sanityAsset) : "");
      if (f) return { href: resolve(f, null, "file"), newTab: true };
      return { href: "#" };
    }
  };

  // ---- Shared details ----
  if (site) regions["church-schema"] = R.churchSchema(site);

  // ---- Events & announcements ----
  const events = byType("event").filter((e) => !e.archived);
  const live = (e) => R.specialEventDue(e, today);
  // Regular gatherings marked "Show in slider" join it a few days before their next date and stay until the end of that day
  const dueRecurring = events.filter((e) => e.kind === "recurring" && e.inSlider && !e.archived).map((e) => R.recurringAsSlide(e, today)).filter(Boolean);
  const slides = [
    ...byType("announcement").filter((a) => a.featured && (a.image?.asset || a.image?._sanityAsset) && R.announcementDue(a, byId[a.relatedEvent?._ref], today))
      .sort((a, b) => (a.publishDate < b.publishDate ? 1 : -1))
      .map((a) => R.announcementAsSlide({ ...a, relatedEvent: byId[a.relatedEvent?._ref] })),
    ...[...events.filter((e) => live(e) && e.featured !== false), ...dueRecurring].sort((a, b) => (a.startDate < b.startDate ? -1 : 1))
  ];
  if (byType("event").length || byType("announcement").length) regions["upcoming-events"] = R.upcomingEventsPartial(c, slides);
  const regular = sorted(events.filter((e) => e.kind === "recurring" && e.listed !== false && e.recurrence?.frequency !== "yearly" && (!e.recurrence?.endsOn || e.recurrence.endsOn >= today)));
  const seasonal = sorted(events.filter((e) => e.kind === "recurring" && e.listed !== false && e.recurrence?.frequency === "yearly"));
  if (regular.length) {
    regions["events-regular"] = regular.map((e) => R.eventRow(c, e, today)).join("\n");
    regions["visit-gatherings"] = R.gatheringsSentence(regular);
  }
  if (seasonal.length) regions["events-seasonal"] = seasonal.map((e, i) => R.seasonalCard(c, e, i)).join("\n");

  // ---- Homepage ----
  const home = byId.homepage;
  if (home) {
    const h = R.heroParts(c, home);
    if (h.slides) Object.assign(regions, { "hero-slides": h.slides, "hero-texts": h.texts, "hero-thumbs": h.thumbs });
    if (home.kicker) regions["hero-kicker"] = h.kicker;
    if (h.buttons) regions["hero-buttons"] = h.buttons;
    const times = deref(home.serviceTimes);
    if (times.length) regions["service-times"] = times.map((e, i) => R.timeCard(c, e, i)).join("\n");
    const liveTimes = deref(home.liveSchedule);
    if (liveTimes.length) regions["live-schedule"] = liveTimes.map((e, i) => R.liveCard(c, e, i)).join("\n");
    const mins = deref(home.featuredMinistries);
    if (mins.length) regions["place-tabs"] = R.placeTabs(c, mins);
    const outs = deref(home.featuredOutreach);
    if (outs.length) regions["outreach-cards"] = outs.map((o, i) => R.outreachHomeCard(c, o, i)).join("\n");
  }

  // ---- Vision & pillars (Our Vision & Values), journey & membership call to action (Become a Member) ----
  const about = byId.aboutPage;
  if (about) {
    if (about.values?.length) regions["about-vision"] = R.aboutVision(c, about);
    if (about.pillars?.length) regions["about-pillars"] = R.aboutPillars(about);
    if (about.journeySteps?.length) regions["about-journey"] = R.aboutJourney(about);
    if (about.ctaHeading) regions["about-cta"] = R.aboutCta(c, about);
  }

  // ---- Ministries, departments, outreach, leaders, jobs ----
  const visible = (t) => sorted(byType(t).filter((d) => !d.archived));
  if (visible("ministry").length) regions.ministries = R.zzRows(c, visible("ministry"));
  if (visible("department").length) regions.departments = R.zzRows(c, visible("department"));
  if (visible("outreach").length) {
    regions["outreach-rows"] = R.zzRows(c, visible("outreach"));
    regions["outreach-overview"] = visible("outreach").filter((o) => o.overviewTitle).map(R.outreachOverviewCard).join("\n");
  }
  if (visible("leader").length) {
    regions["leaders-summary"] = visible("leader").map((l, i) => R.leaderCardHtml(c, l, i)).join("\n");
    regions.leaders = visible("leader").map((l) => R.leaderHtml(c, l)).join("\n");
  }
  if (byType("job").length) {
    const open = sorted(byType("job").filter((j) => j.status === "open" && j.page && (!j.deadline || j.deadline >= today)));
    regions.jobs = R.jobsHtml(open);
  }

  // ---- Sermons ----
  // The Sermons page "Teaching series" comes from the MSC Sermons YouTube channel (below), so the
  // dashboard's Sermons no longer fill a page section (the mobile app still lists them).
  // To bring them back: regions["sermons-more"] = sermons.map((s, i) => R.sermonCard(c, s, i)).join("\n")

  // ---- YouTube lists (saved by scripts/fetch-content.mjs) ----
  const name = "Mercy Seat Chapel";
  const { uploads = [], streams = [], sermons = [] } = youtube;
  if (streams.length) regions["latest-messages"] = R.messagesHtml(streams.slice(0, 5), name);
  // Sermons page: one big player with the newest video, and the MSC Sermons livestreams (newest first)
  if (uploads.length) regions["sermon-feature"] = R.sermonFeature(uploads[0], name);
  if (sermons.length) regions["teaching-series"] = sermons.slice(0, 12).map((v, i) => R.teachingCard(v, i, "MSC Sermons")).join("\n");
  const replays = streams.filter((v) => v.id !== site?.liveVideoId).slice(0, 4);
  if (replays.length) regions["recent-livestreams"] = replays.map(R.streamCard).join("\n");

  return { site, regions, pending };
}
