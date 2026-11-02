# Chainsaw Courses mobile app migration report

> Historical inventory: billing and version statements below describe an earlier
> snapshot, not the current iOS release. Native Apple StoreKit purchases and
> restore have since been added. Use `IMPORT-INSTRUCTIONS.md` and
> `docs/recovery-portable.md` for current recovery instructions; inspect the
> checked-in native projects for current version/build settings.

Prepared: 20 September 2026

## Project overview

- **Framework:** React 19 SPA, Vite 7 and Capacitor 8.5; not Expo or React Native.
- **Main entry:** `index.html` → `src/main.tsx` → `src/App.tsx`.
- **Package manager:** pnpm 10 with `pnpm-lock.yaml` and a pnpm workspace.
- **Development:** `pnpm --filter @workspace/chainsaw-training run dev`.
- **Typecheck:** `pnpm --filter @workspace/chainsaw-training run typecheck`.
- **Web build:** `pnpm --filter @workspace/chainsaw-training run build`.
- **Android sync:** `pnpm --filter @workspace/chainsaw-training run android:sync`.
- **Android release:** `pnpm --filter @workspace/chainsaw-training run android:bundle:release`.
- **iOS release:** open the Xcode project, validate, archive and upload through Xcode.

The native releases are hosted-web Capacitor shells. They load `https://app.chainsawcourses.com` by default and retain a bundled, self-contained native error page for network failure.

## File inventory

- `src/`: screens, components, hooks, routing, learner session handling and API usage.
- `public/`: bundled images, audio, PDF references, offline/native error pages, manifest and service worker.
- `android/`: Android Studio/Gradle Capacitor source, custom file-saving support and release configuration.
- `ios/`: Xcode/Swift Capacitor source, secure-session and PDF-saving plugins.
- `tests/`: unit and browser regression tests.
- `scripts/`: app-specific consistency and browser-runner scripts.
- `capacitor.config.ts`: app identity, hosted production URL and native shell settings.
- `vite.config.ts`: Vite build and Replit path configuration.
- `lib/api-spec`: shared OpenAPI contract and generator configuration.
- `lib/api-client-react`: generated React Query API client.
- `lib/api-zod`: generated request/response validation schemas.
- `lib/retailer-review-policy`: shared retailer review policy used by the app.

Generated `dist`, native build outputs, caches and dependency directories are not required in the archive.

## Environment requirements

### Client-visible

| Name | Purpose | Usage |
|---|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase web application identifier | Development and production; client-visible by Firebase design |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase web auth domain | Development and production; client-visible |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project/storage identifier | Development and production; client-visible |
| `VITE_FIREBASE_APP_ID` | Firebase web app ID | Development and production; client-visible |
| `VITE_DEMO_MODE` | Enables demo behaviour | Development/demo only |
| `VITE_BROWSER_LIFECYCLE_TEST` | Browser-test behaviour | Test only |
| `BASE_PATH` | Replit/Vite artifact path | Development and production build |
| `PORT` | Replit development server port | Development |

### Native build configuration

| Name | Purpose | Usage |
|---|---|---|
| `CAPACITOR_SERVER_URL` | Hosted app loaded by the native shells | Production build; not secret |
| `CAPACITOR_APP_ID` | Capacitor application ID override | Build time; not secret |

### Shared API server-only

The mobile client does not read these values. They are required by shared API features and must be configured through Replit Secrets or their associated integration:

