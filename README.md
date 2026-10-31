# The Revues

A simple directory of the GTM/sales tools companies should be using, with their reviews.
Plain HTML/CSS/JS — no build step, no framework.

## Files

- `index.html` — homepage: search, category filters, tool grid
- `tool.html` — one tool's page (`tool.html?t=<slug>`): overview, pros/cons, reviews, quick facts
- `data/tools.js` — **all content lives here**: site settings, categories, and the tool list
- `app.js` — renders the pages from `data/tools.js`
- `styles.css` — styling (light + dark mode)

## Add or edit a tool

Open `data/tools.js`, copy an existing entry, and change the fields. The field list is at the
top of the file. New categories go in `SITE.categories`.

Ratings and review quotes are left empty on purpose — fill them in with real numbers and real
quotes (e.g. from G2/Capterra, with `reviewSource` linking back). Tools without reviews show
"Reviews coming soon" and a "Share your review" link.

## Run locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Deploy

Any static host works (Netlify, Vercel, Cloudflare Pages, GitHub Pages): point it at the repo
root, no build command. Then point `www.therevues.com` at it.
