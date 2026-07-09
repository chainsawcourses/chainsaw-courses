---
name: SpeechRecognition TypeScript types
description: Web Speech API types missing from TypeScript — need custom .d.ts declarations.
---

# SpeechRecognition TypeScript types

The Web Speech API (`SpeechRecognition`, `SpeechRecognitionEvent`, `SpeechRecognitionErrorEvent`, `SpeechRecognitionResultList`, etc.) is not included in TypeScript's standard lib.

**Why:** TypeScript only ships DOM types that are widely standardized. Web Speech API is still vendor-prefixed and not in the standard lib.

**How to apply:**
Create `src/types/speech-recognition.d.ts` with all necessary interfaces:
- `SpeechRecognitionEvent` with `resultIndex`, `results`
- `SpeechRecognitionErrorEvent` with `error`, `message`
- `SpeechRecognitionResultList`, `SpeechRecognitionResult`, `SpeechRecognitionAlternative`
- `SpeechRecognition` interface with all event handlers and methods
- `SpeechRecognitionStatic` constructor type
- `Window` augmentation for `SpeechRecognition` and `webkitSpeechRecognition`

In component code:
- Use `window.SpeechRecognition` / `window.webkitSpeechRecognition` with a null check
- Use `SpeechRecognition | null` type for `useRef` instead of `InstanceType<typeof window.SpeechRecognition>`
