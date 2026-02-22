# TrackIt — Continuation TODO for Claude Code

## Project Context

TrackIt is a React Native (Expo) Android app for tracking generic daily metrics — nutrition, habits, workouts, etc. It stores data locally using `expo-sqlite`, shows charts via `react-native-chart-kit`, exports CSV via `expo-file-system` + `expo-sharing`, and sends daily reminders via `expo-notifications`.

### Tech Stack
- **Framework**: React Native with Expo (managed workflow)
- **Language**: TypeScript
- **Navigation**: `@react-navigation/native` + `@react-navigation/bottom-tabs`
- **Database**: `expo-sqlite` (sync API, `openDatabaseSync`)
- **Charts**: `react-native-chart-kit`
- **Notifications**: `expo-notifications` + `@react-native-async-storage/async-storage`
- **Icons**: `@expo/vector-icons` (MaterialCommunityIcons)
- **Date utils**: `date-fns`

### File Structure
```
src/
  db/
    database.ts       — initDB(), SQLite connection
    trackers.ts       — CRUD for tracker_types table
    entries.ts        — CRUD + aggregation for entries table
  screens/
    TodayScreen.tsx   — log entries, progress cards, streak badges
    ChartsScreen.tsx  — line/bar charts per tracker, period selector
    HistoryScreen.tsx — entries grouped by date, delete
    SettingsScreen.tsx — tracker CRUD, export CSV, reminders button
  components/
    RemindersModal.tsx — per-tracker notification scheduling UI
  navigation/
    AppNavigator.tsx  — bottom tab navigator (4 tabs)
  utils/
    notifications.ts  — schedule/cancel/sync expo-notifications
  theme/
    index.ts          — colors, spacing, radius, font size constants
```

### Database Schema
```sql
tracker_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  unit TEXT,
  color TEXT,        -- hex string e.g. '#6C63FF'
  icon TEXT,         -- MaterialCommunityIcons name
  daily_goal REAL,
  is_boolean INTEGER -- 0 or 1
)

entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tracker_id INTEGER REFERENCES tracker_types(id) ON DELETE CASCADE,
  value REAL,
  date TEXT,         -- 'yyyy-MM-dd' format
  note TEXT,
  created_at TEXT
)
```

### Theme Colors
```typescript
background: '#0F0F14'
surface: '#1A1A24'
surfaceHighlight: '#25253A'
text: '#FFFFFF'
textMuted: '#9090A0'
border: '#2A2A3A'
primary: '#6C63FF'
success: '#4CAF50'
error: '#F44336'
```

---

## TODO List

---

### 1. Swipe to Delete on History Screen

**File**: `src/screens/HistoryScreen.tsx`

**Goal**: Let users swipe left on any entry row to reveal a delete button, instead of the small trash icon.

**Instructions**:
- Install `react-native-gesture-handler` (already in deps) and `@react-native-community/swipeable` or use the built-in `Swipeable` from `react-native-gesture-handler`
- Wrap each `renderItem` entry in a `Swipeable` component
- Render a red "Delete" action on the right swipe
- On swipe confirm, call `deleteEntry(item.id)` then reload
- Remove the existing trash icon button from the row since swipe replaces it
- Make sure `GestureHandlerRootView` wraps the app root in `App.tsx`

**Example swipe action shape**:
```tsx
const renderRightActions = (item: EntryRow) => (
  <TouchableOpacity style={deleteAction} onPress={() => confirmDelete(item)}>
    <MaterialCommunityIcons name="trash-can-outline" size={24} color="#fff" />
    <Text style={deleteActionText}>Delete</Text>
  </TouchableOpacity>
);
// deleteAction style: red background, full height, padding 20, centered
```

---

### 2. Haptic Feedback on Logging

**File**: `src/screens/TodayScreen.tsx`

**Goal**: Trigger a haptic pulse when the user successfully logs an entry.

