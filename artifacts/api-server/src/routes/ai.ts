import { Router } from "express";
import { db } from "@workspace/db";
import { chatMessagesTable } from "@workspace/db";
import { SendAiMessageBody } from "@workspace/api-zod";
import { eq, asc } from "drizzle-orm";
import { resolveUser } from "./auth";
import { logger } from "../lib/logger";
import { getManualText } from "../lib/manual";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

const router = Router();

const EXAM_QUESTIONS = [
  "Explain the risk assessment process.",
  "Identify the hazards, risks and controls associated with the site, task and machine.",
  "Outline the emergency planning relevant to the working area.",
  "Outline your responsibilities as an operator under the Health and Safety at Work Act and PUWER.",
  "State providers of industry good practice in chainsaw operations.",
  "Explain why it is important to maintain chainsaws to the manufacturer's recommendations.",
  "Identify and explain the function of all the key safety features of a chainsaw.",
  "State the hazards associated with battery powered chainsaw equipment.",
  "Explain battery power unit maintenance and checks.",
  "State the benefits associated with the use of battery powered machines.",
  "Explain the function and maintenance requirements of the individual components of a chainsaw (spark plug, air filter, chain brake, cooling system, exhaust system, clutch/drive system, sprocket, starter mechanism, fuel filter, oil filter).",
  "Explain the function and maintenance requirements of the guidebar.",
  "Describe the problems encountered when a chain and guidebar are worn, damaged or poorly maintained.",
  "State the information required to replace a chainsaw chain.",
  "Identify different cutter types and their application.",
  "Explain how to select the correct filing information for the chain and why this is necessary.",
  "Explain the function and maintenance requirements of the chain.",
  "State the steps to be taken when a chainsaw is not repairable, faulty or non-operational.",
  "Describe the correct methods for disposing of waste from chainsaw maintenance activities.",
  "State the appropriate safe working distances from other operators during cross-cutting.",
  "State routine bio-security controls relevant to chainsaw operations.",
  "State the environmental considerations specific to cross-cutting.",
  "Describe tension and compression in timber.",
  "Describe the procedure for removing a trapped saw.",
  "State the recognised methods required to cross-cut timber.",
  "Describe how to apply ergonomic working methods during chainsaw operations.",
  "Describe how to safely move timber.",
  "State the considerations for stacking of timber.",
  "State the precautions to take to avoid uncontrolled timber movement.",
];

const CHAINSAW_SYSTEM_PROMPT = `You are a strict NPTC oral examiner conducting the City & Guilds Level 2 Certificate of Competence in Chainsaw Maintenance and Cross-cutting (0039-20) oral examination.

You have a fixed list of ${EXAM_QUESTIONS.length} questions that you MUST ask in strict order, one at a time. The questions are:

${EXAM_QUESTIONS.map((q, i) => `Q${i + 1}: ${q}`).join("\n")}

EXAMINATION RULES:
1. Count the number of questions you have already asked by reviewing the conversation history. The next question to ask is always the one after the last question you posed.
2. When the student sends any message to BEGIN the exam (or a trigger like "begin", "start", or "ready"), introduce yourself briefly and ask Q1.
3. After each student answer, give a brief, direct evaluation (1-3 sentences: what was good and what key points were missed if any), then immediately ask the next question prefixed with "QUESTION [N] OF ${EXAM_QUESTIONS.length}:".
4. Never skip a question and never repeat a question already asked.
5. When all ${EXAM_QUESTIONS.length} questions have been answered, provide a short overall summary of performance and declare the oral examination complete.
6. Stay strictly on topic — chainsaw safety, maintenance, legislation, and cross-cutting technique only. If the student goes off topic, redirect them politely and re-ask the current unanswered question.
7. Be professional, concise, and authoritative — this is a formal examination.
8. Do NOT engage in general chat or answer random questions. You are conducting an examination, not a tutoring session.

Format each question you ask exactly like this:
QUESTION [N] OF ${EXAM_QUESTIONS.length}: [question text]`;

