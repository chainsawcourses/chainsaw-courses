#!/usr/bin/env node

/**
 * Check Chainsaw Courses-authored interface copy for common US spellings and
 * typos. This deliberately works on source text rather than the built bundle:
 * source locations make a failed check actionable and keep generated/manual
 * content out of the check.
 */

import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, "..");
const sourceRoot = resolve(appRoot, "src");

const SCANNED_FILES = [
  "pages",
  "components",
  "lib/biosecurityHazards.ts",
  "lib/exportPrint.ts",
  "data/vocalExamQuestions.ts",
];

// ManualFlipbook renders imported/manual PDF material. It is not authored UI
// copy, so it is excluded rather than forcing a spelling policy onto a source
// document that the app displays.
const EXCLUDED_FILES = new Set(["pages/ManualFlipbook.tsx"]);
const EXCLUDED_PATH_PREFIXES = [
  // Generated/third-party UI primitives contain implementation strings, not
  // Chainsaw Courses-authored learner or admin copy.
  "components/ui/",
];

// These are properties whose values are implementation details, not visible
// copy. Keeping this list explicit prevents a new CSS class or DOM identifier
// from producing a spelling warning.
const NON_COPY_ATTRIBUTES = new Set([
  "class",
  "className",
  "data-testid",
  "fill",
  "fontFamily",
  "href",
  "id",
  "name",
  "onClick",
  "rel",
  "role",
  "src",
  "style",
  "target",
  "type",
  "viewBox",
]);

const NON_COPY_PROPERTIES = new Set([
  "alignItems",
  "backgroundColor",
  "behavior",
  "borderColor",
  "color",
  "fill",
  "fillColor",
  "fontFamily",
  "justifyContent",
  "stroke",
  "textAlign",
  "transformOrigin",
]);

const COPY_PROPERTIES = new Set([
  "alt",
  "content",
  "description",
  "heading",
  "label",
  "message",
  "placeholder",
  "subtitle",
  "text",
  "title",
  "value",
]);

const SPELLING_RULES = [
  { id: "color", pattern: /\bcolors?\b/gi, replacement: "colour/colours" },
  { id: "center", pattern: /\bcent(?:er|ers|ered|ering)\b/gi, replacement: "centre/centres/centred/centring" },
  { id: "behavior", pattern: /\bbehavior(?:s|al)?\b/gi, replacement: "behaviour/behaviours/behavioural" },
  { id: "favorite", pattern: /\bfavorites?\b/gi, replacement: "favourite/favourites" },
  { id: "favor", pattern: /\bfavor(?:ed|ing|s)?\b/gi, replacement: "favoured/favouring/favours" },
  { id: "organize", pattern: /\borganiz(?:e|ed|es|ing|ation|ations)\b/gi, replacement: "organise/organised/organisation" },
  { id: "customize", pattern: /\bcustomiz(?:e|ed|es|ing|ation)\b/gi, replacement: "customise/customised/customisation" },
  { id: "analyze", pattern: /\banalyz(?:e|ed|es|ing|ation)\b/gi, replacement: "analyse/analysed/analysing/analysis" },
  { id: "defense", pattern: /\bdefens(?:e|es|ed|ing)\b/gi, replacement: "defence" },
  { id: "offense", pattern: /\boffens(?:e|es|ed|ing)\b/gi, replacement: "offence" },
  { id: "labor", pattern: /\blabor(?:s|ing|ed)?\b/gi, replacement: "labour" },
  { id: "labeled", pattern: /\blabel(?:ed|ing)\b/gi, replacement: "labelled/labelling" },
  { id: "canceled", pattern: /\bcancel(?:ed|ing)\b/gi, replacement: "cancelled/cancelling" },
  { id: "traveling", pattern: /\btravel(?:ed|ing)\b/gi, replacement: "travelled/travelling" },
  { id: "fulfill", pattern: /\bfulfill(?:s|ed|ing)?\b/gi, replacement: "fulfil/fulfils/fulfilled/fulfilling" },
  { id: "enroll", pattern: /\benroll(?:s|ed|ing)?\b/gi, replacement: "enrol/enrols/enrolled/enrolling" },
  { id: "theater", pattern: /\btheaters?\b/gi, replacement: "theatre/theatres" },
  { id: "gray", pattern: /\bgrays?\b/gi, replacement: "grey/greys" },
  { id: "airplane", pattern: /\bairplanes?\b/gi, replacement: "aeroplane/aeroplanes" },
  { id: "sidewalk", pattern: /\bsidewalks?\b/gi, replacement: "pavement/pavements" },
  { id: "zipcode", pattern: /\bzip\s*codes?\b/gi, replacement: "postcode/postcodes" },
  { id: "receive", pattern: /\brecieve\b/gi, replacement: "receive" },
  { id: "separate", pattern: /\bseperat(?:e|ely|ed|ing)\b/gi, replacement: "separate/separately" },
  { id: "occur", pattern: /\b(?:occured|occurence|occurences)\b/gi, replacement: "occurred/occurrence/occurrences" },
  { id: "accommodate", pattern: /\baccomodate(?:s|d|ing)?\b/gi, replacement: "accommodate" },
  { id: "definitely", pattern: /\bdefin(?:e|i)ately\b/gi, replacement: "definitely" },
  { id: "successful", pattern: /\bsuccesful(?:ly)?\b/gi, replacement: "successful/successfully" },
  { id: "assessment", pattern: /\bassesment(?:s)?\b/gi, replacement: "assessment/assessments" },
];

