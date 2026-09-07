---
name: Native file delivery
description: The reliable cross-platform rule for user-initiated downloads in the hosted Capacitor app.
---

Downloads initiated with hidden browser anchors are not reliable inside the Android Capacitor WebView. Native builds must write generated file bytes to the app cache and pass the resulting URI to the operating-system share sheet; web browsers may use the File System Access API or a normal Downloads fallback.

**Why:** Android WebViews can expose browser-style file APIs while silently doing nothing when a blob download is triggered. The native filesystem/share route gives users a real Files, Drive, or app destination.

**How to apply:** Route every user-facing PDF, CSV, image, or generated-file download through the shared delivery layer. Keep “View” links separate from “Download” controls, and sync/build the native projects whenever Capacitor plugins change.