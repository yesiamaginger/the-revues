# The Revues

A simple directory of the software, professional services and events door-to-door home service
businesses should be using, with their reviews.
Plain HTML/CSS/JS — no build step, no framework.

## Files

- `index.html` — homepage: search, Featured Stack, category filters, directory grid
- `tool.html` — one listing's page (`tool.html?t=<slug>`): overview, pros/cons, ratings, reviews, quick facts
- `data/tools.js` — **all content lives here**: site settings, categories, and the tool list
- `app.js` — renders the pages from `data/tools.js`
- `styles.css` — styling (light + dark mode)

## Add or edit a listing

Open `data/tools.js`, copy an existing entry, and change the fields. The field list is at the
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
