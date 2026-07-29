import { useEffect, useState, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, ChevronDown, ChevronRight, Plus, Pencil, Trash2, Save, X, Upload, ToggleLeft, ToggleRight, AlertTriangle } from "lucide-react";
import { useAdminSession } from "../../contexts/AdminContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { VOCAL_EXAM_QUESTIONS } from "../../data/vocalExamQuestions";

const ORANGE = "#e27226";

interface KeyPoint { label: string; keywords: string[]; }
interface VocalPrompt { prompt: string; keyPoints: KeyPoint[]; threshold: number; isAction?: boolean; }
interface MockQuestion { id: number; question: string; prompts: VocalPrompt[]; image?: string; sortOrder: number; isActive: boolean; }

const BLANK_Q: Omit<MockQuestion, "id"> = {
  question: "",
  prompts: [{ prompt: "", threshold: 1, keyPoints: [{ label: "", keywords: [] }] }],
  isActive: true,
  sortOrder: 0,
};

function KeyPointEditor({
  kp, idx, onChange, onRemove, canRemove,
}: { kp: KeyPoint; idx: number; onChange: (kp: KeyPoint) => void; onRemove: () => void; canRemove: boolean }) {
  return (
    <div className="bg-secondary/10 rounded-md p-3 space-y-2">
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-1.5">
          <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Label {idx + 1}</label>
          <input
            value={kp.label}
            onChange={e => onChange({ ...kp, label: e.target.value })}
            placeholder="e.g. Step 1 — Identify the hazards"
            className="w-full rounded border border-input bg-background px-2 py-1 text-xs font-mono"
          />
        </div>
        {canRemove && (
          <button onClick={onRemove} className="mt-5 text-muted-foreground hover:text-destructive transition-colors shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div>
        <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Keywords (comma-separated)</label>
        <textarea
          value={kp.keywords.join(", ")}
          onChange={e => onChange({ ...kp, keywords: e.target.value.split(",").map(k => k.trim()).filter(Boolean) })}
          rows={2}
          placeholder="identif, hazard, danger, find the..."
          className="w-full rounded border border-input bg-background px-2 py-1 text-xs font-mono mt-1 resize-none"
        />
      </div>
    </div>
  );
}

function PromptEditor({
  prompt, idx, onChange, onRemove, canRemove,
}: { prompt: VocalPrompt; idx: number; onChange: (p: VocalPrompt) => void; onRemove: () => void; canRemove: boolean }) {
  const setKp = (i: number, kp: KeyPoint) => {
    const next = [...prompt.keyPoints];
    next[i] = kp;
    onChange({ ...prompt, keyPoints: next });
  };
  const removeKp = (i: number) => onChange({ ...prompt, keyPoints: prompt.keyPoints.filter((_, j) => j !== i) });
  const addKp = () => onChange({ ...prompt, keyPoints: [...prompt.keyPoints, { label: "", keywords: [] }] });

  return (
    <div className="border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">Prompt {idx + 1}</span>
        {canRemove && (
          <button onClick={onRemove} className="text-muted-foreground hover:text-destructive text-xs font-mono flex items-center gap-1 transition-colors">
            <Trash2 className="w-3 h-3" /> Remove prompt
          </button>
        )}
      </div>
      <div>
        <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Prompt text</label>
        <textarea
          value={prompt.prompt}
          onChange={e => onChange({ ...prompt, prompt: e.target.value })}
          rows={2}
          className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm mt-1 resize-none"
        />
      </div>
      <div className="flex items-center gap-4">
        <div>
          <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground block">Threshold</label>
          <input
            type="number" min={1}
            value={prompt.threshold}
            onChange={e => onChange({ ...prompt, threshold: parseInt(e.target.value) || 1 })}
            className="w-16 rounded border border-input bg-background px-2 py-1 text-xs font-mono mt-1"
          />
        </div>
        <div className="flex items-center gap-2 mt-3">
          <input
            type="checkbox"
            id={`isAction-${idx}`}
            checked={!!prompt.isAction}
            onChange={e => onChange({ ...prompt, isAction: e.target.checked })}
            className="w-4 h-4"
          />
          <label htmlFor={`isAction-${idx}`} className="font-mono text-xs text-muted-foreground">Is action question</label>
        </div>
      </div>
      <div className="space-y-2">
        <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Key Points ({prompt.keyPoints.length})</label>
        {prompt.keyPoints.map((kp, i) => (
          <KeyPointEditor key={i} kp={kp} idx={i} onChange={kp => setKp(i, kp)} onRemove={() => removeKp(i)} canRemove={prompt.keyPoints.length > 1} />
        ))}
        <button onClick={addKp} className="flex items-center gap-1 text-xs font-mono text-primary hover:text-primary/80 transition-colors mt-1">
          <Plus className="w-3 h-3" /> Add key point
        </button>
      </div>
    </div>
  );
}

function QuestionEditor({
  initial, onSave, onCancel, saving,
}: { initial: Omit<MockQuestion, "id"> & { id?: number }; onSave: (data: Omit<MockQuestion, "id">) => void; onCancel: () => void; saving: boolean }) {
  const [form, setForm] = useState<Omit<MockQuestion, "id">>({
    question: initial.question,
    prompts: initial.prompts,
    image: initial.image,
    sortOrder: initial.sortOrder,
    isActive: initial.isActive,
  });

  const setPrompt = (i: number, p: VocalPrompt) => {
    const next = [...form.prompts];
    next[i] = p;
    setForm(f => ({ ...f, prompts: next }));
  };
  const removePrompt = (i: number) => setForm(f => ({ ...f, prompts: f.prompts.filter((_, j) => j !== i) }));
  const addPrompt = () => setForm(f => ({ ...f, prompts: [...f.prompts, { prompt: "", threshold: 1, keyPoints: [{ label: "", keywords: [] }] }] }));

  return (
    <div className="space-y-4">
      <div>
        <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Question text</label>
        <textarea
          value={form.question}
          onChange={e => setForm(f => ({ ...f, question: e.target.value }))}
          rows={3}
          className="w-full rounded border border-input bg-background px-3 py-2 text-sm mt-1 resize-none"
        />
      </div>
      <div>
        <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Image URL (optional)</label>
        <input
          value={form.image ?? ""}
          onChange={e => setForm(f => ({ ...f, image: e.target.value || undefined }))}
          placeholder="/images/example.jpg"
          className="w-full rounded border border-input bg-background px-3 py-1.5 text-sm font-mono mt-1"
        />
      </div>
      <div className="flex items-center gap-3">
        <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Sort order</label>
        <input
          type="number"
          value={form.sortOrder}
          onChange={e => setForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
          className="w-20 rounded border border-input bg-background px-2 py-1 text-xs font-mono"
        />
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
            className="w-4 h-4"
          />
          <span className="font-mono text-xs text-muted-foreground">Active</span>
        </label>
      </div>
      <div className="space-y-3">
        <span className="font-mono text-xs font-bold uppercase tracking-widest">Prompts ({form.prompts.length})</span>
        {form.prompts.map((p, i) => (
          <PromptEditor key={i} prompt={p} idx={i} onChange={p => setPrompt(i, p)} onRemove={() => removePrompt(i)} canRemove={form.prompts.length > 1} />
        ))}
        <button onClick={addPrompt} className="flex items-center gap-1 text-xs font-mono text-primary hover:text-primary/80 transition-colors">
          <Plus className="w-3 h-3" /> Add prompt
        </button>
      </div>
      <div className="flex items-center gap-2 pt-2 border-t border-border">
        <Button size="sm" onClick={() => onSave(form)} disabled={saving || !form.question.trim()} className="font-mono text-xs gap-1.5">
          <Save className="w-3.5 h-3.5" /> {saving ? "Saving…" : "Save"}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} className="font-mono text-xs gap-1.5">
          <X className="w-3.5 h-3.5" /> Cancel
        </Button>
      </div>
    </div>
  );
}

export default function MockQuestions() {
  const { adminToken } = useAdminSession();
  const { toast } = useToast();
  const headers = { admintoken: adminToken ?? "", "Content-Type": "application/json" };

  const [questions, setQuestions] = useState<MockQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [confirmImport, setConfirmImport] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/mock-questions", { headers: { admintoken: adminToken ?? "" } });
      if (res.ok) { const data = await res.json(); setQuestions(data.questions); }
    } finally { setLoading(false); }
  }, [adminToken]);

  useEffect(() => { load(); }, [load]);

  const toggle = (id: number) => setExpanded(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleCreate = async (data: Omit<MockQuestion, "id">) => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/mock-questions", { method: "POST", headers, body: JSON.stringify({ ...data, sortOrder: questions.length }) });
      if (!res.ok) throw new Error();
      const q: MockQuestion = await res.json();
      setQuestions(prev => [...prev, q]);
      setEditing(null);
      toast({ title: "Question created" });
    } catch { toast({ variant: "destructive", title: "Failed to create question" }); }
    finally { setSaving(false); }
  };

  const handleUpdate = async (id: number, data: Omit<MockQuestion, "id">) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/mock-questions/${id}`, { method: "PUT", headers, body: JSON.stringify(data) });
      if (!res.ok) throw new Error();
      const q: MockQuestion = await res.json();
      setQuestions(prev => prev.map(x => x.id === id ? q : x));
      setEditing(null);
      toast({ title: "Question updated" });
    } catch { toast({ variant: "destructive", title: "Failed to update question" }); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/mock-questions/${id}`, { method: "DELETE", headers: { admintoken: adminToken ?? "" } });
      if (!res.ok) throw new Error();
      setQuestions(prev => prev.filter(q => q.id !== id));
      toast({ title: "Question deleted" });
    } catch { toast({ variant: "destructive", title: "Failed to delete question" }); }
    finally { setDeletingId(null); }
  };

  const handleToggleActive = async (q: MockQuestion) => {
    try {
      const res = await fetch(`/api/admin/mock-questions/${q.id}`, { method: "PUT", headers, body: JSON.stringify({ isActive: !q.isActive }) });
      if (!res.ok) throw new Error();
      const updated: MockQuestion = await res.json();
      setQuestions(prev => prev.map(x => x.id === q.id ? updated : x));
    } catch { toast({ variant: "destructive", title: "Failed to update question" }); }
  };

  const handleImportDefaults = async (replace: boolean) => {
    setImporting(true);
    setConfirmImport(false);
    try {
      const payload = VOCAL_EXAM_QUESTIONS.map(q => ({ question: q.question, prompts: q.prompts, image: q.image }));
      const res = await fetch("/api/admin/mock-questions/import-defaults", {
        method: "POST", headers,
        body: JSON.stringify({ questions: payload, replace }),
      });
      if (!res.ok) throw new Error();
      const { count } = await res.json();
      toast({ title: `Imported ${count} questions` });
      await load();
    } catch { toast({ variant: "destructive", title: "Import failed" }); }
    finally { setImporting(false); }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 z-20 bg-background/95 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild className="font-mono uppercase tracking-widest text-xs">
            <Link href="/admin/dashboard"><ArrowLeft className="w-4 h-4 mr-1" /> Dashboard</Link>
          </Button>
          <span className="font-mono font-bold uppercase tracking-widest text-sm">Mock Questions</span>
          <div className="w-28" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <p className="font-mono text-sm text-muted-foreground">
            {loading ? "Loading…" : `${questions.length} question${questions.length !== 1 ? "s" : ""} · ${questions.filter(q => q.isActive).length} active`}
          </p>
          <div className="flex items-center gap-2">
            {!confirmImport ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmImport(true)}
                disabled={importing}
                className="font-mono text-xs gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                {questions.length === 0 ? "Import Defaults" : "Re-import Defaults"}
              </Button>
            ) : (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-md px-3 py-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="font-mono text-xs text-amber-800">Replace all existing questions?</span>
                <button onClick={() => handleImportDefaults(true)} className="font-mono text-xs font-bold text-destructive hover:underline">Yes, replace</button>
                <button onClick={() => handleImportDefaults(false)} className="font-mono text-xs font-bold text-primary hover:underline">Append only</button>
                <button onClick={() => setConfirmImport(false)} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
              </div>
            )}
            <Button
              size="sm"
              onClick={() => setEditing("new")}
              disabled={editing === "new"}
              className="font-mono text-xs gap-1.5"
              style={{ backgroundColor: ORANGE, color: "#fff" }}
            >
              <Plus className="w-3.5 h-3.5" /> Add Question
            </Button>
          </div>
        </div>

        {/* New question form */}
        {editing === "new" && (
          <div className="border border-border rounded-lg p-5 bg-card space-y-1">
            <h3 className="font-mono font-bold text-sm uppercase tracking-widest mb-3">New Question</h3>
            <QuestionEditor
              initial={{ ...BLANK_Q }}
              onSave={handleCreate}
              onCancel={() => setEditing(null)}
              saving={saving}
            />
          </div>
        )}

        {/* Empty state */}
        {!loading && questions.length === 0 && editing !== "new" && (
          <div className="text-center py-16 text-muted-foreground">
            <p className="font-mono text-sm mb-3">No questions yet.</p>
            <Button size="sm" variant="outline" onClick={() => handleImportDefaults(false)} disabled={importing} className="font-mono text-xs gap-1.5">
              <Upload className="w-3.5 h-3.5" /> Import the 78 default questions
            </Button>
          </div>
        )}

        {/* Question list */}
        {questions.map((q, idx) => {
          const isExpanded = expanded.has(q.id);
          const isEditingThis = editing === q.id;
          return (
            <div key={q.id} className={`border rounded-lg bg-card transition-colors ${q.isActive ? "border-border" : "border-border/40 opacity-60"}`}>
              {/* Row header */}
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="font-mono text-xs text-muted-foreground w-8 shrink-0">#{idx + 1}</span>
                <button onClick={() => toggle(q.id)} className="flex-1 text-left flex items-center gap-2 min-w-0">
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                  <span className="text-sm font-medium truncate">{q.question || <span className="text-muted-foreground italic">Untitled</span>}</span>
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-[10px] text-muted-foreground">{q.prompts.reduce((s, p) => s + p.keyPoints.length, 0)} KPs</span>
                  <button
                    onClick={() => handleToggleActive(q)}
                    title={q.isActive ? "Deactivate" : "Activate"}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {q.isActive
                      ? <ToggleRight className="w-5 h-5 text-green-600" />
                      : <ToggleLeft className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={() => { setEditing(q.id); setExpanded(s => { const n = new Set(s); n.add(q.id); return n; }); }}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(q.id)}
                    disabled={deletingId === q.id}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Expanded body */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-border pt-3">
                  {isEditingThis ? (
                    <QuestionEditor
                      initial={q}
                      onSave={data => handleUpdate(q.id, data)}
                      onCancel={() => setEditing(null)}
                      saving={saving}
                    />
                  ) : (
                    <div className="space-y-3">
                      {q.prompts.map((p, pi) => (
                        <div key={pi} className="space-y-2">
                          <p className="text-sm text-muted-foreground italic">"{p.prompt}"</p>
                          <p className="font-mono text-xs text-muted-foreground">Threshold: {p.threshold} · {p.isAction ? "Action" : "Knowledge"}</p>
                          <div className="space-y-1">
                            {p.keyPoints.map((kp, ki) => (
                              <div key={ki} className="bg-secondary/10 rounded px-3 py-2">
                                <p className="font-mono text-xs font-semibold">{kp.label}</p>
                                <p className="font-mono text-[10px] text-muted-foreground mt-0.5">{kp.keywords.slice(0, 6).join(", ")}{kp.keywords.length > 6 ? ` +${kp.keywords.length - 6} more` : ""}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </main>
    </div>
  );
}
