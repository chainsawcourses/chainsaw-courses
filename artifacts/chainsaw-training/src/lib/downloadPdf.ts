import { deliverPdf, type PdfDeliveryResult } from "./pdfDownload";

export async function downloadPdf(
  url: string,
  filename: string,
  requestInit?: RequestInit,
): Promise<PdfDeliveryResult> {
  const res = await fetch(url, requestInit);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  return deliverPdf(blob, filename);
}
