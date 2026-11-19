/* Fills contact details into a page while it is built (replaces fillSiteData in main.js).

   In page text, mark an element with data-site="…" and it gets the current value from
   Site Settings (dashboard) when the site is built, e.g.
       <a data-site="phone" href="#">(301) 740-8118</a>   → number and tel: link
       <a data-site="email" href="#">…</a>                → address and mailto: link
       <a data-site="address" href="#">…</a>              → street address and map link
       <strong data-site="mailing-address">…</strong>     → P.O. box
       <a data-site="website" href="#">…</a>              → www.mercyseatchapel.org
       <a data-site="maps|giving|youtube-live|app-store|play-store|youtube|instagram|facebook|twitter|tiktok" href="#">
                                                           → link only (text unchanged)
       <img data-site="logo|logo-on-light" …>              → white / blue logo
       <div data-site="socials" data-class="…"></div>      → row of social media icon links
   data-brand="facebook" (etc.) on any link adds that brand's icon before its text.
   The text inside an element is only replaced when it is plain text (no tags inside). */
import { SITE, BRAND_ICONS, SOCIAL_NAMES } from "../data/site.js";

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const socialLinksHtml = (cls) => Object.entries(SITE.social).map(([k, url]) =>
  `<a class="${esc(cls)}" href="${esc(url)}" target="_blank" rel="noopener" aria-label="${esc(`${SITE.name} on ${SOCIAL_NAMES[k] || k}`)}">${BRAND_ICONS[k]}</a>`).join("");

// key → [text (or undefined to keep), href (or undefined to keep)]
function valuesFor(key) {
  switch (key) {
    case "phone": return [SITE.phone, SITE.phoneHref];
    case "prayer-line": return [SITE.prayerLine, SITE.prayerLineHref];
    case "email": return [SITE.email, "mailto:" + SITE.email];
    case "address": return [SITE.address, SITE.mapsUrl];
    case "website": return [SITE.website.replace(/^https?:\/\//, ""), SITE.website];
    case "mailing-address": return [SITE.mailingAddress, undefined];
    case "maps": return [undefined, SITE.mapsUrl];
    case "giving": return [undefined, SITE.givingUrl];
    case "youtube-live": return [undefined, SITE.youtubeLiveUrl];
    case "sermons-channel": return [undefined, SITE.sermonsChannelUrl];
    case "app-store": return [undefined, SITE.appStoreUrl];
    case "play-store": return [undefined, SITE.playStoreUrl];
    default: return [undefined, SITE.social?.[key]];
  }
}

const setAttr = (attrs, name, value) => {
  const re = new RegExp(`(\\s${name}=)"[^"]*"`);
  return re.test(attrs) ? attrs.replace(re, `$1"${esc(value)}"`) : `${attrs} ${name}="${esc(value)}"`;
};

export function fillSite(html) {
  // <tag … data-site="key" …>  (and the plain text that follows up to its closing tag)
  return html.replace(/<(a|strong|span|b|p|div|img)\b([^>]*?\sdata-site="([\w-]+)"[^>]*)>(?:([^<]*)(<\/\1>))?/g, (whole, tag, attrs, key, text, close) => {
    if (tag === "img") {
      if (key !== "logo" && key !== "logo-on-light") return whole;
      let a = setAttr(attrs, "src", key === "logo" ? SITE.logo : SITE.logoOnLight);
      if (!/\salt="[^"]+"/.test(a)) a = setAttr(a, "alt", SITE.name);
      return `<img${a}>`;
    }
    if (key === "socials") {
      const cls = attrs.match(/\sdata-class="([^"]*)"/)?.[1] || "social-btn";
      return close !== undefined ? `<${tag}${attrs}>${socialLinksHtml(cls)}${close}` : whole;
    }
    const [newText, href] = valuesFor(key);
    let a = attrs;
    if (href !== undefined && tag === "a") a = setAttr(a, "href", href);
    if (close === undefined) return `<${tag}${a}>`; // has tags inside: keep its content
    return `<${tag}${a}>${newText !== undefined ? esc(newText) : text}${close}`;
  })
  // data-brand: brand icon before the link text
  .replace(/(<a\b[^>]*\sdata-brand="(\w+)"[^>]*>)/g, (whole, open, brand) => (BRAND_ICONS[brand] ? open + BRAND_ICONS[brand] : whole));
}
