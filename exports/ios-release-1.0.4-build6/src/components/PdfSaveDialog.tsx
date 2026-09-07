import { useEffect, useMemo, useState } from "react";
import { FileDown, FolderOpen, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { deliverPdf } from "../lib/pdfDownload";
import { Capacitor } from "@capacitor/core";

interface PdfSaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blob: Blob | null;
  defaultFilename: string;
  documentLabel: string;
}

function normaliseFilename(value: string, fallback: string): string {
  const trimmed = (value.trim() || fallback)
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return trimmed.toLowerCase().endsWith(".pdf") ? trimmed : `${trimmed}.pdf`;
}

function canChooseFolder(): boolean {
  return typeof window !== "undefined"
    && !Capacitor.isNativePlatform()
    && typeof (window as Window & { showSaveFilePicker?: unknown }).showSaveFilePicker === "function";
}

function nativeSaveLocation(): string | null {
  if (Capacitor.getPlatform() === "android") return "Downloads/Chainsaw Courses";
  if (Capacitor.getPlatform() === "ios") return "Files/Chainsaw Courses";
  return null;
}

export default function PdfSaveDialog({
  open,
  onOpenChange,
  blob,
  defaultFilename,
  documentLabel,
}: PdfSaveDialogProps) {
  const { toast } = useToast();
  const [filename, setFilename] = useState(defaultFilename);
  const [saving, setSaving] = useState(false);

  const safeFilename = useMemo(
    () => normaliseFilename(filename, defaultFilename),
    [defaultFilename, filename],
  );

  useEffect(() => {
    if (open) {
      setFilename(defaultFilename);
      setSaving(false);
    }
  }, [defaultFilename, open]);

  const handleSave = async () => {
    if (!blob || saving) return;
    setSaving(true);
    try {
      const result = await deliverPdf(blob, safeFilename);
      if (result === "saved") {
        const location = nativeSaveLocation();
        toast({
          title: "PDF saved",
          description: location
            ? `Saved to ${location} as ${safeFilename}`
            : `Saved as ${safeFilename}`,
        });
        onOpenChange(false);
      } else if (result === "shared") {
        toast({ title: "PDF shared or saved" });
        onOpenChange(false);
      } else if (result === "downloaded") {
        toast({
          title: "PDF download started",
          description: `The file should appear in Downloads as ${safeFilename}.`,
        });
        onOpenChange(false);
      }
    } catch (error) {
      console.error("PDF delivery failed", error);
      toast({
        variant: "destructive",
        title: "Could not save PDF",
        description: "The PDF was created, but your device could not open its save or share options. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const chooseFolder = canChooseFolder();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono uppercase tracking-widest text-sm">
            Save PDF
          </DialogTitle>
          <DialogDescription className="font-mono text-xs leading-relaxed">
            Choose a filename for this {documentLabel}. {chooseFolder
              ? "The next step will let you choose the folder."
              : nativeSaveLocation()
                ? `The PDF will be saved directly to ${nativeSaveLocation()}.`
              : "Your device will open its save or share options."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label htmlFor="pdf-filename" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            File name
          </label>
          <Input
            id="pdf-filename"
            value={filename}
            onChange={(event) => setFilename(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void handleSave();
            }}
            autoFocus
            disabled={saving}
            className="font-mono text-sm"
            spellCheck={false}
          />
          <p className="font-mono text-[10px] text-muted-foreground">
            The file will be saved as <span className="text-foreground">{safeFilename}</span>
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="font-mono text-xs uppercase tracking-widest"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={!blob || saving || !safeFilename}
            className="font-mono text-xs uppercase tracking-widest"
          >
            {chooseFolder ? (
              <FolderOpen className="w-3.5 h-3.5 mr-1.5" />
            ) : typeof navigator !== "undefined" && typeof navigator.share === "function" ? (
              <Share2 className="w-3.5 h-3.5 mr-1.5" />
            ) : (
              <FileDown className="w-3.5 h-3.5 mr-1.5" />
            )}
            {saving
              ? "Saving…"
              : chooseFolder
                ? "Choose location & save"
                : nativeSaveLocation()
                  ? "Save PDF"
                  : "Save / share PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}