function collectSourceFiles(directory, files = []) {
  return stat(directory).then(async (directoryStat) => {
    if (directoryStat.isFile()) {
      if (/\.(?:tsx?|jsx?)$/.test(directory)) files.push(directory);
      return files;
    }

    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        await collectSourceFiles(entryPath, files);
      } else if (/\.(?:tsx?|jsx?)$/.test(entry.name)) {
        files.push(entryPath);
      }
    }
    return files;
  });
}

async function getFilesToScan() {
  const files = [];
  for (const configuredPath of SCANNED_FILES) {
    const fullPath = resolve(sourceRoot, configuredPath);
    const statEntries = await collectSourceFiles(fullPath);
    files.push(...statEntries);
  }
  return [...new Set(files)].filter((filePath) => {
    const relativePath = relative(sourceRoot, filePath);
    return (
      !EXCLUDED_FILES.has(relativePath) &&
      !EXCLUDED_PATH_PREFIXES.some((prefix) => relativePath.startsWith(prefix))
    );
  });
}

function lineNumberAt(source, index) {
  return source.slice(0, index).split("\n").length;
}

function lineAt(source, index) {
  const start = source.lastIndexOf("\n", index - 1) + 1;
  const end = source.indexOf("\n", index);
  return source.slice(start, end === -1 ? source.length : end).trim();
}

function propertyName(node) {
  if (!node) return null;
  if (ts.isIdentifier(node) || ts.isStringLiteral(node)) return node.text;
  return null;
}

function hasPropertyAncestor(node, property) {
  let current = node.parent;
  while (current) {
    if (ts.isPropertyAssignment(current) && propertyName(current.name) === property) return true;
    current = current.parent;
  }
  return false;
}

function isSharedCssTemplate(node) {
  let current = node.parent;
  while (current) {
    if (ts.isVariableDeclaration(current) && propertyName(current.name) === "SHARED_CSS") return true;
    current = current.parent;
  }
  return false;
}

function copyContext(node) {
  if (ts.isJsxText(node)) return true;

  const parent = node.parent;
  if (ts.isJsxAttribute(parent)) {
    return !NON_COPY_ATTRIBUTES.has(parent.name.text);
  }
  if (ts.isPropertyAssignment(parent)) {
    return COPY_PROPERTIES.has(propertyName(parent.name));
  }

  return false;
}

function shouldIgnoreNode(node, text, relativePath) {
  if (isSharedCssTemplate(node)) return true;
  if (relativePath === "data/vocalExamQuestions.ts" && hasPropertyAncestor(node, "keywords")) return true;

  const parent = node.parent;
  if (ts.isJsxAttribute(parent) && NON_COPY_ATTRIBUTES.has(parent.name.text)) return true;
  if (ts.isPropertyAssignment(parent) && NON_COPY_PROPERTIES.has(propertyName(parent.name))) return true;

  // A single token outside an explicit copy-bearing property is generally a
  // route, enum, status, DOM value, or other implementation detail.
  if (!/\s/.test(text) && !copyContext(node)) return true;

  return false;
}

