# RayHealth EVV Mobile

RayHealth EVV Mobile is the caregiver-facing Capacitor app that Google AI Studio started and Android Studio/Xcode can continue. This repo contains the shared Vite app plus native shells for Android and iOS.

## Native entry points

- Android Studio project: `android/`
- Xcode project: `ios/App/App.xcodeproj`

## What is already in this repo

- Capacitor Android shell under `android/`
- Capacitor iOS shell under `ios/`
- Firebase client bootstrap in `firebase-applet-config.json` for future push/messaging work
- Firestore rules drafts in `DRAFT_firestore.rules` and `firestore.rules`
- Caregiver-facing UI under `src/`
- RayHealth API-backed mobile auth/onboarding/visit sync under `src/services/`

## Bootstrap the project

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env.local` and set the needed secrets.
3. Build the web bundle:
   ```bash
   npm run build
   ```
4. Sync Capacitor:
   ```bash
   npm run cap:sync
   ```

## Environment

Minimum local values:

```env
VITE_GEMINI_API_KEY=your_gemini_key
APP_URL=http://localhost:3000
VITE_PARENT_API_URL=https://rayhealthevv.com/api
```

## Android Studio handoff

1. Make sure the Gradle wrapper is executable:
   ```bash
   chmod +x android/gradlew
   ```
2. Sync Android assets:
   ```bash
   npm run cap:sync:android
   ```
3. Open the native project:
   ```bash
   npm run android:open
   ```
   Or open the `android/` folder directly in Android Studio.
4. Let Android Studio generate `android/local.properties` from your installed SDK if it is missing.

## iOS handoff

1. Sync iOS assets:
   ```bash
   npm run cap:sync:ios
   ```
2. Open:
   ```bash
   npm run ios:open
   ```
   Or open `ios/App/App.xcodeproj` directly in Xcode.

## Firebase notes

- Web Firebase config lives in `firebase-applet-config.json`, but mobile login/schedule sync now use the RayHealth API as the system of record.
- If native Firebase services are added later, Android Studio will expect `android/app/google-services.json`.
- Xcode will expect `ios/App/App/GoogleService-Info.plist`.

## Current status

This repo now runs the real RayHealth invite, login, schedule, visit, task, and sync contract instead of the earlier demo/Firebase auth flow. Native session persistence uses Capacitor Preferences on device builds, and Android Studio can continue from the synced native shell.

See `ANDROID_STUDIO_HANDOFF.md` for the focused continuation brief.