function buildSystemPrompt(): string {
  const manual = getManualText();
  if (!manual) return CHAINSAW_SYSTEM_PROMPT;
  // Truncate if extremely long to stay within token limits
  const trimmedManual =
    manual.length > 120000 ? manual.slice(0, 120000) + "\n...[truncated]" : manual;
  return `${CHAINSAW_SYSTEM_PROMPT}\n\n---\n\nREFERENCE MATERIAL (your internal knowledge — do NOT quote passages to the candidate):\n${trimmedManual}`;
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

router.post("/ai/chat", async (req, res) => {
  const parse = SendAiMessageBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { message, deviceId, activationCode } = parse.data;
  const user = await resolveUser(activationCode, deviceId, req.headers["userid"] ? Number(req.headers["userid"]) : undefined);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    await db.insert(chatMessagesTable).values({
      userId: user.id,
      role: "user",
      content: message,
    });

    const history = await db
      .select()
      .from(chatMessagesTable)
      .where(eq(chatMessagesTable.userId, user.id))
      .orderBy(asc(chatMessagesTable.createdAt));

    let reply: string;

    const gemini = getGeminiClient();

    if (gemini) {
      const contents = history.slice(0, -1).map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
      contents.push({ role: "user", parts: [{ text: message }] });

      const response = await gemini.models.generateContent({
        model: "gemini-2.0-flash",
        contents,
        config: {
          systemInstruction: buildSystemPrompt(),
          maxOutputTokens: 8192,
        },
      });

      reply = response.text ?? "I was unable to generate a response. Please try again.";
    } else {
      reply = `Thank you. The AI examiner requires a live AI connection to conduct the oral exam. Please ensure the system is properly configured and try again.`;
    }

    await db.insert(chatMessagesTable).values({
      userId: user.id,
      role: "assistant",
      content: reply,
    });

    res.json({ reply, isOnTopic: true });
  } catch (err) {
    logger.error({ err }, "Error in AI chat");
    res.status(500).json({ error: "Internal server error" });
  }
});

const GradeAnswerBody = z.object({
  transcript: z.string(),
  promptText: z.string(),
  keyPoints: z.array(z.object({ keywords: z.array(z.string()) })),
  deviceId: z.string(),
  activationCode: z.string(),
});

router.post("/ai/grade-answer", async (req, res) => {
  const parse = GradeAnswerBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { transcript, promptText, keyPoints, deviceId, activationCode } = parse.data;
  const user = await resolveUser(activationCode, deviceId, req.headers["userid"] ? Number(req.headers["userid"]) : undefined);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const gemini = getGeminiClient();
  if (!gemini || !transcript.trim()) {
    res.json({ matched: keyPoints.map(() => false), fallback: true });
    return;
  }

  const keyPointsText = keyPoints
    .map((kp: { keywords: string[] }, i: number) => `${i + 1}. Concepts: ${kp.keywords.slice(0, 6).join(", ")}`)
    .join("\n");

  const manual = getManualText();
  const manualSection = manual
    ? `\n\nREFERENCE MATERIAL (your internal knowledge — do NOT quote passages):\n${manual.length > 60000 ? manual.slice(0, 60000) + "\n...[truncated]" : manual}`
    : "";

  const gradingPrompt = `You are an NPTC chainsaw safety examiner grading a student's spoken answer.

Question: "${promptText}"
Student's answer: "${transcript}"${manualSection}

Decide whether the student's answer covers each key concept below.
Be GENEROUS — accept synonyms, paraphrasing, colloquial phrasing, and partial answers that show genuine understanding.
Examples of acceptable equivalents:
- "clean and inspect connections and batteries" covers battery maintenance
- "checking for damage or wear" covers inspection
- "make sure it's off before working on it" covers isolation/lockout

Key concepts (one per line):
${keyPointsText}

Reply ONLY with a JSON array of booleans in the same order, nothing else.
Example: [true, false, true]`;

  try {
    const response = await gemini.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: gradingPrompt }] }],
      config: { maxOutputTokens: 256 },
    });

    const text = response.text?.trim() ?? "[]";
    const match = text.match(/\[[\s\S]*?\]/);
    const parsed = match ? JSON.parse(match[0]) : null;
    const matched =
      Array.isArray(parsed) && parsed.length === keyPoints.length
        ? parsed.map(Boolean)
        : keyPoints.map(() => false);

    res.json({ matched });
  } catch (err) {
    logger.error({ err }, "Error in AI grade-answer");
    res.json({ matched: keyPoints.map(() => false), fallback: true });
  }
});

router.get("/ai/chat-history", async (req, res) => {
  const deviceId = req.headers["deviceid"] as string;
  const activationCode = req.headers["activationcode"] as string;

  if (!deviceId || !activationCode) {
    res.status(401).json({ error: "Missing auth headers" });
    return;
  }

  const user = await resolveUser(activationCode, deviceId, req.headers["userid"] ? Number(req.headers["userid"]) : undefined);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const messages = await db
      .select()
      .from(chatMessagesTable)
      .where(eq(chatMessagesTable.userId, user.id))
      .orderBy(asc(chatMessagesTable.createdAt));

    res.json(
      messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    logger.error({ err }, "Error fetching chat history");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
