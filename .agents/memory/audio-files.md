---
name: Firebase audio files
description: 75 WAV voice recordings for oral exam questions in Firebase Storage.
---

# Firebase audio files

There are 75 `.wav` voice recordings in Firebase Storage bucket `chainsaw-courses.firebasestorage.app`. They are publicly accessible via `https://firebasestorage.googleapis.com/v0/b/chainsaw-courses.firebasestorage.app/o/<filename>?alt=media` without any download token.

Filenames follow the pattern `{questionNumber}{description}.wav`, e.g. `1riskassessment.wav`, `2site hazards.wav`, etc.

They map 1:1 to question IDs in `vocalExamQuestions.ts` (1-75). Question 76 (kickback) and 77 (PPE) do not have audio files yet.

**Why:** Extracted into `src/data/audioFiles.ts` with `getAudioUrl(questionId)` helper so both MockTest.tsx and TrainingModule.tsx can share the mapping.

**How to apply:**
- Import `getAudioUrl` and `AUDIO_FILES` from `../data/audioFiles`
- Use `new Audio(getAudioUrl(qid))` to play directly in the browser