**Instructions**:
- Install: `npx expo install expo-haptics`
- Import: `import * as Haptics from 'expo-haptics'`
- In `submitLog()`, after calling `addEntry(...)`, add:
  ```typescript
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  ```
- Also add a light impact when opening the log modal (`Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)`) inside `openLog()`

---

### 3. Empty State Illustrations

**Files**: `src/screens/TodayScreen.tsx`, `src/screens/HistoryScreen.tsx`, `src/screens/ChartsScreen.tsx`

**Goal**: When there are no trackers or no entries, show a friendly illustrated empty state instead of plain text.

**Instructions**:
- Create a reusable component at `src/components/EmptyState.tsx`:
  ```tsx
  type Props = { icon: string; title: string; subtitle: string; color?: string }
  // Renders a large MaterialCommunityIcons icon (size 64), bold title, muted subtitle
  // centered vertically with marginTop: 80
  ```
- Replace all `ListEmptyComponent` plain `<Text>` elements with `<EmptyState>`:
  - **Today**: icon `"check-circle-outline"`, title `"Nothing tracked yet"`, subtitle `"Tap + on any card to log your first entry"`
  - **History**: icon `"calendar-blank-outline"`, title `"No entries yet"`, subtitle `"Start logging on the Today tab"`
  - **Charts**: icon `"chart-line"`, title `"No data to show"`, subtitle `"Log some entries and come back here"`
- Use the tracker's color if one is selected, otherwise `theme.colors.primary`

---

### 4. Weekly Summary Card on Today Screen

**File**: `src/screens/TodayScreen.tsx`  
**New DB function needed in**: `src/db/entries.ts`

**Goal**: Show a summary card at the top of the Today screen comparing this week's totals to last week's for each tracker.

**Instructions**:

Add to `src/db/entries.ts`:
```typescript
export const getWeeklyComparison = (trackerId: number): { thisWeek: number; lastWeek: number } => {
  const thisWeek = db.getFirstSync<{ total: number }>(
    `SELECT COALESCE(SUM(value), 0) as total FROM entries
     WHERE tracker_id=? AND date >= date('now', '-7 days')`,
    [trackerId]
  )?.total ?? 0;

  const lastWeek = db.getFirstSync<{ total: number }>(
    `SELECT COALESCE(SUM(value), 0) as total FROM entries
     WHERE tracker_id=? AND date >= date('now', '-14 days') AND date < date('now', '-7 days')`,
    [trackerId]
  )?.total ?? 0;

  return { thisWeek, lastWeek };
};
```

In `TodayScreen.tsx`:
- Add a horizontal `ScrollView` above the tracker `FlatList` showing one card per tracker
- Each card shows: tracker name, this week's total, and a colored up/down arrow + percentage vs last week
- Use `getWeeklyComparison(tracker.id)` for each tracker
- Card style: `surface` background, rounded, ~140px wide, colored accent border on left
- Delta calculation: `((thisWeek - lastWeek) / (lastWeek || 1)) * 100`
- Green arrow up if positive, red arrow down if negative, gray dash if no change

---

### 5. Custom Date Logging

**Files**: `src/screens/TodayScreen.tsx`, `src/components/RemindersModal.tsx` (for reference on modal patterns)

**Goal**: Allow users to log an entry for yesterday or any past date, not just today.

**Instructions**:
- In the log modal (`TodayScreen.tsx`), add a date selector below the value input
- Show the currently selected date (default: today) as a tappable chip
- When tapped, show a simple date picker — build a custom one like the time picker in `RemindersModal.tsx` using up/down chevrons for day offset (Today, Yesterday, 2 days ago, etc.) — do NOT use a native date picker as it's unreliable across Android versions
- Pass the selected date string (`format(selectedDate, 'yyyy-MM-dd')`) to `addEntry()` instead of the hardcoded `TODAY` constant
- After logging, reload only if the selected date is today (otherwise the card totals won't change and that's correct)

---

### 6. Multiple Entries Per Day on Today Screen

