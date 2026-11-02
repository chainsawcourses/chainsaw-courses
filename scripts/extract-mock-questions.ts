import { VOCAL_EXAM_QUESTIONS } from "../artifacts/chainsaw-training/src/data/vocalExamQuestions";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const workspaceRoot = fileURLToPath(new URL("../", import.meta.url));
const dest = path.join(
  workspaceRoot,
  "artifacts/api-server/src/data/mockQuestionsSeed.json",
);
const out = JSON.stringify(VOCAL_EXAM_QUESTIONS, null, 2);

if (process.argv.includes("--check")) {
  const current = fs.existsSync(dest) ? fs.readFileSync(dest, "utf-8") : null;

  if (current !== out) {
    console.error(
      [
        "Mock question seed export is stale.",
        "The learner-visible questions in vocalExamQuestions.ts do not match mockQuestionsSeed.json.",
        "Run `pnpm --filter @workspace/scripts run generate-mock-questions` and commit the updated export.",
      ].join("\n"),
    );
    process.exit(1);
  }

  console.log(
    `Mock question seed export is current (${VOCAL_EXAM_QUESTIONS.length} questions).`,
  );
  process.exit(0);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, out, "utf-8");
console.log(`Wrote ${VOCAL_EXAM_QUESTIONS.length} questions to ${dest}`);
