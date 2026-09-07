import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, ChevronDown, ChevronRight, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAdminSession } from "../../contexts/AdminContext";
import { useToast } from "@/hooks/use-toast";

const ORANGE = "#e27226";

interface QuizQuestion {
  id: number;
  moduleId: number;
  question: string;
  options: string[];
  correctOption: number;
  order: number;
}

interface ModuleQuiz {
  id: number;
  title: string;
  order: number;
  isActive: boolean;
  questions: QuizQuestion[];
}

interface QuestionFormValues {
  question: string;
  options: string[];
  correctOption: number;
  order: number;
}

const BLANK_FORM: QuestionFormValues = {
  question: "",
  options: ["", "", "", ""],
  correctOption: 0,
  order: 0,
};

function QuestionForm({
  initial,
  onSave,
  onCancel,
  saving,
  formId,
}: {
  initial: QuestionFormValues;
  onSave: (values: QuestionFormValues) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
  formId: string;
}) {
  const [form, setForm] = useState(initial);

  const setField = <K extends keyof QuestionFormValues>(key: K, value: QuestionFormValues[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const setOption = (index: number, value: string) => {
    setForm((current) => {
      const options = [...current.options];
      options[index] = value;
      return { ...current, options };
    });
  };

  const addOption = () => setForm((current) => ({ ...current, options: [...current.options, ""] }));

  const removeOption = (index: number) => {
    setForm((current) => {
      if (current.options.length <= 2) return current;
      const options = current.options.filter((_, optionIndex) => optionIndex !== index);
      const correctOption = current.correctOption >= options.length
        ? options.length - 1
        : current.correctOption > index
          ? current.correctOption - 1
          : current.correctOption;
      return { ...current, options, correctOption };
    });
  };

  const valid = form.question.trim() && form.options.length >= 2 && form.options.every((option) => option.trim());

  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Question text *</label>
        <textarea
          value={form.question}
          onChange={(event) => setField("question", event.target.value)}
          rows={2}
          placeholder="Enter the question shown to learners…"
          className="w-full resize-none rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1"
          style={{ "--tw-ring-color": ORANGE } as React.CSSProperties}
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          Answer options — select the correct answer
        </label>
        <div className="space-y-1.5">
          {form.options.map((option, index) => (
            <div key={`${formId}-option-${index}`} className="flex items-center gap-2">
              <input
                type="radio"
                name={`${formId}-correct`}
                checked={form.correctOption === index}
                onChange={() => setField("correctOption", index)}
                className="accent-orange-500"
                aria-label={`Mark option ${index + 1} correct`}
              />
              <input
                value={option}
                onChange={(event) => setOption(index, event.target.value)}
                placeholder={`Option ${index + 1}`}
                className="min-w-0 flex-1 rounded-lg border border-border bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1"
                style={{ "--tw-ring-color": ORANGE } as React.CSSProperties}
              />
              {form.options.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeOption(index)}
                  className="text-muted-foreground transition-colors hover:text-red-500"
                  aria-label={`Remove option ${index + 1}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addOption}
          className="mt-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          + Add another option
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Order
          <input
            type="number"
            min={0}
            value={form.order}
            onChange={(event) => setField("order", Math.max(0, Number(event.target.value) || 0))}
            className="w-20 rounded-lg border border-border bg-white px-2 py-1.5 text-sm"
          />
        </label>
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={saving} className="font-mono text-xs">
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => onSave(form)}
            disabled={!valid || saving}
            className="gap-1.5 font-mono text-xs"
            style={{ backgroundColor: ORANGE, color: "#fff" }}
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "Saving…" : "Save question"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function toFormValues(question: QuizQuestion): QuestionFormValues {
  return {
    question: question.question,
    options: [...question.options],
    correctOption: question.correctOption,
    order: question.order,
  };
}

export default function ModuleQuizzes() {
  const [, setLocation] = useLocation();
  const { adminToken, isReady } = useAdminSession();
  const { toast } = useToast();
  const [modules, setModules] = useState<ModuleQuiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [openModules, setOpenModules] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<number | null>(null);
  const [addingTo, setAddingTo] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isReady && !adminToken) setLocation("/admin");
  }, [isReady, adminToken, setLocation]);

  const load = useCallback(async () => {
    if (!adminToken) return;
    setLoading(true);
    try {
      const response = await fetch("/api/admin/module-quizzes", {
        cache: "no-store",
        headers: { admintoken: adminToken, "Cache-Control": "no-cache" },
      });
      if (!response.ok) throw new Error("Could not load module quizzes");
      const data = await response.json() as { modules: ModuleQuiz[] };
      setModules(data.modules);
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Could not load module quiz questions." });
    } finally {
      setLoading(false);
    }
  }, [adminToken, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateQuestion = async (id: number, values: QuestionFormValues) => {
    if (!adminToken) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/module-quizzes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", admintoken: adminToken },
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(data?.error || "Could not update question");
      }
      const updated = await response.json() as QuizQuestion;
      setModules((current) => current.map((module) => ({
        ...module,
        questions: module.questions.map((question) => question.id === id ? updated : question),
      })));
      setEditing(null);
      toast({ title: "Module question updated" });
    } catch (error) {
      toast({ variant: "destructive", title: "Could not save", description: error instanceof Error ? error.message : "Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const addQuestion = async (moduleId: number, values: QuestionFormValues) => {
    if (!adminToken) return;
    setSaving(true);
    try {
      const response = await fetch("/api/admin/module-quizzes", {
        method: "POST",
        headers: { "Content-Type": "application/json", admintoken: adminToken },
        body: JSON.stringify({ ...values, moduleId }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(data?.error || "Could not add question");
      }
      const created = await response.json() as QuizQuestion;
      setModules((current) => current.map((module) =>
        module.id === moduleId ? { ...module, questions: [...module.questions, created].sort((a, b) => a.order - b.order || a.id - b.id) } : module
      ));
      setAddingTo(null);
      toast({ title: "Module question added" });
    } catch (error) {
      toast({ variant: "destructive", title: "Could not add question", description: error instanceof Error ? error.message : "Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const deleteQuestion = async (question: QuizQuestion) => {
    if (!adminToken || !window.confirm("Delete this module quiz question? This cannot be undone.")) return;
    try {
      const response = await fetch(`/api/admin/module-quizzes/${question.id}`, {
        method: "DELETE",
        headers: { admintoken: adminToken },
      });
      if (!response.ok) throw new Error("Could not delete question");
      setModules((current) => current.map((module) => ({
        ...module,
        questions: module.questions.filter((candidate) => candidate.id !== question.id),
      })));
      toast({ title: "Module question deleted" });
    } catch {
      toast({ variant: "destructive", title: "Could not delete", description: "Please try again." });
    }
  };

  const totalQuestions = modules.reduce((total, module) => total + module.questions.length, 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <Button variant="ghost" size="sm" asChild className="font-mono text-xs uppercase tracking-widest">
            <Link href="/admin/dashboard"><ArrowLeft className="mr-1 h-4 w-4" /> Dashboard</Link>
          </Button>
          <span className="font-mono text-sm font-bold uppercase tracking-widest">Module Quiz Bank</span>
          <div className="w-28" />
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-4 px-4 py-6">
        <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-950">
          <strong>Module quizzes</strong> — these questions appear after each training video. Changes are live for the next quiz opened by a learner; no app reinstall or republish is needed.
        </div>

        <div className="flex items-center justify-between">
          <p className="font-mono text-sm text-muted-foreground">
            {loading ? "Loading…" : `${modules.length} module${modules.length === 1 ? "" : "s"} · ${totalQuestions} question${totalQuestions === 1 ? "" : "s"}`}
          </p>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading} className="font-mono text-xs">
            Refresh
          </Button>
        </div>

        {!loading && modules.length === 0 && (
          <div className="rounded-xl border border-border bg-card py-16 text-center text-sm text-muted-foreground">
            No modules found.
          </div>
        )}

        {modules.map((module) => {
          const isOpen = openModules.has(module.id);
          const isAdding = addingTo === module.id;
          return (
            <section key={module.id} className="overflow-hidden rounded-xl border border-border bg-card">
              <button
                type="button"
                onClick={() => setOpenModules((current) => {
                  const next = new Set(current);
                  if (next.has(module.id)) next.delete(module.id);
                  else next.add(module.id);
                  return next;
                })}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30"
              >
                {isOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                  Module {module.order}: {module.title}
                  {!module.isActive && <span className="ml-2 text-xs font-normal text-muted-foreground">(inactive)</span>}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {module.questions.length} question{module.questions.length === 1 ? "" : "s"}
                </span>
              </button>

              {isOpen && (
                <div className="space-y-2 border-t border-border px-4 py-3">
                  {module.questions.map((question, index) => (
                    <div key={question.id} className="rounded-lg border border-border p-3">
                      {editing === question.id ? (
                        <QuestionForm
                          formId={`edit-${question.id}`}
                          initial={toFormValues(question)}
                          onSave={(values) => updateQuestion(question.id, values)}
                          onCancel={() => setEditing(null)}
                          saving={saving}
                        />
                      ) : (
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 shrink-0 font-mono text-xs text-muted-foreground">{index + 1}.</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">{question.question}</p>
                            <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                              {question.options.map((option, optionIndex) => (
                                <span key={`${question.id}-${optionIndex}`} className={optionIndex === question.correctOption ? "font-semibold text-green-700" : ""}>
                                  {optionIndex === question.correctOption ? "✓ " : "○ "}{option}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <button
                              type="button"
                              onClick={() => setEditing(question.id)}
                              className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                              title="Edit question"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteQuestion(question)}
                              className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500"
                              title="Delete question"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {isAdding ? (
                    <QuestionForm
                      formId={`new-${module.id}`}
                      initial={{ ...BLANK_FORM, order: module.questions.length }}
                      onSave={(values) => addQuestion(module.id, values)}
                      onCancel={() => setAddingTo(null)}
                      saving={saving}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAddingTo(module.id)}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add question to this module
                    </button>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </main>
    </div>
  );
}