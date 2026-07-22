import { sendEmail } from "./email";
import { AssessmentVenue, AssessmentEnquiry } from "@workspace/db";
import { logger } from "./logger";

const BASE_URL = process.env.PUBLIC_URL ?? "https://chainsawcourses.co.uk";

interface CandidateInfo {
  fullName: string;
  email: string;
  postcode: string;
  phone: string;
}

function brandHeader() {
  return `
    <div style="background:#d97706;padding:18px 24px;border-radius:8px 8px 0 0;">
      <span style="color:#fff;font-family:monospace;font-weight:900;font-size:15px;letter-spacing:2px;text-transform:uppercase;">
        CHAINSAW COURSES — PRACTICAL PROGRESSION GATEWAY
      </span>
    </div>
  `;
}

function brandFooter() {
  return `
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;font-family:monospace;">
      Chainsaw Courses · chainsawcourses.co.uk · info@chainsawcourses.co.uk<br/>
      No funds are handled by this platform. All assessment fees are paid directly to the venue.
    </div>
  `;
}

function candidateTable(candidates: CandidateInfo[]) {
  const rows = candidates.map((c, i) => `
    <tr style="background:${i % 2 === 0 ? "#f9fafb" : "#fff"};">
      <td style="padding:8px 12px;font-family:monospace;font-size:13px;">${c.fullName}</td>
      <td style="padding:8px 12px;font-family:monospace;font-size:13px;">${c.postcode}</td>
      <td style="padding:8px 12px;font-family:monospace;font-size:13px;">${c.phone}</td>
      <td style="padding:8px 12px;font-family:monospace;font-size:13px;"><a href="mailto:${c.email}" style="color:#d97706;">${c.email}</a></td>
    </tr>
  `).join("");
  return `
    <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;margin:16px 0;">
      <thead>
        <tr style="background:#111827;">
          <th style="padding:8px 12px;text-align:left;color:#fff;font-family:monospace;font-size:12px;letter-spacing:1px;">NAME</th>
          <th style="padding:8px 12px;text-align:left;color:#fff;font-family:monospace;font-size:12px;letter-spacing:1px;">POSTCODE</th>
          <th style="padding:8px 12px;text-align:left;color:#fff;font-family:monospace;font-size:12px;letter-spacing:1px;">PHONE</th>
          <th style="padding:8px 12px;text-align:left;color:#fff;font-family:monospace;font-size:12px;letter-spacing:1px;">EMAIL</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

// ─── Candidate Confirmation ───────────────────────────────────────────────────

export async function sendCandidateConfirmation(
  candidate: CandidateInfo,
  venue: AssessmentVenue,
  nextBatchDate: string,
) {
  const subject = `Assessment Enquiry Registered — ${venue.name}`;
  const text = `Your enquiry to ${venue.name} has been logged. It will be included in the next assessment broadcast on ${nextBatchDate}. If 4 candidates register interest in this venue before then, we'll notify the venue immediately.`;
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      ${brandHeader()}
      <div style="padding:24px;">
        <p style="font-size:15px;margin-top:0;">Hi ${candidate.fullName},</p>
        <p>Your enquiry to <strong>${venue.name}</strong> (${venue.town}, ${venue.county}) has been registered.</p>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:14px 16px;margin:16px 0;">
          <p style="margin:0;font-size:14px;color:#166534;">
            📅 Your enquiry will be included in the next <strong>assessment broadcast on ${nextBatchDate}</strong>.<br/>
            Batched broadcasts have a higher response rate than individual cold emails — venues receive a consolidated list of qualified candidates, making it easier for them to schedule a date.
          </p>
        </div>
        <p style="font-size:13px;color:#6b7280;">
          If 4 candidates register interest in ${venue.name} before ${nextBatchDate}, we'll notify the venue immediately — no need to wait.<br/><br/>
          A separate enquiry email from you will also open in your email app. Please send it — this goes directly to the venue so they can recognise your name when our broadcast arrives.
        </p>
        <p style="font-size:13px;color:#6b7280;">We'll keep you updated by email. You can cancel your enquiry at any time from the app.</p>
        ${brandFooter()}
      </div>
    </div>
  `;
  await sendEmail({ to: candidate.email, subject, text, html });
}

// ─── Batch Email to Venue ─────────────────────────────────────────────────────

export async function sendBatchEmailToVenue(
  venue: AssessmentVenue,
  candidates: CandidateInfo[],
  isFullGroup: boolean,
) {
  const count = candidates.length;
  const subject = isFullGroup
    ? `NPTC 201/202 — Full Group of 4 Candidates Ready · ${venue.town}, ${venue.county}`
    : `NPTC 201/202 — ${count} Qualified Candidate${count > 1 ? "s" : ""} Interested · ${venue.town}, ${venue.county}`;

  const intro = isFullGroup
    ? `<p style="font-size:15px;"><strong>You have a full group of 4 qualified candidates</strong> ready to book NPTC Unit 201/202 (Chainsaw Maintenance &amp; Cross Cutting) at your centre.</p>`
    : `<p style="font-size:15px;">You have <strong>${count} qualified candidate${count > 1 ? "s" : ""}</strong> currently interested in NPTC Unit 201/202 (Chainsaw Maintenance &amp; Cross Cutting) at your centre.</p>`;

  const html = `
    <div style="font-family:sans-serif;max-width:620px;margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      ${brandHeader()}
      <div style="padding:24px;">
        <p style="margin-top:0;font-size:13px;color:#6b7280;">To: ${venue.name} Assessment Team</p>
        ${intro}
        <p style="font-size:13px;color:#374151;">All candidates have completed the <strong>Chainsaw Courses theoretical training programme</strong> and hold a Certificate of Completion. They are now seeking a practical assessment centre for NPTC 201/202.</p>
        ${candidateTable(candidates)}
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:14px 16px;margin:16px 0;">
          <p style="margin:0;font-size:13px;color:#92400e;">
            ⏱ <strong>NPTC Registration Notice:</strong> Please allow up to 10 working days for NPTC candidate registration when scheduling an assessment date.
          </p>
        </div>
        <p style="font-size:13px;color:#374151;">Please reply directly to this email with your available assessment dates and individual deposit/payment information for each candidate. Each candidate is responsible for paying your centre directly — no funds are handled by Chainsaw Courses.</p>
        ${brandFooter()}
      </div>
    </div>
  `;

  const text = `${subject}\n\nCandidates:\n${candidates.map(c => `${c.fullName} — ${c.postcode} — ${c.phone} — ${c.email}`).join("\n")}\n\nPlease reply with available dates and payment details. NPTC 10-day registration notice applies.`;
  await sendEmail({ to: venue.email, subject, text, html });
  logger.info({ venueId: venue.id, candidateCount: count, isFullGroup }, "Batch email sent to venue");
}

// ─── 7-Day Nudge to Candidate ─────────────────────────────────────────────────

export async function sendNudge7(
  candidate: CandidateInfo,
  venue: AssessmentVenue,
  enquiry: AssessmentEnquiry,
  batchSentDate: string,
) {
  const resolveUrl = `${BASE_URL}/api/gateway/resolve/${enquiry.resolveToken}`;
  const followupUrl = `${resolveUrl}?action=followup`;
  const resolvedUrl = `${resolveUrl}?action=resolved`;

  const subject = `Update on your ${venue.name} enquiry — any response?`;
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      ${brandHeader()}
      <div style="padding:24px;">
        <p style="margin-top:0;font-size:15px;">Hi ${candidate.fullName},</p>
        <p>We contacted <strong>${venue.name}</strong> on ${batchSentDate} with your enquiry — we haven't received a response yet.</p>
        <p style="font-size:14px;color:#374151;">Would you like us to send a follow-up on your behalf?</p>
        <div style="display:flex;gap:12px;margin:20px 0;">
          <a href="${followupUrl}" style="display:inline-block;background:#d97706;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-family:monospace;font-weight:bold;font-size:13px;letter-spacing:1px;">
            YES — FOLLOW UP FOR ME
          </a>
          <a href="${resolvedUrl}" style="display:inline-block;background:#f3f4f6;color:#374151;padding:12px 24px;border-radius:6px;text-decoration:none;font-family:monospace;font-weight:bold;font-size:13px;letter-spacing:1px;">
            I'VE HEARD BACK — CANCEL
          </a>
        </div>
        <p style="font-size:12px;color:#9ca3af;">If you've already made contact with the venue, just click "I've heard back" and we won't bother you again. If you do nothing, we'll assume everything is resolved.</p>
        ${brandFooter()}
      </div>
    </div>
  `;
  const text = `Hi ${candidate.fullName},\n\nWe contacted ${venue.name} on ${batchSentDate} — no response yet.\n\nFollow up on your behalf: ${followupUrl}\nI've heard back: ${resolvedUrl}`;
  await sendEmail({ to: candidate.email, subject, text, html });
}

