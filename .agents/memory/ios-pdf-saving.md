---
name: iOS PDF saving
description: The native Apple delivery rule for generated PDFs and its release requirement.
---

Save generated PDFs directly into the app's Documents/Chainsaw Courses folder and expose that folder through the iOS Files app. Keep the Apple share sheet as fallback only.

**Why:** The iOS share sheet can fail after the PDF is generated, producing the same user-visible failure as Android. Direct document-folder writing avoids dependence on an available share target.

**How to apply:** Register the native PDF saver in the Capacitor bridge, keep Files sharing and opening-in-place enabled, and test the App Store build on a physical iPhone/iPad before rollout. Native changes require a new Apple build.