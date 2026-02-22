# TrackIt

> Track anything. See everything. Export anywhere.

A beautiful, privacy-first Android app for tracking your daily habits, nutrition, workouts, and anything else that matters — with rich charts, streak tracking, reminders, and CSV export. No accounts. No cloud. Your data stays on your device.

---

## Screenshots

| Today                                            | Charts                                      | History                                      | Settings                               |
| ------------------------------------------------ | ------------------------------------------- | -------------------------------------------- | -------------------------------------- |
| Log entries with progress bars and streak badges | Line & bar charts with 7D / 30D / 90D views | Entries grouped by date with swipe to delete | Manage trackers, reminders, and export |

---

## Features

- **Track anything** — create custom trackers for nutrition (protein, carbs, water), habits (gym, reading, meditation), or any numeric metric with your own unit and daily goal
- **Boolean & numeric modes** — toggle-style trackers for done/not-done habits, or numeric ones with cumulative totals
- **Progress at a glance** — today's cards show colored progress bars and per-tracker totals
- **🔥 Streak tracking** — consecutive day streaks shown per tracker to keep you motivated
- **Rich charts** — smooth line charts for numeric trackers, bar charts for boolean ones, with 7D / 30D / 90D period selector and key stats (avg, peak, success rate)
- **Full history** — all entries grouped by date, with delete support
- **Daily reminders** — per-tracker notification scheduling with a custom time picker, no internet required
- **CSV export** — export all your data as a CSV file and share it anywhere
- **100% offline** — SQLite on-device storage, zero network requests, zero accounts

---

## Tech Stack

| Layer         | Technology                                  |
| ------------- | ------------------------------------------- |
| Framework     | React Native + Expo (managed workflow)      |
| Language      | TypeScript                                  |
| Database      | expo-sqlite (sync API)                      |
| Navigation    | React Navigation (bottom tabs)              |
| Charts        | react-native-chart-kit                      |
| Notifications | expo-notifications                          |
| Icons         | MaterialCommunityIcons (@expo/vector-icons) |
| Date utils    | date-fns                                    |
| Storage       | @react-native-async-storage/async-storage   |

---

## Getting Started

### Prerequisites