**File**: `src/screens/TodayScreen.tsx`  
**New DB function needed in**: `src/db/entries.ts`

**Goal**: Show individual entries for today under each tracker card when expanded, not just the total.

**Instructions**:

Add to `src/db/entries.ts`:
```typescript
export const getTodayEntries = (trackerId: number, date: string) => {
  return db.getAllSync<Entry>(
    `SELECT * FROM entries WHERE tracker_id=? AND date=? ORDER BY created_at DESC`,
    [trackerId, date]
  );
};
```

In `TodayScreen.tsx`:
- Add state: `const [expanded, setExpanded] = useState<Record<number, boolean>>({}`
- Make each tracker card tappable to toggle expanded state (the `+` button still opens log modal)
- When expanded, render a sub-list of today's individual entries below the card showing time logged (`created_at`) and value
- Add a small swipe-to-delete or trash icon per sub-entry calling `deleteEntry(id)` then `load()`
- Animate expand/collapse with `LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)` before setting state

---

### 7. App Icon Design

**Goal**: Replace the default Expo icon with a proper TrackIt icon.

**Instructions**:
- Create a 1024×1024 PNG file at `assets/icon.png`
- Design: dark background `#0F0F14`, centered `#6C63FF` circle, white checkmark or bar chart icon inside
- You can generate this with an SVG-to-PNG tool or use the following SVG as a base:
  ```svg
  <svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
    <rect width="1024" height="1024" rx="180" fill="#0F0F14"/>
    <circle cx="512" cy="512" r="320" fill="#6C63FF" opacity="0.15"/>
    <!-- Bar chart bars -->
    <rect x="280" y="580" width="80" height="160" rx="16" fill="#6C63FF"/>
    <rect x="400" y="460" width="80" height="280" rx="16" fill="#6C63FF" opacity="0.8"/>
    <rect x="520" y="380" width="80" height="360" rx="16" fill="#6C63FF"/>
    <rect x="640" y="500" width="80" height="240" rx="16" fill="#FF6584"/>
    <!-- Trend line -->
    <polyline points="320,560 440,440 560,360 660,480" stroke="white" stroke-width="12" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/>
  </svg>
  ```
- Also create `assets/splash.png` (same design, wider canvas 1284×2778) and `assets/adaptive-icon.png` (1024×1024, no rounded corners — Android clips it)
- Update `app.json`:
  ```json
  {
    "expo": {
      "icon": "./assets/icon.png",
      "splash": {
        "image": "./assets/splash.png",
        "backgroundColor": "#0F0F14",
        "resizeMode": "contain"
      },
      "android": {
        "adaptiveIcon": {
          "foregroundImage": "./assets/adaptive-icon.png",
          "backgroundColor": "#0F0F14"
        }
      }
    }
  }
  ```

---

### 8. Android APK Build (Local, No Account Required)

**Goal**: Build a standalone APK installable without Expo Go, using Android Studio locally.

**Prerequisites**:
- Android Studio installed with Android SDK
- `ANDROID_HOME` environment variable set (usually `~/Library/Android/sdk` on Mac or `C:\Users\<you>\AppData\Local\Android\Sdk` on Windows)
- `adb` available in PATH (comes with Android Studio)
- Phone has "Install from unknown sources" enabled for sideloading

**Instructions**:

1. Generate the native `android/` folder from the Expo project:
   ```bash
   npx expo prebuild --platform android
   ```
   This converts the Expo project into a standard Android Gradle project. Only needs to be run once, or again if you add new native dependencies.

2. Build the debug APK:
   ```bash
   cd android
   ./gradlew assembleDebug
   ```
   On Windows use `gradlew.bat assembleDebug` instead.

3. The APK will be output at:
   ```
   android/app/build/outputs/apk/debug/app-debug.apk
   ```

4. Install on your connected phone via USB:
   ```bash
   adb install app/build/outputs/apk/debug/app-debug.apk
   ```
   Or copy the APK file to your phone and open it directly to sideload.

