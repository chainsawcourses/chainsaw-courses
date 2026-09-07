---
name: Dynamic course content
description: Cache policy for learner-facing questions edited from the admin portal.
---

Admin-editable questions must be treated as live server content, not release-bound app assets. Learner assessment pages should request a fresh bank when entered, and native WebViews must bypass their HTTP response cache for API GETs. API reads also carry a changing `_fresh` query parameter so legacy service-worker caches cannot match an earlier response URL.

**Why:** Installed mobile apps may resume an existing WebView rather than reload it. A short client cache or WebView cache can otherwise show an old question even though the admin portal saved the change successfully.

**How to apply:** Preserve the question set during a learner's active attempt, but refetch the current bank before a new attempt or when returning to an untouched assessment start screen. Retain both `no-store` HTTP caching and the `_fresh` cache-busting URL parameter for learner API GETs. Do not make an admin edit require a native rebuild or app-store release.

The final Assessment Bank and per-module quiz banks are distinct learning content sets and need clearly labelled controls in the admin portal.

**Why:** Editing a final-exam question cannot change a module quiz question, even when the wording is similar. Ambiguous controls made a successful save look like a failed learner-app update.

**How to apply:** Keep the final Assessment Bank for the summative exam and manage module-specific questions through the Module Quiz Bank. Tell admins which assessment learners need to reopen to see an edit.