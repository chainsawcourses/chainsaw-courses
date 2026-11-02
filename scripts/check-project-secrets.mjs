import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const keyPatterns = [
  "ADMIN_PASSWORD", "SESSION_SECRET", "SHOPIFY_WEBHOOK_SECRET",
  "VAPID_EMAIL", "VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY",
  "VIMEO_ACCESS_TOKEN", "SMTP_HOST", "SMTP_PORT", "SMTP_USER",
  "SMTP_USERNAME", "SMTP_PASSWORD", "SMTP_FROM", "SMTP_URL",
  "FIREBASE_PRIVATE_KEY", "FIREBASE_PRIVATE_KEY_ID", "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_CLIENT_ID", "FIREBASE_PROJECT_ID", "FIREBASE_SERVER_KEY",
  "FIREBASE_API_KEY", "GOOGLE_APPLICATION_CREDENTIALS",
];
const keyPattern = keyPatterns.join("|");
const ignored = /(^|\/)(node_modules|dist|build|coverage|generated|tests|\.git)(\/|$)|(^|\/)playwright\.config\.[cm]?[jt]s$|\.(test|spec)\.[cm]?[jt]sx?$|\.(map|lock|png|jpg|jpeg|gif|webp|pdf|md|txt)$/i;

let files;
try {
  files = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" })
    .split("\0").filter(Boolean);
} catch {
  throw new Error("Unable to inspect tracked project files with git.");
}

const findings = [];
for (const relative of files) {
  if (relative === "scripts/check-project-secrets.mjs" || ignored.test(relative)) continue;
  const full = path.join(root, relative);
  let content;
  try {
    content = await readFile(full, "utf8");
  } catch {
    continue;
  }
  // A process.env lookup is a reference to a managed secret, not a committed value.
  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (!new RegExp(`(?:^|[\\s,{])(?:${keyPattern})(?:\\s*|['"])[:=]`).test(line)) return;
    if (/\bprocess\.env\.(?:[A-Z0-9_]+)|\bprocess\.env\[['"][A-Z0-9_]+['"]\]/.test(line)) {
      // Still catch a literal assignment elsewhere on the same line.
      const assignment = line.match(new RegExp(`(?:${keyPattern})\\s*[:=]\\s*(['"])([^'"]+)\\1`));
      if (!assignment) return;
    }
    const assignment = line.match(new RegExp(`(?:${keyPattern})\\s*[:=]\\s*(?:"([^"]*)"|'([^']*)'|([^\\s,;}]+))`));
    if (!assignment) return;
    const value = assignment[1] ?? assignment[2] ?? assignment[3] ?? "";
    if (!value || value.startsWith("$") || value.includes("process.env")) return;
    findings.push(`${relative}:${index + 1}`);
  });
}

if (findings.length) {
  throw new Error(`Credential assignments found in tracked project files:\n${findings.join("\n")}`);
}
console.log("Tracked project files contain no literal managed credential assignments.");