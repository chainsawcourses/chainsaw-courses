# Chainsaw Courses recovery

## Scope and security

The recovery set is a restricted Google Drive folder, independent of the running
Replit app. A separately published GitHub copy, when verified in the recovery
manifest, uses a dated recovery branch in the existing public repository. It is a clean source snapshot: it
does not publish the workspace's uploaded screenshots, learner exports, signing
credentials or unpushed commit history. The default GitHub branch is not replaced.

Keep the Drive folder restricted to authorised staff. Learner data, documents and
the filename mapping in the new recovery set are encrypted before upload. Never
place decrypted data, download credentials or secret values in GitHub or on a
public application route. Existing readable backups are separate and unchanged.

## Opening the encrypted recovery set

The source archive, guide, public checksum manifest and two small recovery
programs contain no learner records and can be opened normally. The files ending
in `.ccrf`, including `PRIVATE-MANIFEST.ccrf`, are encrypted with the existing
migration backup passphrase. The owner must retain that passphrase securely
outside Replit; a passphrase stored only in Replit is not outage recovery.

Download the entire recovery folder from Drive and keep its filenames together.
On a computer with Node.js, run:

```sh
node restore-recovery-set.mjs "/path/to/downloaded-folder" "/path/to/private-restored-data"
```

The program asks for the passphrase without displaying it. It authenticates and
decrypts the private manifest, checks each encrypted file's SHA-256, decrypts it,
checks the original checksum, and recreates the original folders. It refuses to
use an existing output directory: choose a new folder whose parent already
exists. Keep this decrypted output private; it is a restore
working directory, not an ordinary backup to share.

The documented `CCRF1` format is AES-256-GCM with a 16-byte salt, 12-byte nonce,
32-byte scrypt-derived key (N=16384, r=8, p=1), authenticated `CCRF1` header and
16-byte authentication tag. The included Node programs use built-in modules,
so decryption does not depend on Replit or its integrations. This format is
distinct from older `.backup.enc` / CBK1 files and encrypted transfer ZIPs.

## Source build and integrity findings — 2 November 2026

The saved source was extracted into a disposable Linux directory. A frozen,
offline pnpm install completed from the dependency cache, and both the frontend
and API production builds succeeded with Node 24.22.1 and pnpm 10.26.1. The build
process received no database, email, payment or other live service credentials.
No restored server was started and no production data was changed. This proves
the saved application source builds here; a different host must also provide
compatible Node/native dependencies and the owner-held configuration below.

The database restore matched every exported cell across 43 tables / 1,839 rows.
All 538 non-null enrolment references resolved, none pointed to a different
learner, and current-enrolment pointers matched their learner. Two pre-existing
enrolment rows referenced users absent from the export. They were retained
unchanged, not silently deleted or assigned to another learner. Investigate those
historical records separately before any production data repair.

The morning recovery snapshot was verified in Drive; its original GitHub write
failed. The later portability work publishes a separate clean source recovery
branch and checks its remote manifest. Consult the portability receipt for the
exact verified commit; the GitHub default branch remains unchanged.

## What must be recovered

| Component | Recovery source | Important boundary |
|---|---|---|
| Web, API, native project source, runtime assets and lockfile | Dated source archive in Drive; GitHub copy only when verified in the manifest | Old release binaries, development uploads and source-document originals are not application source |
| Learners, enrolments, progress, content configuration and billing records | Portable Export: `data.json`, `restore-postgresql.sql`, `manifest.json`, `README.txt` | Verify all manifest hashes; import into an isolated database first |
| Certificates, waivers, inspections and risk assessments | Document folders in the Drive recovery set | Generated copies are not necessarily the exact original issued PDF; original retained folders are labelled separately |
| Uploaded assessment images/audio and retailer logos | Media folders copied from the readable backup | Match references to filenames; re-upload and remap storage references on another provider |
| Firebase course audio and course instructions | Firebase media copy and manifest when retrieval succeeds | A failed or missing object must be listed, not silently omitted |
| Vimeo course videos | Owner's Vimeo account and separately retained video originals | Database video IDs are backed up, but an embed ID is not a backup of the video |
| Secrets | Owner's password manager/provider account | Secret names are a checklist, never a substitute for values or account recovery |
| Apple/Google signing and store access | Owner-controlled Apple Developer, App Store Connect, Google Play and signing-key copies | Source code cannot recreate an existing signing identity |
| Domains, DNS, email, Shopify and Google connections | Owner-controlled provider accounts | Reconnect or reissue credentials; these accounts cannot be restored from a database |

## Verified rehearsal

On 2 November 2026, the actual Drive Portable Export captured at
`2026-11-02T06:03:28.162Z` was downloaded and all three payload files matched the
SHA-256 values in its manifest. Its SQL restored successfully into a separate,
temporary PostgreSQL 16 database: **43 tables and 1,839 rows**, matching the JSON
export. Every restored cell value was compared with the JSON export after
normalising PostgreSQL timestamp/number representations; all matched. The restore included three foreign-key constraints. Production was not
changed. The temporary instance was stopped after the test.

This proves the portable table restore, not a production cutover or a complete
mobile-store release. Indexes, triggers, roles and permissions must be recreated
from the current application schema/migrations. Documents and external media
are captured separately, not in the same database transaction.

