# Mobile Release Verification 1.0.6

Verified on 17 September 2026 against the current workspace source.

## Automated release validation

- Full `pnpm run check:release` gate: passed
- Mobile package boundary check: passed
- Mobile handoff checksum audit: passed before packaging; current handoffs have their own verified manifests
- Production deployment: public, successful current build

## Android release

- File: `exports/Chainsaw_Courses_Android_com.chainsawcourses.app_v1.0.6_code10.aab`
- Package: `com.chainsawcourses.app`
- Version: 1.0.6
- Version code: 10
- Minimum API: 24
- Compile and target API: 36
- Signing: matches the upload certificate registered for the Google Play app
- AAB archive integrity: passed
- R8 mapping: `exports/Chainsaw_Courses_Android_com.chainsawcourses.app_v1.0.6_code10_mapping.txt`
- AAB SHA-256: `fa6e580d8fbfc6ae5aa865083d8d4493f8174a81ad74e7e6e239902830d9156b`

## Apple release handoff

- File: `exports/Chainsaw_Courses_iOS_1.0.6_Build_7_COMPLETE_XCODE_PROJECT.zip`
- Bundle identifier: `com.overleafpublishers.chainsawcourses`
- Version: 1.0.6
- Build: 7
- Deployment target: iOS 15
- Devices: iPhone and iPad
- Hosted app URL: `https://app.chainsawcourses.com`
- Native PDF saver and secure-session plugins: included in the Xcode target
- Obsolete concatenated PDF plugin source: excluded from the handoff
- Capacitor Filesystem and Share Swift packages: vendored inside the handoff
- Swift package paths: verified from a clean extracted ZIP with no workspace or `node_modules` references
- Referenced remote Swift packages and required tags: reachable
- ZIP archive integrity: passed
- ZIP SHA-256: `d12e065b85130f6a4e180ccdd1abc48bb5336f24246d830c4b23a288df1ac9da`

The Apple ZIP is a portable Xcode source handoff, not a signed IPA. Linux cannot run Xcode, so a clean unsigned Release archive remains part of the required Mac validation. It must then be signed, validated, and uploaded using the Overleaf Publishers Apple team.

## Production backend smoke check

- `GET /api`: HTTP 200
- Privacy policy: HTTP 200
- `GET /api/config/welcome-note`: HTTP 200
- Anonymous `GET /api/retailers`: HTTP 401 as expected
- Anonymous `GET /api/modules`: HTTP 401 as expected

The release gate also passed the route contract, privacy-policy PDF, store-policy, manual delivery, retailer directory, billing history, installed-session lifecycle, video completion persistence, TypeScript, secrets, and deployment-size checks.

## Still requires a person or store console

- Run every test in `release/MOBILE-RELEASE-1.0.6.md` on a real Android phone, iPhone, and iPad.
- Use a dedicated full-access reviewer account for the real authenticated end-to-end check.
- Validate a controlled Shopify test order and webhook retry without using a real customer's order.
- Upload Android code 10 to the correct `com.chainsawcourses.app` closed-testing track.
- Extract the Apple ZIP into a clean Mac folder, resolve packages, and produce a clean Release archive in Xcode before upload.
- Sign and upload Apple build 7 from Xcode, then assign it to the **First Run** TestFlight group.
- Complete the outstanding Apple and Google listing, rating, privacy, app-access, screenshot, and testing requirements.