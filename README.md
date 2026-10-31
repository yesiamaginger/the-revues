# The Revues

A simple directory of the software, professional services and events door-to-door home service
businesses should be using, with their reviews.
Plain HTML/CSS/JS — no build step, no framework.

## Files

- `index.html` — homepage: search, Featured Stack, category filters, directory grid
- `tool.html` — one listing's page (`tool.html?t=<slug>`): overview, pros/cons, ratings, reviews, quick facts
- `data/companies.csv` — **the master list of every business on the site** (one row per company)
- `data/listings.js` — generated from `companies.csv`; don't edit by hand
- `scripts/build_listings.py` — turns `companies.csv` into `listings.js`
- `data/tools.js` — site settings, Featured Stack, and hand-written entries (pros/cons, pricing, events)
- `app.js` — renders the pages from `data/tools.js`
- `styles.css` — styling (light + dark mode)

## The company list (`data/companies.csv`)

One row per business. Columns:

- **Name, URL, Segment** (Software, Professional Services or Events)
- **Tags** and **Industries** — separated by `; `
- **Bio** — the first sentence becomes the card's one-liner
- For each review site, `<Site> Rating`, `<Site> Review Count`, `<Site> URL`: Google, Apple App Store,
  Google Play Store, G2, Capterra, Software Advice, Other, App Store, Google Play, Google Reviews,
  Trustpilot, Featured Customers. "App Store"/"Apple App Store", "Google Play"/"Google Play Store"
  and "Google"/"Google Reviews" show under one name on the site.

After editing the CSV (or replacing it with a fresh export), rebuild:

```bash
python3 scripts/build_listings.py
```

To bring in a new export from the spreadsheet, let the script clean it first (trims spaces, adds
`https://`, fixes tag casing, merges repeated companies), then commit both files:

```bash
python3 scripts/build_listings.py --import path/to/export.csv
```

The script prints a `check:` line for anything that needs a look (bad URL, unknown segment,
rating out of range).

## Hand-written entries (`data/tools.js`)

For extra detail (pros/cons, pricing, reviewer quotes, event dates), add an entry to
`data/tools.js` with the same slug as the company (its name, lowercase, dashes). Its fields win;
tags, industries and ratings still come from the CSV if the entry leaves them out. Copy an existing entry, and change the fields. The field list is at the
top of the file. Categories are Software, Professional Services and Events (`SITE.categories`).

- **Ratings:** add real ratings to `ratings` with a link to the source (G2, Capterra, Google,
  App Store…). The first one shows on the card; all of them show on the listing page.
- **Featured Stack:** edit `SITE.featuredStack` — one `{ job, slug }` per slot.
- **Events:** add `event: { dates, location }`.

Listings with no ratings show "Reviews coming soon" and a "Share your review" link.

## Run locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Deploy

Any static host works (Netlify, Vercel, Cloudflare Pages, GitHub Pages): point it at the repo
root, no build command. Then point `www.therevues.com` at it.
