---
name: Android PDF saving
description: The reliable delivery rule for generated PDFs in the native Android app.
---

Save generated PDFs directly into Android's public Downloads collection through a native MediaStore bridge. Do not make successful delivery depend on the Android share chooser.

**Why:** Some Android devices and WebViews reject or fail to open Capacitor's file share sheet even after the PDF is generated correctly. Direct MediaStore writing does not require the user to have a compatible share target.

**How to apply:** Use the direct Downloads saver first on Android 10 and newer, and keep Filesystem plus Share only as a compatibility fallback. Native changes require a new Android release; a hosted web refresh cannot add the bridge to an older installed binary.