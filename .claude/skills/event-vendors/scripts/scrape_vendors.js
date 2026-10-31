#!/usr/bin/env node
// Scrape every company listed as a sponsor / exhibitor / vendor on an event website.
//
//   node scrape_vendors.js <event-url> [--page <sponsors-url>] [--out <dir>] [--deep] [--existing <tools.js>]
//
//   <event-url>   the event's homepage (or its sponsors page directly)
//   --page        skip discovery and scrape this page
//   --out         output folder (default: ./event-vendors-out)
//   --deep        also visit each vendor's website and grab its title + meta description
//   --existing    path to data/tools.js — vendors already listed are flagged
//
// Writes <out>/<event-host>.json, <event-host>.csv, and a full-page screenshot of every
// page it scraped (sponsor walls are often logo-only, so the screenshot lets you read them).
//
// Uses the Playwright + Chromium already installed in the environment.

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

// ── args ─────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  const v = args[i + 1];
  args.splice(i, v && !v.startsWith("--") ? 2 : 1);
  return v && !v.startsWith("--") ? v : true;
};
const PAGE = flag("--page");
const OUT = flag("--out") || "event-vendors-out";
const DEEP = !!flag("--deep");
const EXISTING = flag("--existing");
const EVENT_URL = args[0] || PAGE;
if (!EVENT_URL) {
  console.error("usage: node scrape_vendors.js <event-url> [--page <url>] [--out <dir>] [--deep] [--existing <tools.js>]");
  process.exit(1);
}

// Words that mark a page / nav link / section heading as the vendor list.
const LIST_WORDS = /sponsor|exhibitor|vendor|partner|expo|booth|marketplace|supporter|showcase|solution provider/i;
const LIST_PATHS = [
  "sponsors", "sponsor", "our-sponsors", "exhibitors", "exhibitor-list", "vendors",
  "partners", "expo", "expo-hall", "marketplace",
];
// Links that are never a vendor.
const NOT_VENDOR_HOSTS = [
  "facebook.com", "instagram.com", "twitter.com", "x.com", "linkedin.com", "youtube.com", "youtu.be",
  "tiktok.com", "pinterest.com", "threads.net", "google.com", "goo.gl", "apple.com", "maps.app.goo.gl",
  "eventbrite.com", "ticketmaster.com", "wix.com", "squarespace.com", "wordpress.org", "wordpress.com",
  "hubspot.com", "mailchimp.com", "list-manage.com", "typeform.com", "jotform.com", "calendly.com",
  "zoom.us", "vimeo.com", "spotify.com", "podcasts.apple.com", "w3.org", "schema.org", "gstatic.com",
  "googleapis.com", "cloudflare.com", "shopify.com", "godaddy.com", "webflow.com", "webflow.io",
  "linktr.ee", "bit.ly", "whova.com", "cvent.com", "hopin.com", "swapcard.com",
];
// Third-party exhibitor platforms: if the list lives there, follow it.
const EXHIBITOR_PLATFORMS = /mapyourshow|a2zinc|map-dynamics|expocad|swapcard|eventscribe|cvent|whova|grip\.events|bizzabo|eventbrite|accelevents/i;

const host = (u) => {
  try { return new URL(u).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; }
};
const root = (h) => h.split(".").slice(-2).join(".");
const isNotVendor = (h) => !h || NOT_VENDOR_HOSTS.some((b) => h === b || h.endsWith("." + b));

