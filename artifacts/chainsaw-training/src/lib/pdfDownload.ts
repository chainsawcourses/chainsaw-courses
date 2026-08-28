export type PdfDeliveryResult = "saved" | "shared" | "downloaded" | "cancelled";

type SaveFilePicker = (options: {
  suggestedName: string;
  types: Array<{
    description: string;
    accept: Record<string, string[]>;
  }>;
}) => Promise<{
  createWritable: () => Promise<{
    write: (data: Blob) => Promise<void>;
    close: () => Promise<void>;
  }>;
}>;

function getSaveFilePicker(): SaveFilePicker | null {
  if (typeof window === "undefined") return null;
  return (window as Window & { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker ?? null;
}

/**
 * Lets the device choose how/where to receive a generated PDF.
 *
 * On Android/iOS this opens the native share sheet, which includes available
 * save locations and PDF apps. Browsers without file sharing use the normal
 * Downloads-folder fallback.
 */
export async function deliverPdf(blob: Blob, filename: string): Promise<PdfDeliveryResult> {
  const saveFilePicker = getSaveFilePicker();
  if (saveFilePicker) {
    try {
      const fileHandle = await saveFilePicker({
        suggestedName: filename,
        types: [{ description: "PDF document", accept: { "application/pdf": [".pdf"] } }],
      });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      return "saved";
    } catch (error) {
      // Closing the native picker is a deliberate cancellation. Other picker
      // failures fall through to the share sheet/download fallback.
      if (error instanceof DOMException && error.name === "AbortError") {
        return "cancelled";
      }
    }
  }

  if (typeof navigator !== "undefined" && typeof navigator.share === "function" && typeof File !== "undefined") {
    const file = new File([blob], filename, { type: "application/pdf" });
    let canShareFile = true;

    if (typeof navigator.canShare === "function") {
      try {
        canShareFile = navigator.canShare({ files: [file] });
      } catch {
        canShareFile = false;
      }
    }

    if (canShareFile) {
      try {
        await navigator.share({
          files: [file],
          title: filename,
          text: "Choose where to save or share this PDF.",
        });
        return "shared";
      } catch (error) {
        // Closing the native chooser is a deliberate cancellation, not a
        // reason to silently save the file somewhere else.
        if (error instanceof DOMException && error.name === "AbortError") {
          return "cancelled";
        }
        // Some older WebViews expose navigator.share but reject file sharing.
        // Fall through to the reliable browser download below.
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return "downloaded";
}