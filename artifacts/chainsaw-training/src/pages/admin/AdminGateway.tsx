import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ArrowLeft, Plus, Pencil, Trash2, MapPin, Star, Users, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAdminSession } from "../../contexts/AdminContext";

interface Venue {
  id: number;
  name: string;
  address: string;
  town: string;
  county: string;
  postcode: string;
  lat: number;
  lng: number;
  email: string;
  phone: string;
  website?: string;
  tier: string;
  active: boolean;
  notes?: string;
}

interface EnquiryRow {
  enquiry: { id: number; status: string; createdAt: string; batchSentAt?: string; nudge7SentAt?: string; nudge12SentAt?: string };
  venue: { name: string; town: string } | null;
  user: { fullName: string; email: string } | null;
  passport: { postcode: string; phone: string } | null;
}

const EMPTY_VENUE: Omit<Venue, "id"> = {
  name: "", address: "", town: "", county: "", postcode: "",
  lat: 0, lng: 0, email: "", phone: "", website: "", tier: "silver", active: true, notes: "",
};

function statusBadgeClass(status: string) {
  if (status === "resolved") return "bg-green-500/15 text-green-700 border-green-400/40";
  if (status === "nudge12_sent") return "bg-red-500/15 text-red-700 border-red-400/40";
  if (status === "nudge7_sent" || status === "followup_requested") return "bg-amber-500/15 text-amber-700 border-amber-400/40";
  return "bg-secondary text-muted-foreground border-border";
}

