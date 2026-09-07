---
name: Mobile PDF references
description: How course-reference PDFs should remain usable in native Android and mobile WebView environments.
---

Critical course reference documents need an in-app readable representation as well as the downloadable PDF.

**Why:** Android WebViews and some mobile browsers do not consistently support PDF rendering or opening a new tab/window, even when the document endpoint and PDF file are valid.

**How to apply:** Keep a direct PDF download available for users who need the document file, but route core reference material through a responsive in-app reader rather than relying on `window.open` or `target="_blank"`.