**Notes**:
- Debug APK is fine for personal use and testing — no signing required
- Never run `npx expo prebuild` again after modifying files inside `android/` manually — it will overwrite your changes. Use `--clean` flag only if you want a full reset

**Production build (signed APK/AAB for Play Store or personal release)**:

1. Generate a keystore (one-time, keep this file safe — losing it means you can never update the app on Play Store):
   ```bash
   keytool -genkeypair -v -keystore trackit.keystore -alias trackit -keyalg RSA -keysize 2048 -validity 10000
   ```
   It will prompt for a password and some identity info. Store `trackit.keystore` somewhere safe outside the repo.

2. Add signing config to `android/app/build.gradle`:
   ```groovy
   android {
     ...
     signingConfigs {
       release {
         storeFile file('/absolute/path/to/trackit.keystore')
         storePassword 'your_store_password'
         keyAlias 'trackit'
         keyPassword 'your_key_password'
       }
     }
     buildTypes {
       release {
         signingConfig signingConfigs.release
         minifyEnabled true
         proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
       }
     }
   }
   ```

3. Build signed release APK:
   ```bash
   cd android
   ./gradlew assembleRelease
   ```
   Output: `android/app/build/outputs/apk/release/app-release.apk`

4. Or build AAB for Play Store:
   ```bash
   ./gradlew bundleRelease
   ```
   Output: `android/app/build/outputs/bundle/release/app-release.aab`

5. Install release APK on device:
   ```bash
   adb install app/build/outputs/apk/release/app-release.apk
   ```

**Security note**: Never commit `trackit.keystore` or passwords to git. Add to `.gitignore`:
```
android/app/*.keystore
*.keystore
```

---

### 9. Google Play Store Submission (Local Build)

**Goal**: Publish TrackIt to the Play Store using a locally built AAB.

**Instructions**:

1. **Create a Google Play Developer account** — $25 one-time fee at [play.google.com/console](https://play.google.com/console)

2. **Build a signed AAB locally** (follow keystore setup in TODO #8 first):
   ```bash
   cd android
   ./gradlew bundleRelease
   ```
   Output: `android/app/build/outputs/bundle/release/app-release.aab`

3. **In Play Console**: Create app → choose "App" → Free → select country availability

4. **Upload the AAB**:
   - Go to Release → Production (or start with Internal testing for safety)
   - Upload `app-release.aab`
   - Play Store generates optimized APKs from it automatically

5. **Prepare required store assets**:
   - App icon: 512×512 PNG (resize the icon from TODO #7)
   - Feature graphic: 1024×500 PNG (simple banner with app name and dark theme)
   - Screenshots: minimum 2 phone screenshots — take them from a real device or emulator via:
     ```bash
     adb exec-out screencap -p > screenshot.png
     ```
   - Short description: max 80 chars, e.g. `"Track anything daily — nutrition, habits, workouts. Charts & export included."`
   - Full description: explain trackers, charts, reminders, CSV export
   - Privacy policy URL: required even for apps with no accounts — host a minimal one on GitHub Pages or [privacypolicygenerator.info](https://privacypolicygenerator.info)

6. **Fill in content rating questionnaire** — TrackIt has no objectionable content, rates as Everyone

7. **Submit for review** — first submission typically takes 1-3 days

**Notes**:
- Use Internal Testing first to verify the production build works on a real device before promoting to Production
- Every update needs a higher `versionCode` in `android/app/build.gradle` — increment it before each release build
- The same keystore must be used for every future update — keep it backed up securely

---

## Priority Order

1. Swipe to delete (quick win, UX polish)
2. Haptic feedback (2 lines of code)
3. Empty state illustrations (visual polish)
4. Multiple entries per day (core UX improvement)
5. Custom date logging (power user feature)
6. Weekly summary card (motivational feature)
7. App icon design (release prep)
8. APK build (release prep)
9. Play Store submission (launch)
