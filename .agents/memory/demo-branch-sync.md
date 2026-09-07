---
name: Demo branch synchronization
description: Constraints for safely bringing the full app's GitHub main branch into the restricted demo branch.
---

Treat GitHub `main` as the full-app source and `demo` as a maintained derivative. Merge new main history into demo, then preserve only the intentional demo overrides: preview authentication, selected unlocked modules, unrestricted preview seeking, fixed faded preview watermark, non-contactable Gateway, and waiver preview messaging.

**Why:** The repository contains large Git LFS build artifacts whose credentials may not be available to the demo workspace. Normal merges can fail during smudging even though all application source is available. The demo also intentionally conflicts with main in a small set of authentication, module, player, navigation, and waiver files.

**How to apply:** Fetch with LFS smudging disabled, merge main, use the newer main implementation as the conflict base, and reapply demo behavior explicitly. Run API/generated-contract checks, frontend typechecking, and the demo build. Apply merged Drizzle schema changes to development; production schema follows through Publish.