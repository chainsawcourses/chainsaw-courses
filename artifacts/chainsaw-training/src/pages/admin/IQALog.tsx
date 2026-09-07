import { useEffect, useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Plus, CheckCircle2, X, Search } from "lucide-react";
import { useAdminSession } from "../../contexts/AdminContext";
import { useToast } from "@/hooks/use-toast";

interface IQARecord {
  id: number; reviewerName: string; sampleDate: string;
  studentIds: number[]; findingsSummary: string;
  actionRequired: string | null; actionTaken: string | null;
  signedOffAt: string | null; createdAt: string;
}

interface Student { id: number; fullName: string; email: string; }

const ORANGE = "#e27226";

// ── Searchable multi-select student picker ─────────────────────────────────
function StudentPicker({
  students,
  selected,
  onChange,
}: {
  students: Student[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectedStudents = students.filter(s => selected.includes(s.id));
  const filtered = students.filter(s =>
    !selected.includes(s.id) &&
    (s.fullName.toLowerCase().includes(query.toLowerCase()) ||
     s.email.toLowerCase().includes(query.toLowerCase()))
  );

  const add = (id: number) => { onChange([...selected, id]); setQuery(""); };
  const remove = (id: number) => onChange(selected.filter(x => x !== id));

  return (
    <div ref={ref} className="relative">
      {/* Selected chips */}
      <div
        className="min-h-[38px] w-full border border-border rounded-lg px-2 py-1.5 bg-background flex flex-wrap gap-1.5 cursor-text"
        onClick={() => { setOpen(true); }}
      >
        {selectedStudents.map(s => (
          <span key={s.id} className="flex items-center gap-1 bg-orange-100 text-orange-800 text-xs rounded-full px-2.5 py-0.5 font-medium">
            {s.fullName}
            <button
              type="button"
              onClick={e => { e.stopPropagation(); remove(s.id); }}
              className="hover:text-orange-600 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <div className="flex items-center gap-1 flex-1 min-w-[120px]">
          <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={selected.length === 0 ? "Type a student name…" : "Add another…"}
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-3 py-2.5 text-xs text-muted-foreground italic">
              {query ? `No students matching "${query}"` : selected.length === students.length ? "All students selected" : "No students found"}
            </p>
          ) : (
            filtered.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => add(s.id)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-orange-50 transition-colors flex items-center justify-between gap-2"
              >
                <span className="font-medium text-foreground">{s.fullName}</span>
                <span className="text-xs text-muted-foreground truncate">{s.email}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
const blankForm = {
  reviewerName: "",
  sampleDate: new Date().toISOString().slice(0, 10),
  studentIds: [] as number[],
  findingsSummary: "",
  actionRequired: "",
  actionTaken: "",
};

export default function IQALog() {
  const [, setLocation] = useLocation();
  const { adminToken, isReady } = useAdminSession();
  const { toast } = useToast();
  const [records, setRecords] = useState<IQARecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [actionDrafts, setActionDrafts] = useState<Record<number, string>>({});

  useEffect(() => { if (isReady && !adminToken) setLocation("/admin"); }, [isReady, adminToken, setLocation]);

  useEffect(() => {
    if (!adminToken) return;
    Promise.all([
      fetch("/api/admin/iqa-records", { headers: { admintoken: adminToken } }).then(r => r.json()),
      fetch("/api/admin/students", { headers: { admintoken: adminToken } }).then(r => r.json()),
    ]).then(([recs, studs]) => {
      setRecords(recs);
      setStudents(studs.map((s: Student) => ({ id: s.id, fullName: s.fullName, email: s.email })));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [adminToken]);

  const handleAdd = async () => {
    if (!form.reviewerName || !form.findingsSummary) {
      toast({ variant: "destructive", title: "Error", description: "Reviewer name and findings are required." });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/iqa-records", {
        method: "POST",
        headers: { admintoken: adminToken!, "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewerName: form.reviewerName,
          sampleDate: form.sampleDate,
          studentIds: form.studentIds,
          findingsSummary: form.findingsSummary,
          actionRequired: form.actionRequired || null,
          actionTaken: form.actionTaken || null,
        }),
      });
      if (!res.ok) throw new Error();
      const created: IQARecord = await res.json();
      setRecords(r => [created, ...r]);
      setForm(blankForm);
      setShowForm(false);
      toast({ title: "IQA record added" });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Could not save record." });
    } finally {
      setSaving(false);
    }
  };

  const signOff = async (id: number) => {
    const res = await fetch(`/api/admin/iqa-records/${id}`, {
      method: "PATCH",
      headers: { admintoken: adminToken!, "Content-Type": "application/json" },
      body: JSON.stringify({ signedOffAt: new Date().toISOString(), actionTaken: actionDrafts[id] }),
    });
    if (res.ok) {
      const updated: IQARecord = await res.json();
      setRecords(r => r.map(x => x.id === id ? { ...x, signedOffAt: updated.signedOffAt, actionTaken: updated.actionTaken } : x));
      toast({ title: "Record signed off" });
    }
  };

  const fld = <K extends keyof typeof blankForm>(k: K, v: typeof blankForm[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/admin/dashboard">
            <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />Dashboard
            </button>
          </Link>
          <span className="text-muted-foreground/40">·</span>
          <span className="font-semibold text-sm flex-1">IQA Log</span>
          <button
            onClick={() => setShowForm(s => !s)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-white font-medium"
            style={{ background: ORANGE }}
          >
            <Plus className="w-3.5 h-3.5" />Add Record
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        {showForm && (
          <div className="bg-white rounded-xl border border-border p-5 space-y-3">
            <h2 className="font-semibold text-sm text-foreground">New IQA Sampling Record</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Reviewer Name *</label>
                <input
                  value={form.reviewerName}
                  onChange={e => fld("reviewerName", e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Sample Date *</label>
                <input
                  type="date"
                  value={form.sampleDate}
                  onChange={e => fld("sampleDate", e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Students Sampled
                {form.studentIds.length > 0 && (
                  <span className="ml-2 text-orange-600 font-medium">{form.studentIds.length} selected</span>
                )}
              </label>
              <StudentPicker
                students={students}
                selected={form.studentIds}
                onChange={ids => fld("studentIds", ids)}
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Findings Summary *</label>
              <textarea
                value={form.findingsSummary}
                onChange={e => fld("findingsSummary", e.target.value)}
                rows={3}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background resize-none"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Action Required</label>
              <textarea
                value={form.actionRequired}
                onChange={e => fld("actionRequired", e.target.value)}
                rows={2}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background resize-none"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Action Taken</label>
              <textarea
                value={form.actionTaken}
                onChange={e => fld("actionTaken", e.target.value)}
                rows={2}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background resize-none"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleAdd}
                disabled={saving}
                className="text-xs px-4 py-2 rounded-lg text-white font-medium"
                style={{ background: ORANGE }}
              >
                {saving ? "Saving…" : "Save Record"}
              </button>
              <button
                onClick={() => { setShowForm(false); setForm(blankForm); }}
                className="text-xs px-4 py-2 rounded-lg border border-border text-muted-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!loading && records.length === 0 && !showForm && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No IQA records yet. Add your first sampling record above.
          </div>
        )}

        <div className="space-y-3">
          {records.map(r => {
            const sampledNames = r.studentIds
              .map(id => students.find(s => s.id === id)?.fullName ?? `Student #${id}`)
              .filter(Boolean);
            const isExpanded = expanded === r.id;
            return (
              <div key={r.id} className="bg-white rounded-xl border border-border overflow-hidden">
                <div
                  className="px-4 py-3 flex items-start justify-between gap-3 cursor-pointer"
                  onClick={() => setExpanded(isExpanded ? null : r.id)}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">
                        {new Date(r.sampleDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                      </p>
                      {r.signedOffAt && <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Reviewer: {r.reviewerName} · {r.studentIds.length} student{r.studentIds.length !== 1 ? "s" : ""} sampled
                      {sampledNames.length > 0 && (
                        <span className="text-foreground"> ({sampledNames.join(", ")})</span>
                      )}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{isExpanded ? "▲" : "▼"}</span>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                    {sampledNames.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Students sampled:</span>{" "}
                        {sampledNames.join(", ")}
                      </p>
                    )}
                    <div>
                      <p className="text-xs font-medium text-foreground mb-1">Findings</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{r.findingsSummary}</p>
                    </div>
                    {r.actionRequired && (
                      <div>
                        <p className="text-xs font-medium text-foreground mb-1">Action Required</p>
                        <p className="text-sm text-foreground">{r.actionRequired}</p>
                      </div>
                    )}
                    {!r.signedOffAt && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-foreground">Action Taken</p>
                        <textarea
                          value={actionDrafts[r.id] ?? r.actionTaken ?? ""}
                          onChange={e => setActionDrafts(d => ({ ...d, [r.id]: e.target.value }))}
                          rows={2}
                          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background resize-none"
                          placeholder="Describe action taken…"
                        />
                        <button
                          onClick={() => signOff(r.id)}
                          className="text-xs px-3 py-1.5 rounded-lg text-white font-medium"
                          style={{ background: ORANGE }}
                        >
                          Sign Off
                        </button>
                      </div>
                    )}
                    {r.signedOffAt && (
                      <div>
                        {r.actionTaken && (
                          <>
                            <p className="text-xs font-medium text-foreground mb-1">Action Taken</p>
                            <p className="text-sm text-foreground">{r.actionTaken}</p>
                          </>
                        )}
                        <p className="text-xs text-green-600 mt-2">
                          ✓ Signed off {new Date(r.signedOffAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
