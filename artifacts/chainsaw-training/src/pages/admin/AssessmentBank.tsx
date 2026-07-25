import { useEffect, useState, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, ChevronDown, ChevronRight, Plus, Pencil, Trash2, Check, X, ToggleLeft, ToggleRight } from "lucide-react";
import { useAdminSession } from "../../contexts/AdminContext";
import { useToast } from "@/hooks/use-toast";

const ORANGE = "#e27226";

interface Question {
  id: number;
  question: string;
  options: string[];
  correctOption: number;
  learningOutcome: string | null;
  assessmentCriteria: string | null;
  order: number;
  isActive: boolean;
}

const BLANK_FORM = {
  question: "",
  options: ["", "", "", ""],
  correctOption: 0,
  learningOutcome: "",
  assessmentCriteria: "",
  order: 0,
  isActive: true,
};

function QuestionForm({
  initial,
  knownLOs,
  onSave,
  onCancel,
  saving,
}: {
  initial: typeof BLANK_FORM;
  knownLOs: string[];
  onSave: (data: typeof BLANK_FORM) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState(initial);

  const setField = <K extends keyof typeof BLANK_FORM>(k: K, v: (typeof BLANK_FORM)[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const setOption = (i: number, v: string) =>
    setForm(f => { const opts = [...f.options]; opts[i] = v; return { ...f, options: opts }; });

  const addOption = () => setForm(f => ({ ...f, options: [...f.options, ""] }));
  const removeOption = (i: number) =>
    setForm(f => {
      if (f.options.length <= 2) return f;
      const opts = f.options.filter((_, idx) => idx !== i);
      const correct = f.correctOption >= opts.length ? opts.length - 1 : f.correctOption;
      return { ...f, options: opts, correctOption: correct };
    });

  const valid = form.question.trim() && form.options.every(o => o.trim()) && form.options.length >= 2;

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Question text *</label>
        <textarea
          value={form.question}
          onChange={e => setField("question", e.target.value)}
          rows={2}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white resize-none focus:outline-none focus:ring-1"
          style={{ "--tw-ring-color": ORANGE } as React.CSSProperties}
          placeholder="Enter question…"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Answer options — click radio to mark correct</label>
        <div className="space-y-1.5">
          {form.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="radio"
                name="correct"
                checked={form.correctOption === i}
                onChange={() => setField("correctOption", i)}
                className="accent-orange-500 flex-shrink-0"
              />
              <input
                value={opt}
                onChange={e => setOption(i, e.target.value)}
                className="flex-1 border border-border rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-1"
                style={{ "--tw-ring-color": ORANGE } as React.CSSProperties}
                placeholder={`Option ${i + 1}`}
              />
              {form.options.length > 2 && (
                <button onClick={() => removeOption(i)} className="text-muted-foreground hover:text-red-500 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
        <button onClick={addOption} className="mt-1.5 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
          <Plus className="w-3 h-3" />Add option
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Learning Outcome</label>
          <input
            value={form.learningOutcome}
            onChange={e => setField("learningOutcome", e.target.value)}
            list="lo-list"
            className="w-full border border-border rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none"
            placeholder="e.g. LO1 – Safe use of chainsaw"
          />
          <datalist id="lo-list">
            {knownLOs.map(lo => <option key={lo} value={lo} />)}
          </datalist>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Assessment Criteria</label>
          <input
            value={form.assessmentCriteria}
            onChange={e => setField("assessmentCriteria", e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none"
            placeholder="e.g. AC1.1"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={e => setField("isActive", e.target.checked)}
            className="accent-orange-500"
          />
          Active in bank
        </label>
        <div className="flex gap-2 ml-auto">
          <button
            onClick={() => onSave(form)}
            disabled={!valid || saving}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-white font-medium disabled:opacity-40"
            style={{ background: ORANGE }}
          >
            <Check className="w-3.5 h-3.5" />{saving ? "Saving…" : "Save"}
          </button>
          <button onClick={onCancel} className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function QuestionRow({
  q,
  knownLOs,
  onUpdate,
  onDelete,
}: {
  q: Question;
  knownLOs: string[];
  onUpdate: (id: number, data: typeof BLANK_FORM) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const LETTERS = ["A", "B", "C", "D", "E", "F"];

  const handleSave = async (form: typeof BLANK_FORM) => {
    setSaving(true);
    await onUpdate(q.id, form);
    setSaving(false);
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!confirm("Delete this question permanently?")) return;
    await onDelete(q.id);
  };

  if (editing) {
    return (
      <QuestionForm
        initial={{
          question: q.question,
          options: q.options,
          correctOption: q.correctOption,
          learningOutcome: q.learningOutcome ?? "",
          assessmentCriteria: q.assessmentCriteria ?? "",
          order: q.order,
          isActive: q.isActive,
        }}
        knownLOs={knownLOs}
        onSave={handleSave}
        onCancel={() => setEditing(false)}
        saving={saving}
      />
    );
  }

  return (
    <div className={`bg-white rounded-xl border px-4 py-3 ${q.isActive ? "border-border" : "border-border/50 opacity-60"}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0 space-y-1.5">
          <p className="text-sm font-medium text-foreground leading-snug">{q.question}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0.5">
            {q.options.map((opt, i) => (
              <p key={i} className={`text-xs flex items-center gap-1.5 ${i === q.correctOption ? "text-green-700 font-semibold" : "text-muted-foreground"}`}>
                <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold flex-shrink-0 ${i === q.correctOption ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                  {LETTERS[i]}
                </span>
                {opt}
              </p>
            ))}
          </div>
          {q.assessmentCriteria && (
            <p className="text-xs text-muted-foreground">AC: {q.assessmentCriteria}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {!q.isActive && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">DRAFT</span>
          )}
          <button
            onClick={() => setEditing(true)}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Edit"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleDelete}
            className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function LOSection({
  lo,
  questions,
  knownLOs,
  onUpdate,
  onDelete,
  onAdd,
}: {
  lo: string;
  questions: Question[];
  knownLOs: string[];
  onUpdate: (id: number, data: typeof BLANK_FORM) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onAdd: (data: typeof BLANK_FORM) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const active = questions.filter(q => q.isActive).length;

  const handleAdd = async (form: typeof BLANK_FORM) => {
    setSaving(true);
    await onAdd({ ...form, learningOutcome: lo === "Unassigned" ? "" : lo });
    setSaving(false);
    setAdding(false);
  };

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
        <span className="font-semibold text-sm text-foreground flex-1 min-w-0 truncate">{lo}</span>
        <span className="text-xs text-muted-foreground flex-shrink-0">
          {active}/{questions.length} active
        </span>
        <div className="flex-shrink-0 ml-1">
          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${questions.length > 0 ? Math.round((active / questions.length) * 100) : 0}%`, background: ORANGE }} />
          </div>
        </div>
      </button>

      {open && (
        <div className="border-t border-border px-4 py-3 space-y-2">
          {questions.map(q => (
            <QuestionRow key={q.id} q={q} knownLOs={knownLOs} onUpdate={onUpdate} onDelete={onDelete} />
          ))}

          {adding ? (
            <QuestionForm
              initial={{ ...BLANK_FORM, learningOutcome: lo === "Unassigned" ? "" : lo }}
              knownLOs={knownLOs}
              onSave={handleAdd}
              onCancel={() => setAdding(false)}
              saving={saving}
            />
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />Add question to this outcome
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function AssessmentBank() {
  const [, setLocation] = useLocation();
  const { adminToken, isReady } = useAdminSession();
  const { toast } = useToast();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(true);
  const [addingNew, setAddingNew] = useState(false);
  const [savingNew, setSavingNew] = useState(false);

  useEffect(() => { if (isReady && !adminToken) setLocation("/admin"); }, [isReady, adminToken, setLocation]);

  const headers = { admintoken: adminToken ?? "", "Content-Type": "application/json" };

  const load = useCallback(async () => {
    if (!adminToken) return;
    try {
      const data = await fetch("/api/admin/questions", { headers: { admintoken: adminToken } }).then(r => r.json()) as Question[];
      setQuestions(data);
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Could not load questions." });
    } finally {
      setLoading(false);
    }
  }, [adminToken]);

  useEffect(() => { load(); }, [load]);

  const handleUpdate = async (id: number, form: typeof BLANK_FORM) => {
    const res = await fetch(`/api/admin/questions/${id}`, {
      method: "PUT", headers,
      body: JSON.stringify({ ...form, learningOutcome: form.learningOutcome || null, assessmentCriteria: form.assessmentCriteria || null }),
    });
    if (!res.ok) { toast({ variant: "destructive", title: "Error", description: "Could not update question." }); return; }
    const updated: Question = await res.json();
    setQuestions(qs => qs.map(q => q.id === id ? updated : q));
    toast({ title: "Question updated" });
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/admin/questions/${id}`, { method: "DELETE", headers });
    if (!res.ok) { toast({ variant: "destructive", title: "Error", description: "Could not delete question." }); return; }
    setQuestions(qs => qs.filter(q => q.id !== id));
    toast({ title: "Question deleted" });
  };

  const handleAdd = async (form: typeof BLANK_FORM) => {
    const res = await fetch("/api/admin/questions", {
      method: "POST", headers,
      body: JSON.stringify({ ...form, learningOutcome: form.learningOutcome || null, assessmentCriteria: form.assessmentCriteria || null }),
    });
    if (!res.ok) { toast({ variant: "destructive", title: "Error", description: "Could not add question." }); return; }
    const created: Question = await res.json();
    setQuestions(qs => [...qs, created]);
    toast({ title: "Question added" });
  };

  const handleAddNew = async (form: typeof BLANK_FORM) => {
    setSavingNew(true);
    await handleAdd(form);
    setSavingNew(false);
    setAddingNew(false);
  };

  const filtered = questions.filter(q => {
    if (!showInactive && !q.isActive) return false;
    if (search) {
      const s = search.toLowerCase();
      return q.question.toLowerCase().includes(s) ||
        (q.learningOutcome ?? "").toLowerCase().includes(s) ||
        (q.assessmentCriteria ?? "").toLowerCase().includes(s) ||
        q.options.some(o => o.toLowerCase().includes(s));
    }
    return true;
  });

  const grouped = new Map<string, Question[]>();
  for (const q of filtered) {
    const key = q.learningOutcome ?? "Unassigned";
    const arr = grouped.get(key) ?? [];
    arr.push(q);
    grouped.set(key, arr);
  }
  const sortedLOs = [...grouped.keys()].sort((a, b) => a === "Unassigned" ? 1 : b === "Unassigned" ? -1 : a.localeCompare(b));
  const knownLOs = [...new Set(questions.map(q => q.learningOutcome).filter(Boolean))].sort() as string[];

  const total = questions.length;
  const active = questions.filter(q => q.isActive).length;

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
          <span className="font-semibold text-sm flex-1">Assessment Bank</span>
          <button
            onClick={() => setAddingNew(a => !a)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-white font-medium"
            style={{ background: ORANGE }}
          >
            <Plus className="w-3.5 h-3.5" />Add Question
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Questions", value: total },
            { label: "Active in Bank", value: active },
            { label: "Inactive / Draft", value: total - active },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-border p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {active < 135 && total > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
            <strong>IIRSM guidance:</strong> A minimum bank of 3× the drawn count (135+ active questions) is recommended to prevent memorisation.
            <span className="font-semibold"> Current active count ({active}) is below this threshold.</span>
          </div>
        )}

        {/* Add new question form (top-level, unassigned LO by default) */}
        {addingNew && (
          <QuestionForm
            initial={BLANK_FORM}
            knownLOs={knownLOs}
            onSave={handleAddNew}
            onCancel={() => setAddingNew(false)}
            saving={savingNew}
          />
        )}

        {/* Search + filter */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search questions, options, LO…"
            className="border border-border rounded-lg px-3 py-2 text-sm w-64 bg-white focus:outline-none focus:ring-1"
            style={{ "--tw-ring-color": ORANGE } as React.CSSProperties}
          />
          <button
            onClick={() => setShowInactive(s => !s)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showInactive ? <ToggleRight className="w-4 h-4" style={{ color: ORANGE }} /> : <ToggleLeft className="w-4 h-4" />}
            {showInactive ? "Showing inactive" : "Hiding inactive"}
          </button>
          <p className="text-sm text-muted-foreground ml-auto">{filtered.length} question{filtered.length !== 1 ? "s" : ""} · {sortedLOs.length} outcome{sortedLOs.length !== 1 ? "s" : ""}</p>
        </div>

        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            {total === 0 ? "No questions yet — add your first question above." : "No questions match your search."}
          </div>
        )}

        {/* Grouped by LO */}
        <div className="space-y-3">
          {sortedLOs.map(lo => (
            <LOSection
              key={lo}
              lo={lo}
              questions={grouped.get(lo) ?? []}
              knownLOs={knownLOs}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onAdd={handleAdd}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
