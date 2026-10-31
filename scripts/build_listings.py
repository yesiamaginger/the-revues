#!/usr/bin/env python3
"""Build the site's listing data from the master spreadsheet.

    data/companies.csv  ->  data/listings.js

Usage:
    python3 scripts/build_listings.py                    # rebuild data/listings.js
    python3 scripts/build_listings.py --import new.csv   # merge new.csv into data/companies.csv, then rebuild

--import accepts either the master-sheet format (same columns as data/companies.csv) or the
listings-app export ("Company Name", "Category", "Review Links", ...). It tidies each row (trims
whitespace, adds https:// to URLs, maps tags and industries onto the site's names) and merges it
into the master file. A row is the same company as an existing one when the names match ignoring
spaces and punctuation, or the website domains match. Existing values win; the new row only adds
tags, industries, and columns that were empty.
"""
import csv
import json
import re
import sys
from datetime import date, datetime
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
OTHER_HOSTS = {"featuredcustomers.com": "Featured Customers", "nicejob.com": "NiceJob", "facebook.com": "Facebook",
               "amazon.com": "Amazon", "verified-reviews.com": "Verified Reviews"}

BASE_COLUMNS = ["Name", "URL", "Segment", "Tags", "Industries", "Bio"]
EXTRA_COLUMNS = ["Event Location", "Event Dates"]
COLUMNS = BASE_COLUMNS + [f"{s} {f}" for s in SOURCES for f in ("Rating", "Review Count", "URL")] + EXTRA_COLUMNS

# Listings-app export -> master sheet.
APP_SEGMENTS = {"Technology": "Software", "Trainers": "Professional Services"}
APP_SOURCES = {"Google": "Google", "App Store": "Apple App Store", "Google Play": "Google Play Store",
               "Capterra": "Capterra", "G2": "G2", "Trustpilot": "Trustpilot", "Software Advice": "Software Advice"}
INDUSTRY_ALIASES = {"fiber internet": "Fiber"}
# App tag -> site tag(s). Tags not listed here are kept as written.
TAG_ALIASES = {
    "canvassing app": ["Canvassing"], "proposal / imagery": ["Proposal Tools", "Imagery"],
    "proposal tool": ["Proposal Tools"], "quoting": ["Proposal Tools"], "routing": ["Route Optimization"],
    "tax / accounting": ["Tax/Accounting"], "tax": ["Tax/Accounting"], "accounting": ["Tax/Accounting"],
    "swag / merch": ["Swag & Custom Apparel"], "referral & reputation tools": ["Referral Programs", "Review Management"],
    "marketing tool": ["Marketing Tools"], "marketing": ["Marketing Agency"], "branding": ["Marketing Agency"],
    "onboarding/hr": ["HR & Workforce Management"], "site survey": ["Site Surveys"], "measurement": ["Aerial Measurements"],
    "payments": ["Payments & Invoicing"], "recruiting": ["Recruiting Services"], "ai": ["AI Agents"],
    "investment": ["Investment Strategy"], "lead management": ["CRM"], "sales": ["Sales Enablement"],
    "systems / process training": ["Systems & Process Training"],
}
# Different listings that share a website domain; never merged on domain alone.
SEPARATE_LISTINGS = {"d2du"}
# Spellings of the same company name -> the name key it should merge into.
NAME_ALIASES = {"pestcontrolmillionaires": "pestcontrolmillionaire"}


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
    inds = {i.lower(): i for i in INDUSTRIES}
    found = [inds.get(i.lower(), INDUSTRY_ALIASES.get(i.lower(), i)) for i in split_list(row["Industries"])]
    tags = []
    for t in split_list(row["Tags"]):
        if t.lower() in inds:  # an industry entered as a tag
            found.append(inds[t.lower()])
            continue
        for t in TAG_ALIASES.get(t.lower(), [known_tags.get(t.lower(), t)]):
            if t not in tags:
                tags.append(t)
    row["Tags"] = "; ".join(tags)
    row["Industries"] = "; ".join([i for i in INDUSTRIES if i in found] + [i for i in found if i not in INDUSTRIES])
    return row


def merge(into, extra):
    for field in ("Tags", "Industries"):
        values = split_list(into[field])
        values += [v for v in split_list(extra[field]) if v not in values]
        into[field] = "; ".join(values)
    found = split_list(into["Industries"])
    into["Industries"] = "; ".join([i for i in INDUSTRIES if i in found] + [i for i in found if i not in INDUSTRIES])
    for c in COLUMNS:
        if not into[c] and extra[c]:
            into[c] = extra[c]


