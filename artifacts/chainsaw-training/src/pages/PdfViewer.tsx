import { ArrowLeft } from "lucide-react";
import { Link, useSearch } from "wouter";
import { Button } from "@/components/ui/button";

export default function PdfViewer() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const url = params.get("url") ?? "";
  const title = params.get("title") ?? "Document";
  const back = params.get("back") ?? "/training";

  return (
    <div className="min-h-screen flex flex-col">
      {/* Sticky header with back button — always visible */}
      <header className="border-b border-border bg-card sticky top-0 z-50 shrink-0">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Button variant="ghost" size="sm" className="font-mono text-xs" asChild>
            <Link href={back}>
              <ArrowLeft className="w-4 h-4 mr-2" /> BACK
            </Link>
          </Button>
          <div className="font-mono text-sm font-bold uppercase truncate max-w-[60vw]">{title}</div>
          <div className="w-[80px]" />
        </div>
      </header>

      {/* PDF iframe — fills remaining viewport */}
      <main className="flex-1 flex flex-col">
        {url ? (
          <iframe
            src={url}
            className="flex-1 w-full border-0"
            style={{ minHeight: "calc(100vh - 64px)" }}
            title={title}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center font-mono text-muted-foreground text-sm">
            No document URL provided.
          </div>
        )}
      </main>
    </div>
  );
}
