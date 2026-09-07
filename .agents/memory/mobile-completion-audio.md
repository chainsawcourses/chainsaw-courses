---
name: Mobile completion audio
description: How successful-save feedback remains audible in native iOS and Android WebViews.
---

Completion sounds triggered after an asynchronous save must first be primed within the user's save gesture, then played only after the request succeeds.

**Why:** Mobile WebViews can reject newly started audio after the user-activation window ends, even though the learner initiated the save.

**How to apply:** Use the shared completion-sound helper to prime its existing audio element synchronously at the beginning of a user-triggered save. Keep the audible playback in the successful mutation callback, and keep playback failures non-fatal.