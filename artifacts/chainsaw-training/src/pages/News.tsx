import { ExternalLink, Newspaper, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useListNewsItems } from "@workspace/api-client-react";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function News() {
  const { data: items, isLoading, isError } = useListNewsItems();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center gap-3">
          <Newspaper className="w-5 h-5 text-primary" />
          <span className="font-mono font-bold uppercase tracking-widest text-sm text-primary">
            Industry News
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-4">
        <p className="text-muted-foreground text-sm font-mono">
          Recent arboriculture and forestry news curated by your training provider.
          Click any article to read it on the original source.
        </p>

        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-12 justify-center">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Loading news…
          </div>
        )}

        {isError && (
          <div className="text-destructive text-sm py-12 text-center font-mono">
            Failed to load news. Please try again later.
          </div>
        )}

        {!isLoading && !isError && items?.length === 0 && (
          <div className="text-muted-foreground text-sm py-12 text-center font-mono">
            No news articles posted yet. Check back soon.
          </div>
        )}

        {items?.map((item) => (
          <a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block group"
          >
            <Card className="hover:border-primary/60 transition-colors cursor-pointer">
              <CardContent className="p-0">
                <div className="flex gap-4 p-4">
                  {item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="w-24 h-20 object-cover rounded shrink-0 bg-muted"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  )}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="font-mono font-bold text-sm leading-snug group-hover:text-primary transition-colors line-clamp-2">
                        {item.title}
                      </h2>
                      <ExternalLink className="w-3.5 h-3.5 shrink-0 mt-0.5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <p className="text-muted-foreground text-xs leading-relaxed line-clamp-2">
                      {item.excerpt}
                    </p>
                    <Badge variant="outline" className="font-mono text-xs">
                      {formatDate(item.publishedAt)}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </a>
        ))}
      </main>
    </div>
  );
}