Samples from the certificate, waiver, inspection, risk-assessment and retained
original-certificate folders opened as readable PDFs. A retailer-logo sample
decoded as an image. These are sample readability checks, not an assertion that
every historical document has been opened.

## Restoring media names

Assessment media copies use `image-<object UUID>.<extension>` or
`audio-<object UUID>.<extension>`, sometimes with a backup timestamp suffix.
Retailer-logo copies use `Retailer_<retailer ID>_Logo_<backup timestamp>.<extension>`.
The logo's original object UUID is in the database, not its backup filename.
Map by retailer ID, then use the recorded source timestamp/checksum to select
the relevant version. Keep historical versions distinct; do not overwrite them
because their readable names are similar. Upload into the new storage service
and update the restored database references explicitly.

There are 35 Vimeo-linked modules in the verified database snapshot. Their
configuration is recoverable, but the underlying video originals have not been
exported by this rehearsal. Independent video recovery therefore still depends
on the owner's Vimeo/original-video copies.

## Recover on another Replit project

1. Download and decrypt the dated recovery folder directly from Google Drive. Do not rely on
   a download route served by the unavailable app.
2. Verify `RECOVERY-MANIFEST.json` and the source archive checksum. Extract the
   source archive into a new, private project.
3. Install the Node/pnpm versions identified by the source package and run
   `pnpm install --frozen-lockfile`.
4. Create an empty PostgreSQL database. Run the supplied SQL with
   `psql -v ON_ERROR_STOP=1 -f restore-postgresql.sql`. It intentionally creates
   `chainsaw_backup_import`, not `public`, and refuses an existing recovery
   schema. Do not run it against the live database.
5. Recreate the application schema from `lib/db` in an isolated target. Map and
   import the recovery tables into that schema, preserving IDs, enrolment
   ownership, timestamps, sequence values and uniqueness rules. Compare every
   table count and relationship before making the target live.
6. Create fresh file storage. Upload the saved assessment media and retailer
   logos and remap object references. Restore required documents and Firebase
   content, or configure their existing owner-controlled services.
7. Reconnect Google, Shopify, email and any enabled AI services. Configure
   secrets through the new project's Secrets interface, not a committed `.env`.
8. Recreate the web/API artifact routing and scheduled backup job. Both services
   must bind to their supplied port. Review the included artifact configurations
   and `.replit` rather than assuming old project IDs still work.
9. Build the API and web packages, then verify activation/sign-in, existing
   access expiry, progress, documents, media, administrator access and purchase
   restoration in the isolated environment. Keep emails, webhooks, push and
   purchase writes disabled until explicitly authorised.
10. Only after verification, switch DNS/traffic and update mobile release
    configuration if the backend address changed. Re-enrol devices or reissue
    sessions only when required; do not extend course terms during migration.

## Recover with different software or hosting

The JSON is vendor-neutral table data. The SQL requires PostgreSQL; other
databases/software need an explicit field mapping. Import learners and enrolments
before dependent progress, attempts and documents. Preserve original identifiers
and map them if the destination assigns new ones. Do not flatten renewed courses
into one learner result or treat a restored purchase as a new purchase.

The existing app can run on a Node-compatible host plus PostgreSQL. Its optional
GCS and direct Google API adapters remove the Replit storage/connector dependency
when owner-controlled credentials are configured. Follow
[the portable deployment guide](recovery-portable.md); copying files alone does
not reconnect those services. Native Apple
and Android projects must keep their existing bundle/application IDs and signing
identities. A new signing identity is not an update to an existing app.

## Owner-held credential checklist

Retain independent recovery access to the domain registrar/DNS, GitHub, Google
Drive/Sheets, Firebase, Vimeo, Shopify, SMTP provider, Apple Developer/App Store
Connect and Google Play accounts. Store recovery codes and signing materials
securely outside Replit.

Managed secret names currently used include `ADMIN_PASSWORD`, `SESSION_SECRET`,
`BACKUP_TRIGGER_SECRET`, `MIGRATION_BACKUP_PASSPHRASE`, `PRIVATE_OBJECT_DIR`,
`PUBLIC_OBJECT_SEARCH_PATHS`, `DEFAULT_OBJECT_STORAGE_BUCKET_ID`,
`SHOPIFY_ACTIVATION_SECRET`, `SHOPIFY_WEBHOOK_SECRET`, `SMTP_HOST`, `SMTP_PORT`,
`SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `VAPID_EMAIL`, `VAPID_PUBLIC_KEY`,
`VAPID_PRIVATE_KEY`, `APPLE_IAP_ISSUER_ID`, `APPLE_IAP_KEY_ID`,
`APPLE_IAP_PRIVATE_KEY`, `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_APP_ID`,
`VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID` and `app_url`.
The target also needs its own database connection and any enabled provider
credentials. This list contains names only; no secret values are backed up here.

## Maintaining the set

Run `node scripts/prepare-recovery-source.mjs` to prepare an ignored source
snapshot. It fails on unresolved LFS pointers and excludes credential files and
private/non-source directories. Snapshot publishing and Drive copying must be
explicit operations, followed by destination checksum verification. Repeat the
isolated restore after significant schema, storage or purchase changes.