// ── browser helpers ──────────────────────────────────────────────
async function load(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  // Click through cookie banners so they don't cover the screenshot.
  for (const label of [/^accept/i, /^agree/i, /^got it/i, /^ok$/i, /^allow all/i]) {
    const b = page.getByRole("button", { name: label }).first();
    if (await b.isVisible().catch(() => false)) await b.click().catch(() => {});
  }
  // Scroll to the bottom (lazy-loaded logos), clicking "load more"/"show all" when present.
  for (let i = 0; i < 40; i++) {
    const before = await page.evaluate(() => document.body.scrollHeight);
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await page.waitForTimeout(250);
    const more = page.getByRole("button", { name: /load more|show more|view all|see all|show all/i }).first();
    if (await more.isVisible().catch(() => false)) {
      await more.click().catch(() => {});
      await page.waitForTimeout(1200);
    }
    const atBottom = await page.evaluate(() => window.scrollY + window.innerHeight >= document.body.scrollHeight - 5);
    if (atBottom && (await page.evaluate(() => document.body.scrollHeight)) === before) break;
  }
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
}

// Find links on the current page that point to the sponsors / exhibitors list.
async function findListLinks(page, eventHost) {
  const links = await page.$$eval("a[href]", (as) =>
    as.map((a) => ({ href: a.href, text: (a.innerText || a.getAttribute("aria-label") || a.title || "").trim() }))
  );
  const seen = new Set();
  return links
    .filter((l) => LIST_WORDS.test(l.text) || LIST_WORDS.test(new URL(l.href, "http://x").pathname))
    .filter((l) => root(host(l.href)) === root(eventHost) || EXHIBITOR_PLATFORMS.test(l.href))
    .filter((l) => !/become|apply|application|opportunit|prospectus|inquir|interest|packages?\b|pricing/i.test(l.text + l.href))
    .map((l) => l.href.split("#")[0])
    .filter((h) => !seen.has(h) && seen.add(h));
}

