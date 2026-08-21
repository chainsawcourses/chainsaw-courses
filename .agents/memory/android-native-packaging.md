---
name: Android native packaging
description: Constraints for replacing the retired browser wrapper with an Android app that Google Play accepts.
---

Use a standard Capacitor Android bundle for `com.chainsawcourses.app`, never the retired `com.chainsawcourses.uk` browser wrapper. Google Play now requires the official bundle to target Android API 36 or newer, and each upload must use a higher version code.

**Why:** The old `.uk` release was a Trusted Web Activity, so it surfaced browser controls even when launched from its icon. It also cannot be updated in place by the official `.app` package.

**How to apply:** Build releases with the configured native Android project and the established upload signing material, then upload only to the `.app` Play listing. The Android WebView deliberately loads the hosted app to keep same-origin API routes working. Browser/PWA storage and native WebView storage are separate, so a learner who previously activated in a browser may need their device bond reset before using the native app.