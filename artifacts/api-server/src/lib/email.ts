import nodemailer from "nodemailer";
import { logger } from "./logger";

export interface MailOptions {
  to: string | string[];
  cc?: string | string[];
  subject: string;
  text: string;
  html: string;
}

export async function sendEmail(opts: MailOptions): Promise<boolean> {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) {
    logger.warn("SMTP not configured — email skipped");
    return false;
  }
  try {
    const transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT?.trim() ?? 587),
      secure: process.env.SMTP_SECURE?.trim() === "true",
      auth: {
        user: process.env.SMTP_USER?.trim(),
        pass: process.env.SMTP_PASS?.trim(),
      },
    });
    const from = process.env.SMTP_FROM?.trim() ?? "Chainsaw Courses <noreply@chainsawcourses.com>";
    await transporter.sendMail({ from, ...opts });
    return true;
  } catch (err) {
    logger.error({ err }, "Failed to send email");
    return false;
  }
}
