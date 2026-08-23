---
name: Android AAB build environment
description: Requirements for producing a signed Capacitor Android bundle in this Replit workspace.
---

Build Android App Bundles with a standard Java 21 JDK and Android SDK API 36; the default GraalVM Java 19 environment is not compatible with this project’s Android Gradle build.

**Why:** The app compiles for Java 21, while Gradle’s Android JDK image transform fails under the default GraalVM 19 runtime. The workspace does not expose an Android SDK by default.

**How to apply:** Use a standard JDK 21 (such as Temurin) with `ANDROID_HOME` pointing to an SDK containing `platforms;android-36` and matching build tools. Keep the SDK temporary/outside the project and build the signed release through Gradle using the existing signing-info file.