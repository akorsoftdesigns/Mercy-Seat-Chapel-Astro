/* Mercy Seat Chapel: site details and main menu, used by the shared layout
   (header, footer, <head>) when the pages are built.

   Contact details, service times and links come from the dashboard (Site Settings),
   saved by `npm run content`. The values below are only used if that content is missing.
   scripts/fetch-content.mjs also copies the Site Settings into public/assets/js/main.js
   for the scripts that run in the browser. NAV (the menu) is still repeated in main.js
   until Phase 5 (docs/astro-migration-plan.md): change both. */
import { cmsSite } from "../lib/cms.js";

// Fixed details (not managed in the dashboard)
export const SITE_FIXED = {
  name: "Mercy Seat Chapel",
  logo: "assets/images/mercy-seat-logo-white.png",       // white logo: header, mobile menu, footer and any blue background
  logoOnLight: "assets/images/mercy-seat-logo-blue.png", // blue logo: light backgrounds inside pages
  website: "https://www.mercyseatchapel.org",
  dashboardUrl: "https://crm.mercyseatchapel.org/"
};

// Fallback contact details, service times and links (the live values are edited in the dashboard: Site Settings)
const FALLBACK_SETTINGS = {
  phone: "(301) 740-8118",
  phoneHref: "tel:+13017408118",
  prayerLine: "1 857 216 6700, code 860476",
  prayerLineHref: "tel:+18572166700,,860476#",
  email: "info@mercyseatchapel.org",
  address: "17604 Washington Grove Lane, Gaithersburg, MD 20877",
  mailingAddress: "P.O. Box 914, Washington Grove, MD 20880",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=17604+Washington+Grove+Lane+Gaithersburg+MD+20877",
  givingUrl: "https://msc.edgdmedia.com/giving/",
  appStoreUrl: "#",
  playStoreUrl: "#",
  youtubeChannelId: "UCVoCauuDqWoSh4fDPtVdt5g",
  liveVideoId: "Zg8AQ9CMOZ4",
  youtubeLiveUrl: "https://www.youtube.com/@MercySeatChapel/live",
  social: { youtube: "https://www.youtube.com/c/Mercyseatchapel", instagram: "https://www.instagram.com/mercyseatchapel/", facebook: "https://www.facebook.com/Mercyseatchapel/", twitter: "https://twitter.com/mercyseatchapel", tiktok: "https://www.tiktok.com/@mercyseatchapel" },
  times: [
    { label: "Sunday Service", time: "10:00 AM" },
    { label: "Bible Study (Tue)", time: "7:30 PM" },
    { label: "Holy Communion", time: "1st Tue · 7:30 PM" }
  ]
};

export const SITE_SETTINGS = cmsSite || FALLBACK_SETTINGS;
export const SITE = { ...SITE_FIXED, ...SITE_SETTINGS };

/* Main menu.
   "pages" = extra pages that highlight this menu item as the current section.
   A menu with href "#" has no page of its own: its label is a button that opens the dropdown. */
export const NAV = [
  { label: "Home", href: "index.html" },
  { label: "About", href: "about.html", pages: ["about.html", "rccg.html", "leadership.html"], children: [
    { label: "RCCG", href: "about.html#who-we-are" },
    { label: "Pastor’s Message", href: "about.html#pastor" },
    { label: "Our Beliefs", href: "about.html#beliefs" },
    { label: "Our Vision & Values", href: "our-vision-values.html" },
    { label: "Leadership", href: "leadership.html" }
  ]},
  { label: "Connect", href: "#", pages: ["foundation-academy.html", "marriage-counselling.html", "seeking-his-presence.html"], children: [
    { label: "Ministries", href: "ministries.html" },
    { label: "Departments", href: "departments.html" },
    { label: "Events & Programs", href: "events.html" },
    { label: "Outreach & Community", href: "outreach.html" },
    { label: "Become a Member", href: "become-a-member.html" },
    { label: "Testimonies", href: "testimonies.html" },
    { label: "Gallery", href: "gallery.html" }
  ]},
  { label: "Sermons", href: "sermons.html", children: [
    { label: "Latest Messages", href: "sermons.html" },
    { label: "Watch Live", href: "live.html" }
  ]},
  { label: "Contact", href: "contact.html" }
];

export const BRAND_ICONS = {
  youtube: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.6" cy="6.4" r=".6" fill="currentColor"/></svg>',
  facebook: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.5 22v-8.2h2.8l.4-3.2h-3.2V8.5c0-.9.3-1.6 1.6-1.6h1.7V4.1c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.4H7.3v3.2h2.8V22h3.4Z"/></svg>',
  twitter: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.2-8.3L1.8 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.3 4.7H5.5l11.2 14.5Z"/></svg>',
  tiktok: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.6 2h-3.4v13.6a2.9 2.9 0 1 1-2.9-2.9c.3 0 .6 0 .9.1V9.3a6.3 6.3 0 1 0 5.4 6.3V8.7a8 8 0 0 0 4.6 1.5V6.8a4.6 4.6 0 0 1-4.6-4.6Z"/></svg>'
};
export const SOCIAL_NAMES = { youtube: "YouTube", instagram: "Instagram", facebook: "Facebook", twitter: "X (Twitter)", tiktok: "TikTok" };
