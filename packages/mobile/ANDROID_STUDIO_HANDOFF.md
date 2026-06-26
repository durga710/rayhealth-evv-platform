# Android Studio Handoff

This mobile repo is the continuation point after the Google AI Studio export.

## Open these native projects

- Android Studio: `android/`
- Xcode: `ios/App/App.xcodeproj`

## First-run commands

```bash
npm install
chmod +x android/gradlew
npm run cap:sync:android
```

Then either:

```bash
npm run android:open
```

or open the `android/` folder in Android Studio manually.

## Required environment

Create `.env.local` from `.env.example` and set:

```env
VITE_GEMINI_API_KEY=your_gemini_key
# Optional legacy AI Studio fallback
GEMINI_API_KEY=
APP_URL=http://localhost:3000
VITE_PARENT_API_URL=https://rayhealthevv.com/api
```

## Firebase files in this repo

- Web config: `firebase-applet-config.json`
- Firestore rules: `firestore.rules`
- Draft rules: `DRAFT_firestore.rules`

## Native Firebase follow-up

If Android push/auth/storage plugins are added, place:

- `android/app/google-services.json`
- `ios/App/App/GoogleService-Info.plist`

## What was cleaned up for the handoff

- Root package renamed to `rayhealth-evv-mobile`
- Android/iOS open scripts exposed from `package.json`
- Capacitor sync commands split for Android and iOS
- README rewritten around RayHealth instead of the generic AI Studio stub
- Parent API example corrected to `https://rayhealthevv.com/api`

## Important reality check

The native shell is present and ready for Android Studio/Xcode pickup. Some app logic is still AI Studio starter logic and should be finished against the real RayHealth backend before calling the mobile app production-complete.