function isTechnicalMatch(text, matchIndex, matchedText, ruleId) {
  const before = text.slice(Math.max(0, matchIndex - 40), matchIndex);
  const after = text.slice(matchIndex + matchedText.length, matchIndex + matchedText.length + 20);

  if (["color", "center", "gray"].includes(ruleId) && (before.endsWith("-") || after.startsWith("-"))) {
    return true;
  }

  if (
    ruleId === "center" &&
    /(?:align-items|justify-content|text-align|transform-origin)\s*:\s*$/i.test(before)
  ) {
    return true;
  }

  if (
    ruleId === "color" &&
    (
      /(?:background-color|border-color|color|fill|stroke)\s*:\s*$/i.test(before) ||
      (/style\s*=\s*['"][^'"]*$/i.test(before) && /^\s*:/.test(after))
    )
  ) {
    return true;
  }

  return false;
}

function findMatches(text, sourceIndex, source, relativePath) {
  const matches = [];
  for (const rule of SPELLING_RULES) {
    rule.pattern.lastIndex = 0;
    let match;
    while ((match = rule.pattern.exec(text))) {
      if (isTechnicalMatch(text, match.index, match[0], rule.id)) continue;
      matches.push({
        file: relativePath,
        line: lineNumberAt(source, sourceIndex + match.index),
        rule: rule.id,
        replacement: rule.replacement,
        excerpt: lineAt(source, sourceIndex + match.index),
      });
    }
  }
  return matches;
}

function findCopyMatches(source, relativePath) {
  const matches = [];
  const sourceFile = ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const visit = (node) => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node) ||
      ts.isJsxText(node)
    ) {
      const text = node.text;
      if (text.trim() && !shouldIgnoreNode(node, text, relativePath)) {
        const rawNodeText = node.getText(sourceFile);
        const contentOffset = Math.max(0, rawNodeText.indexOf(text));
        matches.push(...findMatches(text, node.getStart(sourceFile) + contentOffset, source, relativePath));
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return matches;
}

function runSelfTest() {
  const visibleCopy = `
    const utilityClasses = "items-center transition-colors bg-gray-100";
    export function Example() {
      return <p>Choose your favorite color and do not seperate the items.</p>;
    }
  `;
  const visibleFindings = findCopyMatches(visibleCopy, "pages/SelfTest.tsx");
  const visibleRules = visibleFindings.map(({ rule }) => rule).sort();
  const expectedVisibleRules = ["color", "favorite", "separate"];

  const assessmentCopy = `
    export const question = {
      label: "Choose your favorite color",
      keywords: ["favorite color", "center"],
    };
  `;
  const assessmentFindings = findCopyMatches(assessmentCopy, "data/vocalExamQuestions.ts");
  const assessmentRules = assessmentFindings.map(({ rule }) => rule).sort();
  const expectedAssessmentRules = ["color", "favorite"];

  if (
    JSON.stringify(visibleRules) !== JSON.stringify(expectedVisibleRules) ||
    JSON.stringify(assessmentRules) !== JSON.stringify(expectedAssessmentRules)
  ) {
    throw new Error(
      `UK English checker self-test failed: visible=${visibleRules.join(",")}; assessment=${assessmentRules.join(",")}`,
    );
  }

  console.log("UK English checker self-test passed.");
}

async function main() {
  if (process.argv.includes("--self-test")) {
    runSelfTest();
    return;
  }

  const files = await getFilesToScan();
  const findings = [];

  for (const filePath of files) {
    const source = await readFile(filePath, "utf8");
    findings.push(...findCopyMatches(source, relative(sourceRoot, filePath)));
  }

  if (findings.length > 0) {
    console.error(`UK English check failed: ${findings.length} finding${findings.length === 1 ? "" : "s"}.`);
    for (const finding of findings) {
      console.error(
        `- ${finding.file}:${finding.line} [${finding.rule}] use ${finding.replacement}; ${finding.excerpt}`,
      );
    }
    process.exitCode = 1;
    return;
  }

  console.log(`UK English check passed (${files.length} source files scanned).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});