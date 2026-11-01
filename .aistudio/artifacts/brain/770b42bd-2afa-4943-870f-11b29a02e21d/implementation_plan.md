# Attendo Kiosk & Google Sheet Automated Attendance Integration Plan

This implementation plan details the complete architecture, data lifecycle, and operational steps for connecting the Attendo Kiosk biometric suite with a Google Sheet backend for automated, real-time employee attendance logging and live verification.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The automated attendance reporting pipeline is designed to work seamlessly with any published Google Apps Script Web App URL without altering existing biometric face-matching algorithms or Firebase Firestore persistence.

- **Dual-Channel Payload Dispatch**: Dispatches both URL query parameters (for Apps Scripts utilizing `e.parameter`) and a structured JSON POST body (for scripts utilizing `e.postData.contents`), ensuring 100% compatibility across all Google Apps Script implementations.
- **Multi-Tier Web App URL Resolution**: Resolves the target Google Sheet Web App URL through direct arguments, runtime memory, client environment variables (`VITE_GOOGLE_APPS_SCRIPT_URL`), local persistent storage (`attendo_google_sheet_url`), and the company record in Firebase Firestore (`companies/{companyId}/settings/googleSheetUrl`).
- **Deduplication Engine**: Employs an in-memory 12-second composite key cache to eliminate duplicate row insertions when punches are triggered simultaneously across kiosk and application state listeners.
- **Direct Database Routing**: Targets the designated Firestore database (`ai-studio-testremix2attend-770b42bd-2afa-4943-870f-11b29a02e21d`) using adaptive auto-detect polling to avoid connection timeouts in containerized and iframe environments.

---

### 1. Overview & Core Concept

- **What It Does**: Bridges the Attendo AI Biometric Face Kiosk and Store Admin HR Portal with Google Sheets. Whenever an employee is biometrically recognized and clocks in, starts a break, resumes work, or clocks out, their attendance details (Name, Employee ID, Timestamp, Status, Shift Times, and Department) are automatically written as a new row in the company's Google Sheet in real time.
- **Target Audience / Persona**: Hypermarket store managers, HR administrators, and floor staff who rely on Google Sheets for automated payroll, shift auditing, and daily attendance records.
- **Key Value**: Eliminates manual attendance export/import tasks, prevents buddy-punching via AI facial verification, and guarantees zero data loss via offline-first synchronization.

---

### 2. User Experience & Visual Design

#### Key User Flows

```
[Staff Approaches Kiosk] ──> [AI Biometric Face Match (98%+ Confidence)]
                                           │
                                           ▼
                             [Evaluate Shift Schedule & Buffer]
                                           │
                                           ▼
                             [Execute Attendance Punch (In / Break / Out)]
                                           │
                    ┌──────────────────────┴──────────────────────┐
                    ▼                                             ▼
        [Optimistic UI Feedback]                    [Background Dual Sync Engine]
    - Success Chime & Voice Greeting             1. Enqueue to Firebase Firestore
    - Confetti & Last-Punch Audit Pill           2. Broadcast to other tabs
    - Immediate Local Feed Update                3. POST to Google Sheet Web App URL
```

1. **Kiosk Biometric Attendance Flow**:
   - The staff member steps in front of the kiosk camera.
   - The face-matching engine detects landmarks, confirms liveness, and matches against enrolled company staff.
   - The system evaluates shift duty rules and presents contextual punch actions (`Punch In`, `Start Break`, `End Break`, `Punch Out`).
   - Upon punch selection, audio chimes confirm the action, and details are immediately dispatched to both Firebase and Google Sheets.

2. **Admin Portal Live Verification Flow**:
   - The manager opens **Company Settings > Google Sheets Automated Attendance Sync**.
   - The manager inputs or reviews their Google Apps Script `/exec` Web App URL.
   - The manager clicks the **'Test Sheet Sync'** button.
   - The system sends a standardized test employee record (`Name: Test User`, `ID: 999`, `Status: TEST_CHECK_IN`).
   - An alert banner confirms successful delivery and displays the verified row details.

#### Visual Identity & Theme
- **Color Palette**: Enterprise slate background (`#0F172A` / `#F8FAFC`), crisp Tailwind blue (`#2563EB`) primary accents, emerald green (`#10B981`) for live sheet connectivity, and amber (`#F59E0B`) for shift variance indicators.
- **Typography & Hierarchy**: Inter display font for clean administrative readability, coupled with monospace font styling for employee IDs, store codes, and ISO timestamps.
- **Interactive Feedback**: Dynamic pulsers indicating "Connected & Live" sheet status, animated spinner indicators on active sync buttons, and audio chimes for operational success.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Dual-Format Dispatch (Query Parameters + JSON Body)**
  - *Chosen Approach*: Send core fields (`name`, `employeeId`, `timestamp`, `status`, `punchType`) as URL query parameters AND the full payload as a UTF-8 JSON POST body with `mode: 'no-cors'`.
  - *Why*: Google Apps Script deployments vary widely—some scripts parse `e.parameter` while others parse `e.postData.contents`. Dual dispatch guarantees compatibility without requiring script modifications.
  - *Alternatives Considered*: Standard `cors` mode (fails due to Google Apps Script 302 redirects and cross-origin preflight restrictions in browsers).

