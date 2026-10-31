// Rendering for the homepage directory and individual tool pages.
window.Revues = (function () {
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const domain = (url) => new URL(url).hostname.replace(/^www\./, "");

  function logo(tool, size) {
    const initials = tool.name.replace(/[^A-Za-z0-9 ]/g, "").split(" ").map((w) => w[0]).join("").slice(0, 2);
    const src = tool.logo || `https://www.google.com/s2/favicons?domain=${domain(tool.url)}&sz=128`;
    return `<div class="logo-box logo-${size}"><img src="${esc(src)}" alt="" loading="lazy"
      onerror="this.remove()" /><span>${esc(initials)}</span></div>`;
  }

  function stars(rating) {
    const full = Math.round(rating * 2) / 2;
    let out = "";
    for (let i = 1; i <= 5; i++) out += i <= full ? "★" : i - 0.5 === full ? "⯪" : "☆";
    return `<span class="stars" aria-label="${rating} out of 5">${out}</span>`;
  }

  function ratingLine(tool) {
    if (tool.rating == null) return `<span class="muted">Reviews coming soon</span>`;
    const count = tool.reviewCount ? ` · ${tool.reviewCount.toLocaleString()} reviews` : "";
    const src = tool.reviewSource ? ` on ${esc(tool.reviewSource.name)}` : "";
    return `${stars(tool.rating)} <strong>${tool.rating.toFixed(1)}</strong><span class="muted">${count}${src}</span>`;
  }

  function submitLinks() {
    const href = `mailto:${SITE.contactEmail}?subject=${encodeURIComponent("Tool submission for The Revues")}`;
    document.querySelectorAll("[data-submit]").forEach((a) => (a.href = href));
    document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
  }

  function card(t) {
    return `<a class="card" href="tool.html?t=${encodeURIComponent(t.slug)}">
      <div class="card-top">${logo(t, "md")}
        <div><h3>${esc(t.name)}</h3><span class="tag">${esc(t.category)}</span></div>
      </div>
      <p>${esc(t.tagline)}</p>
      <div class="card-foot"><span class="rating">${ratingLine(t)}</span></div>
    </a>`;
  }

  function home() {
    submitLinks();
    document.querySelector("[data-tagline]").textContent = SITE.tagline;
    const params = new URLSearchParams(location.search);
    let active = params.get("category") || "All";
    const input = document.getElementById("search");
    input.value = params.get("q") || "";

    const chips = document.getElementById("chips");
    const counts = {};
    TOOLS.forEach((t) => (counts[t.category] = (counts[t.category] || 0) + 1));
    chips.innerHTML = ["All", ...SITE.categories]
      .map((c) => `<button class="chip" data-cat="${esc(c)}">${esc(c)} <span>${c === "All" ? TOOLS.length : counts[c] || 0}</span></button>`)
      .join("");

    const sorted = [...TOOLS].sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || (b.rating ?? 0) - (a.rating ?? 0));

    function render() {
      const q = input.value.trim().toLowerCase();
      const list = sorted.filter(
        (t) =>
          (active === "All" || t.category === active) &&
          (!q || [t.name, t.tagline, t.description, t.category, t.bestFor].join(" ").toLowerCase().includes(q))
      );
      document.getElementById("grid").innerHTML = list.map(card).join("");
      document.getElementById("empty").hidden = list.length > 0;
      document.getElementById("count").textContent = `${list.length} tool${list.length === 1 ? "" : "s"}${active === "All" ? "" : ` in ${active}`}`;
      chips.querySelectorAll(".chip").forEach((b) => b.classList.toggle("active", b.dataset.cat === active));
      const p = new URLSearchParams();
      if (active !== "All") p.set("category", active);
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
    document.querySelector('meta[name="description"]').content = `${t.name}: ${t.tagline}`;

    const list = (items, cls) => (items && items.length ? `<ul class="${cls}">${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : "");
    const reviews = (t.reviews || []).length
      ? t.reviews
          .map(
            (r) => `<figure class="review"><blockquote>“${esc(r.quote)}”</blockquote>
          <figcaption><strong>${esc(r.author)}</strong>${r.role ? `, ${esc(r.role)}` : ""}${r.company ? ` at ${esc(r.company)}` : ""}${r.source ? ` <span class="muted">· via ${esc(r.source)}</span>` : ""}</figcaption></figure>`
          )
          .join("")
      : `<div class="review empty-reviews"><p>We're collecting reviews for ${esc(t.name)}. Use it? <a data-submit href="#">Share your review</a>.</p></div>`;

    const related = TOOLS.filter((x) => x.category === t.category && x.slug !== t.slug).slice(0, 3);

    root.innerHTML = `
      <a class="back" href="index.html?category=${encodeURIComponent(t.category)}">← ${esc(t.category)}</a>
      <section class="tool-head">
        ${logo(t, "lg")}
        <div class="tool-title">
          <h1>${esc(t.name)}</h1>
          <p class="lede">${esc(t.tagline)}</p>
          <div class="rating">${ratingLine(t)}</div>
        </div>
        <div class="tool-actions">
          <a class="btn" href="${esc(t.url)}" target="_blank" rel="noopener">Visit ${esc(domain(t.url))} ↗</a>
          ${t.reviewSource ? `<a class="btn btn-ghost" href="${esc(t.reviewSource.url)}" target="_blank" rel="noopener">All reviews on ${esc(t.reviewSource.name)} ↗</a>` : ""}
        </div>
      </section>

      <div class="tool-body">
        <div>
          <h2>Overview</h2>
          <p>${esc(t.description)}</p>
          ${t.pros?.length || t.cons?.length ? `<div class="proscons">
            <div><h3>What users like</h3>${list(t.pros, "pros")}</div>
            <div><h3>What to watch for</h3>${list(t.cons, "cons")}</div>
          </div>` : ""}
          <h2>Reviews</h2>
          ${reviews}
        </div>
        <aside class="facts">
          <dl>
            <dt>Category</dt><dd><a href="index.html?category=${encodeURIComponent(t.category)}">${esc(t.category)}</a></dd>
            ${t.bestFor ? `<dt>Best for</dt><dd>${esc(t.bestFor)}</dd>` : ""}
            ${t.pricing ? `<dt>Pricing</dt><dd>${esc(t.pricing)}</dd>` : ""}
            <dt>Website</dt><dd><a href="${esc(t.url)}" target="_blank" rel="noopener">${esc(domain(t.url))}</a></dd>
          </dl>
        </aside>
      </div>

      ${related.length ? `<section class="related"><h2>More in ${esc(t.category)}</h2><div class="grid">${related.map(card).join("")}</div></section>` : ""}
    `;
    submitLinks();
  }

  return { home, tool };
})();
