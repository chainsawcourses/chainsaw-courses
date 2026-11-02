# Chainsaw Courses mobile app import instructions

## Runtime and package manager

- Node.js 22 or a compatible current LTS release
- pnpm 10.x; the repository rejects npm and Yarn installs
- JDK 21 and Android SDK API 36 for Android release builds
- macOS with current Xcode for iOS archives

This is a React 19/Vite 7 application packaged with Capacitor 8. It is not an Expo or React Native project.

## Import layout

Copy the archive root into the destination multi-artifact repository. Keep these workspace paths together:

- `artifacts/chainsaw-training`
- `lib/api-client-react`
- `lib/api-zod`
- `lib/api-spec`
- `lib/retailer-review-policy`
- `scripts`
- root pnpm and TypeScript configuration

If the destination already has newer shared packages, merge against the destination versions rather than overwriting them. Keep the shared API server and database authoritative.

## Install and run

```bash
pnpm install --frozen-lockfile
pnpm --filter @workspace/chainsaw-training run dev
```

The Replit development workflow is:

```bash
pnpm --filter @workspace/chainsaw-training run dev
```

The artifact listens on `PORT`, defaults to `/`, and expects the shared API under the same origin at `/api`.

## Checks

```bash
pnpm --filter @workspace/chainsaw-training run typecheck
pnpm --filter @workspace/chainsaw-training run test:access-policy
pnpm --filter @workspace/chainsaw-training run test:service-worker
pnpm --filter @workspace/chainsaw-training run test:session-bootstrap
pnpm --filter @workspace/chainsaw-training run test:store-policy
pnpm --filter @workspace/retailer-review-policy run test
pnpm --filter @workspace/api-spec run check-generated
pnpm run check:project-secrets
pnpm run check:mobile-packages
pnpm --filter @workspace/chainsaw-training run build
```

Browser tests require Playwright Chromium and WebKit plus their Linux system dependencies.

## API client regeneration

The OpenAPI source is `lib/api-spec/openapi.yaml`. Regenerate and verify clients with:

```bash
pnpm --filter @workspace/api-spec run generate
pnpm --filter @workspace/api-spec run check-generated
```

Generated outputs are consumed through `@workspace/api-client-react` and `@workspace/api-zod`.

## Android

Development sync:

```bash
pnpm --filter @workspace/chainsaw-training run build
pnpm --filter @workspace/chainsaw-training run android:sync
```

Before the first release:

1. Reconnect the existing Android upload keystore outside source control.
2. Recreate `.local/android-signing/signing-key-info.txt` using the existing release-build format.
3. Put the keystore beside that file; never commit either file.
4. Restore `google-services.json` only if native Firebase messaging is required.
5. Confirm package ID `com.chainsawcourses.app`, version name, version code, target API and release signing.
6. Run the physical-device checklist in `release/MOBILE-RELEASE-1.0.6.md`.

Release command:

```bash
pnpm --filter @workspace/chainsaw-training run android:bundle:release
```

Do not run it until signing has been reconnected and the imported app has passed validation.

## iOS

1. Open `artifacts/chainsaw-training/ios/App/App.xcodeproj` on a Mac.
2. Resolve Swift Package Manager dependencies.
3. Reconnect the Apple development team and automatic signing.
4. Confirm bundle ID `com.overleafpublishers.chainsawcourses`, version and build number.
5. Restore push-notification entitlements or service configuration if required.
6. Build and test on an iPhone and iPad before archiving.

Apple certificates, provisioning profiles and App Store Connect credentials are not included.

## Environment and integrations

Use the names-only configuration inventory in `docs/recovery.md`; secret files are deliberately excluded from the recovery source. On Replit, configure actual server secrets in Replit Secrets. For another compatible Node/PostgreSQL host follow `docs/recovery-portable.md`. Client-visible Firebase values may use `VITE_*`; administrator, email, billing, Shopify, VAPID, session and storage credentials must remain server-only.

Reconnect:

- Shared Chainsaw Courses API and production database
- Replit App Storage
- Shopify webhook/activation configuration
- SMTP or Gmail email delivery
- Firebase web configuration and optional native messaging files
- Google Drive access used by the shared API
- Gemini/Replit AI integration if AI assessment is enabled

The iOS app now includes native Apple StoreKit purchases and restore for six-month course access, with verification by the shared backend. Android activation and licence checks remain separate; no Google Play Billing SDK was added by the portability work. Preserve both platforms' existing purchase and access paths.

## API routing requirement

The installed app loads `CAPACITOR_SERVER_URL`, currently `https://app.chainsawcourses.com`, inside a full-screen WebView. API calls are same-origin `/api/...`. Keep the web app and API published together or provide an equivalent same-origin reverse proxy. Do not point production builds at localhost or a `.replit.dev` URL.

The replacement-code contract is:

```text
POST /api/learner/code-reset-requests
GET /api/admin/code-reset-requests
POST /api/admin/code-reset-requests/{requestId}/send-code
```

The two administrator routes require existing admin authentication.