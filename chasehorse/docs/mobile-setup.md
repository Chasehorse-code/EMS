# ChaseHorse Mobile Setup & Deployment Guide

This guide details configuration, security safeguards, environment profiles, EAS preview builds, and external service requirements for the ChaseHorse React Native (Expo) mobile application (`apps/mobile`).

---

## 1. Environment Architecture & Variants

The mobile app supports three build variants driven by environment variables (`EXPO_PUBLIC_*`). Create `.env.local` or target-specific env files for deployment:

| Variable | Dev / Local | Staging | Production | Description |
| :--- | :--- | :--- | :--- | :--- |
| `EXPO_PUBLIC_API_BASE_URL` | `http://10.0.2.2:8080/api/v1` (Android) / `http://localhost:8080/api/v1` (iOS/Web) | `https://staging-api.chasehorse.com/api/v1` | `https://api.chasehorse.com/api/v1` | Spring Boot REST API Endpoint |
| `EXPO_PUBLIC_SUPABASE_URL` | `https://phxybimufcrsnxfepiuz.supabase.co` | `https://phxybimufcrsnxfepiuz.supabase.co` | `https://<prod-ref>.supabase.co` | Supabase Project Host |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Public publishable anon key | Public publishable anon key | Production publishable anon key | Public JWT Token |

### Security Constraints (Zero-Tolerance)
1. **Never commit secret keys:** Never include Supabase `service_role` keys, database passwords, or JWT signing secrets in the mobile codebase.
2. **Credential Storage:** Session access and refresh tokens are persisted exclusively via `expo-secure-store` in hardware-backed keystore/keychain (`apps/mobile/src/config/supabase.ts`). `AsyncStorage` is banned for tokens.
3. **Database-backed Roles:** Mobile client never trusts claims inside client JWTs for roles; user privileges and account status (`ACTIVE`, `PENDING_APPROVAL`, `SUSPENDED`) are fetched dynamically via `GET /me`.

---

## 2. Local Development & Quality Gates

### Running the App Locally
```powershell
# From apps/mobile
npm install
npm run typecheck      # Must pass with 0 errors
npx expo start --port 8082
```

### Running Test Gates
From repository root (`chasehorse`):
```powershell
npm test               # Runs unit suite + OpenAPI route parity verification
npm run typecheck      # Runs tsc -b across all packages and apps
```

---

## 3. Native Permissions & Sensor Integration

### Location Permissions (`expo-location`)
- **Usage:** Used in `NearbyTasksScreen` and `CameraHUD` for task discovery (up to 100 km radius DB limit) and tamper-evident evidence watermarking.
- **Privacy Controls:** Users can withdraw location consent at any time from `EmployeeProfileScreen`. Withdrawing consent pauses real-time tracking, clears local coordinates, and halts location updates.
- **Accuracy Guarantee:** The app requests `Accuracy.Highest` and displays measured accuracy (`±Xm`). Evidence capture is blocked if accuracy is coarser than 100m.

### Camera & Viewfinder (`apps/mobile/src/components/camera/CameraHUD.tsx`)
- **Live Capture Only:** Gallery uploads are disabled for evidence to prevent tampering.
- **Watermark Stamp Strip:** Captured photos are overlaid with:
  - Task ID
  - Authenticated Worker ID
  - IST Timestamp
  - GPS Coordinates & Accuracy (`±Xm`)
  - Distance to Site
  - Cryptographic Verification Checksum (`CH-TSK-...`)
- **Proximity Gate:** Warns when evidence is captured outside the designated task operational radius.

---

## 4. Push Notification Setup & Architecture

Push notifications in Expo require external platform provisioning by the app owner:

### Architecture Flow
1. Mobile app obtains Expo push token via `Notifications.getExpoPushTokenAsync()`.
2. App sends token to backend via `POST /api/v1/devices/token` with authenticated session.
3. Spring Boot backend publishes events (Task Assigned, Decision Approved, Rework Requested, Wallet Credited) to the Expo Push Gateway (`https://exp.host/--/api/v2/push/send`).

### Platform Credentials Checklist for App Owner
- **Apple iOS (APNs):**
  - Apple Developer Account with Push Notifications capability.
  - Generate an APNs Authentication Key (`.p8` file) in Apple Developer Portal.
  - Upload Key ID, Team ID, and `.p8` file to EAS Credentials (`eas credentials -p ios`).
- **Google Android (FCM v1):**
  - Firebase Console -> Project Settings -> Cloud Messaging.
  - Generate Firebase Service Account JSON private key.
  - Place `google-services.json` in `apps/mobile/`.
  - Register FCM Server Credentials in EAS (`eas credentials -p android`).

---

## 5. EAS Build Configuration (`eas.json`)

`apps/mobile/eas.json` is configured for preview and production artifact generation without publishing to public app stores:

```json
{
  "cli": {
    "version": ">= 12.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      },
      "ios": {
        "simulator": true
      }
    },
    "production": {
      "autoIncrement": true
    }
  }
}
```

### Triggering Preview Builds
```powershell
# Android APK (installable directly on test devices/emulators)
eas build --profile preview --platform android

# iOS Simulator Build
eas build --profile preview --platform ios
```
*Note: Do NOT run `eas submit` or publish to Apple App Store / Google Play Store as per workspace constraints.*
