---
name: App Store Submission Status
description: Full status of iOS (Apple) and Android (Google Play) submissions for Chainsaw Courses app
---

## App Details
- App name: Chainsaw Courses
- Company: Overleaf Publishers Ltd
- Contact: info@chainsawcourses.com
- iOS Bundle ID: com.overleafpublishers.chainsawcourses
- Android Bundle ID: com.chainsawcourses.app (correct one — ignore com.chainsawcourses.uk which was created by mistake)

## iOS — Apple App Store
- Build tool: Capacitor, opened via `cap open ios` from ~/Downloads/chainsaw-training
- 3 builds uploaded. Build 3 is latest (correct icon, correct bundle ID)
- App icon: 1024×1024px — added to Xcode Assets.xcassets → AppIcon
- Screenshots: 7 of 10 uploaded for iPhone 6.9" display
- App preview videos: attempted but had audio/dimension issues. Required size: 886×1920px (iPhone), 1200×1600px (iPad). Must have audio track (even silent AAC).
- Description, keywords, support URL (https://chainsawcourses.com), copyright (© 2026 Overleaf Publishers Ltd) all filled in
- TestFlight: External group "First Run" created. Build 3 submitted for beta review — link: https://testflight.apple.com/join/r2YgRpMr
- Apple reviewer login: sign-in required — test account needed with FULL access to all course content
- Store version release: set to MANUAL release
- Still needed: age rating, category, pricing, complete App Review Info, submit for review
- Privacy policy URL: use the hosted one in the app (see below)
- Agreements: Free Apps Agreement is active; Paid Apps Agreement is pending user information. The app is free and uses external course activation, so no Apple bank account or paid-app tax form is needed unless Apple payments or In-App Purchases are introduced.

### Important status distinction
- “Waiting for Review” on TestFlight → External Testing refers to Apple’s beta-app review for the external group.
- The App Store version itself was still “Prepare for Submission” in the last recorded state; it is not in App Store review until “Add for Review” is submitted.
- External testers cannot install until the beta review approves the build; the public TestFlight link does not bypass that review.

## Android — Google Play
- Two apps exist — use ONLY `com.chainsawcourses.app`; `com.chainsawcourses.uk` was created by mistake and its old Trusted Web Activity bundle opens with browser controls.
- A signed native Capacitor replacement bundle is ready: version `1.0.1`, version code `3`, package `com.chainsawcourses.app`, targeting Android 16 / API 36. It opens in a full-screen native WebView without browser chrome.
- Use the replacement bundle verified with the original Google Play upload certificate; newer locally generated keys and the earlier bundle signed with one of them are rejected by Play. Upload only the corrected bundle to the `com.chainsawcourses.app` closed-testing track, provided version code 3 is newer than the highest uploaded bundle.
- Google’s Android 16 policy warning applies to the older API 35 build and is addressed by the new API 36 bundle.
- Testers on the retired `.uk` app must install the correct `.app` listing; Android cannot update one package into the other.
- Closed testing (Alpha1) is in progress. Testers must opt in with the Google account on the tester email list and remain opted in for the required testing period before a production access request.

## Privacy Policy
- Already built and live in the app at: /chainsaw-training/privacy
- Full URL: https://b379fd4c-68c8-4315-87b3-18430e88c03e-00-tbplmpp3xkyl.spock.replit.dev/chainsaw-training/privacy
- Use this URL for both Apple and Google Play privacy policy fields

## App Login
- App requires Firebase login
- Apple reviewer needs a test account with FULL access to all course content (all modules unlocked)
- Same for Google Play review

## Key Answers for Google Play Checklist
- Ads: No
- Financial features: No
- Health app: No
- Government app: No
- Target audience: 18 and over
- Category: Education
- Content rating: fill out questionnaire, answer No to violence/sexual/gambling etc
- Data collected: email address (for login), encrypted in transit, not sold to third parties
