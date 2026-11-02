# Chainsaw Courses Mobile Release 1.0.6

## Release files

- Android: `Chainsaw_Courses_Android_com.chainsawcourses.app_v1.0.6_code10.aab`
- Apple: `Chainsaw_Courses_iOS_1.0.6_Build_7_COMPLETE_XCODE_PROJECT.zip`
- Production app: `https://app.chainsawcourses.com`

Each release file has a matching `.sha256` manifest. Keep the release file and its manifest together.

## Android upload

1. Open the Google Play Console entry for package `com.chainsawcourses.app`. Do not use the retired `com.chainsawcourses.uk` entry.
2. Upload the version 1.0.6, version-code 10 AAB to the required closed-testing track.
3. Upload the R8 mapping file from the release handoff if Play Console requests it.
4. Confirm Play reports target API 36 and accepts the registered upload certificate.
5. Add every tester's Google account to the tester list and send the opt-in link.
6. Keep the required number of testers opted in for Google's required period before requesting production access.

## Apple archive and upload

1. On a Mac, unzip the complete Xcode project into a new folder. Do not merge individual Swift files into an older project.
2. Open `App.xcodeproj` from the unzipped project folder.
3. Select the `App` target, choose the Overleaf Publishers Apple team, and confirm automatic signing succeeds.
4. Confirm the bundle identifier is `com.overleafpublishers.chainsawcourses`, version is 1.0.6, and build is 7.
5. Select **Any iOS Device (arm64)**, then use **Product > Archive**.
6. In Organizer, run **Validate App**, then **Distribute App > App Store Connect > Upload**.
7. Assign build 7 to the existing **First Run** external TestFlight group after processing and beta review.
8. Test through TestFlight before adding the build to the App Store version.

## Required physical-device tests

Run the complete list on at least one current Android phone, one iPhone, and one iPad. Repeat the responsive and orientation checks on a small phone, a larger phone, and a tablet where devices are available.

### Installation and startup

- Fresh install opens directly in the full-screen app without browser controls.
- The launch screen transitions to the sign-in/activation screen without a white screen.
- Airplane mode at launch shows the packaged native error page rather than a blank screen.
- Restoring connectivity and reopening the app loads the production service.
- Updating from the previous store build preserves a valid learner session where the package identity is unchanged.

### Activation, access, and sessions

- A new learner can activate with a valid code and sign in.
- An existing learner can reopen the app and continue without activating again.
- A paused, expired, invalid, and already-bonded code each shows the correct message.
- The full-access reviewer account can open every module and the final exam.
- Backgrounding, force-closing, restarting, and signing out preserve or clear state as intended.
- If a learner previously activated in a browser, verify whether support must reset the device bond before native activation.

### Course content and completion

- Module list, text, images, manual pages, quizzes, and final exam load correctly.
- Video and audio start, pause, resume, and record completion.
- Completion survives immediate navigation, app backgrounding, and a temporary connection loss.
- Certificates and other generated PDFs contain the expected learner details.

### Native file saving

- Android saves generated PDFs to the public Downloads collection and can open/share the saved file.
- iPhone and iPad save generated PDFs under **Files > On My iPhone/iPad > Chainsaw Courses** and can open/share the saved file.
- Cancelling the fallback share sheet does not report a successful save.

### Notifications and links

- Notification permission is requested at the intended point and a test notification opens the correct screen.
- Privacy policy, support, retailer website, and other external links open as intended.
- The retailer map loads, list selection works, and a tile outage still leaves retailer details and website links usable.
- Phone portrait, phone landscape, tablet portrait, and tablet landscape layouts have no clipped controls or horizontal overflow.

## Production backend checks

Before each store upload:

- `https://app.chainsawcourses.com/api` returns HTTP 200.
- The production deployment reports a successful public build.
- Authentication, module, progress, exam, welcome-note, privacy-policy, and retailer requests return their expected success or authorisation response.
- A real reviewer-account session can activate, read content, save progress, complete a video, and retrieve a certificate.
- A controlled Shopify test order issues one activation code and one email; a repeated webhook does not issue duplicates.
- Billing delivery monitoring and assessment-media persistence checks are passing.

Do not run activation, exam completion, certificate, or Shopify fulfilment tests with a real customer's account or order.

## Apple App Store Connect checklist

- Age rating questionnaire completed.
- Primary category set to Education.
- Pricing set to Free.
- Privacy policy URL uses the stable production app URL, not a temporary development URL.
- App Review contact details, notes, and full-access reviewer account are complete.
- Required iPhone and iPad screenshots match the current build.
- App privacy answers match the production data flows.
- Build 7 passes external TestFlight review and the physical-device checklist.
- App Store release remains manual until review is approved.

## Google Play Console checklist

- Correct app entry is `com.chainsawcourses.app`.
- Closed-testing release uses version code 10.
- Data Safety answers match the production data flows.
- Content rating is complete; target audience is 18 and over; category is Education.
- Ads, financial features, health, and government-app declarations are set to No.
- App access instructions include the full-access reviewer account.
- Current phone and tablet screenshots, app icon, feature graphic, short description, and full description are complete.
- Closed-testing participation requirement is satisfied before requesting production access.

## Reviewer account

Create a dedicated reviewer account with access to all modules and the final exam. Verify it immediately before submission. Enter its credentials only in App Store Connect and Google Play Console; do not place credentials in this file, source control, screenshots, or support notes outside the store consoles.