- **Decision 2: Multi-Tier URL Fallback Hierarchy**
  - *Chosen Approach*: Resolve URLs from argument -> in-memory cache -> environment variables (`VITE_GOOGLE_APPS_SCRIPT_URL`) -> localStorage (`attendo_google_sheet_url`) -> Firestore company record.
  - *Why*: Allows the kiosk to continue logging punches to Google Sheets even if Firestore access is temporarily offline or experiencing cold starts.

- **Decision 3: Named Firestore Database Targeting**
  - *Chosen Approach*: Explicitly configure the named database `ai-studio-testremix2attend-770b42bd-2afa-4943-870f-11b29a02e21d` in both `firebase-applet-config.json` and `src/services/firebase.ts`.
  - *Why*: Prevents Firestore SDK 10-second backend timeout errors that occur when the client defaults to `(default)`.

---

### 4. Technical Architecture & Data Strategy

#### System & Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Attendo Application Suite                     │
├──────────────────────────┬─────────────────────────┬────────────────────┤
│   Store Admin Portal     │   Biometric Face Kiosk  │   Staff Mobile App │
│   - Roster & Shifts      │   - Real-time Video     │   - GPS Geofence   │
│   - Google Sheet Config  │   - AI Face Recognition │   - Shift View     │
│   - 'Test Sheet Sync'    │   - executePunch()      │   - Mobile Punch   │
└────────────┬─────────────┴────────────┬────────────┴─────────┬──────────┘
             │                          │                      │
             ▼                          ▼                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     Central Attendance Logging Pipeline                 │
│                 (handleNewPunch / syncAttendanceToGoogleSheet)          │
├─────────────────────────────────────────────────────────────────────────┤
│  1. Shift Evaluator: Grace period, late minutes, break durations       │
│  2. Local State: 0ms Optimistic UI updates with audio feedback          │
│  3. 12s Deduplication Filter: Prevents duplicate record dispatch        │
│  4. Offline Sync Queue: Persists pending operations in localStorage     │
└────────────┬─────────────────────────────────────────────────┬──────────┘
             │                                                 │
             ▼                                                 ▼
┌───────────────────────────────┐               ┌─────────────────────────┐
│     Cloud Firestore Backend   │               │ Google Sheet Web App    │
│  - Database:                  │               │ - Endpoint: .../exec    │
│    ai-studio-testremix2...    │               │ - Mode: no-cors POST    │
│  - Live snap collections      │               │ - Dual-format payload   │
│  - Security rules deployed    │               │ - Real-time row append  │
└───────────────────────────────┘               └─────────────────────────┘
```

#### Data Schema Definition

The payload delivered to the Google Sheet backend adheres to the following unified schema:

| Column / Key | Type | Description | Example Value |
| :--- | :--- | :--- | :--- |
| `Timestamp` / `timestamp` | `string` | 12-hour formatted local date & time | `01-Nov-2026, 01:05:26 AM` |
| `Employee Name` / `name` | `string` | Verified staff full name | `Test User` |
| `Employee ID` / `employeeId` | `string` | Unique alphanumeric identifier | `999` |
| `Status` / `status` | `string` | Evaluated shift status | `TEST_CHECK_IN`, `ON_TIME`, `LATE (15 mins)` |
| `Punch Type` / `punchType` | `string` | Action category | `PUNCH_IN`, `PUNCH_OUT`, `BREAK_START` |
| `Scheduled Time` | `string` | 12-hour shift start time | `09:00 AM` or `-` |
| `Actual Time` | `string` | 12-hour clock punch time | `01:05:26 AM` |
| `Department` | `string` | Assigned floor department | `Store Operations` |
| `Delay` | `string` | Variance from shift schedule | `+10m` or `-` |

---

### 5. Implementation & Execution Steps

1. **Step 1: URL Resolution & Background Dispatch Engine**
   - Implement `getEffectiveGoogleSheetUrl` and `setGlobalGoogleSheetUrl` in `src/services/googleSheets.ts`.
   - Implement `recentlySyncedPunches` deduplication cache (12s window).
   - Integrate dual query parameter and JSON payload dispatch in `syncAttendanceToGoogleSheet`.

2. **Step 2: Kiosk Attendance Integration**
   - Update `executePunch` in `src/components/KioskFace.tsx` to automatically trigger `syncAttendanceToGoogleSheet` upon biometric verification.
   - Retain complete face-recognition stabilization, anti-spoof checks, and 12-hour AM/PM formatting.

3. **Step 3: Admin Portal Instant Verification**
   - Update `testGoogleSheetConnection` in `src/services/googleSheets.ts` to dispatch `Name: Test User`, `ID: 999`, and `Status: TEST_CHECK_IN`.
   - Add the **'Test Sheet Sync'** button (`id="btn-test-sheet-sync"`) in Admin Portal Settings with loading states.
   - Add the quick **'Test Sheet Sync'** action in the Live Attendance Punch Feed header on the Overview dashboard.

4. **Step 4: Firestore Database & Network Hardening**
   - Specify `firestoreDatabaseId: "ai-studio-testremix2attend-770b42bd-2afa-4943-870f-11b29a02e21d"` in `firebase-applet-config.json`.
   - Configure `experimentalAutoDetectLongPolling: true` and add safe timeout guards to `testFirestoreConnection` in `src/services/firebase.ts`.
   - Deploy `firestore.rules` via `deploy_firebase`.

5. **Step 5: End-to-End Validation**
   - Run type linting (`lint_applet`) and build compilation (`compile_applet`).
   - Validate live button interactions and feedback alerts in the application preview.
