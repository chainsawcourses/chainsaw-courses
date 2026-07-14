export interface RssSource {
  label: string;
  url: string;
  country: string;
}

export const RSS_SOURCES: RssSource[] = [
  // ── UK ──────────────────────────────────────────────────────────────────
  {
    label: "Forestry Commission",
    url: "https://www.gov.uk/search/news-and-communications.atom?organisations[]=forestry-commission",
    country: "UK",
  },
  {
    label: "Woodlands.co.uk",
    url: "https://www.woodlands.co.uk/blog/feed/",
    country: "UK",
  },
  {
    label: "HSE Press Releases",
    url: "https://press.hse.gov.uk/feed/",
    country: "UK",
  },
  {
    label: "Tree Care Industry",
    url: "https://www.treecareindustry.org/feed/",
    country: "US",
  },

  // ── Chainsaw Manufacturers ───────────────────────────────────────────────
  {
    label: "STIHL UK Blog",
    url: "https://blog.stihl.co.uk/feed/",
    country: "UK",
  },
  {
    label: "ProArborist",
    url: "https://www.proarborist.com/feed/",
    country: "Global",
  },
  {
    label: "Chainsaw Journal",
    url: "https://www.chainsawjournal.com/feed/",
    country: "Global",
  },

  // ── United States ────────────────────────────────────────────────────────
  {
    label: "Timber Harvesting Magazine",
    url: "https://timberharvesting.com/feed/",
    country: "US",
  },
  {
    label: "Woodworking Network",
    url: "https://www.woodworkingnetwork.com/rss.xml",
    country: "US",
  },
  {
    label: "Forest2Market",
    url: "https://www.forest2market.com/blog/rss.xml",
    country: "US",
  },

  // ── Canada ───────────────────────────────────────────────────────────────
  {
    label: "Sawmilling.com",
    url: "https://www.sawmilling.com/feed/",
    country: "Canada",
  },
  {
    label: "Landward",
    url: "https://www.landward.eu/feed/",
    country: "UK",
  },

  // ── Australia ────────────────────────────────────────────────────────────
  {
    label: "AUSFPA (Australian Forest Products)",
    url: "https://ausfpa.com.au/feed/",
    country: "Australia",
  },
  {
    label: "Timberbiz",
    url: "https://timberbiz.com.au/feed/",
    country: "Australia",
  },
];
