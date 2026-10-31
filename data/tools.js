// The Revues — directory data.
// To add a listing, copy an entry and edit it. That's the whole CMS.
//
// Fields:
//   slug        url id (lowercase, dashes)                       required
//   name        display name                                     required
//   url         website                                          required
//   category    one of SITE.categories                           required
//   type        sub-label shown on the card, e.g. "Canvassing app"
//   tagline     one line, what it is                             required
//   description a short paragraph                                required
//   bestFor     who it's for
//   pricing     e.g. "Free plan · paid per user/month"
//   pros, cons  short bullet lists
//   ratings     real ratings, best source first — the first one shows on the card:
//               [{ source: "G2", rating: 4.5, count: 430, url: "https://www.g2.com/..." }]
//   reviews     quotes from real reviewers: [{ quote, author, role, company, source }]
//   event       events only: { dates: "Jan 28–30, 2027", location: "Utah" }
//   featured    true to pin near the top of the directory
//
// Only enter ratings and quotes you've taken from the source you link.

window.SITE = {
  name: "The Revues",
  tagline:
    "The software, professional services and events door-to-door home service businesses should know about — with real reviews.",
  contactEmail: "hello@therevues.com", // TODO: confirm address
  categories: ["Software", "Professional Services", "Events"],

  // "The Featured Stack" on the homepage: one pick per job, in order.
  featuredStack: [
    { job: "Canvassing & territory", slug: "salesrabbit" },
    { job: "Field sales CRM", slug: "spotio" },
    { job: "Follow-up & digital card", slug: "repcard" },
    { job: "Rep training", slug: "d2du" },
    { job: "Conference", slug: "d2dcon" },
  ],
};

window.TOOLS = [
  // ── Software ────────────────────────────────────────────────
  {
    slug: "salesrabbit",
    name: "SalesRabbit",
    url: "https://salesrabbit.com",
    category: "Software",
    type: "Canvassing app",
    tagline: "Door-to-door canvassing app for territory, leads and rep tracking.",
    description:
      "SalesRabbit is one of the longest-running door-to-door sales apps. Managers draw territories and assign them to reps, reps log every knock and lead on a map, and leaderboards and reporting show who's producing.",
    bestFor: "D2D teams in solar, roofing, pest control, security and other home services.",
    pricing: "Paid per user/month",
    pros: ["Territory mapping and assignment", "Lead tracking on a map", "Leaderboards and rep reporting"],
    cons: ["Some reviewers report mobile app glitches"],
    ratings: [
      { source: "G2", rating: 4.5, count: 430, url: "https://www.g2.com/sellers/salesrabbit" },
      { source: "Capterra", rating: 4.2, count: 191, url: "https://www.capterra.com/p/157329/Sales-Rabbit/reviews/" },
    ],
    reviews: [],
    featured: true,
  },
  {
    slug: "spotio",
    name: "SPOTIO",
    url: "https://spotio.com",
    category: "Software",
    type: "Field sales CRM",
    tagline: "Field sales CRM with territory mapping, route planning and activity tracking.",
    description:
      "SPOTIO is a field sales platform for outside and door-to-door teams: territory management, route planning, lead and activity tracking, and manager reporting, with CRM integrations.",
    bestFor: "Outside sales and D2D teams that need territory and activity visibility.",
    pricing: "Paid per user/month",
    pros: ["Territory and route planning", "Activity tracking and reporting", "CRM integrations"],
    cons: ["Some reviewers report mobile app usability issues"],
    ratings: [{ source: "G2", rating: 4.5, count: 400, url: "https://www.g2.com/products/spotio/reviews" }],
    reviews: [],
    featured: true,
  },
  {
    slug: "repcard",
    name: "RepCard",
    url: "https://repcard.com",
    category: "Software",
    type: "Field sales platform",
    tagline: "Digital business cards and automated follow-up for field reps.",
    description:
      "RepCard gives each rep a digital business card and automates follow-up with homeowners, alongside lead tracking, leaderboards and team management for outside sales.",
    bestFor: "D2D teams that want consistent follow-up after the knock.",
    pricing: "Contact sales",
    pros: ["Automated follow-up", "Lead tracking", "Digital business cards"],
    cons: ["Online only — no offline mode, per reviewers"],
    ratings: [{ source: "G2", rating: 4.3, count: 5, url: "https://www.g2.com/sellers/repcard" }],
    reviews: [],
  },
  {
    slug: "enzy",
    name: "Enzy",
    url: "https://www.enzy.co",
    category: "Software",
    type: "Gamification & incentives",
    tagline: "Leaderboards, competitions and incentives to drive rep performance.",
    description:
      "Enzy is a sales performance app with interactive leaderboards, competitions, incentive management and analytics, used by field sales teams to keep reps motivated.",
    bestFor: "Managers who run competitions and incentives for their reps.",
    pricing: "Contact sales",
    pros: ["Live leaderboards", "Competition and incentive management", "Performance analytics"],
    cons: [],
    ratings: [],
    reviews: [],
  },

  // ── Professional Services ──────────────────────────────────
  {
    slug: "d2du",
    name: "D2D University",
    url: "https://d2du.com",
    category: "Professional Services",
    type: "Sales training",
    tagline: "On-demand door-to-door sales training from The D2D Experts.",
    description:
      "D2D University is an online training library for door-to-door reps and managers, with industry-specific tracks such as solar. Run by The D2D Experts.",
    bestFor: "Teams that want to onboard and level up reps at scale.",
    pricing: "Subscription",
    pros: ["Large video library", "Industry-specific tracks", "Self-paced for reps"],
    cons: [],
    ratings: [],
    reviews: [],
    featured: true,
  },
  {
    slug: "ownersos",
    name: "OwnersOS",
    url: "https://ownersos.com",
    category: "Professional Services",
    type: "Business coaching",
    tagline: "Operating system and coaching for home service companies scaling past $1M.",
    description:
      "OwnersOS helps home service company owners build the systems, team and processes to scale from $1M to $20M and beyond.",
    bestFor: "Owners of growing home service companies.",
    pricing: "Contact for pricing",
    pros: [],
    cons: [],
    ratings: [],
    reviews: [],
  },

  // ── Events ──────────────────────────────────────────────────
  {
    slug: "d2dcon",
    name: "D2DCon 10",
    url: "https://d2dcon.com",
    category: "Events",
    type: "Conference",
    tagline: "The largest door-to-door sales conference.",
    description:
      "D2DCon brings together door-to-door sales reps, managers and owners for training, keynotes and networking. The 10th edition is in Utah.",
    bestFor: "Reps, managers and owners in D2D sales.",
    event: { dates: "Jan 28–30, 2027", location: "Utah" },
    ratings: [],
    reviews: [],
    featured: true,
  },
];
