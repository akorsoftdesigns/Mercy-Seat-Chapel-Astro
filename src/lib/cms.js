/* Dashboard content for the pages, read once per build.

       import { regions } from "../lib/cms.js";
       <Fragment set:html={regions["events-regular"]} />

   The content comes from src/data/cms-snapshot.json (refresh it with `npm run content`);
   the templates are in studio/shared/render.js; the logic is in src/lib/cms-core.js. */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { buildCms, PUBLIC, SNAPSHOT } from "./cms-core.js";

const readJson = (file, fallback) => (existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : fallback);
/* ---------- For the pages (read once per build) ---------- */
const snapshot = readJson(SNAPSHOT, null);
const youtube = {
  uploads: readJson(path.join(PUBLIC, "assets/data/youtube-uploads.json"), []),
  streams: readJson(path.join(PUBLIC, "assets/data/youtube-streams.json"), [])
};
const built = snapshot ? buildCms(snapshot, youtube) : { site: null, regions: {}, pending: [] };
if (!snapshot) console.warn("[cms] src/data/cms-snapshot.json is missing: run `npm run content` first. Dashboard sections will be empty.");
for (const { out } of built.pending) if (!existsSync(path.join(PUBLIC, out))) console.warn(`[cms] picture not downloaded yet: ${out} (run \`npm run content\`)`);

/** Page sections by name, e.g. regions["events-regular"] */
export const regions = built.regions;
/** Site Settings from the dashboard (null if the snapshot has none) */
export const cmsSite = built.site;
