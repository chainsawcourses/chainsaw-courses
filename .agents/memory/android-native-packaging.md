---
name: Android native packaging
description: Constraints for replacing the retired browser wrapper with an Android app that Google Play accepts.
---

Use a standard Capacitor Android bundle for `com.chainsawcourses.app`, never the retired `com.chainsawcourses.uk` browser wrapper. Google Play now requires the official bundle to target Android API 36 or newer, and each upload must use a higher version code.

**Why:** The old `.uk` release was a Trusted Web Activity, so it surfaced browser controls even when launched from its icon. It also cannot be updated in place by the official `.app` package.

**How to apply:** Build releases with the configured native Android project and the original Google Play upload signing material, then upload only to the `.app` Play listing. Verify the generated bundle itself before sharing it: its manifest must name the `.app` package and the intended version code/API target. Do not substitute a newly generated keystore: Play accepts only the certificate registered for the listing unless its upload key is formally reset. The Android WebView deliberately loads the hosted app to keep same-origin API routes working. Browser/PWA storage and native WebView storage are separate, so a learner who previously activated in a browser may need their device bond reset before using the native app.

Before exporting any release, compare the bundle certificate SHA-1 with the upload certificate listed in Google Play Console.

**Why:** A workspace can contain several valid signing keys, and Gradle can successfully produce a bundle signed by the wrong one. Google Play rejects that upload even though the native build itself succeeds.

**How to apply:** Use `keytool -printcert -jarfile <bundle.aab>` to read the bundle certificate and compare it with Play Console’s expected SHA-1 before offering the file for upload.

## Adaptive launcher icon

Use a transparent foreground asset containing only the Chainsaw Courses mark for Android adaptive icons. Do not use the white square PWA icon as the native foreground layer.

**Why:** Android supplies the background and circular mask itself. An opaque PWA icon already contains both white background and safe-area padding, so using it as the foreground applies the padding twice and makes the mark appear undersized.

**How to apply:** Keep `ic_launcher_background` as the solid background and generate the density-specific `ic_launcher_foreground.png` assets from the cropped transparent brand mark. A launcher-icon visual change requires a new signed bundle with a higher version code; publishing the hosted web app alone cannot change the installed Android launcher icon.