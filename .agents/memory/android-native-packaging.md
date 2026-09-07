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

## Release signing selection

The default local signing configuration is not the Play upload key. Build releases with the original historical signing material whose certificate SHA-1 is `4F:5C:4C:21:43:74:90:B4:BF:31:55:B9:88:EB:32:69:11:EC:58:05`.

**Why:** A locally valid bundle can be signed with a different certificate and will still build successfully, but Google Play rejects it.

**How to apply:** Compare every new bundle’s SHA-1 with the last accepted Play bundle before exporting it; do not treat a successful Gradle signing step as sufficient.

## Adaptive launcher icon

Use the approved original launcher artwork: density-specific `ic_launcher` images for older Android versions, and a white adaptive background with the smaller `ic_maskable` artwork inset by `8.5dp`. Keep the adaptive foreground transparent.

**Why:** The desired original launcher appearance is a small, centered helmet-and-chainsaw mark inside a white circle. Using the wide transparent mark directly as the adaptive foreground makes it appear oversized and changes the approved design.

**How to apply:** Preserve the original resource layout when rebuilding launcher assets. A launcher-icon visual change requires a new signed bundle with a higher version code; publishing the hosted web app alone cannot change the installed Android launcher icon.