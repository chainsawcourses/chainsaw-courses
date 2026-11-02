import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDirectory, "../../..");

const sources = {
  web: {
    label: "web privacy notice",
    path: path.join(
      workspaceRoot,
      "artifacts/chainsaw-training/src/pages/PrivacyPolicy.tsx",
    ),
  },
  pdf: {
    label: "downloadable PDF",
    path: path.join(
      workspaceRoot,
      "artifacts/api-server/src/lib/generatePrivacyPolicyPdf.ts",
    ),
  },
  staticHtml: {
    label: "server-rendered static HTML",
    path: path.join(
      workspaceRoot,
      "artifacts/api-server/privacy-policy.html",
    ),
  },
};

export const APPROVED_POSTAL_ADDRESS = "BR6 9RW";

export const PLACEHOLDER_PHRASES = [
  "[postal address]",
  "[insert address]",
  "address goes here",
  "address here",
  "your postal address",
  "your address",
  "postal address: tbc",
  "postal address: todo",
  "postal address: placeholder",
];

const requirements = [
  {
    label: "approved postal address",
    web: [APPROVED_POSTAL_ADDRESS],
    pdf: [APPROVED_POSTAL_ADDRESS],
    staticHtml: [APPROVED_POSTAL_ADDRESS],
  },
  {
    label: "policy version",
    web: ["Last updated: 15 September 2026", "Version 1.2"],
    pdf: ["Last updated: 15 September 2026", "Version 1.2"],
    staticHtml: [],
  },
  {
    label: "analytics data exclusions",
    web: [
      "Learner identity, manual page numbers, search text and manual content are not sent to analytics.",
      "Analytics is not used for advertising or cross-site profiling.",
    ],
    pdf: [
      "Learner identity, manual page numbers, search text and manual content are not sent to analytics.",
      "Analytics is not used for advertising or cross-site profiling.",
    ],
    staticHtml: [],
  },
  {
    label: "cookie wording",
    web: [
      "essential <strong>cookies</strong>",
      "We do not use advertising cookies.",
    ],
    pdf: ["essential cookies", "We do not use advertising cookies."],
    staticHtml: [],
  },
  {
    label: "analytics retention wording",
    web: [
      "Replit retains analytics with the published project&rsquo;s history",
      "reporting periods of up to 30 days",
    ],
    pdf: [
      "Replit retains analytics with the published project's history",
      "reporting periods of up to 30 days",
    ],
    staticHtml: [],
  },
];

function readSource(source) {
  try {
    return fs.readFileSync(source.path, "utf8");
  } catch (error) {
    console.error(
      `Privacy notice consistency check failed: could not read ${source.label} at ${path.relative(workspaceRoot, source.path)}.`,
    );
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export function validatePrivacyPolicySources(contents) {
  const failures = [];

  for (const requirement of requirements) {
    for (const format of Object.keys(sources)) {
      const missing = requirement[format].filter(
        (fragment) => !contents[format].includes(fragment),
      );

      if (missing.length > 0) {
        failures.push({
          requirement: requirement.label,
          format,
          missing,
        });
      }
    }
  }

  for (const [format, content] of Object.entries(contents)) {
    const lowerCaseContent = content.toLowerCase();
    const placeholders = PLACEHOLDER_PHRASES.filter((phrase) =>
      lowerCaseContent.includes(phrase),
    );

    if (placeholders.length > 0) {
      failures.push({
        requirement: "absence of placeholder postal-address wording",
        format,
        found: placeholders,
      });
    }
  }

  return failures;
}

function runCheck() {
  const contents = Object.fromEntries(
    Object.entries(sources).map(([key, source]) => [key, readSource(source)]),
  );
  const failures = validatePrivacyPolicySources(contents);

  if (failures.length > 0) {
    console.error("Privacy notice consistency check failed.");
    for (const failure of failures) {
      if (failure.missing) {
        console.error(
          `- ${sources[failure.format].label} is missing required ${failure.requirement} wording:`,
        );
        for (const fragment of failure.missing) {
          console.error(`  ${JSON.stringify(fragment)}`);
        }
      } else {
        console.error(
          `- ${sources[failure.format].label} contains forbidden ${failure.requirement}:`,
        );
        for (const phrase of failure.found) {
          console.error(`  ${JSON.stringify(phrase)}`);
        }
      }
    }
    console.error(
      "Update all learner-facing privacy notice sources together, or update this check if the approved policy wording has changed.",
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `Privacy notice consistency check passed: all three sources contain the approved postal address (${APPROVED_POSTAL_ADDRESS}), no address placeholders, and the current shared policy wording.`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCheck();
}
