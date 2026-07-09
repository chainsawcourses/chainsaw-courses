---
name: Gemini rate limits
description: Free-tier Gemini API quota is strict — expect 429s under load.
---

# Gemini rate limits

The project uses `GEMINI_API_KEY` (via Replit AI Integrations / `ai-integrations-gemini` skill) for AI grading in the oral exam.

**Why:** Free-tier quotas on `gemini-2.0-flash` include per-minute request limits, per-minute token limits, and per-day limits. When exceeded, the API returns HTTP 429 with `RESOURCE_EXHAUSTED` and a retry delay.

**How to apply:**
- The AI grading endpoint already falls back to local keyword matching when the Gemini call fails
- The mock assessment works offline even when Gemini quota is exhausted
- If AI grading feels inconsistent, check the API server logs for 429 errors before debugging the logic
