import { generateCertificatePdf } from "./generateCertificate";

/** Render the real layout without recording a pass or issuing a reference. */
export function generateSampleCertificatePdf(name: string, email: string): Promise<Uint8Array> {
  return generateCertificatePdf({ id: 0, fullName: name, email }, new Date(), null, { sample: true });
}