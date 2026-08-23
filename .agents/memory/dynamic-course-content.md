---
name: Dynamic course content
description: Cache policy for learner-facing questions edited from the admin portal.
---

Admin-editable questions must be treated as live server content, not release-bound app assets. Learner assessment pages should request a fresh bank when entered, and native WebViews must bypass their HTTP response cache for API GETs.

**Why:** Installed mobile apps may resume an existing WebView rather than reload it. A short client cache or WebView cache can otherwise show an old question even though the admin portal saved the change successfully.

**How to apply:** Preserve the question set during a learner's active attempt, but refetch the current bank before a new attempt or when returning to an untouched assessment start screen. Do not make an admin edit require a native rebuild or app-store release.