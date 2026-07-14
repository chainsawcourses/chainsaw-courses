import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, ArrowLeft, Biohazard, CheckCircle2, ClipboardCheck, MinusCircle, Search, X, XCircle } from "lucide-react";
import { useListAllInspections, getListAllInspectionsQueryKey } from "@workspace/api-client-react";
import { useAdminSession } from "../../contexts/AdminContext";

export default function Inspections() {
  const [, setLocation] = useLocation();
  const { adminToken, isReady } = useAdminSession();

  useEffect(() => {
    if (isReady && !adminToken) {
      setLocation("/admin");
    }
  }, [isReady, adminToken, setLocation]);

  const { data: inspections, isLoading } = useListAllInspections({
    query: { queryKey: getListAllInspectionsQueryKey(), enabled: !!adminToken },
  });

  const [search, setSearch] = useState("");
  const [failuresOnly, setFailuresOnly] = useState(false);

  const failureCount = inspections?.filter((i) => i.hasFailures).length ?? 0;

  const q = search.trim().toLowerCase();
  const filtered = inspections?.filter((r) => {
    const matchesSearch = !q ||
      (r.studentName ?? "").toLowerCase().includes(q) ||
      (r.sawIdentifier ?? "").toLowerCase().includes(q);
    const matchesFilter = !failuresOnly || r.hasFailures;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center font-mono font-bold uppercase tracking-widest text-sm text-primary">
            <Biohazard className="w-5 h-5 mr-2 inline" /> INSPECTION RECORDS
          </div>
          <Button variant="outline" size="sm" className="font-mono text-xs" asChild>
            <Link href="/admin/dashboard">
              <ArrowLeft className="w-4 h-4 mr-2" /> BACK TO DASHBOARD
            </Link>
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <Card className="bg-secondary/20">
          <CardContent className="p-4 flex items-center gap-3">
            <ClipboardCheck className="w-5 h-5 text-primary" />
            <span className="font-mono text-sm">
              {inspections
                ? `${inspections.length} inspection${inspections.length === 1 ? "" : "s"} recorded, ${failureCount} with failed items`
                : "No inspections submitted yet"}
            </span>
          </CardContent>
        </Card>

        {/* Search + filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by student name or saw identifier…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-10 h-10 font-mono text-sm bg-card"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <Button
            variant={failuresOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setFailuresOnly((v) => !v)}
            className="font-mono text-xs h-10 shrink-0"
          >
            <AlertTriangle className="w-3.5 h-3.5 mr-1.5" /> Failures only
          </Button>
        </div>

        {isLoading && (
          <div className="font-mono text-sm text-muted-foreground uppercase tracking-widest">Loading...</div>
        )}

        {!isLoading && filtered?.length === 0 && (
          <p className="text-center text-muted-foreground font-mono text-sm py-8">
            {q || failuresOnly ? "No records match your search" : "No inspections submitted yet"}
          </p>
        )}

        <div className="space-y-3">
          {filtered?.map((record) => (
            <Card key={record.id} className={record.hasFailures ? "border-destructive/50" : undefined}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-sm font-mono">
                  <span>{record.studentName ?? "Unknown student"}</span>
                  {record.hasFailures ? (
                    <span className="flex items-center gap-1 text-destructive text-xs uppercase tracking-widest">
                      <AlertTriangle className="w-4 h-4" /> Failures noted
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-primary text-xs uppercase tracking-widest">
                      <CheckCircle2 className="w-4 h-4" /> All clear
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm font-mono text-muted-foreground space-y-2">
                <div className="text-[10px] uppercase tracking-widest opacity-60">
                  {record.sawIdentifier ? `${record.sawIdentifier} — ` : ""}{new Date(record.createdAt).toLocaleString()}
                </div>
                <div className="grid sm:grid-cols-2 gap-1.5">
                  {record.items.map((item) => (
                    <div key={item.id} className="flex items-start gap-2 text-xs">
                      {item.status === "pass" && <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />}
                      {item.status === "fail" && <XCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />}
                      {item.status === "na" && <MinusCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />}
                      <div>
                        <span className={item.status === "fail" ? "text-destructive" : ""}>{item.label}</span>
                        {item.status === "fail" && item.note && (
                          <p className="text-destructive/80 italic mt-0.5">"{item.note}"</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
