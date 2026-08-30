---
name: UK English copy
description: Locale and source-preservation rules for Chainsaw Courses interface wording.
---

Use UK English for all Chainsaw Courses-authored interface copy, including spelling, punctuation, labels, notices, and learner guidance.

**Why:** The product is a UK training service, and the user explicitly requested a consistent site-wide UK English standard.

**How to apply:** Correct clear US variants in authored UI and admin text, but do not rewrite third-party documents, legislation, standards, PDF source material, assessment keyword aliases, or spoken-exam wording unless the correction is unambiguous and preserves behaviour and technical meaning.

For automated TSX copy checks, inspect parsed string, template, and JSX text nodes rather than scanning raw source.

**Why:** Raw lexical scans confuse apostrophes in JSX with string delimiters and can spill into CSS properties or technical identifiers, producing noisy false positives.

**How to apply:** Use the TypeScript syntax tree to distinguish visible copy from classes, style properties, identifiers, imported source content, and assessment keyword aliases.