---
name: Android AAB build environment
description: Requirements for producing a signed Capacitor Android bundle in this Replit workspace.
---

Build Android App Bundles with a standard Java 21 JDK and Android SDK API 36; the default GraalVM Java 19 environment is not compatible with this project’s Android Gradle build.

**Why:** The app compiles for Java 21, while Gradle’s Android JDK image transform fails under the default GraalVM 19 runtime. The workspace does not expose an Android SDK by default.

**How to apply:** Use a standard JDK 21 (such as Temurin) with `ANDROID_HOME` pointing to an SDK containing `platforms;android-36` and matching build tools. Keep the SDK temporary/outside the project and build the signed release through Gradle using the existing signing-info file.

**Release automation constraint:** The training app's Vite build also requires `PORT` and `BASE_PATH` outside a workflow. Android Gradle Plugin 8.13 records release package/version data in the generated bundle manifest rather than final-output metadata.

**Why:** A static web build otherwise aborts before Capacitor sync, and a verifier that expects final-output metadata incorrectly fails after Gradle has successfully signed the bundle.

**How to apply:** Give release-only Vite defaults when absent, then verify the generated bundle manifest, AAB archive integrity, and exported SHA-256 checksum after `bundleRelease`.