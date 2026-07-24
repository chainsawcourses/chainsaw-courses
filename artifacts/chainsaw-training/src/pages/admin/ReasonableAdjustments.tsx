import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Plus } from "lucide-react";
import { useAdminSession } from "../../contexts/AdminContext";
import { useToast } from "@/hooks/use-toast";

interface Adjustment {
  id: number; userId: number; fullName: string; email: string;
  adjustmentType: string; details: string; evidenceProvided: string | null;
  approvedBy: string; approvedAt: string; expiresAt: string | null;
}

interface Student { id: number; fullName: string; email: string; }

const ORANGE = "#e27226";
const TYPES = ["Extra Time", "Large Print", "Screen Reader", "Bilingual Support", "Rest Breaks", "Other"];
const blank = { userId: "", adjustmentType: TYPES[0], details: "", evidenceProvided: "", approvedBy: "", expiresAt: "" };

export default function ReasonableAdjustments() {
  const [, setLocation] = useLocation();
  const { adminToken, isReady } = useAdminSession();
  const { toast } = useToast();
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");

  useEffect(() => { if (isReady && !adminToken) setLocation("/admin"); }, [isReady, adminToken, setLocation]);

  useEffect(() => {
    if (!adminToken) return;
    Promise.all([
      fetch("/api/admin/reasonable-adjustments", { headers: { admintoken: adminToken } }).then(r => r.json()),
      fetch("/api/admin/students", { headers: { admintoken: adminToken } }).then(r => r.json()),
    ]).then(([adjs, studs]) => {
      setAdjustments(adjs);
      setStudents(studs.map((s: Student) => ({ id: s.id, fullName: s.fullName, email: s.email })));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [adminToken]);

  const filteredStudents = students.filter(s =>
    studentSearch && (s.fullName.toLowerCase().includes(studentSearch.toLowerCase()) || s.email.toLowerCase().includes(studentSearch.toLowerCase()))
  ).slice(0, 5);

  const handleAdd = async () => {
    if (!form.userId || !form.details || !form.approvedBy) {
      toast({ variant: "destructive", title: "Error", description: "Student, details and approvedBy are required." });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/reasonable-adjustments", {
        method: "POST", headers: { admintoken: adminToken!, "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: parseInt(form.userId), adjustmentType: form.adjustmentType,
          details: form.details, evidenceProvided: form.evidenceProvided || null,
          approvedBy: form.approvedBy, expiresAt: form.expiresAt || null,
        }),
      });
      if (!res.ok) throw new Error();
      const created = await res.json();
      const student = students.find(s => s.id === parseInt(form.userId));
      setAdjustments(a => [{ ...created, fullName: student?.fullName ?? "", email: student?.email ?? "" }, ...a]);
      setForm(blank); setShowForm(false); setStudentSearch("");
      toast({ title: "Adjustment recorded" });
    } catch { toast({ variant: "destructive", title: "Error", description: "Could not save." }); }
    finally { setSaving(false); }
  };

  const fld = (k: keyof typeof blank, v: string) => setForm(f => ({ ...f, [k]: v }));
  const selectedStudent = students.find(s => s.id === parseInt(form.userId));

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
          <span className="font-semibold text-sm flex-1">Reasonable Adjustments</span>
          <button onClick={() => setShowForm(s => !s)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-white font-medium" style={{ background: ORANGE }}>
            <Plus className="w-3.5 h-3.5" />Add
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        {showForm && (
          <div className="bg-white rounded-xl border border-border p-5 space-y-3">
            <h2 className="font-semibold text-sm">New Reasonable Adjustment</h2>

            <div className="relative">
              <label className="text-xs text-muted-foreground mb-1 block">Student *</label>
              {selectedStudent ? (
                <div className="flex items-center justify-between border border-border rounded-lg px-3 py-2 bg-background">
                  <span className="text-sm text-foreground">{selectedStudent.fullName} <span className="text-muted-foreground">({selectedStudent.email})</span></span>
                  <button onClick={() => { fld("userId", ""); setStudentSearch(""); }} className="text-xs text-muted-foreground underline">Change</button>
                </div>
              ) : (
                <>
                  <input value={studentSearch} onChange={e => setStudentSearch(e.target.value)} placeholder="Search learner name or email…" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
                  {filteredStudents.length > 0 && (
                    <div className="absolute z-10 left-0 right-0 bg-white border border-border rounded-lg shadow-md mt-1">
                      {filteredStudents.map(s => (
                        <button key={s.id} onClick={() => { fld("userId", String(s.id)); setStudentSearch(s.fullName); }} className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors">
                          {s.fullName} <span className="text-muted-foreground text-xs">{s.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Adjustment Type *</label>
                <select value={form.adjustmentType} onChange={e => fld("adjustmentType", e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                  {TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Approved By *</label>
                <input value={form.approvedBy} onChange={e => fld("approvedBy", e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
              </div>
            </div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Details *</label><textarea value={form.details} onChange={e => fld("details", e.target.value)} rows={2} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background resize-none" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground mb-1 block">Evidence Provided</label><input value={form.evidenceProvided} onChange={e => fld("evidenceProvided", e.target.value)} placeholder="e.g. GP letter, EHC plan" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
              <div><label className="text-xs text-muted-foreground mb-1 block">Expires (optional)</label><input type="date" value={form.expiresAt} onChange={e => fld("expiresAt", e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" /></div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={handleAdd} disabled={saving} className="text-xs px-4 py-2 rounded-lg text-white font-medium" style={{ background: ORANGE }}>{saving ? "Saving…" : "Save"}</button>
              <button onClick={() => setShowForm(false)} className="text-xs px-4 py-2 rounded-lg border border-border text-muted-foreground">Cancel</button>
            </div>
          </div>
        )}

        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!loading && adjustments.length === 0 && !showForm && (
          <div className="text-center py-12 text-muted-foreground text-sm">No reasonable adjustments recorded.</div>
        )}

        <div className="space-y-2">
          {adjustments.map(a => (
            <div key={a.id} className="bg-white rounded-xl border border-border px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground">{a.fullName}</p>
                <p className="text-xs text-muted-foreground">{a.email}</p>
                <p className="text-xs text-foreground mt-0.5">{a.details}</p>
                {a.evidenceProvided && <p className="text-xs text-muted-foreground">Evidence: {a.evidenceProvided}</p>}
              </div>
              <div className="flex items-start gap-4 text-xs text-muted-foreground flex-shrink-0">
                <div className="text-right">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium text-white" style={{ background: ORANGE }}>{a.adjustmentType}</span>
                  <p className="mt-1">Approved by {a.approvedBy}</p>
                  <p>{new Date(a.approvedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
                  {a.expiresAt && <p className="text-amber-600">Expires {new Date(a.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
