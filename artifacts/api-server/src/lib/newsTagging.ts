/**
 * newsTagging.ts
 * Uses Gemini to tag a news/CPD article with the most relevant Learning Outcome
 * and Assessment Criteria from the IIRSM course framework.
 */
import { GoogleGenAI } from "@google/genai";
import { db, newsItemsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const LO_AC_FRAMEWORK = `
Learning Outcomes and Assessment Criteria for Chainsaw Maintenance & Cross Cutting (City & Guilds 0039-20):

LO1 — Know the health and safety requirements for chainsaw operations
  AC 1.1 State the legislation and regulations relevant to chainsaw use
  AC 1.2 State the responsibilities of the operator under HASAWA and PUWER
  AC 1.3 Identify the hazards and risks associated with chainsaw operations
  AC 1.4 State the PPE requirements and relevant standards for chainsaw use

LO2 — Know how to plan and prepare for chainsaw operations
  AC 2.1 Describe the site risk assessment process
  AC 2.2 Explain emergency action planning (EAP) for chainsaw operations
  AC 2.3 State routine bio-security controls relevant to chainsaw operations
  AC 2.4 State the environmental considerations specific to chainsaw operations
  AC 2.5 State the appropriate safe working distances from other operators

LO3 — Know the chainsaw and its safety features
  AC 3.1 Identify and explain the key safety features of a chainsaw
  AC 3.2 State the hazards associated with battery-powered chainsaw equipment
  AC 3.3 State the benefits and maintenance requirements of battery-powered chainsaws

LO4 — Know how to maintain and prepare a chainsaw for use
  AC 4.1 Explain the function and maintenance of individual chainsaw components
  AC 4.2 Explain the function and maintenance requirements of the guide bar
  AC 4.3 Identify and explain chain types, filing, and replacement information
  AC 4.4 Describe correct disposal of chainsaw waste

LO5 — Know how to use a chainsaw safely to cross-cut timber
  AC 5.1 Describe tension and compression in timber and the recognised cross-cutting methods
  AC 5.2 Describe the pre-start and pre-use checks required before chainsaw operation
  AC 5.3 Explain how to apply ergonomic working methods during chainsaw operations
  AC 5.4 Describe how to safely move timber and precautions to avoid uncontrolled movement
  AC 5.5 Describe the procedure for removing a trapped saw

LO6 — Know how to maintain ongoing competence in chainsaw operations
  AC 6.1 State providers of industry good practice in chainsaw operations
  AC 6.2 State the considerations for stacking of timber
  AC 6.3 Describe how to maintain and demonstrate ongoing competence
`;

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

/**
 * Tag a news article with the most relevant LO and AC.
 * Returns null values if Gemini is unavailable or no match is found.
 */
export async function tagNewsArticle(
  id: number,
  title: string,
  excerpt: string,
): Promise<void> {
  const client = getGeminiClient();
  if (!client) {
    logger.warn("Gemini not configured — skipping news tagging");
    return;
  }

  const prompt = `You are an expert in chainsaw safety training. Given a news or CPD article, identify the single most relevant Learning Outcome (LO) and Assessment Criterion (AC) from the framework below.

${LO_AC_FRAMEWORK}

Article title: ${title}
Article excerpt: ${excerpt}

Respond with ONLY a JSON object in this exact format, no other text:
{"lo": "LO1", "ac": "AC 1.3"}

If the article does not clearly relate to any LO or AC, respond with:
{"lo": null, "ac": null}`;

  try {
    const response = await client.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const raw = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
    // Strip markdown code fences if present
    const clean = raw.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/, "").trim();
    const parsed = JSON.parse(clean) as { lo: string | null; ac: string | null };

    if (parsed.lo || parsed.ac) {
      await db
        .update(newsItemsTable)
        .set({ learningOutcome: parsed.lo ?? null, assessmentCriteria: parsed.ac ?? null })
        .where(eq(newsItemsTable.id, id));
      logger.info({ id, lo: parsed.lo, ac: parsed.ac }, "News article tagged with LO/AC");
    } else {
      logger.info({ id }, "News article: no LO/AC match found");
    }
  } catch (err) {
    logger.warn({ err, id }, "News LO/AC tagging failed — article will remain untagged");
  }
}
