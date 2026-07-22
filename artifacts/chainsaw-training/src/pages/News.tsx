import { ArrowLeft, Bell, BellOff, ExternalLink, Newspaper, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useListNewsItems } from "@workspace/api-client-react";
import { usePushNotifications } from "../hooks/usePushNotifications";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function News() {
  const { data: items, isLoading, isError } = useListNewsItems();
  const { state: notifState, subscribe, unsubscribe } = usePushNotifications();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild className="font-mono uppercase tracking-widest text-xs">
            <Link href="/training">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Link>
          </Button>
          <Newspaper className="w-4 h-4 text-orange-500" />
          <span className="font-mono font-bold uppercase tracking-widest text-sm">
            Industry News
          </span>
          <div className="ml-auto">
            {notifState === "unsupported" ? null : notifState === "denied" ? (
              <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
                Notifications blocked
              </span>
            ) : notifState === "subscribed" ? (
              <Button
                size="sm"
                variant="outline"
                onClick={unsubscribe}
                className="font-mono text-[10px] uppercase tracking-widest gap-1.5"
              >
                <BellOff className="w-3.5 h-3.5" />
                Notifications On
              </Button>
            ) : notifState === "unsubscribed" ? (
              <Button
                size="sm"
                variant="outline"
                onClick={subscribe}
                className="font-mono text-[10px] uppercase tracking-widest gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
              >
                <Bell className="w-3.5 h-3.5" />
                Enable Notifications
              </Button>
            ) : (
              <RefreshCw className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-4">
        <div className="space-y-1 pb-2">
          <h1 className="font-black tracking-tighter text-xl uppercase text-foreground leading-tight">
            Stay Safe, Stay Sharp
          </h1>
          <p className="text-muted-foreground text-sm font-mono leading-relaxed">
            The industry moves fast — new legislation, equipment recalls, biosecurity alerts, and best-practice updates can directly affect how you work safely. These articles are hand-picked especially for you as a paying member and subscriber of chainsaw courses. Tap any headline to read the full story.
          </p>
        </div>

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
                      <h2 className="font-mono font-bold text-sm leading-snug text-orange-500 group-hover:text-orange-400 transition-colors line-clamp-2">
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
