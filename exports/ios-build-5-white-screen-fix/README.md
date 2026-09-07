# Chainsaw Courses — iOS Build 5 white-screen repair

Build 4 starts the local Capacitor web bundle. That bundle can resolve its JavaScript from the wrong base path and cannot use the hosted `/api` routes, which leaves the app on a blank white screen.

This repair configures the native iOS WebView to load the live, secure app at `https://app.chainsawcourses.com`, just like the Android app. The app remains full-screen inside the native Capacitor WebView.

## On the Mac

1. Unzip this package.
2. Copy `capacitor.config.ts` into the matching location in the existing Chainsaw Courses project, replacing that file.
3. From the project root, run:

   ```bash
   PORT=19478 BASE_PATH=/ pnpm --filter @workspace/chainsaw-training run build
   pnpm --filter @workspace/chainsaw-training exec cap sync ios
   pnpm --filter @workspace/chainsaw-training exec cap open ios
   ```

4. In Xcode, confirm the app target still uses the existing bundle identifier:

   ```text
   com.overleafpublishers.chainsawcourses
   ```

5. Increase the Xcode build number from `4` to `5`, then archive and upload it to App Store Connect.
6. Add Build 5 to the existing **First Run** TestFlight group.

## Expected result

After the tester updates to Build 5, Chainsaw Courses should open directly to the normal app screen instead of a blank white page. No learner progress or activation details are changed by this repair.