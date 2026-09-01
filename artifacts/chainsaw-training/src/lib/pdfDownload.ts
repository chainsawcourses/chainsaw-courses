import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

export type FileDeliveryResult = "saved" | "shared" | "downloaded" | "cancelled";
export type PdfDeliveryResult = FileDeliveryResult;

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

function extensionOf(filename: string): string {
  const match = filename.match(/(\.[a-z0-9]+)$/i);
  return match?.[1]?.toLowerCase() ?? "";
}

function isCancellation(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  const message = error instanceof Error ? error.message : String(error);
  return /cancel|dismiss/i.test(message);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Could not encode file"));
        return;
      }
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.readAsDataURL(blob);
  });
}

async function deliverNativeFile(
  blob: Blob,
  filename: string,
): Promise<FileDeliveryResult> {
  const safeName = filename.replace(/[\\/:*?"<>|]+/g, "-");
  const path = `shared-files/${Date.now()}-${safeName}`;
  const data = await blobToBase64(blob);
  await Filesystem.writeFile({
    path,
    data,
    directory: Directory.Cache,
    recursive: true,
  });
  const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });

  try {
    await Share.share({
      title: safeName,
      text: "Choose Files, Drive, or another location to save this file.",
      files: [uri],
      dialogTitle: "Save or share file",
    });
    return "shared";
  } catch (error) {
    if (isCancellation(error)) return "cancelled";
    // Compatibility fallback for older native plugin implementations that
    // accepted a single local URI through `url` before `files` was supported.
    try {
      await Share.share({
        title: safeName,
        text: "Choose Files, Drive, or another location to save this file.",
        url: uri,
        dialogTitle: "Save or share file",
      });
      return "shared";
    } catch (fallbackError) {
      if (isCancellation(fallbackError)) return "cancelled";
      throw fallbackError;
    }
  }
}

/**
 * Lets the device choose how/where to receive a generated file.
 *
 * Capacitor apps use the native share sheet instead of relying on WebView
 * downloads, which Android may silently ignore. Desktop browsers use the file
 * picker where supported. Other browsers fall back to their Downloads folder.
 */
export async function deliverFile(
  blob: Blob,
  filename: string,
  mimeType = blob.type || "application/octet-stream",
): Promise<FileDeliveryResult> {
  if (Capacitor.isNativePlatform()) {
    return deliverNativeFile(blob, filename);
  }

  const extension = extensionOf(filename);
  const saveFilePicker = getSaveFilePicker();
  if (saveFilePicker) {
    try {
      const fileHandle = await saveFilePicker({
        suggestedName: filename,
        types: [{
          description: extension === ".pdf" ? "PDF document" : "File",
          accept: { [mimeType]: extension ? [extension] : [] },
        }],
      });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      return "saved";
    } catch (error) {
      // Closing the native picker is a deliberate cancellation. Other picker
      // failures fall through to the share sheet/download fallback.
      if (isCancellation(error)) {
        return "cancelled";
      }
    }
  }

  if (typeof navigator !== "undefined" && typeof navigator.share === "function" && typeof File !== "undefined") {
    const file = new File([blob], filename, { type: mimeType });
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
          text: "Choose where to save or share this file.",
        });
        return "shared";
      } catch (error) {
        // Closing the native chooser is a deliberate cancellation, not a
        // reason to silently save the file somewhere else.
        if (isCancellation(error)) {
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
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return "downloaded";
}

export function deliverPdf(blob: Blob, filename: string): Promise<PdfDeliveryResult> {
  return deliverFile(blob, filename, "application/pdf");
}