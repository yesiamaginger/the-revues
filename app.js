// Rendering for the homepage directory and individual tool pages.
window.Revues = (function () {
  // Hand-written entries (data/tools.js) win; the spreadsheet listings (data/listings.js) fill in
  // everything else, and supply tags, industries and ratings the hand-written entry leaves out.
  const TOOLS = (() => {
    const curated = window.TOOLS || [];
    const bySlug = Object.fromEntries(curated.map((t) => [t.slug, t]));
    const out = [...curated];
    for (const l of window.LISTINGS || []) {
      const c = bySlug[l.slug];
      if (!c) out.push(l);
      else {
        c.tags = c.tags?.length ? c.tags : l.tags;
        c.industries = c.industries?.length ? c.industries : l.industries;
        c.ratings = c.ratings?.length ? c.ratings : l.ratings;
      }
    }
    return out;
  })();
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const domain = (url) => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  };
  const summary = (t) => t.tagline || (t.tags || []).join(" · ");

  function logo(tool, size) {
    const initials = tool.name.replace(/[^A-Za-z0-9 ]/g, "").split(" ").map((w) => w[0]).join("").slice(0, 2);
    const src = tool.logo || (domain(tool.url) && `https://www.google.com/s2/favicons?domain=${domain(tool.url)}&sz=128`);
    return `<div class="logo-box logo-${size}">${src ? `<img src="${esc(src)}" alt="" loading="lazy"
      onerror="this.remove()" />` : ""}<span>${esc(initials)}</span></div>`;
  }

  function stars(rating) {
    const full = Math.round(rating * 2) / 2;
    let out = "";
    for (let i = 1; i <= 5; i++) out += i <= full ? "★" : i - 0.5 === full ? "⯪" : "☆";
    return `<span class="stars" aria-label="${rating} out of 5">${out}</span>`;
  }

  function ratingLine(r) {
    if (!r) return `<span class="muted">Reviews coming soon</span>`;
    const count = r.count ? ` · ${r.count.toLocaleString()} review${r.count === 1 ? "" : "s"}` : "";
    return `${stars(r.rating)} <strong>${r.rating.toFixed(1)}</strong><span class="muted">${count} on ${esc(r.source)}</span>`;
  }

  const topRating = (t) => (t.ratings || [])[0];
  const eventLine = (t) => (t.event ? `${esc(t.event.dates)}${t.event.location ? ` · ${esc(t.event.location)}` : ""}` : "");

  function submitLinks() {
    const href = `mailto:${SITE.contactEmail}?subject=${encodeURIComponent("Listing submission for The Revues")}`;
    document.querySelectorAll("[data-submit]").forEach((a) => (a.href = href));
    document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
  }

  function card(t) {
    return `<a class="card" href="tool.html?t=${encodeURIComponent(t.slug)}">
      <div class="card-top">${logo(t, "md")}
        <div><h3>${esc(t.name)}</h3><span class="tag">${esc(t.type || t.category)}</span></div>
      </div>
      <p>${esc(summary(t))}</p>
      <div class="card-foot"><span class="rating">${t.event ? `<span class="event-when">📅 ${eventLine(t)}</span>` : ratingLine(topRating(t))}</span></div>
    </a>`;
  }

  function home() {
    submitLinks();
    document.querySelector("[data-tagline]").textContent = SITE.tagline;
    const params = new URLSearchParams(location.search);
    let active = params.get("category") || "All";
    const industrySel = document.getElementById("industry");
    const industries = [...new Set(TOOLS.flatMap((t) => t.industries || []))].sort((a, b) =>
      a === "Other" ? 1 : b === "Other" ? -1 : a.localeCompare(b)
    );
    industrySel.innerHTML = `<option value="">All industries</option>` + industries.map((i) => `<option>${esc(i)}</option>`).join("");
    industrySel.value = params.get("industry") || "";
    const input = document.getElementById("search");
    input.value = params.get("q") || "";

    const chips = document.getElementById("chips");
    const counts = {};
    TOOLS.forEach((t) => (counts[t.category] = (counts[t.category] || 0) + 1));
    chips.innerHTML = ["All", ...SITE.categories]
      .map((c) => `<button class="chip" data-cat="${esc(c)}">${esc(c)} <span>${c === "All" ? TOOLS.length : counts[c] || 0}</span></button>`)
      .join("");

    const stack = document.getElementById("stack-list");
    stack.innerHTML = (SITE.featuredStack || [])
      .map(({ job, slug }) => {
        const t = TOOLS.find((x) => x.slug === slug);
        if (!t) return "";
        const r = topRating(t);
        return `<a class="stack-item" href="tool.html?t=${encodeURIComponent(t.slug)}">
          <span class="stack-job">${esc(job)}</span>
          <div class="stack-name">${logo(t, "sm")}<strong>${esc(t.name)}</strong></div>
          <span class="stack-meta">${t.event ? eventLine(t) : r ? `★ ${r.rating.toFixed(1)} on ${esc(r.source)}` : esc(t.category)}</span>
        </a>`;
      })
      .join("");

    const score = (t) => topRating(t)?.rating ?? 0;
    const sorted = [...TOOLS].sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || score(b) - score(a));

    function render() {
      const q = input.value.trim().toLowerCase();
      const list = sorted.filter(
        (t) =>
          (active === "All" || t.category === active) &&
          (!industrySel.value || (t.industries || []).includes(industrySel.value)) &&
          (!q || [t.name, t.type, t.tagline, t.description, t.category, t.bestFor, ...(t.tags || [])].join(" ").toLowerCase().includes(q))
      );
      document.getElementById("grid").innerHTML = list.map(card).join("");
      document.getElementById("empty").hidden = list.length > 0;
      document.getElementById("count").textContent = `${list.length} listing${list.length === 1 ? "" : "s"}${active === "All" ? "" : ` in ${active}`}${industrySel.value ? ` for ${industrySel.value}` : ""}`;
      chips.querySelectorAll(".chip").forEach((b) => b.classList.toggle("active", b.dataset.cat === active));
      const p = new URLSearchParams();
      if (active !== "All") p.set("category", active);
      if (industrySel.value) p.set("industry", industrySel.value);
      if (q) p.set("q", q);
      history.replaceState(null, "", p.toString() ? `?${p}` : location.pathname);
    }

    chips.addEventListener("click", (e) => {
      const b = e.target.closest(".chip");
      if (!b) return;
      active = b.dataset.cat;
      render();
    });
    input.addEventListener("input", render);
    industrySel.addEventListener("change", render);
    render();
  }

  function tool() {
    submitLinks();
    const slug = new URLSearchParams(location.search).get("t");
    const t = TOOLS.find((x) => x.slug === slug);
    const root = document.getElementById("tool");
    if (!t) {
      root.innerHTML = `<div class="notfound"><h1>Tool not found</h1><p><a href="index.html">Back to all tools</a></p></div>`;
      return;
    }
    document.title = `${t.name} reviews & overview — The Revues`;
    document.querySelector('meta[name="description"]').content = `${t.name}: ${summary(t)}`;

    const list = (items, cls) => (items && items.length ? `<ul class="${cls}">${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : "");
    const reviews = (t.reviews || []).length
      ? t.reviews
          .map(
            (r) => `<figure class="review"><blockquote>“${esc(r.quote)}”</blockquote>
          <figcaption><strong>${esc(r.author)}</strong>${r.role ? `, ${esc(r.role)}` : ""}${r.company ? ` at ${esc(r.company)}` : ""}${r.source ? ` <span class="muted">· via ${esc(r.source)}</span>` : ""}</figcaption></figure>`
          )
          .join("")
      : `<div class="review empty-reviews"><p>We're collecting reviews of ${esc(t.name)}. Use it? <a data-submit href="#">Share your review</a>.</p></div>`;

    const ratingsBlock = (t.ratings || []).length
      ? `<div class="ratings">${t.ratings
          .map(
            (r) => `<a class="rating-src" href="${esc(r.url)}" target="_blank" rel="noopener">
          <span class="rating-big">${r.rating.toFixed(1)}</span>
          <span>${stars(r.rating)}<br /><span class="muted">${r.count ? `${r.count.toLocaleString()} reviews on ` : "on "}${esc(r.source)} ↗</span></span></a>`
          )
          .join("")}</div>`
      : "";

    const related = TOOLS.filter((x) => x.category === t.category && x.slug !== t.slug).slice(0, 3);

    root.innerHTML = `
      <a class="back" href="index.html?category=${encodeURIComponent(t.category)}">← ${esc(t.category)}</a>
      <section class="tool-head">
        ${logo(t, "lg")}
        <div class="tool-title">
          <h1>${esc(t.name)}</h1>
          <p class="lede">${esc(summary(t))}</p>
          <div class="rating">${t.event ? `📅 ${eventLine(t)}` : ratingLine(topRating(t))}</div>
        </div>
        <div class="tool-actions">
          ${domain(t.url) ? `<a class="btn" href="${esc(t.url)}" target="_blank" rel="noopener">Visit ${esc(domain(t.url))} ↗</a>` : ""}
        </div>
      </section>

      <div class="tool-body">
        <div>
          ${t.description && t.description !== t.tagline ? `<h2>Overview</h2>
          <p>${esc(t.description)}</p>` : ""}
          ${t.pros?.length || t.cons?.length ? `<div class="proscons">
            <div><h3>What users like</h3>${list(t.pros, "pros")}</div>
            <div><h3>What to watch for</h3>${list(t.cons, "cons")}</div>
          </div>` : ""}
          <h2>Reviews</h2>
          ${ratingsBlock}
          ${reviews}
        </div>
        <aside class="facts">
          <dl>
            <dt>Category</dt><dd><a href="index.html?category=${encodeURIComponent(t.category)}">${esc(t.category)}</a>${t.type ? ` · ${esc(t.type)}` : ""}</dd>
            ${t.event ? `<dt>When</dt><dd>${esc(t.event.dates)}</dd>${t.event.location ? `<dt>Where</dt><dd>${esc(t.event.location)}</dd>` : ""}` : ""}
            ${t.industries?.length ? `<dt>Industries</dt><dd>${t.industries.map((i) => `<a href="index.html?industry=${encodeURIComponent(i)}">${esc(i)}</a>`).join(", ")}</dd>` : ""}
            ${t.tags?.length ? `<dt>Features</dt><dd class="tag-list">${t.tags.map((x) => `<span class="tag">${esc(x)}</span>`).join("")}</dd>` : ""}
            ${t.bestFor ? `<dt>Best for</dt><dd>${esc(t.bestFor)}</dd>` : ""}
            ${t.pricing ? `<dt>Pricing</dt><dd>${esc(t.pricing)}</dd>` : ""}
            ${domain(t.url) ? `<dt>Website</dt><dd><a href="${esc(t.url)}" target="_blank" rel="noopener">${esc(domain(t.url))}</a></dd>` : ""}
          </dl>
        </aside>
      </div>

      ${related.length ? `<section class="related"><h2>More in ${esc(t.category)}</h2><div class="grid">${related.map(card).join("")}</div></section>` : ""}
    `;
    submitLinks();
  }

  return { home, tool };
})();
