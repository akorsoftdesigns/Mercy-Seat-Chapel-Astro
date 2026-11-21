#!/usr/bin/env node
/* ==========================================================================
   Mercy Seat Chapel: fetch the dashboard content before a build
   Reads published content from Sanity (public, read-only: no keys needed) and saves:
     - src/data/cms-snapshot.json      what the pages are built from (src/lib/cms.js)
     - public/assets/cms/…             new dashboard pictures, downloaded once
     - public/assets/data/youtube-*.json, youtube-live.json, content.json
     - SITE_SETTINGS in public/assets/js/main.js (still used in the browser)
   Then `npm run build` turns it into pages. `npm run content` runs this script.

       node scripts/fetch-content.mjs                    (needs SANITY_PROJECT_ID, default 1eb6wyfe)
       node scripts/fetch-content.mjs --data seed.json   (offline, from a file)
       options: --no-youtube  --dry-run

   Safe by design: if Sanity can't be reached, nothing is changed and the last saved
   content is built; if YouTube's feed is down, the video lists keep their last version.
   Replaces scripts/cms-build.mjs (which pasted sections between <!-- cms:name --> markers).
   ========================================================================== */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { TIME_ZONE } from "../studio/shared/schedule.js";
import { youtubeId } from "../studio/shared/youtube.js";
import { buildCms, PUBLIC, SNAPSHOT } from "../src/lib/cms-core.js";

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const opt = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const DRY = flag("--dry-run");
const API_VERSION = "v2025-02-19";
const TYPES = ["siteSettings", "homepage", "aboutPage", "announcement", "event", "sermon", "ministry", "department", "outreach", "leader", "job"];
const log = (...a) => console.log("[content]", ...a);
const written = [];
async function save(file, content) {
  const prev = existsSync(file) ? await readFile(file, "utf8") : null;
  if (prev === content) return;
  if (!DRY) { await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, content); }
  written.push(path.relative(process.cwd(), file));
}
const json = (v) => JSON.stringify(v, null, 1) + "\n";

/* ---------- 1. Published content ---------- */
async function loadFromSanity() {
  const projectId = process.env.SANITY_PROJECT_ID || "1eb6wyfe", dataset = process.env.SANITY_DATASET || "production";
  const query = `{"docs": *[_type in $types], "assets": *[_type in ["sanity.imageAsset","sanity.fileAsset"]]{_id, url, sha1hash, extension, originalFilename}}`;
  const url = `https://${projectId}.apicdn.sanity.io/${API_VERSION}/data/query/${dataset}?query=${encodeURIComponent(query)}&$types=${encodeURIComponent(JSON.stringify(TYPES))}&perspective=published`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sanity answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const { result } = await res.json();
  return { docs: result.docs, assets: Object.fromEntries(result.assets.map((a) => [a._id, a])) };
}

async function loadFromFile(file) {
  const raw = await readFile(path.resolve(file), "utf8");
  const docs = file.endsWith(".ndjson") ? raw.split("\n").filter(Boolean).map((l) => JSON.parse(l)) : JSON.parse(raw);
  return { docs: docs.filter((d) => !String(d._id).startsWith("drafts.")), assets: {} };
}

/* ---------- 2. Which stream is live (YouTube Data API) ----------
   Uses the YOUTUBE_API_KEY secret, which exists only inside GitHub Actions. The key is never
   written into any file, page or log: only the chosen video ID is saved. No key = skipped, and
   the dashboard's "Current livestream link" is used. Costs 3 of 10,000 free daily quota units. */