// ─── Follow-up Email to Venue (after candidate clicks "Yes") ─────────────────

export async function sendFollowUpToVenue(
  venue: AssessmentVenue,
  candidate: CandidateInfo,
) {
  const subject = `Follow-up: NPTC 201/202 Enquiry — ${candidate.fullName}`;
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      ${brandHeader()}
      <div style="padding:24px;">
        <p style="margin-top:0;">To: ${venue.name} Assessment Team,</p>
        <p>This is a follow-up regarding a recent assessment enquiry from one of our candidates. We sent initial details previously but haven't yet received a response.</p>
        ${candidateTable([candidate])}
        <p style="font-size:13px;">This candidate has completed the Chainsaw Courses theoretical programme and is keen to book an NPTC 201/202 practical assessment at your centre. Please reply with your available dates at your earliest convenience.</p>
        ${brandFooter()}
      </div>
    </div>
  `;
  const text = `Follow-up for ${candidate.fullName} (${candidate.postcode} · ${candidate.phone} · ${candidate.email}).\n\nPlease reply with available NPTC 201/202 assessment dates.`;
  await sendEmail({ to: venue.email, subject, text, html });
}

// ─── 12-Day Nudge to Candidate (recommend calling) ───────────────────────────

export async function sendNudge12(
  candidate: CandidateInfo,
  venue: AssessmentVenue,
  enquiry: AssessmentEnquiry,
  alternativeVenues: AssessmentVenue[],
) {
  const resolvedUrl = `${BASE_URL}/api/gateway/resolve/${enquiry.resolveToken}?action=resolved`;

  const altRows = alternativeVenues.slice(0, 3).map(v => `
    <tr>
      <td style="padding:7px 12px;font-family:monospace;font-size:13px;">${v.name}</td>
      <td style="padding:7px 12px;font-family:monospace;font-size:13px;">${v.town}, ${v.county}</td>
      <td style="padding:7px 12px;font-family:monospace;font-size:13px;"><a href="tel:${v.phone}" style="color:#d97706;">${v.phone}</a></td>
    </tr>
  `).join("");

  const subject = `Still no reply from ${venue.name} — we recommend calling directly`;
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      ${brandHeader()}
      <div style="padding:24px;">
        <p style="margin-top:0;font-size:15px;">Hi ${candidate.fullName},</p>
        <p>We've followed up with <strong>${venue.name}</strong> on your behalf but still haven't received a response.</p>
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:14px 16px;margin:16px 0;">
          <p style="margin:0;font-size:14px;color:#991b1b;">
            📞 We recommend calling <strong>${venue.name}</strong> directly:<br/>
            <a href="tel:${venue.phone}" style="color:#d97706;font-family:monospace;font-weight:bold;font-size:16px;">${venue.phone}</a>
          </p>
        </div>
        ${alternativeVenues.length > 0 ? `
          <p style="font-size:14px;color:#374151;">Alternatively, here are other nearby assessment centres you can contact:</p>
          <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
            <thead><tr style="background:#111827;">
              <th style="padding:7px 12px;text-align:left;color:#fff;font-family:monospace;font-size:12px;">VENUE</th>
              <th style="padding:7px 12px;text-align:left;color:#fff;font-family:monospace;font-size:12px;">LOCATION</th>
              <th style="padding:7px 12px;text-align:left;color:#fff;font-family:monospace;font-size:12px;">PHONE</th>
            </tr></thead>
            <tbody>${altRows}</tbody>
          </table>
        ` : ""}
        <p style="margin-top:20px;font-size:13px;">
          <a href="${resolvedUrl}" style="color:#d97706;">Click here if you've already sorted your assessment</a> — we'll cancel all further updates.
        </p>
        ${brandFooter()}
      </div>
    </div>
  `;
  const text = `Hi ${candidate.fullName},\n\nStill no reply from ${venue.name}. We recommend calling directly: ${venue.phone}.\n\nAlternative venues:\n${alternativeVenues.slice(0, 3).map(v => `${v.name} — ${v.phone}`).join("\n")}\n\nResolved? ${resolvedUrl}`;
  await sendEmail({ to: candidate.email, subject, text, html });
}