def from_app_export(r):
    """Convert one listings-app export row to master-sheet columns."""
    row = {
        "Name": r["Company Name"], "URL": r["Website"], "Tags": r["Tags"], "Industries": r["Industries"],
        "Segment": APP_SEGMENTS.get(r["Category"].strip(), r["Category"].strip()),
    }
    desc = (r.get("Description") or "").strip()
    parts = [p.strip() for p in desc.split("|")]
    if row["Segment"] == "Events" and len(parts) == 2:
        end = event_end(parts[1])
        if not end or end >= date.today():  # past dates are dropped; the event itself stays listed
            row["Event Location"], row["Event Dates"] = parts
    else:
        row["Bio"] = desc
    # One review link ("Source: url"); "Average Rating" is that source's rating (0 = none).
    link = (r.get("Review Links") or "").strip()
    rating = (r.get("Average Rating") or "").strip()
    if link:
        label, _, url = link.partition(":")
        source = APP_SOURCES.get(label.strip(), "Other")
        row[f"{source} URL"] = url.strip()
        if rating not in ("", "0"):
            row[f"{source} Rating"] = rating
    return row


def event_end(dates):
    """Last day of an event from text like "Oct 19-21, 2026" or "Nov 30 - Dec 2, 2026"."""
    m = re.search(r"([A-Z][a-z]{2})[a-z]*\.?\s+(\d{1,2})(?:\s*[-–]\s*(?:([A-Z][a-z]{2})[a-z]*\.?\s+)?(\d{1,2}))?,?\s*(\d{4})", dates)
    if not m:
        return None
    try:
        return datetime.strptime(f"{m.group(3) or m.group(1)} {m.group(4) or m.group(2)} {m.group(5)}", "%b %d %Y").date()
    except ValueError:
        return None


def host(url):
    return re.sub(r"^www\.", "", url.split("://", 1)[-1].split("/")[0].lower())


def import_csv(path):
    with open(path, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    if rows and "Company Name" in rows[0]:
        rows = [from_app_export(r) for r in rows]
    existing = []
    if MASTER.exists():
        with open(MASTER, encoding="utf-8-sig", newline="") as f:
            existing = list(csv.DictReader(f))
    # Canonical casing for tags = the most common spelling.
    counts = {}
    for r in existing + rows:
        for t in split_list(r.get("Tags")):
            counts.setdefault(t.lower(), {}).setdefault(t, 0)
            counts[t.lower()][t] += 1
    known_tags = {k: max(v, key=lambda s: (v[s], s[:1].isupper())) for k, v in counts.items()}

    merged, by_name, by_host = [], {}, {}
    added = 0
    for i, raw in enumerate(existing + rows):
        row = clean_row(raw, known_tags)
        name_key = re.sub(r"[^a-z0-9]", "", row["Name"].lower())
        name_key = NAME_ALIASES.get(name_key, name_key)
        host_key = host(row["URL"]) if row["URL"] and name_key not in SEPARATE_LISTINGS else None
        match = by_name.get(name_key) or (by_host.get(host_key) if host_key else None)
        if match:
            merge(match, row)
            if i >= len(existing):
                print(f"merged into existing: {row['Name']} -> {match['Name']}" if row["Name"] != match["Name"] else f"merged into existing: {row['Name']}")
        else:
            merged.append(row)
            if i >= len(existing):
                added += 1
            match = row
        by_name.setdefault(name_key, match)
        if host_key:
            by_host.setdefault(host_key, match)
    merged.sort(key=lambda r: r["Name"].lower())
    with open(MASTER, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS)
        w.writeheader()
        w.writerows(merged)
    print(f"wrote {MASTER.relative_to(ROOT)}: {len(rows)} rows imported, {added} new companies, {len(merged)} total")


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
        if not r["URL"]:
            problems.append(f"{name}: no website")
        elif not re.match(r"^https?://[^/\s]+\.[^/\s]+", r["URL"]):
            problems.append(f"{name}: bad URL '{r['URL']}'")

        ratings, seen = [], {}
        for s in SOURCES:
            rating = num(r.get(f"{s} Rating"), float)
            url = r.get(f"{s} URL", "")
            if rating is None:
                continue
            if not 0 <= rating <= 5:
                problems.append(f"{name}: {s} rating {rating} is not 0-5")
            label = DISPLAY_NAME.get(s, s)
            if s == "Other":
                host = re.sub(r"^www\.", "", url.split("/")[2]) if "://" in url else ""
                label = next((v for k, v in OTHER_HOSTS.items() if host.endswith(k)), host or "Other")
            entry = {"source": label, "rating": rating, "count": num(r.get(f"{s} Review Count"), int), "url": url}
            if (label, url) in seen:  # same rating entered under two equivalent columns: keep the one with a count
                prev = seen[(label, url)]
                if entry["count"] and not prev["count"]:
                    prev.update(entry)
                continue
            seen[(label, url)] = entry
            ratings.append(entry)
        ratings.sort(key=lambda x: -(x["count"] or 0))

        tags = split_list(r["Tags"])
        extra = {}
        if r.get("Event Dates") and (event_end(r["Event Dates"]) or date.max) < date.today():
            problems.append(f"{name}: event dates {r['Event Dates']} have passed")
        if r["Segment"] == "Events":
            extra["event"] = {"dates": r.get("Event Dates", ""), "location": r.get("Event Location", "")}
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
            **extra,
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
