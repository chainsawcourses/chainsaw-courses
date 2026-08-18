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

## Android — Google Play
- Two apps exist — use ONLY com.chainsawcourses.app (created Jul 28). Ignore com.chainsawcourses.uk (created by mistake Aug 17)
- 2 builds uploaded (version 1 and 2), internal testing active
- Closed testing (Alpha1) in progress but blocked by 4 errors on dashboard
- Need 20 testers for 14 days on closed testing before production is allowed
- Dashboard checklist still needed: privacy policy URL, sign-in details, ads declaration, content rating, target audience, data safety, financial features, health declaration, category, store listing

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
