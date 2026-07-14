import Parser from "rss-parser";
import { db, newsItemsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import { RSS_SOURCES } from "./rssSources";

const parser = new Parser({
  timeout: 10000,
  headers: { "User-Agent": "ChainsawTrainingApp/1.0 (news aggregator)" },
});

function extractGoogleUrl(raw: string): string {
  try {
    const parsed = new URL(raw);
    const dest = parsed.searchParams.get("url");
    if (dest) return decodeURIComponent(dest);
  } catch {
    // not a Google redirect — use as-is
  }
  return raw;
}

function buildGuid(sourceLabel: string, link: string, title: string): string {
  return `${sourceLabel}::${link || title}`;
}

export async function fetchAllFeeds(): Promise<{ fetched: number; inserted: number; skipped: number; errors: string[] }> {
  let fetched = 0;
  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const source of RSS_SOURCES) {
    try {
      const feed = await parser.parseURL(source.url);
      const items = feed.items ?? [];
      fetched += items.length;

      for (const item of items) {
        const rawLink = item.link ?? item.guid ?? "";
        const cleanLink = extractGoogleUrl(rawLink);
        const title = (item.title ?? "").replace(/<[^>]*>/g, "").trim();
        const excerpt = (item.contentSnippet ?? item.content ?? item.summary ?? "")
          .replace(/<[^>]*>/g, "")
          .trim()
          .slice(0, 400);
        const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();
        const guid = item.guid
          ? `${source.label}::${item.guid}`
          : buildGuid(source.label, cleanLink, title);

        if (!title || !cleanLink) {
          skipped++;
          continue;
        }

        // deduplication — skip if guid already exists
        const existing = await db
          .select({ id: newsItemsTable.id })
          .from(newsItemsTable)
          .where(eq(newsItemsTable.guid, guid))
          .limit(1);

        if (existing.length > 0) {
          skipped++;
          continue;
        }

        await db.insert(newsItemsTable).values({
          title,
          excerpt: excerpt || title,
          url: cleanLink,
          imageUrl: null,
          publishedAt: pubDate,
          status: "pending",
          guid,
          feedSource: source.label,
        });

        inserted++;
      }
    } catch (err) {
      const msg = `${source.label}: ${err instanceof Error ? err.message : String(err)}`;
      errors.push(msg);
      logger.warn({ source: source.label, err }, "RSS fetch failed — skipping source");
    }
  }

  logger.info({ fetched, inserted, skipped, errors: errors.length }, "RSS fetch complete");
  return { fetched, inserted, skipped, errors };
}