- Node.js 18+
- [Expo Go](https://expo.dev/go) on your Android device, or Android Studio for a native build

### Install

```bash
git clone https://github.com/yourusername/trackit.git
cd trackit
npm install
```

### Run (Expo Go)

```bash
npx expo start
```

Scan the QR code with Expo Go on your Android device.

### Local Android dev build (Android Studio required)

If needed, point to your SDK explicitly:

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
```

```bash
# Build + install debug app on connected device/emulator
npm run android:dev

# Build debug APK only
npm run android:assemble:debug
```

### Local Android release build (signed, no EAS)

0. Setup env:

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
```

1. Create or reuse a keystore:

```bash
keytool -genkeypair -v \
  -keystore trackit-release.jks \
  -alias trackit-release \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

2. Set non-secret signing vars:

```bash
export ANDROID_KEYSTORE_PATH="trackit-release.jks"
export ANDROID_KEY_ALIAS="trackit-release"
```

3. Assemble and install release build:

```bash
npm run android:assemble:release

# adb shell pm list packages | grep trackit
# adb uninstall com.anonymous.trackit

adb install -r android/app/build/outputs/apk/release/app-release.apk
```

`npm run android:assemble:release` and `npm run android:bundle:release` prompt for keystore/key passwords with hidden input.
You can optionally provide them via `ANDROID_KEYSTORE_PASSWORD` and `ANDROID_KEY_PASSWORD`.

4. Build signed artifacts locally:

```bash
export ANDROID_KEYSTORE_PATH="trackit-release.jks"
export ANDROID_KEY_ALIAS="trackit-release"

# Play Store artifact (.aab)
npm run android:bundle:release

# Optional installable release APK
npm run android:assemble:release
```

Artifacts:

- `android/app/build/outputs/bundle/release/app-release.aab`
- `android/app/build/outputs/apk/release/app-release.apk`

---

## Project Structure

```
src/
├── db/
│   ├── database.ts        # SQLite init, seed data
│   ├── trackers.ts        # Tracker CRUD
│   └── entries.ts         # Entry CRUD, aggregation, streaks
├── screens/
│   ├── TodayScreen.tsx    # Main logging screen
│   ├── ChartsScreen.tsx   # Charts + stats
│   ├── HistoryScreen.tsx  # Date-grouped entry history
│   └── SettingsScreen.tsx # Tracker management, export, reminders
├── components/
│   └── RemindersModal.tsx # Per-tracker notification UI
├── navigation/
│   └── AppNavigator.tsx   # Bottom tab navigator
├── utils/
│   └── notifications.ts   # Schedule/cancel/sync notifications
└── theme/
    └── index.ts           # Colors, spacing, typography
```

---

## Data Model

```sql
-- Tracker definitions
CREATE TABLE tracker_types (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  unit        TEXT NOT NULL,
  color       TEXT NOT NULL,   -- hex color
  icon        TEXT NOT NULL,   -- MaterialCommunityIcons name
  daily_goal  REAL,
  is_boolean  INTEGER DEFAULT 0
);

-- Log entries
CREATE TABLE entries (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  tracker_id  INTEGER NOT NULL REFERENCES tracker_types(id) ON DELETE CASCADE,
  value       REAL NOT NULL,
  date        TEXT NOT NULL,   -- yyyy-MM-dd
  note        TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);
```

---

## Default Trackers

The app seeds 5 trackers on first launch as a starting point:

| Tracker | Unit    | Goal  | Type    |
| ------- | ------- | ----- | ------- |
| Protein | g       | 150   | Numeric |
| Carbs   | g       | 250   | Numeric |
| Water   | ml      | 2500  | Numeric |
| Gym     | session | 1     | Boolean |
| Steps   | steps   | 10000 | Numeric |

All of these can be edited or deleted, and you can create as many custom trackers as you want.

---

## Testing

The project has rigorous test coverage across all core layers.

```bash
# Run all tests
npm test

# With coverage report
npm run test:coverage

# Watch mode during development
npm run test:watch
```

### Test coverage

| Area            | File                                            | Tests                                                                                                         |
| --------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Tracker CRUD    | `src/db/__tests__/trackers.test.ts`             | getAllTrackers, createTracker, updateTracker, deleteTracker                                                   |
| Entry logic     | `src/db/__tests__/entries.test.ts`              | addEntry, getDailyTotals, getAggregatedByDay, deleteEntry, exportAllData, getStreak (including gap detection) |
| Notifications   | `src/utils/__tests__/notifications.test.ts`     | requestPermissions, loadReminders, saveReminders, scheduleReminder, cancelReminder, syncReminders             |
| Today screen    | `src/screens/__tests__/TodayScreen.test.tsx`    | Rendering, card display, log modal, validation, streak badge                                                  |
| Settings screen | `src/screens/__tests__/SettingsScreen.test.tsx` | Tracker list, create, edit, validate, export CSV                                                              |

**41 tests, 0 failures.**

---

## Roadmap

- [ ] Swipe to delete entries in History
- [ ] Haptic feedback on logging
- [ ] Empty state illustrations
- [ ] Multiple entries per day expandable view on Today screen
- [ ] Custom date logging (log for yesterday)
- [ ] Weekly summary comparison card
- [ ] App icon + splash screen
- [ ] Signed release APK / Play Store submission

See [`TODO.md`](./TODO.md) for detailed implementation notes for each item.

---

## Privacy

TrackIt stores all data locally on your device using SQLite. It makes no network requests, requires no account, and never transmits any data anywhere. The only permissions requested are notification permissions (optional, for reminders).

---

## License

MIT © 2026
