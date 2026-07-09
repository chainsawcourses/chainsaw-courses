import { Router } from "express";
import { db } from "@workspace/db";
import { chatMessagesTable } from "@workspace/db";
import { SendAiMessageBody } from "@workspace/api-zod";
import { eq, asc } from "drizzle-orm";
import { resolveUser } from "./auth";
import { logger } from "../lib/logger";
import { getManualText, getQaResource, findQaForQuestion } from "../lib/ai-resource";
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

const TUTOR_SYSTEM_PROMPT = `You are a helpful Chainsaw Manual Tutor — a course assistant trained exclusively on the Chainsaw Maintenance & Cross-cutting training manual.

RULES:
1. Answer student questions using ONLY the knowledge contained in the reference manual below.
2. If the manual does not cover a topic, say so clearly: "That topic isn't covered in the training manual."
3. Be concise but thorough. Use bullet points for lists and numbered steps for procedures.
4. Stay on chainsaw safety, maintenance, legislation, and cross-cutting topics. Politely redirect off-topic questions.
5. When appropriate, cite which section or page of the manual the information comes from.
6. Do NOT make up facts or cite external sources beyond the manual.`;

function buildSystemPrompt(mode: "exam" | "tutor" = "exam"): string {
  const manual = getManualText();
  const qa = getQaResource();

  if (mode === "tutor") {
    const parts: string[] = [TUTOR_SYSTEM_PROMPT];
    if (manual) {
      const trimmed =
        manual.length > 30000 ? manual.slice(0, 30000) + "\n...[truncated]" : manual;
      parts.push(`---\n\nREFERENCE MANUAL (your ONLY knowledge source):\n${trimmed}`);
    }
    return parts.join("\n\n");
  }

  const parts: string[] = [CHAINSAW_SYSTEM_PROMPT];

  if (manual) {
    const trimmed =
      manual.length > 30000 ? manual.slice(0, 30000) + "\n...[truncated]" : manual;
    parts.push(`---\n\nREFERENCE MANUAL (internal knowledge — do NOT quote passages to the candidate):\n${trimmed}`);
  }

  if (qa && qa.length > 0) {
    const qaSummary = qa
      .map((e) => {
        const bullets = e.sampleAnswers.slice(0, 5).map((b) => `  - ${b}`).join("\n");
        return `[${e.category ?? "general"}] Q: ${e.question}\n  Threshold: ${e.threshold ?? "N/A"} required points\n  Model: ${e.modelAnswer}\n  Sample answers:\n${bullets}`;
      })
      .join("\n\n");
    const trimmedQa =
      qaSummary.length > 40000 ? qaSummary.slice(0, 40000) + "\n...[truncated]" : qaSummary;
    parts.push(`---\n\nQUESTION BANK (internal knowledge — do NOT reveal thresholds or show model answers to the candidate):\n${trimmedQa}`);
  }

  return parts.join("\n\n");
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

  const { message, deviceId, activationCode, mode } = parse.data;
  const chatMode: "exam" | "tutor" = mode === "tutor" ? "tutor" : "exam";

  const user = await resolveUser(activationCode, deviceId, req.headers["userid"] ? Number(req.headers["userid"]) : undefined);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  let reply: string;

  try {
    await db.insert(chatMessagesTable).values({
      userId: user.id,
      role: "user",
      content: message,
      mode: chatMode,
    });

    const history = await db
      .select()
      .from(chatMessagesTable)
      .where(eq(chatMessagesTable.userId, user.id))
      .orderBy(asc(chatMessagesTable.createdAt));

    // Only include messages from the same mode in the context window
    const modeHistory = history.filter((m) => m.mode === chatMode);

    const gemini = getGeminiClient();

    if (gemini) {
      const contents = modeHistory.slice(0, -1).map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
      contents.push({ role: "user", parts: [{ text: message }] });

      const response = await gemini.models.generateContent({
        model: "gemini-2.0-flash",
        contents,
        config: {
          systemInstruction: buildSystemPrompt(chatMode),
          maxOutputTokens: 8192,
        },
      });

      reply = response.text ?? "I was unable to generate a response. Please try again.";
    } else {
      reply = chatMode === "tutor"
        ? "The AI tutor requires a live AI connection. Please ensure the system is properly configured and try again."
        : "The AI examiner requires a live AI connection to conduct the oral exam. Please ensure the system is properly configured and try again.";
    }
  } catch (err: unknown) {
    // Detect Gemini rate-limit / quota errors and return a friendly message
    const errMsg = err instanceof Error ? err.message : String(err);
    const isRateLimit = errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("RESOURCE_EXHAUSTED");
    if (isRateLimit) {
      logger.warn({ errMsg }, "Gemini rate limit exceeded");
      reply = chatMode === "tutor"
        ? "The AI tutor is temporarily unavailable due to high demand. Please try again in a few minutes."
        : "The AI examiner is temporarily unavailable due to high demand. Please try again in a few minutes.";
    } else {
      logger.error({ err }, "Error in AI chat");
      reply = "Sorry, something went wrong. Please try again.";
    }
  }

  try {
    await db.insert(chatMessagesTable).values({
      userId: user.id,
      role: "assistant",
      content: reply,
      mode: chatMode,
    });
  } catch (dbErr) {
    logger.error({ dbErr }, "Failed to save AI reply");
  }

  res.json({ reply, isOnTopic: true });
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
  const qaEntry = findQaForQuestion(promptText);

  const manualSection = manual
    ? `\n\nREFERENCE MANUAL (internal knowledge — do NOT quote passages):\n${manual.length > 40000 ? manual.slice(0, 40000) + "\n...[truncated]" : manual}`
    : "";

  const qaSection = qaEntry
    ? `\n\nREFERENCE Q&A (internal knowledge — do NOT reveal threshold or show model answers to the candidate):\nQuestion: ${qaEntry.question}\nRequired points to pass: ${qaEntry.threshold ?? "N/A"}\nModel answer: ${qaEntry.modelAnswer}\nAcceptable answer examples:\n${qaEntry.sampleAnswers.slice(0, 6).map((b) => "  - " + b).join("\n")}`
    : "";

  const gradingPrompt = `You are an NPTC chainsaw safety examiner grading a student's spoken answer.

Question: "${promptText}"
Student's answer: "${transcript}"${manualSection}${qaSection}

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
  const mode = (req.query.mode as string) ?? "exam";

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
    const allMessages = await db
      .select()
      .from(chatMessagesTable)
      .where(eq(chatMessagesTable.userId, user.id))
      .orderBy(asc(chatMessagesTable.createdAt));

    const filtered = allMessages.filter((m) => m.mode === mode);

    res.json(
      filtered.map((m) => ({
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
