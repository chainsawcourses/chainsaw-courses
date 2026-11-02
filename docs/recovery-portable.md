# Non-Replit recovery: compatible Node/PostgreSQL hosting

Source branch: [recovery/portable-2026-11-02](https://github.com/chainsawcourses/chainsaw-courses/tree/recovery/portable-2026-11-02).
Use the commit/checksum receipt saved in the restricted Drive recovery folder
to pin the exact verified version rather than assuming the default branch is current.

This is a code-based deployment, not an automatic no-code-builder import.
Use Node 24, pnpm 10.26.1, PostgreSQL 16, a Google Cloud Storage bucket and
owner-controlled Google credentials. Never import private data into a public
builder project. Keep the web app and API on the same HTTPS origin.

## Independent source and data

The current recovery source is published on the separately identified GitHub
recovery branch, not by pushing the private workspace history or replacing main.
The verification receipt records its exact commit and source manifest. Routine
data backups remain in the owner's restricted Google Drive recovery folder.
The dated encrypted recovery folder is an additional independent snapshot, not
a promise that every later daily export contains all external media.

Download the entire matching Drive export and its category folders. Verify their
manifest first. Encrypted CCRF1 sets additionally need the included standalone
reader and the owner's passphrase stored outside Replit. Read `docs/recovery.md`.

## Build

Provide the owner's public Firebase project settings at frontend build time:
`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`
and `VITE_FIREBASE_APP_ID`. They can be recovered from the owner's Firebase
console; no values are put into the public source backup. The current frontend
initialises Firebase at startup and cannot render without this project config.
These client-visible settings are distinct from Replit runtime credentials and
from private server keys.

```sh
pnpm install --frozen-lockfile
pnpm --filter @workspace/chainsaw-training run build
pnpm --filter @workspace/api-server run build
```

Use a conventional Linux host with the native Node dependencies required by
the PDF/canvas packages. The existing native iOS/Android projects are unchanged.
They retain the same bundle IDs, signing identities and hosted production URL.

## Restore a new isolated database

1. Create a **new empty** PostgreSQL database, never the live one. Use the schema
   source in `lib/db` to create application tables and indexes.
2. Set `RECOVERY_DATABASE_URL` through the replacement host's secret manager to
   the new isolated target (not the running app's `DATABASE_URL`). Set the explicit
   confirmation `RECOVERY_IMPORT_CONFIRM=isolated-empty-database`.
3. Run `node scripts/import-portable-data.mjs "/private/Portable Export"`.
   It verifies matching manifest hashes, refuses any populated public table,
   restores the separate import schema, copies parents before dependants,
   preserves IDs including GENERATED ALWAYS identities, resets sequences and
   compares every restored cell. It never drops or truncates tables. If it fails,
   inspect a private log and start with another empty target rather than deleting
   historical records or extending course access.
4. For a local rehearsal name the isolated database `chainsaw_recovery`, connect
   over loopback, and apply `scripts/recovery-reader-guard.sql`. Its reader can
   SELECT and issue no-op UPDATE statements, but triggers reject every real row
   change; INSERT/DELETE are not granted. This is necessary because authentication
   GETs reconcile legacy rows even when none match. A SELECT-only login is safer
   for inspection but cannot exercise those authenticated GETs. These local-only
   guards are never a production application login. Compare permissions, indexes
   and constraints against the current schema before enabling a live restore.

## Storage and Google access without Replit

The existing Replit providers remain the defaults. Only on the new host configure:

| Setting | Value/purpose |
| --- | --- |
| `OBJECT_STORAGE_PROVIDER` | `gcs` |
| `PRIVATE_OBJECT_DIR` | `/your-private-bucket/private-prefix` |
| `GOOGLE_API_PROVIDER` | `direct` |
| `GOOGLE_APPLICATION_CREDENTIALS` | Protected host-side ADC credential file, never GitHub |
| `GOOGLE_STORAGE_CREDENTIALS_FILE` | Optional storage-only signer credential file, otherwise ambient/default ADC |
| `GOOGLE_DRIVE_CREDENTIALS_FILE` | Optional separate Drive/Sheets OAuth ADC file, otherwise default ADC |
| `DATABASE_URL` | New host's PostgreSQL connection, secret |
| `SESSION_SECRET` | Owner-held server secret |
| `PORT` | Host-supplied listening port |
| `WEB_DIST_DIR` | Absolute path to the built frontend `dist/public` directory |

Use Application Default Credentials with access to the new GCS bucket. Signed
uploads need a service account capable of signing (private key or IAM signBlob
permission). Configure bucket CORS for the new HTTPS origin and permit signed
PUT uploads. Do not make private objects public. Existing API authorisation still
guards assessment media; public retailer-logo routes retain their existing rules.

Restore bytes under the original relative keys for assessment media and retailer
logos, or explicitly remap references. Database object IDs are not the timestamped
Drive backup filenames: map logos by retailer ID and preserve historical versions.
The new storage runtime uses normal GCS reads, deletes, listings and V4 signed
PUT URLs, without the Replit sidecar.

Direct Google API mode supports only Drive and Sheets through fixed Google hosts.
Use owner-controlled ADC credentials with the required Drive/Sheets access;
the old Replit OAuth connection cannot be exported. For personal Drive folders,
an owner-authorised OAuth ADC credential is usually appropriate; a service
account cannot assume ownership of personal My Drive files and generally needs
a Shared Drive or explicitly shared resources. Confirm account access and quota
before enabling backups. For personal Drive plus GCS signing, use the two separate
credential-file settings: a storage service-account signer and the owner's
Drive/Sheets OAuth credentials. A single user OAuth file cannot sign GCS uploads.
Neither credential file belongs in source or a public folder. Never make the
backup folder public.

## Start safely, then enable integrations deliberately

```sh
node artifacts/api-server/dist/scripts/run-portable-server.mjs
```

The entry serves the built website and `/api` on one origin. It does not run
startup seeds/data fixes. Schedules are off unless `PORTABLE_ENABLE_SCHEDULER=true`.
Use the loopback database with its guarded reader and `RECOVERY_REHEARSAL=true`
for read-only checks; this mode rejects non-GET/HEAD requests and binds loopback.
It is not a learner-facing production deployment. Do not expose a rehearsal
containing restored personal data to the internet.

On the real replacement host reconnect SMTP, Shopify, Apple verification, push,
Firebase, Vimeo and any enabled AI provider through owner-controlled credentials.
Preserve the existing domain where possible. None of those accounts or signing
identities can be recreated from GitHub. Vimeo embed IDs are not video backups.

For daily backups schedule the following with the new host's scheduler, after
Drive/Sheets access and the restored schema have been checked:

```sh
NODE_ENV=production node artifacts/api-server/dist/scripts/run-scheduled-backup.mjs
```

Use the existing London-day backup policy and one scheduled job, not duplicate
in-process and external triggers. The job uses the same advisory-lock and verified
Drive-upload checks. Run it manually against a separate test folder/account first;
no live Google writes were needed for the isolated recovery rehearsal.

Only after reviewed validation should an owner authorise DNS/traffic changes,
live jobs or store releases. There is no automatic promise of working payments,
email, signing or external videos merely because source and data were copied.