- `ADMIN_PASSWORD`
- `SESSION_SECRET`
- `SHOPIFY_ACTIVATION_SECRET`
- `SHOPIFY_WEBHOOK_SECRET`
- `WEBSITE_BILLING_EVENTS_SECRET`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- `SUPPORT_EMAIL`
- `VAPID_EMAIL`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`
- `GEMINI_API_KEY`
- `PRIVATE_OBJECT_DIR`
- `APP_URL`, `PUBLIC_URL`
- Replit-provided runtime names such as `REPLIT_DEV_DOMAIN`, `REPLIT_DOMAINS` and `REPL_ID`

The Firebase values are client-visible configuration. Administrator, session, email, Shopify, billing, VAPID private-key, AI and storage values are server-only. No secret values are recorded in this package.

## External services

- Shared Chainsaw Courses Express API and PostgreSQL database
- Replit App Storage for protected assessment media
- Shopify paid-order webhook and activation-code issuance
- SMTP/Gmail-compatible delivery for activation, reset and certificate emails
- Firebase Remote Config and Storage; optional native messaging configuration
- Google Drive exports performed by the shared API
- Vimeo hosted course videos
- Web Push/VAPID
- Gemini/Replit AI integration for supported assessment functions
- RSS/news sources and postcode/geocoding gateway services
- Apple App Store Connect and Google Play Console for distribution

No mobile Stripe, RevenueCat or in-app-purchase SDK is present. Subscription state enters through the shared website billing endpoint and is enforced by the shared API.

## API connectivity

There is no separate mobile API host selector. Browser and native-hosted-web code use same-origin `/api/...`. The native shell loads `CAPACITOR_SERVER_URL`, so the website and shared API must be available under the same production origin or behind an equivalent reverse proxy.

The app consumes generated API functions from the shared OpenAPI contract and also has focused direct `fetch` calls. Development hostname checks recognise localhost, loopback, `.replit.dev` and legacy `.repl.co` as development; no production API call is hardcoded to those hosts.

### Authentication

Learner requests use activation-code and device identity headers managed by the shared client/session layer. Native session identity is mirrored into encrypted platform storage by custom Capacitor plugins while browser compatibility uses local storage and cookies. Device bonding and entitlement decisions remain server-authoritative.

Administrator routes use the existing administrator authentication header/session mechanism. Administrator credentials must never be embedded in the native binary.

### Replacement-code compatibility

The current shared OpenAPI client generates:

```http
POST /api/learner/code-reset-requests
```

The current administrator dashboard calls:

```http
GET /api/admin/code-reset-requests
POST /api/admin/code-reset-requests/{requestId}/send-code
```

These are the exact requested routes. The learner request body contains an email address. The completion body contains the selected standard activation code. The two administrator routes require existing admin authentication. No route mismatch was found.

### Other principal learner APIs

The app uses shared `/api` routes for activation and identity, modules, progress and video engagement, quizzes, final exam, certificates, enrolment history, assessments, risk assessments, inspections, feedback, manual/assessment media, push subscriptions, retailer directory and account deletion. The OpenAPI document is the contract source; generated clients must be regenerated after contract changes.

### Billing and CSRF

Subscription events are sent to the API by the website/backend, not by the mobile client. `POST /api/billing/subscription-events` uses a server-only billing secret and must never be called with that secret from browser or native client code. Existing same-origin learner requests do not introduce a separate CSRF token. Preserve the current API authentication and origin controls when migrating.

## Data ownership

| Data | Authoritative owner |
|---|---|
| Activation codes | Shared API and production database |
| Replacement-code requests | Shared API and production database |
| Course entitlements/subscription state | Shared API and production database |
| Learner progress and completion | Shared API and production database |
| Certificates | Shared API/database; generated documents may use Drive/storage integrations |
| Device bonding | Shared API/database, with client identity mirrored securely on device |
| Administrator accounts/authentication | Shared API configuration and database |
| Temporary UI/cache state | Browser or native device |

No mobile-only database was found. Local persistence is limited to session mirroring, caches and durable retry state; it is not an independent source of business truth.

## Navigation, storage, permissions and links

- Wouter provides routes for learner activation, course modules, quizzes, exam, history, certificate/manual tools, retailer pages, privacy/legal content and administration.
- Android declares internet access. No camera, microphone or location runtime permission is declared.
- Browser push uses service-worker PushManager. Native Firebase messaging requires the external native service files and capability configuration.
- iOS supports file sharing/open-in-place and custom PDF/session plugins.
- Android uses a custom public Downloads path with share fallback.
- Deep-link and URL/user-activity events are forwarded through Capacitor on iOS.

## Store and signing requirements

Not included:

- Android upload keystore and its passwords/alias file
- Google Play service-account credentials
- `google-services.json`
- Apple signing certificates and provisioning profiles
- App Store Connect API credentials
- Firebase/Apple push credentials

Reconnect Android signing through the existing `.local/android-signing` mechanism. Reconnect Apple signing in Xcode using the owner’s Apple team. Store-console credentials remain in the store consoles or Replit Secrets, never in the source archive.

Current documented identities are:

- Android: `com.chainsawcourses.app`, version 1.0.6, code 10
- iOS: `com.overleafpublishers.chainsawcourses`, version 1.0.6, build 7

Confirm these against the store records before a future release.

## Generated files

- `lib/api-client-react/src/generated` and `lib/api-zod/src/generated` are generated from `lib/api-spec/openapi.yaml`.
- `dist/public` is generated by Vite.
- Android Gradle build directories and release bundles are generated.
- Capacitor sync updates native web/plugin files.
- iOS dependencies are restored through Xcode/Swift Package Manager.

## Validation performed

All commands below completed successfully on 20 September 2026:

```text
pnpm install --frozen-lockfile
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

Results: frozen install passed; typecheck passed; 23 focused app tests and one shared-policy test passed; generated API files were current; the tracked-file secret scan passed; mobile package boundaries passed; production Vite build passed.

The Vite build emitted non-fatal source-map warnings for three UI modules and a large-chunk warning. These do not stop the build but are candidates for later optimisation. No email, payment, activation, production learner mutation or mobile release was performed.

## Known issues and migration risks

1. Android release signing depends on ignored external files under `.local/android-signing`; unsigned source builds are possible, but a store release is not.
2. Native push configuration is optional in the Gradle build and will not activate without the external service file.
3. The app is hosted-web: if `CAPACITOR_SERVER_URL` or the production deployment is unavailable, only the bundled native error page is available.
4. The JavaScript production bundle is large and Vite reports chunk-size warnings.
5. Physical Android, iPhone and iPad validation is still required after import.
6. The destination must preserve the shared `/api` routing contract. Splitting the app and API onto unrelated origins without a proxy will break same-origin calls and session assumptions.
7. The iOS and Android package identifiers intentionally differ; do not “normalise” them during import.

## Export security

The archive is built from an allowlisted source staging tree. It excludes dependency directories, Vite/native build outputs, caches, test results, release binaries, prior exports, attachments, environment files with values, keystores, certificates, provisioning profiles, service-account files and native service configuration files.

The original project remains in place and has not been deleted, disabled or substantially restructured.