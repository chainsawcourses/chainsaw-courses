# Chainsaw Courses — Apple release 1.0.4 (Build 6)

This package contains the prepared iOS/Xcode update for the existing App Store app:

- App Store bundle identifier: `com.overleafpublishers.chainsawcourses`
- Marketing version: `1.0.4`
- Build number: `6`
- Production app URL: `https://app.chainsawcourses.com`
- Minimum iOS version: iOS 15

## What is included

- Direct PDF saving into the iOS Files app under `Chainsaw Courses`
- The existing Apple share sheet retained as a fallback
- Files-app document access enabled
- Current Capacitor configuration and web PDF-delivery code
- The approved 1024 × 1024 Chainsaw Courses App Store icon
- All current website changes are loaded from the production app URL

## Finish the App Store archive on a Mac

Apple requires Xcode on macOS and the existing Apple signing team. This Linux workspace cannot produce or sign the final `.ipa`.

1. Keep a backup of the existing Mac project.
2. Copy the supplied `ios` folder into the matching `artifacts/chainsaw-training/ios` location.
3. Copy `capacitor.config.ts` into `artifacts/chainsaw-training/`.
4. Copy the supplied `src` files into their matching locations.
5. From the repository root, run:

   ```bash
   pnpm install
   PORT=19478 BASE_PATH=/ pnpm --filter @workspace/chainsaw-training run build
   CAPACITOR_APP_ID=com.overleafpublishers.chainsawcourses \
     pnpm --filter @workspace/chainsaw-training exec cap sync ios
   pnpm --filter @workspace/chainsaw-training exec cap open ios
   ```

6. In Xcode, select the existing Overleaf Publishers development team.
7. Confirm the target shows:
   - Bundle identifier: `com.overleafpublishers.chainsawcourses`
   - Version: `1.0.4`
   - Build: `6`
8. Test a certificate, inspection, and risk-assessment PDF on an iPhone or iPad. Each should appear in the Files app under `On My iPhone/iPad → Chainsaw Courses`.
9. Select **Any iOS Device (arm64)**, then use **Product → Archive**.
10. In Organizer, choose **Distribute App → App Store Connect → Upload**.

Existing users update normally through TestFlight or the App Store. They do not need to uninstall the app or create a new account.