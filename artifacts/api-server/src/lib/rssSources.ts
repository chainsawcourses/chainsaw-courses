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
    label: "Forestry England",
    url: "https://www.forestryengland.uk/articles/rss.xml",
    country: "UK",
  },
  {
    label: "HSE Press Releases",
    url: "https://press.hse.gov.uk/feed/",
    country: "UK",
  },
  {
    label: "Arboricultural Association",
    url: "https://www.trees.org.uk/News/RSS",
    country: "UK",
  },

  // ── Chainsaw Manufacturers ───────────────────────────────────────────────
  {
    label: "STIHL UK Blog",
    url: "https://blog.stihl.co.uk/feed/",
    country: "UK",
  },
  {
    label: "Husqvarna Newsroom",
    url: "https://www.husqvarna.com/uk/newsroom/feed/",
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
    label: "US Forest Service News",
    url: "https://www.fs.usda.gov/feeds/news/newsReleases.xml",
    country: "US",
  },
  {
    label: "Forest2Market",
    url: "https://www.forest2market.com/blog/rss.xml",
    country: "US",
  },

  // ── Canada ───────────────────────────────────────────────────────────────
  {
    label: "TimberWest Magazine",
    url: "https://www.timberwestmagazine.com/feed/",
    country: "Canada",
  },
  {
    label: "Canadian Forest Industries",
    url: "https://www.canadianforestindustries.ca/feed/",
    country: "Canada",
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
