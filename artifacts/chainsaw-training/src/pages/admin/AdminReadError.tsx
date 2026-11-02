import { Button } from "@/components/ui/button";

export default function AdminReadError({ subject, retry }: { subject: string; retry: () => void }) {
  return (
    <div role="alert" className="border border-destructive/50 bg-destructive/5 p-4 text-sm font-mono text-destructive flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
      <span>Could not load {subject}. No records have been changed. Check your app admin session or connection, then retry.</span>
      <Button type="button" variant="outline" size="sm" onClick={retry} className="shrink-0 w-fit">Retry</Button>
    </div>
  );
}