async function youtubeLive(channel, key) {
  const api = async (endpoint, params) => {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/${endpoint}?${new URLSearchParams({ ...params, key })}`).catch(() => null);
    if (!res?.ok) throw new Error(`YouTube API ${endpoint} answered ${res ? res.status : "nothing"}`); // (message never includes the key)
    return res.json();
  };
  const lists = await Promise.all(["UU", "UULV"].map((p) =>
    api("playlistItems", { part: "contentDetails", playlistId: p + channel.slice(2), maxResults: "5" })));
  const ids = [...new Set(lists.flatMap((l) => (l.items || []).map((i) => i.contentDetails?.videoId)).filter(Boolean))];
  if (!ids.length) return { live: "", latest: "" };
  const { items = [] } = await api("videos", { part: "snippet,liveStreamingDetails", id: ids.join(",") });
  // The most recent livestream that has finished (scheduled, not-yet-started streams are ignored)
  const latest = items.filter((v) => v.liveStreamingDetails?.actualEndTime)
    .sort((a, b) => Date.parse(b.liveStreamingDetails.actualEndTime) - Date.parse(a.liveStreamingDetails.actualEndTime))[0];
  return { live: items.find((v) => v.snippet?.liveBroadcastContent === "live")?.id || "", latest: latest?.id || "" };
}

/* ---------- 2b. A channel's livestreams (its YouTube "Live" tab), newest first ----------
   With the YouTube API key: up to 25, dated by when each stream started, scheduled streams
   that haven't started left out (2 quota units). Without it, or if the API fails: YouTube's
   public feed (15 newest). Only video IDs, titles and dates are saved. */
const churchDay = (iso) => new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
async function channelStreams(channel, key) {
  if (key) {
    try {
      const api = async (endpoint, params) => {
        const res = await fetch(`https://www.googleapis.com/youtube/v3/${endpoint}?${new URLSearchParams({ ...params, key })}`).catch(() => null);
        if (!res?.ok) throw new Error(`YouTube API ${endpoint} answered ${res ? res.status : "nothing"}`); // (message never includes the key)
        return res.json();
      };
      const list = await api("playlistItems", { part: "contentDetails", playlistId: "UULV" + channel.slice(2), maxResults: "25" });
      const ids = (list.items || []).map((i) => i.contentDetails?.videoId).filter(Boolean);
      if (!ids.length) return [];
      const { items = [] } = await api("videos", { part: "snippet,liveStreamingDetails", id: ids.join(",") });
      return items.filter((v) => v.snippet?.liveBroadcastContent !== "upcoming")
        .map((v) => { const published = v.liveStreamingDetails?.actualStartTime || v.snippet.publishedAt; return { id: v.id, title: v.snippet.title, published, date: churchDay(published) }; })
        .sort((a, b) => (a.published < b.published ? 1 : -1));
    } catch (e) {
      console.warn("[content] YouTube API unavailable for channel streams, using the public feed:", e.message);
    }
  }
  return youtubeFeed(channel, true);
}

/* ---------- 2c. The channel's playlists, for the Watch Live filter buttons ----------
   "Sunday Service" first, then the other playlists by their newest video; only playlists with a
   video in the last PLAYLIST_MAX_AGE_DAYS days, at most PLAYLIST_BUTTONS (same as the live site). */