export default function AdminGateway() {
  const { adminToken } = useAdminSession();
  const [tab, setTab] = useState<"venues" | "enquiries">("venues");
  const [venues, setVenues] = useState<Venue[]>([]);
  const [enquiries, setEnquiries] = useState<EnquiryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingVenue, setEditingVenue] = useState<Partial<Venue> | null>(null);
  const [saving, setSaving] = useState(false);

  const headers = { admintoken: adminToken ?? "", "Content-Type": "application/json" };

  const loadVenues = async () => {
    const r = await fetch("/api/admin/gateway/venues", { headers });
    if (r.ok) setVenues(await r.json());
    setLoading(false);
  };

  const loadEnquiries = async () => {
    const r = await fetch("/api/admin/gateway/enquiries", { headers });
    if (r.ok) setEnquiries(await r.json());
    setLoading(false);
  };

  useEffect(() => {
    if (tab === "venues") loadVenues();
    else loadEnquiries();
  }, [tab]);

  const saveVenue = async () => {
    if (!editingVenue) return;
    setSaving(true);
    try {
      const isNew = !editingVenue.id;
      const url = isNew ? "/api/admin/gateway/venues" : `/api/admin/gateway/venues/${editingVenue.id}`;
      const method = isNew ? "POST" : "PUT";
      const r = await fetch(url, { method, headers, body: JSON.stringify(editingVenue) });
      if (r.ok) { setEditingVenue(null); await loadVenues(); }
    } finally { setSaving(false); }
  };

  const deleteVenue = async (id: number) => {
    if (!confirm("Permanently delete this venue? This cannot be undone.")) return;
    await fetch(`/api/admin/gateway/venues/${id}`, { method: "DELETE", headers });
    await loadVenues();
  };

  const resolveEnquiry = async (id: number) => {
    await fetch(`/api/admin/gateway/enquiries/${id}/resolve`, { method: "POST", headers });
    await loadEnquiries();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-12 flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild className="font-mono uppercase tracking-widest text-xs">
            <Link href="/admin/dashboard"><ArrowLeft className="w-4 h-4 mr-1" /> Dashboard</Link>
          </Button>
          <span className="font-mono font-bold uppercase tracking-widest text-xs flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-[#e27226]" /> Assessment Network
          </span>
          <div className="w-24" />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        {/* Tabs */}
        <div className="flex gap-1 border border-border rounded-md p-1 bg-card/40 w-fit">
          {(["venues", "enquiries"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`font-mono text-xs uppercase tracking-widest px-4 py-1.5 rounded transition-colors ${tab === t ? "bg-[#e27226] text-white font-bold" : "text-muted-foreground hover:text-foreground"}`}>
              {t === "venues" ? <><MapPin className="w-3 h-3 inline mr-1" />Venues</> : <><Users className="w-3 h-3 inline mr-1" />Enquiries</>}
            </button>
          ))}
        </div>

        {/* ── Venues tab ── */}
        {tab === "venues" && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="font-mono font-bold uppercase tracking-widest text-sm">Assessment Venues</h2>
              <Button size="sm" className="font-mono tracking-widest text-xs gap-1.5" onClick={() => setEditingVenue({ ...EMPTY_VENUE })}>
                <Plus className="w-3.5 h-3.5" /> Add Venue
              </Button>
            </div>

            {editingVenue && (
              <Card className="border-[#e27226]/30 bg-card">
                <CardContent className="p-4 space-y-3">
                  <h3 className="font-mono font-bold text-xs uppercase tracking-widest">{editingVenue.id ? "Edit Venue" : "New Venue"}</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      ["name", "Venue Name"], ["address", "Address"], ["town", "Town"],
                      ["county", "County"], ["postcode", "Postcode"], ["email", "Email"],
                      ["phone", "Phone"], ["website", "Website (optional)"],
                    ] as [keyof Venue, string][]).map(([field, label]) => (
                      <div key={field}>
                        <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">{label}</label>
                        <input
                          value={(editingVenue[field] as string) ?? ""}
                          onChange={e => setEditingVenue(prev => ({ ...prev!, [field]: e.target.value }))}
                          className="w-full rounded border border-input bg-background px-2.5 py-1.5 text-sm font-mono"
                        />
                      </div>
                    ))}
                    <div>
                      <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">Latitude</label>
                      <input type="number" step="0.0001" value={editingVenue.lat ?? ""} onChange={e => setEditingVenue(prev => ({ ...prev!, lat: parseFloat(e.target.value) }))} className="w-full rounded border border-input bg-background px-2.5 py-1.5 text-sm font-mono" />
                    </div>
                    <div>
                      <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">Longitude</label>
                      <input type="number" step="0.0001" value={editingVenue.lng ?? ""} onChange={e => setEditingVenue(prev => ({ ...prev!, lng: parseFloat(e.target.value) }))} className="w-full rounded border border-input bg-background px-2.5 py-1.5 text-sm font-mono" />
                    </div>
                    <div>
                      <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">Tier</label>
                      <select value={editingVenue.tier ?? "silver"} onChange={e => setEditingVenue(prev => ({ ...prev!, tier: e.target.value }))} className="w-full rounded border border-input bg-background px-2.5 py-1.5 text-sm font-mono">
                        <option value="gold">Gold — Verified Partner</option>
                        <option value="silver">Silver — Directory</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={editingVenue.active ?? true} onChange={e => setEditingVenue(prev => ({ ...prev!, active: e.target.checked }))} className="accent-[#e27226]" />
                      <label className="font-mono text-xs">Active (visible on map)</label>
                    </div>
                  </div>
                  <div>
                    <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">Internal Notes</label>
                    <textarea value={editingVenue.notes ?? ""} onChange={e => setEditingVenue(prev => ({ ...prev!, notes: e.target.value }))} rows={2} className="w-full rounded border border-input bg-background px-2.5 py-1.5 text-sm resize-none" />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="font-mono tracking-widest text-xs" onClick={() => setEditingVenue(null)}>Cancel</Button>
                    <Button size="sm" className="font-mono tracking-widest text-xs" disabled={saving} onClick={saveVenue}>
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null} Save Venue
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {loading ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div> : (
              <div className="space-y-2">
                {venues.length === 0 && <p className="font-mono text-xs text-muted-foreground text-center py-8">No venues yet — add one above.</p>}
                {venues.map(v => (
                  <Card key={v.id} className={`border-border ${!v.active ? "opacity-50" : ""}`}>
                    <CardContent className="p-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${v.tier === "gold" ? "bg-amber-400" : "bg-gray-400"}`} />
                        <div className="min-w-0">
                          <div className="font-mono font-bold text-sm truncate">{v.name}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">{v.town}, {v.county} · {v.postcode} · {v.email}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className={`font-mono text-[10px] ${v.tier === "gold" ? "border-amber-400/50 text-amber-600" : ""}`}>
                          {v.tier === "gold" ? "⭐ Gold" : "Silver"}
                        </Badge>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditingVenue({ ...v })}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deleteVenue(v.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Enquiries tab ── */}
        {tab === "enquiries" && (
          <div className="space-y-3">
            <h2 className="font-mono font-bold uppercase tracking-widest text-sm">Enquiry Pipeline</h2>
            {loading ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div> : (
              enquiries.length === 0 ? <p className="font-mono text-xs text-muted-foreground text-center py-8">No enquiries yet.</p> : (
                <div className="space-y-2">
                  {enquiries.map(({ enquiry, venue, user, passport }) => (
                    <Card key={enquiry.id} className="border-border">
                      <CardContent className="p-3 flex items-start justify-between gap-3">
                        <div className="space-y-0.5 min-w-0">
                          <div className="font-mono font-bold text-sm truncate">{user?.fullName ?? "—"}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">{user?.email} · {passport?.postcode} · {passport?.phone}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">→ {venue?.name ?? "Unknown venue"}, {venue?.town}</div>
                          <div className="font-mono text-[10px] text-muted-foreground opacity-70">
                            Created: {new Date(enquiry.createdAt).toLocaleDateString("en-GB")}
                            {enquiry.batchSentAt && ` · Batch: ${new Date(enquiry.batchSentAt).toLocaleDateString("en-GB")}`}
                            {enquiry.nudge7SentAt && ` · Nudge7: ${new Date(enquiry.nudge7SentAt).toLocaleDateString("en-GB")}`}
                            {enquiry.nudge12SentAt && ` · Nudge12: ${new Date(enquiry.nudge12SentAt).toLocaleDateString("en-GB")}`}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <Badge variant="outline" className={`font-mono text-[10px] ${statusBadgeClass(enquiry.status)}`}>
                            {enquiry.status.replace(/_/g, " ")}
                          </Badge>
                          {enquiry.status !== "resolved" && (
                            <Button variant="ghost" size="sm" className="h-6 px-2 font-mono text-[10px] text-green-600 hover:text-green-500" onClick={() => resolveEnquiry(enquiry.id)}>
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Resolve
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )
            )}
          </div>
        )}
      </main>
    </div>
  );
}
