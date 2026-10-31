#!/usr/bin/env python3
"""Build the site's listing data from the master spreadsheet.

    data/companies.csv  ->  data/listings.js

Usage:
    python3 scripts/build_listings.py                    # rebuild data/listings.js
    python3 scripts/build_listings.py --import new.csv   # clean new.csv into data/companies.csv, then rebuild

--import tidies an export before it becomes the master file: trims whitespace, adds https:// to
URLs, fixes tag/industry casing, and merges rows that repeat the same company (first row wins
for single-value fields; tags, industries and empty rating columns are filled from the repeats).
"""
import csv
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MASTER = ROOT / "data" / "companies.csv"
OUT = ROOT / "data" / "listings.js"

SEGMENTS = ["Software", "Professional Services", "Events"]
INDUSTRIES = ["Pest Control", "Solar", "Roofing", "HVAC", "Plumbing", "Landscaping", "Windows", "Alarms", "Fiber", "Other"]

# Review sources, in the column order of the spreadsheet. Each becomes three columns:
# "<Source> Rating", "<Source> Review Count", "<Source> URL".
SOURCES = [
    "Google", "Apple App Store", "Google Play Store", "G2", "Capterra", "Software Advice", "Other",
    "App Store", "Google Play", "Google Reviews", "Trustpilot", "Featured Customers",
]
# Columns that mean the same place are shown under one name on the site.
DISPLAY_NAME = {
    "Google": "Google", "Google Reviews": "Google",
    "Apple App Store": "App Store", "App Store": "App Store",
    "Google Play Store": "Google Play", "Google Play": "Google Play",
}
# "Other" ratings are named after the site they link to.
OTHER_HOSTS = {"featuredcustomers.com": "Featured Customers", "nicejob.com": "NiceJob"}

BASE_COLUMNS = ["Name", "URL", "Segment", "Tags", "Industries", "Bio"]
COLUMNS = BASE_COLUMNS + [f"{s} {f}" for s in SOURCES for f in ("Rating", "Review Count", "URL")]


def split_list(value):
    return [p.strip() for p in (value or "").split(";") if p.strip()]


def slugify(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def fix_url(url):
    url = url.strip()
    if not url:
        return url
    if not re.match(r"^https?://", url, re.I):
        url = "https://" + url
    scheme, rest = url.split("://", 1)
    host, _, path = rest.partition("/")
    return f"{scheme.lower()}://{host.lower()}" + (f"/{path}" if path else "/")


def clean_row(row, known_tags):
    row = {c: re.sub(r"\s+", " ", (row.get(c) or "")).strip() for c in COLUMNS}
    row["URL"] = fix_url(row["URL"])
    for s in SOURCES:
        if row[f"{s} URL"]:
            row[f"{s} URL"] = row[f"{s} URL"] if row[f"{s} URL"].startswith("http") else fix_url(row[f"{s} URL"])
        row[f"{s} Review Count"] = row[f"{s} Review Count"].replace(",", "")
    tags = []
    for t in split_list(row["Tags"]):
        t = known_tags.get(t.lower(), t)
        if t not in tags:
            tags.append(t)
    row["Tags"] = "; ".join(tags)
    inds = {i.lower(): i for i in INDUSTRIES}
    found = [inds.get(i.lower(), i) for i in split_list(row["Industries"])]
    row["Industries"] = "; ".join([i for i in INDUSTRIES if i in found] + [i for i in found if i not in INDUSTRIES])
    return row


def merge(into, extra):
    for field in ("Tags", "Industries"):
        values = split_list(into[field])
        values += [v for v in split_list(extra[field]) if v not in values]
        into[field] = "; ".join(values)
    for c in COLUMNS:
        if not into[c] and extra[c]:
            into[c] = extra[c]


def import_csv(path):
    with open(path, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    # Canonical casing for tags = the most common spelling.
    counts = {}
    for r in rows:
        for t in split_list(r.get("Tags")):
            counts.setdefault(t.lower(), {}).setdefault(t, 0)
            counts[t.lower()][t] += 1
    known_tags = {k: max(v, key=lambda s: (v[s], s[:1].isupper())) for k, v in counts.items()}

    merged, by_key = [], {}
    for raw in rows:
        row = clean_row(raw, known_tags)
        key = slugify(row["Name"])
        if key in by_key:
            merge(by_key[key], row)
            print(f"merged repeat row: {row['Name']}")
        else:
            by_key[key] = row
            merged.append(row)
    merged.sort(key=lambda r: r["Name"].lower())
    with open(MASTER, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS)
        w.writeheader()
        w.writerows(merged)
    print(f"wrote {MASTER.relative_to(ROOT)}: {len(rows)} rows in, {len(merged)} companies out")


def num(value, cast):
    try:
        return cast(float(value)) if value else None
    except ValueError:
        return None


def first_sentence(text):
    m = re.match(r"(.+?[.!?])(\s|$)", text)
    return m.group(1) if m else text


def build():
    with open(MASTER, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    problems, listings, slugs = [], [], set()
    for r in rows:
        name = r["Name"]
        slug = slugify(name)
        if slug in slugs:
            problems.append(f"{name}: duplicate name")
        slugs.add(slug)
        if r["Segment"] not in SEGMENTS:
            problems.append(f"{name}: unknown segment '{r['Segment']}'")
        if not re.match(r"^https?://[^/\s]+\.[^/\s]+", r["URL"]):
            problems.append(f"{name}: bad URL '{r['URL']}'")

        ratings, seen = [], set()
        for s in SOURCES:
            rating = num(r.get(f"{s} Rating"), float)
            url = r.get(f"{s} URL", "")
            if rating is None:
                if url:
                    problems.append(f"{name}: {s} URL but no rating")
                continue
            if not 0 <= rating <= 5:
                problems.append(f"{name}: {s} rating {rating} is not 0-5")
            label = DISPLAY_NAME.get(s, s)
            if s == "Other":
                host = re.sub(r"^www\.", "", url.split("/")[2]) if "://" in url else ""
                label = next((v for k, v in OTHER_HOSTS.items() if host.endswith(k)), host or "Other")
            if (label, url) in seen:  # same rating entered under two equivalent columns
                continue
            seen.add((label, url))
            ratings.append({"source": label, "rating": rating, "count": num(r.get(f"{s} Review Count"), int), "url": url})
        ratings.sort(key=lambda x: -(x["count"] or 0))

        tags = split_list(r["Tags"])
        listings.append({
            "slug": slug,
            "name": name,
            "url": r["URL"],
            "category": r["Segment"],
            "type": tags[0] if tags else "",
            "tags": tags,
            "industries": split_list(r["Industries"]),
            "tagline": first_sentence(r["Bio"]),
            "description": r["Bio"],
            "ratings": ratings,
        })

    for p in problems:
        print("check:", p)
    header = (
        "// GENERATED by scripts/build_listings.py from data/companies.csv — do not edit by hand.\n"
        "// Edit the spreadsheet, then run: python3 scripts/build_listings.py\n"
    )
    OUT.write_text(header + "window.LISTINGS = " + json.dumps(listings, indent=1, ensure_ascii=False) + ";\n", encoding="utf-8")
    rated = sum(1 for l in listings if l["ratings"])
    print(f"wrote {OUT.relative_to(ROOT)}: {len(listings)} listings, {rated} with ratings")
    return 1 if any("bad URL" in p or "unknown segment" in p or "duplicate" in p for p in problems) else 0


if __name__ == "__main__":
    args = sys.argv[1:]
    if args[:1] == ["--import"] and len(args) == 2:
        import_csv(args[1])
    elif args:
        sys.exit(__doc__)
    sys.exit(build())
