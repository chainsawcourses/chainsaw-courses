import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListWebsitePurchaseSeatsForReviewQueryKey,
  useListWebsitePurchaseSeatsForReview,
  useResolveWebsitePurchaseSeat,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

type Resolution = "confirmed_received" | "manual_handoff" | "closed_unresolved";

export default function WebsitePurchaseReview({ adminToken }: { adminToken: string }) {
  const queryClient = useQueryClient();
  const key = getListWebsitePurchaseSeatsForReviewQueryKey();
  const { data, isLoading, isError } = useListWebsitePurchaseSeatsForReview({
    query: { enabled: !!adminToken, refetchInterval: 60_000 },
  });
  const resolve = useResolveWebsitePurchaseSeat({
    mutation: {
      onSuccess: () => {
        setCode(null);
        setNote("");
        setSelected(null);
        queryClient.invalidateQueries({ queryKey: key });
      },
    },
  });
  const [selected, setSelected] = useState<number | null>(null);
  const [resolution, setResolution] = useState<Resolution>("confirmed_received");
  const [note, setNote] = useState("");
  const [code, setCode] = useState<{ id: number; value: string } | null>(null);
  const [revealError, setRevealError] = useState("");
  const [revealing, setRevealing] = useState(false);
  const [showResolved, setShowResolved] = useState(false);

  async function reveal(id: number) {
    setCode(null);
    setRevealError("");
    setRevealing(true);
    try {
      const response = await fetch(`/api/admin/website-purchase-seats/${id}/code`, {
        headers: { admintoken: adminToken },
        cache: "no-store",
      });
      const body = await response.json() as { code?: string; error?: string };
      if (!response.ok || !body.code) throw new Error(body.error || "Could not reveal the code");
      setCode({ id, value: body.code });
    } catch (error) {
      setRevealError(error instanceof Error ? error.message : "Could not reveal the code");
      queryClient.invalidateQueries({ queryKey: key });
    } finally {
      setRevealing(false);
    }
  }

  const unresolved = data?.filter((seat) => !seat.resolution) ?? [];
  const resolved = data?.filter((seat) => !!seat.resolution) ?? [];
  const visible = showResolved ? resolved : unresolved;

  return (
    <Card className="border-border bg-card/30">
      <CardHeader className="pb-3">
        <CardTitle className="font-mono text-sm uppercase tracking-widest">
          Website purchase email review <Badge variant="outline" className="ml-2 rounded-none">{unresolved.length}</Badge>
        </CardTitle>
        <p className="font-mono text-xs text-muted-foreground">
          SMTP delivery may be uncertain. Check delivery evidence before contacting the buyer. Nothing here sends an automatic email or issues a new code.
        </p>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex flex-wrap gap-2">
          <Button type="button" size="sm" variant={!showResolved ? "default" : "outline"} onClick={() => { setShowResolved(false); setCode(null); }}>Needs review</Button>
          <Button type="button" size="sm" variant={showResolved ? "default" : "outline"} onClick={() => { setShowResolved(true); setCode(null); }}>Resolved ({resolved.length})</Button>
        </div>
        {isLoading ? <p className="text-xs">Loading purchase seats…</p> :
          isError ? <p role="alert" className="text-xs text-destructive">Purchase email review could not be loaded.</p> :
          visible.length === 0 ? <p className="text-xs text-muted-foreground">No {showResolved ? "resolved" : "outstanding"} purchase emails in the recent queue.</p> :
          <div className="max-h-[36rem] space-y-3 overflow-y-auto">
            {visible.map((seat) => (
              <article key={seat.id} className="min-w-0 border border-border p-3 font-mono text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="break-all">Order {seat.orderId} / line {seat.lineItemId} / seat {seat.seatId}</strong>
                  <Badge variant="outline" className="rounded-none">{seat.emailStatus.replaceAll("_", " ")}</Badge>
                  <Badge variant="outline" className="rounded-none">{seat.status}</Badge>
                  <Badge variant="outline" className="rounded-none">Code {seat.isPaused === null ? "missing" : seat.isPaused ? "paused" : "active"}</Badge>
                </div>
                <p className="mt-2 break-all">{seat.email ?? "No buyer email recorded"} · Updated {new Date(seat.updatedAt).toLocaleString("en-GB")}</p>
                {seat.resolution ? (
                  <p className="mt-2 break-words text-muted-foreground">
                    {seat.resolution.replaceAll("_", " ")} by {seat.resolvedBy ?? "administrator"} on {seat.resolvedAt ? new Date(seat.resolvedAt).toLocaleString("en-GB") : "unknown date"} — {seat.resolutionNote}
                  </p>
                ) : !seat.reviewable ? (
                  <p className="mt-2 text-muted-foreground">
                    {seat.status === "revoked" ? "Reversed; no handoff permitted." : "Sending may still be in progress. Review is available after 10 minutes."}
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    <Button type="button" size="sm" variant="outline" disabled={seat.isPaused !== false || revealing} onClick={() => reveal(seat.id)}>
                      Reveal existing code for manual handoff
                    </Button>
                    {seat.isPaused && <p>Code is paused. Do not hand it to the learner until its access has been checked.</p>}
                    {code?.id === seat.id && <p className="break-all border border-amber-600/40 p-2">Existing code: <strong>{code.value}</strong> — never send a second automated email.</p>}
                    {revealError && selected === seat.id && <p role="alert" className="text-destructive">{revealError}</p>}
                    {selected === seat.id ? (
                      <div className="space-y-2">
                        <label className="block">Outcome
                          <select value={resolution} onChange={(event) => setResolution(event.target.value as Resolution)} className="mt-1 block w-full max-w-sm border border-input bg-background p-2">
                            <option value="confirmed_received">Buyer confirmed receipt</option>
                            <option value="manual_handoff">Existing code handed off manually</option>
                            <option value="closed_unresolved">Closed without confirmed delivery</option>
                          </select>
                        </label>
                        <label className="block">Evidence / support note
                          <Textarea value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} placeholder="Record how delivery was checked or how the buyer was contacted" className="mt-1 max-w-xl" />
                        </label>
                        {resolve.isError && <p role="alert" className="text-destructive">Could not save resolution. Refresh and check the seat state.</p>}
                        <Button type="button" size="sm" disabled={!note.trim() || resolve.isPending || (resolution === "manual_handoff" && (seat.isPaused || code?.id !== seat.id))} onClick={() => resolve.mutate({ id: seat.id, data: { resolution, note: note.trim() } })}>
                          {resolve.isPending ? "Saving…" : "Record resolution"}
                        </Button>
                      </div>
                    ) : <Button type="button" size="sm" variant="outline" onClick={() => { setSelected(seat.id); setCode(null); setRevealError(""); setNote(""); setResolution("confirmed_received"); }}>Resolve</Button>}
                  </div>
                )}
              </article>
            ))}
          </div>}
      </CardContent>
    </Card>
  );
}