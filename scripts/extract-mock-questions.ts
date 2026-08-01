import { VOCAL_EXAM_QUESTIONS } from "../artifacts/chainsaw-training/src/data/vocalExamQuestions";
import fs from "fs";
import path from "path";

const out = JSON.stringify(VOCAL_EXAM_QUESTIONS, null, 2);
const dest = path.resolve("artifacts/api-server/src/data/mockQuestionsSeed.json");
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, out, "utf-8");
console.log(`Wrote ${VOCAL_EXAM_QUESTIONS.length} questions to ${dest}`);
