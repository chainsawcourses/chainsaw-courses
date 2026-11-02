import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAdminSession } from "@/contexts/AdminContext";
import WebsitePurchaseReview from "./WebsitePurchaseReview";

export default function WebsitePurchaseReviewPage() {
  const [, setLocation] = useLocation();
  const { adminToken, isReady } = useAdminSession();

  useEffect(() => {
    if (isReady && !adminToken) setLocation("/admin");
  }, [isReady, adminToken, setLocation]);

  if (!isReady || !adminToken) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <Button variant="outline" size="sm" className="font-mono text-xs" asChild>
            <Link href="/admin/dashboard">
              <ArrowLeft className="mr-1 h-4 w-4" /> DASHBOARD
            </Link>
          </Button>
          <h1 className="min-w-0 font-mono text-sm font-bold uppercase tracking-wide">
            Website purchase email review
          </h1>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <WebsitePurchaseReview adminToken={adminToken} />
      </main>
    </div>
  );
}
