---
name: iOS Xcode handoffs
description: How to package native Apple release fixes for reliable transfer to a non-technical Mac user.
---

Provide a complete, standalone Xcode project ZIP rather than asking the user to merge or repeatedly replace individual Swift files.

**Why:** Manual replacement while Xcode was open repeatedly concatenated copies of a Swift plugin, leaving duplicate classes and imports even after apparently successful copy commands.

**How to apply:** Package the full native project with one uniquely named, clean plugin source referenced by the Xcode target. The user should unzip, open the project, select their Apple team, and archive without source-file merging.