// Pull every vendor candidate from the current page (runs in the browser).
function extractInPage(listWordsSrc) {
  const LIST_WORDS = new RegExp(listWordsSrc, "i");
  const clean = (s) => (s || "").replace(/\s+/g, " ").trim();
  const pageHost = location.hostname.replace(/^www\./, "");

  // Tier / section label = nearest heading above the element.
  const headings = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6,[class*=tier i],[class*=level i]")]
    .filter((h) => clean(h.innerText).length > 1 && clean(h.innerText).length < 60);
  const sectionOf = (el) => {
    let best = "";
    for (const h of headings) {
      if (h.contains(el)) continue;
      if (h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) best = clean(h.innerText);
    }
    return best;
  };
  const inChrome = (el) => !!el.closest("header, footer, nav, [role=navigation], [class*=footer i], [id*=footer i], [class*=cookie i]");

  // Name from a logo file name, e.g. /uploads/2025/01/Acme-Roofing-Logo-300x120.png → "Acme Roofing"
  const nameFromFile = (src) => {
    try {
      let f = decodeURIComponent(new URL(src, location.href).pathname.split("/").pop() || "");
      f = f.replace(/\.(png|jpe?g|webp|svg|gif|avif)$/i, "")
        .replace(/[-_]?\d{2,4}x\d{2,4}$/i, "")
        .replace(/[-_+.]+/g, " ")
        .replace(/\b(logo|logos|sponsor|exhibitor|final|copy|white|black|color|colour|full|horizontal|vertical|transparent|rgb|cmyk|scaled|new|v\d+|\d+)\b/gi, " ");
      return clean(f);
    } catch { return ""; }
  };
  const badAlt = /^(logo|image|img|sponsor|exhibitor|partner|photo|picture|icon|untitled|\d+|)$/i;
  const nameOf = (el, img) => {
    const alt = clean(img && (img.getAttribute("alt") || img.getAttribute("title")));
    const label = clean(el.getAttribute && (el.getAttribute("aria-label") || el.getAttribute("title")));
    const text = clean(el.innerText);
    const cands = [
      [alt.replace(/\s*(logo|sponsor logo)$/i, ""), "img-alt"],
      [label, "aria-label"],
      [text.length < 80 ? text : "", "link-text"],
      [img ? nameFromFile(img.currentSrc || img.src) : "", "img-filename"],
    ];
    for (const [n, how] of cands) if (n && !badAlt.test(n) && !/^(visit|learn more|website|read more|click here)/i.test(n)) return [n, how];
    return ["", ""];
  };
  const imgIn = (el) => el.querySelector("img") || null;
  const bgImg = (el) => {
    const m = getComputedStyle(el).backgroundImage.match(/url\(["']?(.*?)["']?\)/);
    return m ? m[1] : "";
  };

  const out = [];
  // 1) Links (to anything) — the main source.
  for (const a of document.querySelectorAll("a[href]")) {
    if (inChrome(a)) continue;
    const href = a.href;
    if (!/^https?:/.test(href)) continue;
    const img = imgIn(a);
    let [name, how] = nameOf(a, img);
    if (!name && !img) {
      const bg = bgImg(a);
      if (bg) [name, how] = [nameFromFile(bg), "bg-filename"];
    }
    out.push({ name, how, href, logo: img ? img.currentSrc || img.src : bgImg(a), section: sectionOf(a), hasImg: !!img });
  }
  // 2) Logos that aren't links (common on sponsor walls).
  for (const img of document.querySelectorAll("img")) {
    if (img.closest("a[href]") || inChrome(img)) continue;
    const r = img.getBoundingClientRect();
    if (r.width < 40 || r.height < 15) continue;
    const [name, how] = nameOf(img, img);
    out.push({ name, how, href: "", logo: img.currentSrc || img.src, section: sectionOf(img), hasImg: true });
  }
  // 3) Plain-text cards (exhibitor directories): elements whose class says exhibitor/sponsor/vendor.
  for (const el of document.querySelectorAll("[class*=exhibitor i],[class*=sponsor i],[class*=vendor i],[class*=partner i]")) {
    if (el.querySelector("a[href], img") || inChrome(el)) continue;
    const t = clean(el.innerText);
    if (t && t.length < 70 && t.split(" ").length <= 8) out.push({ name: t, how: "card-text", href: "", logo: "", section: sectionOf(el), hasImg: false });
  }
  return { pageHost, title: document.title, items: out, iframes: [...document.querySelectorAll("iframe[src]")].map((f) => f.src) };
}

// ── main ─────────────────────────────────────────────────────────
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  });
  const page = await ctx.newPage();
  const eventHost = host(EVENT_URL);
  const slug = eventHost.replace(/[^a-z0-9]+/g, "-");

  // 1. Work out which pages hold the vendor list.
  let pages = [];
  if (PAGE) pages = [PAGE];
  else {
    await load(page, EVENT_URL);
    pages = await findListLinks(page, eventHost);
    if (!pages.length) {
      for (const p of LIST_PATHS) {
        const u = new URL("/" + p, EVENT_URL).href;
        const r = await ctx.request.get(u, { timeout: 15000 }).catch(() => null);
        if (r && r.ok()) { pages.push(u); break; }
      }
    }
    if (!pages.length) pages = [EVENT_URL]; // sponsors may be on the homepage itself
  }
  pages = pages.slice(0, 8);
  console.error(`Scraping ${pages.length} page(s):\n  ${pages.join("\n  ")}`);

  // 2. Scrape each page.
  const raw = [];
  const notes = [];
  const shots = [];
  for (const [i, u] of pages.entries()) {
    try {
      await load(page, u);
      const shot = path.join(OUT, `${slug}-page${i + 1}.png`);
      await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
      shots.push(shot);
      const res = await page.evaluate(extractInPage, LIST_WORDS.source);
      for (const it of res.items) raw.push({ ...it, page: u });
      for (const f of res.iframes) if (EXHIBITOR_PLATFORMS.test(f)) notes.push(`Exhibitor list is embedded from ${f} — re-run with --page "${f}"`);
    } catch (e) {
      notes.push(`Failed to load ${u}: ${e.message.split("\n")[0]}`);
    }
  }

  // 3. Keep vendors, drop site chrome, dedupe.
  const onEventSite = (h) => root(h) === root(eventHost);
  const vendors = new Map();
  for (const r of raw) {
    const h = host(r.href);
    const external = r.href && !onEventSite(h);
    if (r.href && isNotVendor(h)) continue;
    // Internal links count only if they're logos (some sites link logos to an internal vendor page).
    if (r.href && !external && !r.hasImg) continue;
    // Non-linked logos / cards count only inside a sponsor-ish section.
    if (!r.href && !LIST_WORDS.test(r.section) && r.how !== "card-text") continue;
    if (!r.name && !external) continue;
    const name = r.name || h;
    const key = external ? root(h) : name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!key) continue;
    const prev = vendors.get(key);
    const better = !prev || (prev.name_source === "domain" && r.name) || (!prev.section && r.section);
    if (better) {
      vendors.set(key, {
        name,
        website: external ? new URL(r.href).origin : "",
        domain: external ? h : "",
        tier: LIST_WORDS.test(r.section) || /platinum|gold|silver|bronze|title|presenting|diamond|premier|founding|elite|tier/i.test(r.section) ? r.section : "",
        section: r.section,
        name_source: r.name ? r.how : "domain",
        // Names guessed from file names or domains need a human/Claude check against the logo.
        verify: !r.name || /filename/.test(r.how),
        logo: r.logo || "",
        source_page: r.page,
      });
    }
  }
  let list = [...vendors.values()];

  // 4. Flag vendors already in the directory.
  if (EXISTING && fs.existsSync(EXISTING)) {
    const src = fs.readFileSync(EXISTING, "utf8");
    const urls = [...src.matchAll(/url:\s*"([^"]+)"/g)].map((m) => root(host(m[1])));
    const names = [...src.matchAll(/name:\s*"([^"]+)"/g)].map((m) => m[1].toLowerCase());
    for (const v of list) v.already_listed = (v.domain && urls.includes(root(v.domain))) || names.includes(v.name.toLowerCase());
  }

  // 5. Optional: visit each vendor site for a one-line description.
  if (DEEP) {
    const p2 = await ctx.newPage();
    for (const v of list) {
      if (!v.website) continue;
      try {
        await p2.goto(v.website, { waitUntil: "domcontentloaded", timeout: 20000 });
        const meta = await p2.evaluate(() => ({
          title: document.title,
          description:
            document.querySelector('meta[name="description"]')?.content ||
            document.querySelector('meta[property="og:description"]')?.content || "",
          site_name: document.querySelector('meta[property="og:site_name"]')?.content || "",
        }));
        Object.assign(v, { site_title: meta.title.trim(), site_description: meta.description.trim() });
        if (v.name_source === "domain" && meta.site_name) Object.assign(v, { name: meta.site_name, name_source: "og:site_name" });
      } catch (e) {
        v.site_error = e.message.split("\n")[0];
      }
    }
  }

  await browser.close();
  list.sort((a, b) => a.name.localeCompare(b.name));

  // 6. Write results.
  const result = { event_url: EVENT_URL, scraped_at: new Date().toISOString(), pages, count: list.length, notes, screenshots: shots, vendors: list };
  const jsonPath = path.join(OUT, `${slug}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));
  const cols = ["name", "website", "domain", "tier", "section", "name_source", "verify", "already_listed", "site_description", "logo", "source_page"];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csvPath = path.join(OUT, `${slug}.csv`);
  fs.writeFileSync(csvPath, [cols.join(","), ...list.map((v) => cols.map((c) => esc(v[c])).join(","))].join("\n") + "\n");

  console.error(`\n${list.length} vendors → ${jsonPath}\n${" ".repeat(String(list.length).length + 9)}${csvPath}`);
  for (const n of notes) console.error("NOTE: " + n);
  console.log(JSON.stringify({ count: list.length, json: jsonPath, csv: csvPath, screenshots: shots, notes }));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
