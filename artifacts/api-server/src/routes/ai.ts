import { Router } from "express";
import { db } from "@workspace/db";
import { chatMessagesTable } from "@workspace/db";
import { SendAiMessageBody } from "@workspace/api-zod";
import { eq, asc } from "drizzle-orm";
import { resolveUser } from "./auth";
import { logger } from "../lib/logger";
import OpenAI from "openai";

const router = Router();

const CHAINSAW_SYSTEM_PROMPT = `You are the Chainsaw Manual AI Examiner — a strict, authoritative virtual examiner for the UK Chainsaw Manual professional certification course. Your role is to help students prepare for their assessment.

CRITICAL RULES:
1. You ONLY answer questions directly related to chainsaw operation, maintenance, safety, UK health and safety regulations, arboriculture, or forestry work.
2. If a question is not about these topics, respond: "I can only answer questions related to chainsaw safety, operation, and maintenance as covered in the Chainsaw Manual. Please ask a relevant question."
3. Be precise, safety-focused, and professional in all responses.
4. Reference UK regulations (PUWER, LOLER, HSE guidance) where relevant.
5. Always emphasise safety above all else.

Key topics you cover:
- Personal Protective Equipment (PPE) requirements for chainsaw operators
- Chainsaw maintenance, chain tensioning, bar and chain care
- Safe working techniques: limbing, felling, cross-cutting
- Kickback prevention and hazard identification
- UK legal requirements for chainsaw operators (NPTC/Lantra certificates)
- Risk assessments and method statements
- Tree felling direction, escape routes, exclusion zones
- First aid requirements when working with chainsaws
- Storage, transportation, and refuelling procedures
- Environmental considerations and working near utilities`;

router.post("/ai/chat", async (req, res) => {
  const parse = SendAiMessageBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { message, deviceId, activationCode } = parse.data;
  const user = await resolveUser(activationCode, deviceId);
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

    const recentHistory = history.slice(-10);

    let reply: string;
    let isOnTopic = true;

    const openaiBaseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
    const openaiApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

    if (openaiBaseUrl && openaiApiKey) {
      const openai = new OpenAI({
        baseURL: openaiBaseUrl,
        apiKey: openaiApiKey,
      });

      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: "system", content: CHAINSAW_SYSTEM_PROMPT },
        ...recentHistory.slice(0, -1).map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        { role: "user", content: message },
      ];

      const completion = await openai.chat.completions.create({
        model: "gpt-5-mini",
        messages,
        max_tokens: 500,
      });

      reply = completion.choices[0]?.message?.content ?? "I was unable to generate a response. Please try again.";
      isOnTopic = !reply.includes("I can only answer questions related to chainsaw");
    } else {
      const chainsaw_topics = [
        "chainsaw", "chain", "bar", "kickback", "ppe", "felling", "limbing", "cross-cut",
        "safety", "maintenance", "hazard", "tree", "forestry", "arboriculture", "nptc",
        "lantra", "loler", "puwer", "hse", "risk assessment", "exclusion zone", "escape route",
        "refuel", "tensioning", "sharpening", "sprocket", "brake", "throttle", "operator"
      ];
      const lowerMsg = message.toLowerCase();
      isOnTopic = chainsaw_topics.some((t) => lowerMsg.includes(t));

      if (!isOnTopic) {
        reply = "I can only answer questions related to chainsaw safety, operation, and maintenance as covered in the Chainsaw Manual. Please ask a relevant question.";
      } else {
        const responses: Record<string, string> = {
          ppe: "When operating a chainsaw, mandatory PPE includes: chainsaw-resistant trousers or chaps (Class 1 minimum, Class 2 for professional use), safety boots with chainsaw protection (EN ISO 17249), gloves with chainsaw protection, a helmet with face shield and hearing protection, and high-visibility clothing. This is required under UK PUWER regulations.",
          kickback: "Kickback occurs when the chain near the tip of the bar contacts an object or is pinched. Prevention: always use the upper quadrant of the bar for cutting, maintain a sharp chain, use low-kickback chains and bars, keep both hands on the saw, and never cut above shoulder height. The chain brake should activate automatically during kickback.",
          felling: "Safe felling sequence: 1) Risk assess the area, 2) Plan felling direction and escape route (135° behind felling direction), 3) Clear exclusion zone (2.5x tree height), 4) Make the hinge by cutting the sink/notch (70° angle, 1/3 of tree diameter), 5) Make the felling cut leaving the hinge wood intact, 6) Use felling wedges if needed. Never fell alone.",
          maintenance: "Daily chainsaw maintenance: check and tension chain, inspect bar for wear, clean air filter, check chain oil level, inspect sprocket and drive links, check all controls function correctly, inspect fuel system for leaks. Chain should be sharpened when cutting produces dust rather than chips.",
          default: "That's an important aspect of chainsaw safety. For UK operators, always refer to the official Chainsaw Manual and ensure you hold the appropriate NPTC/Lantra certification for the work you're undertaking. When in doubt, consult your supervisor or health and safety representative. Safe working practices must always be followed in accordance with HSE guidance.",
        };

        if (lowerMsg.includes("ppe") || lowerMsg.includes("protective equipment")) {
          reply = responses.ppe;
        } else if (lowerMsg.includes("kickback")) {
          reply = responses.kickback;
        } else if (lowerMsg.includes("fell") || lowerMsg.includes("felling")) {
          reply = responses.felling;
        } else if (lowerMsg.includes("maintena") || lowerMsg.includes("sharpen")) {
          reply = responses.maintenance;
        } else {
          reply = responses.default;
        }
      }
    }

    await db.insert(chatMessagesTable).values({
      userId: user.id,
      role: "assistant",
      content: reply,
    });

    res.json({ reply, isOnTopic });
  } catch (err) {
    logger.error({ err }, "Error in AI chat");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/ai/chat-history", async (req, res) => {
  const deviceId = req.headers["deviceid"] as string;
  const activationCode = req.headers["activationcode"] as string;

  if (!deviceId || !activationCode) {
    res.status(401).json({ error: "Missing auth headers" });
    return;
  }

  const user = await resolveUser(activationCode, deviceId);
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
