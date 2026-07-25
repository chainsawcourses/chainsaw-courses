import nodemailer from "nodemailer";
import { generateCertificatePdf, CertUser } from "./generateCertificate";
import { logger } from "./logger";

export async function sendCertificateEmail(
  user: CertUser,
  passedAt: Date,
  score: number | null,
): Promise<void> {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) {
    logger.warn({ userId: user.id }, "SMTP not configured — certificate email skipped");
    return;
  }

  try {
    const pdfBytes = await generateCertificatePdf(user, passedAt, score);

    const transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT?.trim() ?? 587),
      secure: process.env.SMTP_SECURE?.trim() === "true",
      auth: {
        user: process.env.SMTP_USER?.trim(),
        pass: process.env.SMTP_PASS?.trim(),
      },
    });

    const from = process.env.SMTP_FROM?.trim() ?? "Chainsaw Courses <noreply@chainsawcourses.co.uk>";
    const safeName = user.fullName.replace(/[^a-z0-9]/gi, "_");

    await transporter.sendMail({
      from,
      to: user.email,
      subject: "Your Chainsaw Courses Certificate of Completion",
      text: [
        `Dear ${user.fullName},`,
        "",
        "Congratulations on successfully completing the Chainsaw Maintenance & Cross Cutting professional training course.",
        "",
        "Your IIRSM-approved Certificate of Completion is attached to this email as a PDF. It is a secured, non-editable document for your records.",
        "",
        "Course details:",
        "  Unit Ref: 0039-20",
        "  Guided Learning Hours: 5",
        "  CPD: 5 Verifiable CPD Hours",
        "  Pass Mark: 80%",
        `  Score achieved: ${score !== null ? `${score}%` : "—"}`,
        "",
        "You can also download your certificate at any time from the app.",
        "",
        "Kind regards,",
        "Chainsaw Courses",
        "chainsawcourses.co.uk",
      ].join("\n"),
      attachments: [
        {
          filename: `Certificate_${safeName}.pdf`,
          content: Buffer.from(pdfBytes),
          contentType: "application/pdf",
        },
      ],
    });

    logger.info({ userId: user.id, email: user.email }, "Certificate email sent");
  } catch (err) {
    logger.error({ err, userId: user.id }, "Failed to send certificate email");
  }
}