const PLAYLIST_BUTTONS = 10, PLAYLIST_MAX_AGE_DAYS = 365, PLAYLIST_FIRST = /^sunday service$/i;
async function channelPlaylists(channel, key) {
  const api = async (endpoint, params) => {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/${endpoint}?${new URLSearchParams({ ...params, key })}`).catch(() => null);
    if (!res?.ok) throw new Error(`YouTube API ${endpoint} answered ${res ? res.status : "nothing"}`); // (message never includes the key)
    return res.json();
  };
  // Every public playlist on the channel (50 per page; up to 200), so new ones are picked up automatically
  const lists = [];
  for (let page = 0, pageToken = ""; page < 4; page++) {
    const r = await api("playlists", { part: "snippet", channelId: channel, maxResults: "50", ...(pageToken && { pageToken }) });
    lists.push(...(r.items || []));
    if (!(pageToken = r.nextPageToken)) break;
  }
  // Every video in a playlist, newest first (private and deleted videos left out; up to 2,000)
  const playlistVideos = async (playlistId) => {
    const videos = [];
    for (let page = 0, pageToken = ""; page < 40; page++) {
      const r = await api("playlistItems", { part: "snippet,contentDetails", playlistId, maxResults: "50", ...(pageToken && { pageToken }) });
      for (const it of r.items || []) {
        const published = it.contentDetails?.videoPublishedAt;
        if (published) videos.push({ id: it.contentDetails.videoId, title: it.snippet.title, published, date: churchDay(published) });
      }
      if (!(pageToken = r.nextPageToken)) break;
    }
    return videos.sort((a, b) => (a.published < b.published ? 1 : -1));
  };
  const out = [];
  for (const p of lists) {
    const videos = await playlistVideos(p.id);
    if (videos.length) out.push({ id: p.id, title: p.snippet.title.trim(), latest: videos[0].published, videos });
  }
  const since = new Date(Date.now() - PLAYLIST_MAX_AGE_DAYS * 864e5).toISOString();
  const playlists = out.filter((p) => PLAYLIST_FIRST.test(p.title) || p.latest >= since)
    .sort((a, b) => (PLAYLIST_FIRST.test(b.title) - PLAYLIST_FIRST.test(a.title)) || (a.latest < b.latest ? 1 : -1))
    .slice(0, PLAYLIST_BUTTONS);
  // "All" = every video on the channel (its uploads list)
  return { all: await playlistVideos("UU" + channel.slice(2)), playlists };
}

/* ---------- 3. YouTube lists (RSS) ---------- */
const xmlText = (s) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
async function youtubeFeed(channel, streams) {
  const q = streams ? "playlist_id=UULV" + channel.slice(2) : "channel_id=" + channel;
  let res; // YouTube's feed sometimes answers 404 for a while; try a few times, then give up until the next run
  for (let attempt = 1; attempt <= 3; attempt++) {
    res = await fetch("https://www.youtube.com/feeds/videos.xml?" + q).catch(() => null);
    if (res?.ok) break;
    if (attempt < 3) await new Promise((r) => setTimeout(r, 3000 * attempt));
  }
  if (!res?.ok) throw new Error(`YouTube feed ${res ? res.status : "unreachable"}`);
  const xml = await res.text();
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, e]) => {
    const published = (e.match(/<published>([^<]+)/) || [])[1];
    return { id: (e.match(/<yt:videoId>([^<]+)/) || [])[1], title: xmlText((e.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || ""), published, date: published ? ymd.format(new Date(published)) : "" };
  }).filter((v) => v.id && v.date).sort((a, b) => (a.published < b.published ? 1 : -1));
}

/* ---------- 4. SITE_SETTINGS in main.js (browser copy of the Site Settings) ---------- */
function siteJs(v) {
  const val = (x) => (Array.isArray(x) ? `[\n${x.map((o) => `    ${obj(o)}`).join(",\n")}\n  ]` : typeof x === "object" ? obj(x) : JSON.stringify(x));
  const obj = (o) => `{ ${Object.entries(o).map(([k, x]) => `${k}: ${JSON.stringify(x)}`).join(", ")} }`;
  return `const SITE_SETTINGS = {\n${Object.entries(v).map(([k, x]) => `  ${k}: ${val(x)}`).join(",\n")}\n};`;
}
async function updateMainJs(site) {
  const file = path.join(PUBLIC, "assets/js/main.js");
  const src = await readFile(file, "utf8");
  const [open, close] = ["/* cms:site-settings */", "/* /cms:site-settings */"];
  const start = src.indexOf(open), end = src.indexOf(close);
  if (start < 0 || end < start) return console.warn("[content] SITE_SETTINGS markers not found in main.js; left unchanged");
  await save(file, src.slice(0, start) + open + "\n" + siteJs(site) + "\n" + src.slice(end));
}

/* ---------- Main ---------- */
async function main() {
  const source = opt("--data");
  const { docs, assets } = source ? await loadFromFile(source) : await loadFromSanity();
  log(`loaded ${docs.length} published items${source ? ` from ${source}` : " from Sanity"}`);
  const settings = docs.find((d) => d._id === "siteSettings");
  const channel = settings?.youtubeChannelId;

  // Live stream for the Watch Live player: live now → most recent finished livestream
  // (the dashboard's "Current livestream link" only as a fallback when YouTube finds neither)
  let youtubeLiveChoice;
  const ytKey = process.env.YOUTUBE_API_KEY;
  if (settings && ytKey && channel && !flag("--no-youtube")) {
    try {
      const yt = await youtubeLive(channel, ytKey);
      const dashboard = youtubeId(settings.liveVideo);
      const liveVideoId = yt.live || yt.latest || dashboard || "";
      const status = yt.live ? "live" : yt.latest ? "latest" : dashboard ? "dashboard" : "none";
      youtubeLiveChoice = { liveVideoId, status };
      await save(path.join(PUBLIC, "assets/data/youtube-live.json"), json(youtubeLiveChoice)); // public, no key: the mobile app reads it
      log(`YouTube live: ${status}${liveVideoId ? ` (${liveVideoId})` : ""}`);
    } catch (e) { console.warn("[content] YouTube live check failed; using the dashboard's livestream link:", e.message); }
  }

  // YouTube lists
  const youtube = {};
  if (!flag("--no-youtube") && channel) {
    try {
      [youtube.uploads, youtube.streams] = await Promise.all([youtubeFeed(channel, false), youtubeFeed(channel, true)]);
      await save(path.join(PUBLIC, "assets/data/youtube-uploads.json"), json(youtube.uploads));
      await save(path.join(PUBLIC, "assets/data/youtube-streams.json"), json(youtube.streams));
      log(`YouTube: ${youtube.uploads.length} uploads, ${youtube.streams.length} live streams`);
    } catch (e) { console.warn("[content] YouTube feed unavailable, video lists left as they were:", e.message); }
  }
  // Sermons page "Teaching series": livestreams of the MSC Sermons channel (ID in src/data/site.js)
  const sermonsChannel = (await readFile(path.join(PUBLIC, "..", "src/data/site.js"), "utf8")).match(/sermonsChannelId:\s*"(UC[\w-]{22})"/)?.[1];
  if (!flag("--no-youtube") && sermonsChannel) {
    try {
      const talks = await channelStreams(sermonsChannel, process.env.YOUTUBE_API_KEY);
      await save(path.join(PUBLIC, "assets/data/youtube-sermons.json"), json(talks));
      log(`YouTube: ${talks.length} MSC Sermons livestreams`);
    } catch (e) { console.warn("[content] MSC Sermons channel unavailable, Teaching series left as it was:", e.message); }
  }
  // Watch Live filter buttons: the channel's playlists (needs the YouTube API key; refreshed at most
  // hourly; otherwise public/assets/data/youtube-playlists.json is kept as it is)
  const playlistsFile = path.join(PUBLIC, "assets/data/youtube-playlists.json");
  const savedPlaylists = existsSync(playlistsFile) ? JSON.parse(await readFile(playlistsFile, "utf8")) : { updated: "" };
  const ytKeyLists = process.env.YOUTUBE_API_KEY;
  if (!flag("--no-youtube") && channel && ytKeyLists && (!savedPlaylists.updated || Date.now() - Date.parse(savedPlaylists.updated) > 55 * 60e3)) {
    try {
      const { all, playlists } = await channelPlaylists(channel, ytKeyLists);
      // One compact file (one line per list), read by the page only when "Show more" is pressed
      const lines = [`{"updated":${JSON.stringify(new Date().toISOString())},`, `"all":${JSON.stringify(all)},`, `"playlists":[`,
        playlists.map((p) => JSON.stringify(p)).join(",\n"), `]}`];
      await save(playlistsFile, lines.join("\n") + "\n");
      log(`YouTube: ${all.length} videos and ${playlists.length} playlists for Watch Live`);
    } catch (e) { console.warn("[content] YouTube playlists unavailable, kept the saved list:", e.message); }
  }

  // Snapshot for the build (only the pictures/files the content points to)
  const used = new Set(JSON.stringify(docs).match(/(image|file)-[\w-]+/g) || []);
  const snapshot = {
    docs: docs.map(({ _rev, ...d }) => d).sort((a, b) => a._id.localeCompare(b._id)),
    assets: Object.fromEntries(Object.entries(assets).filter(([id]) => used.has(id)).sort(([a], [b]) => a.localeCompare(b))),
    ...(youtubeLiveChoice ? { youtubeLive: youtubeLiveChoice } : {})
  };
  await save(SNAPSHOT, json(snapshot));
  // Public content file (backup of what's published + source for the mobile app); skipped for offline test runs
  if (!source) await save(path.join(PUBLIC, "assets/data/content.json"), json({ documents: docs.filter((d) => TYPES.includes(d._type)).map(({ _rev, ...d }) => d).sort((a, b) => a._id.localeCompare(b._id)) }));

  // Browser copy of the Site Settings, and pictures still to download
  const { site, pending } = buildCms(snapshot);
  if (site) await updateMainJs(site);
  for (const { src, out } of pending) {
    const file = path.join(PUBLIC, out);
    if (existsSync(file)) continue;
    const res = await fetch(src);
    if (!res.ok) throw new Error(`Couldn't download ${src} (${res.status})`);
    if (!DRY) { await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, Buffer.from(await res.arrayBuffer())); }
    log("downloaded", out);
  }
  log(written.length ? `${DRY ? "would update" : "updated"}: ${written.join(", ")}` : "content already up to date");
}

main().catch((e) => { console.error("[content] stopped, nothing changed:", e.message); process.exit(1); });
