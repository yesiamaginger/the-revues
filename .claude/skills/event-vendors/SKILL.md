---
name: event-vendors
description: Scrape every company listed as a sponsor, exhibitor, vendor or partner on an event's website, then sort them into new Software / Professional Services leads for The Revues directory. Use when the user gives an event or conference URL (e.g. winthestorm.com) and asks for its sponsors, exhibitors, vendors or "who's at this event", or wants to find new tools/services from events.
---

# Event vendors

Event sponsor and exhibitor lists are one of the best ways to find new software and professional
services for home-service businesses. This skill turns an event's website into a clean,
checked list of those companies, flags the ones The Revues already lists, and sorts the rest by
category.

## 1. Scrape

Run the scraper from the repo root. Pass the event's homepage; it finds the sponsors /
exhibitors page itself (it follows nav links like "Sponsors", "Exhibitors", "Partners", "Expo",
skips "Become a sponsor" pages, then tries common paths like `/sponsors`).

```bash
node .claude/skills/event-vendors/scripts/scrape_vendors.js https://www.winthestorm.com \
  --existing data/tools.js --deep --out research/event-vendors
```

- `--page <url>` — use this when you already know the sponsors page, or when discovery picked
  the wrong one. Repeat the run once per page if sponsors and exhibitors are on separate pages.
- `--deep` — visits each vendor's website and saves its title and meta description (needed for
  step 3). Takes about 2 s per vendor; leave it off for a quick count.
- `--existing data/tools.js` — sets `already_listed` on vendors that are already in the directory.

It writes `<event-host>.json`, `<event-host>.csv` and a full-page screenshot per scraped page
into the `--out` folder, and prints a summary JSON with those paths and any `notes`.

What it handles: JavaScript-rendered pages, lazy-loaded logos (it scrolls), "Load more / View all"
buttons, cookie banners, sponsor tiers (taken from the nearest heading: "Platinum", "Gold",
"Exhibitors"…), logos with no link (named from alt text or the image file name), and
de-duplication by domain. It drops social, ticketing, site-builder and footer links.

**If a run fails:**
- *Network refused / `CONNECT tunnel failed` / `ENOTFOUND`* — the cloud environment's network
  policy blocks the host. Tell the user to add the event's domain (and, for `--deep`, allow
  general web access) under the environment's Network access settings. Until then, use the
  `web-fetch` agent to read the sponsors page and ask it for every company name, website and
  tier; say plainly in your report that the list came from a fetch, not the scraper.
- *A `NOTE` says the list is embedded from another platform* (Map Your Show, Swapcard, a2z,
  Whova…) — run again with `--page` set to that URL.
- *0 or very few vendors* — open the screenshot. If it shows the logos, the wrong page was
  scraped (use `--page`) or the logos are images with no links or alt text (see step 2).

## 2. Check the list against the screenshots

Always Read the screenshot(s) and compare with the CSV. The scraper can't read a logo image, so:

- Rows with `verify: true` got their name from an image file name or a domain. Confirm or fix
  each one from the logo in the screenshot and its `website`/`site_title`.
- Add any company whose logo is visible in the screenshot but is missing from the list (a logo
  with no link and no alt text). Mark these `name_source: "screenshot"`.
- Remove anything that is not an exhibiting company: the event organiser itself, the venue,
  hotels, media partners with no product, charities, and leftover site links.
- State the final count, and compare it with what the page itself claims ("100+ sponsors").
  If they differ a lot, say so and say why.

## 3. Sort for The Revues

The Revues lists **software, professional services and events for door-to-door home-service
businesses** (roofing, solar, pest control, security, HVAC, windows, storm restoration…).
Give every vendor one `fit`, using its `site_description`/`site_title` (open the site with the
`web-fetch` agent if those are empty or unclear):

| fit | means | examples |
|---|---|---|
| `Software` | a product a home-service business would use | canvassing, CRM, estimating, measurements, hail/weather data, scheduling, payments, financing platforms |
| `Professional Services` | a service the business would hire | marketing agencies, recruiting, coaching/training, accounting, legal, insurance, consulting |
| `Other` | sells to the trade but is not software or a service | material manufacturers, distributors, equipment, trucks, apparel |
| `Not relevant` | none of the above | |

Add a one-line `what_they_do` in plain words. Don't guess — if you can't tell, write
`fit: "Unknown"` and say so.

## 4. Deliver

Save the checked list to `research/event-vendors/<event-host>.csv` (columns: name, website,
tier, fit, what_they_do, already_listed, name_source) and keep the scraper's JSON beside it.

Then report to the user, short:
1. Event, page(s) scraped, final vendor count (and the page's own claim, if any).
2. **New leads**: `Software` and `Professional Services` vendors with `already_listed: false`,
   grouped by fit, as a table: name · website · tier · what they do.
3. Counts for `Other` / `Not relevant`, and anything you couldn't verify.

**Adding to the directory:** only when the user asks. Draft entries in `data/tools.js` following
the field list at the top of that file, with `ratings: []` and `reviews: []` — never enter a
rating, review count or quote you haven't taken from the source you link (the file's own rule).
Write `tagline` and `description` from the vendor's own site, not from memory.
