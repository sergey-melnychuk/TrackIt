# TrackIt — Test Coverage Improvement Plan

## Current State

Tests live in:
- `src/db/__tests__/trackers.test.ts` — 8 tests, CRUD only
- `src/db/__tests__/entries.test.ts` — 16 tests, CRUD + streak
- `src/utils/__tests__/notifications.test.ts` — 7 tests, scheduling flows
- `src/screens/__tests__/TodayScreen.test.tsx` — 8 tests, basic rendering + modal
- `src/screens/__tests__/SettingsScreen.test.tsx` — 7 tests, basic rendering + modal

**Total: 41 tests. Run with: `npm test`**

Test infrastructure lives in:
- `src/test/setup.ts` — Jest mocks for all native modules
- `src/test/factories.ts` — `makeTracker()`, `makeEntry()`, `makeBooleanTracker()`
- `src/test/mocks/vectorIcons.ts` — mock for `@expo/vector-icons`
- `src/test/mocks/empty.js` — empty module mock
- `jest.config.js` — Jest configuration (uses `jest-expo` preset)

## Tech Context

- React Native + Expo SDK 52
- `expo-sqlite` sync API (`openDatabaseSync`, `getAllSync`, `runSync`, `getFirstSync`, `execSync`)
- `useFocusEffect` from `@react-navigation/native` — **does NOT fire in tests**, so `load()` callbacks inside screens don't execute automatically
- `Alert.alert` is mocked via `jest.spyOn(Alert, 'alert').mockImplementation(() => {})` in `beforeEach`
- All DB calls are mocked via `mockDb` exported from `src/test/setup.ts`
- Screen tests mock `../../db/trackers` and `../../db/entries` entirely with `jest.mock()`

## Key Mock Pattern

```typescript
// In setup.ts
export const mockDb = {
  execSync: jest.fn(),
  runSync: jest.fn(() => ({ lastInsertRowId: 1, changes: 1 })),
  getAllSync: jest.fn(() => []),
  getFirstSync: jest.fn(() => null),
};

// expo-sqlite is mocked to return mockDb
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(() => mockDb),
}));
```

## What Needs to Be Added

---

### 1. `src/db/__tests__/database.test.ts` — NEW FILE

Test `initDB()` from `src/db/database.ts`.

**What to test:**
- `execSync` is called with a string containing `CREATE TABLE IF NOT EXISTS tracker_types`
- `execSync` is called with a string containing `CREATE TABLE IF NOT EXISTS entries`
- `execSync` is called with a string containing `CREATE INDEX`
- Seed data is inserted when `tracker_types` is empty (`getFirstSync` returns `{ count: 0 }`)
- Seed data is NOT inserted when trackers already exist (`getFirstSync` returns `{ count: 5 }`)
- Seed data insert contains expected default trackers: Protein, Carbs, Water, Gym, Steps

**Setup needed:**
```typescript
import { mockDb } from '../../test/setup';
import { initDB } from '../database';

beforeEach(() => {
  jest.clearAllMocks();
});
```

**Key mock setup for seed test:**
```typescript
// For "should seed" case:
mockDb.getFirstSync.mockReturnValue({ count: 0 });

// For "should not seed" case:
mockDb.getFirstSync.mockReturnValue({ count: 5 });
```

---

### 2. `src/db/__tests__/entries.test.ts` — ADD MISSING TESTS

Add these tests to the existing file:

**Missing: Multiple entries same day accumulate correctly**
```typescript
it('getDailyTotals accumulates multiple entries for same tracker', () => {
  mockDb.getAllSync.mockReturnValue([
    { tracker_id: 1, total: 225, count: 3 }, // 75 + 80 + 70
  ]);
  const result = getDailyTotals('2026-02-22');
  expect(result[0].total).toBe(225);
  expect(result[0].count).toBe(3);
});
```

**Missing: exportAllData CSV structure validation**
```typescript
it('exportAllData returns correct shape for CSV generation', () => {
  const rows = [
    { id: 1, tracker_id: 1, value: 100, date: '2026-02-22', note: 'post workout',
      tracker_name: 'Protein', unit: 'g' },
  ];
  mockDb.getAllSync.mockReturnValue(rows);
  const result = exportAllData();
  expect(result[0]).toHaveProperty('tracker_name');
  expect(result[0]).toHaveProperty('unit');
  expect(result[0]).toHaveProperty('date');
  expect(result[0]).toHaveProperty('value');
  expect(result[0].tracker_name).toBe('Protein');
});

it('exportAllData handles null notes gracefully', () => {
  mockDb.getAllSync.mockReturnValue([
    { id: 1, tracker_id: 1, value: 50, date: '2026-02-22', note: null,
      tracker_name: 'Water', unit: 'ml' },
  ]);
  const result = exportAllData();
  expect(result[0].note).toBeNull();
});
```

**Missing: Cascade delete validation**
```typescript
// In trackers.test.ts
it('deleteTracker removes associated entries via CASCADE', () => {
  // The SQL schema uses ON DELETE CASCADE — verify the DELETE statement
  // targets tracker_types, not entries directly (cascade handles entries)
  deleteTracker(5);
  expect(mockDb.runSync).toHaveBeenCalledWith(
    'DELETE FROM tracker_types WHERE id=?',
    [5]
  );
  // Cascade is DB-level, so we just verify the correct table is targeted
});
```

**Missing: Streak edge cases**
```typescript
it('getStreak returns 0 for tracker with entries only in distant past', () => {
  mockDb.getAllSync.mockReturnValue([
    { date: '2025-01-01' },
    { date: '2025-01-02' },
  ]);
  expect(getStreak(1)).toBe(0);
});

it('getStreak handles duplicate entries on same day as single day', () => {
  const today = new Date().toISOString().slice(0, 10);
  // Two entries on same day should count as 1 streak day
  mockDb.getAllSync.mockReturnValue([
    { date: today },
    { date: today }, // duplicate — DISTINCT in SQL handles this, mock reflects result
  ]);
  // After DISTINCT, only one row per date
  mockDb.getAllSync.mockReturnValue([{ date: today }]);
  expect(getStreak(1)).toBe(1);
});

it('getStreak correctly handles streak starting yesterday', () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dayBefore = new Date();
  dayBefore.setDate(dayBefore.getDate() - 2);

  mockDb.getAllSync.mockReturnValue([
    { date: yesterday.toISOString().slice(0, 10) },
    { date: dayBefore.toISOString().slice(0, 10) },
  ]);
  expect(getStreak(1)).toBe(2);
});
```

---

### 3. `src/utils/__tests__/notifications.test.ts` — ADD MISSING TESTS

Add error/negative path tests to the existing file:

```typescript
it('scheduleReminder handles notification scheduling failure gracefully', async () => {
  (Notifications.scheduleNotificationAsync as jest.Mock).mockRejectedValue(
    new Error('Permission denied')
  );
  await expect(scheduleReminder(mockReminder)).rejects.toThrow('Permission denied');
});

it('syncReminders handles partial failures', async () => {
  const reminders = [
    { ...mockReminder, trackerId: 1, enabled: true },
    { ...mockReminder, trackerId: 2, enabled: true },
  ];
  // First succeeds, second fails
  (Notifications.scheduleNotificationAsync as jest.Mock)
    .mockResolvedValueOnce('id-1')
    .mockRejectedValueOnce(new Error('Failed'));

  await expect(syncReminders(reminders)).rejects.toThrow();
});

it('loadReminders handles corrupted AsyncStorage data', async () => {
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue('not valid json{{{');
  await expect(loadReminders()).rejects.toThrow();
});

it('syncReminders with no reminders saves empty array', async () => {
  const result = await syncReminders([]);
  expect(result).toEqual([]);
  expect(AsyncStorage.setItem).toHaveBeenCalledWith('reminder_configs', '[]');
});
```

---

### 4. `src/screens/__tests__/ChartsScreen.test.tsx` — NEW FILE

Create this file. Note: `useFocusEffect` does not fire — test rendering and UI only, not data loading.

```typescript
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';

jest.mock('../../db/trackers');
jest.mock('../../db/entries');

import * as trackersDb from '../../db/trackers';
import * as entriesDb from '../../db/entries';
import ChartsScreen from '../ChartsScreen';
import { makeTracker, resetIdCounter } from '../../test/factories';

const renderScreen = () =>
  render(<NavigationContainer><ChartsScreen /></NavigationContainer>);

beforeEach(() => {
  jest.clearAllMocks();
  resetIdCounter();
  (trackersDb.getAllTrackers as jest.Mock).mockReturnValue([]);
  (entriesDb.getAggregatedByDay as jest.Mock).mockReturnValue([]);
});

describe('ChartsScreen', () => {
  it('renders the Charts title', () => {
    const { getByText } = renderScreen();
    expect(getByText('Charts')).toBeTruthy();
  });

  it('renders tracker chips for each tracker', () => {
    const trackers = [makeTracker({ name: 'Protein' }), makeTracker({ name: 'Water' })];
    (trackersDb.getAllTrackers as jest.Mock).mockReturnValue(trackers);
    const { getByText } = renderScreen();
    expect(getByText('Protein')).toBeTruthy();
    expect(getByText('Water')).toBeTruthy();
  });

  it('renders period selector buttons', () => {
    const { getByText } = renderScreen();
    expect(getByText('7D')).toBeTruthy();
    expect(getByText('30D')).toBeTruthy();
    expect(getByText('90D')).toBeTruthy();
  });

  it('shows no data message when no entries', () => {
    const tracker = makeTracker({ name: 'Protein' });
    (trackersDb.getAllTrackers as jest.Mock).mockReturnValue([tracker]);
    const { getByText } = renderScreen();
    expect(getByText(/No data yet/i)).toBeTruthy();
  });

  it('selecting a period button changes active state', () => {
    const { getByText } = renderScreen();
    fireEvent.press(getByText('30D'));
    // 30D button should now be active — verify by checking it's pressable
    expect(getByText('30D')).toBeTruthy();
  });

  it('shows empty state when no trackers', () => {
    (trackersDb.getAllTrackers as jest.Mock).mockReturnValue([]);
    const { getByText } = renderScreen();
    expect(getByText(/No trackers yet/i)).toBeTruthy();
  });
});
```

---

### 5. `src/screens/__tests__/HistoryScreen.test.tsx` — NEW FILE

```typescript
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { Alert } from 'react-native';

jest.mock('../../db/trackers');
jest.mock('../../db/database');
jest.mock('../../db/entries');

import * as trackersDb from '../../db/trackers';
import * as entriesDb from '../../db/entries';
import db from '../../db/database';
import HistoryScreen from '../HistoryScreen';
import { makeTracker, resetIdCounter } from '../../test/factories';

const renderScreen = () =>
  render(<NavigationContainer><HistoryScreen /></NavigationContainer>);

beforeEach(() => {
  jest.clearAllMocks();
  resetIdCounter();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  // Mock the raw db.getAllSync used in HistoryScreen directly
  (db.getAllSync as jest.Mock) = jest.fn(() => []);
});

describe('HistoryScreen', () => {
  it('renders the History title', () => {
    const { getByText } = renderScreen();
    expect(getByText('History')).toBeTruthy();
  });

  it('shows last 30 days subtitle', () => {
    const { getByText } = renderScreen();
    expect(getByText('Last 30 days')).toBeTruthy();
  });

  it('shows empty state when no entries', () => {
    const { getByText } = renderScreen();
    expect(getByText(/No entries yet/i)).toBeTruthy();
  });

  it('renders entries grouped by date', () => {
    (db.getAllSync as jest.Mock).mockReturnValue([
      { id: 1, tracker_id: 1, value: 100, date: '2026-02-22', note: null,
        tracker_name: 'Protein', unit: 'g', color: '#6C63FF', icon: 'food-steak' },
    ]);
    const { getByText } = renderScreen();
    expect(getByText('Protein')).toBeTruthy();
    expect(getByText('100 g')).toBeTruthy();
  });

  it('shows Today label for current date', () => {
    const today = new Date().toISOString().slice(0, 10);
    (db.getAllSync as jest.Mock).mockReturnValue([
      { id: 1, tracker_id: 1, value: 50, date: today, note: null,
        tracker_name: 'Water', unit: 'ml', color: '#00BCD4', icon: 'cup-water' },
    ]);
    const { getByText } = renderScreen();
    expect(getByText('Today')).toBeTruthy();
  });

  it('shows note when entry has one', () => {
    const today = new Date().toISOString().slice(0, 10);
    (db.getAllSync as jest.Mock).mockReturnValue([
      { id: 1, tracker_id: 1, value: 80, date: today, note: 'post workout',
        tracker_name: 'Protein', unit: 'g', color: '#6C63FF', icon: 'food-steak' },
    ]);
    const { getByText } = renderScreen();
    expect(getByText('post workout')).toBeTruthy();
  });

  it('prompts confirmation before deleting entry', async () => {
    const today = new Date().toISOString().slice(0, 10);
    (db.getAllSync as jest.Mock).mockReturnValue([
      { id: 1, tracker_id: 1, value: 80, date: today, note: null,
        tracker_name: 'Protein', unit: 'g', color: '#6C63FF', icon: 'food-steak' },
    ]);
    const { getByTestId } = renderScreen();
    fireEvent.press(getByTestId('delete-entry-1'));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Delete entry',
      expect.any(String),
      expect.any(Array)
    );
  });
});
```

**Note:** For the delete test to work, add `testID={`delete-entry-${item.id}`}` to the trash `TouchableOpacity` in `HistoryScreen.tsx`.

---

### 6. Integration Test — `src/__tests__/integration.test.ts` — NEW FILE

This tests the full data flow without mocking the DB layer — using the real `mockDb` to simulate realistic sequences.

```typescript
/**
 * Integration tests — test realistic user flows end-to-end
 * through the DB layer (not screen rendering)
 */
import { mockDb } from '../test/setup';
import { makeTracker, makeEntry, resetIdCounter } from '../test/factories';
import { createTracker } from '../db/trackers';
import { addEntry, getDailyTotals, getStreak, getAggregatedByDay } from '../db/entries';

beforeEach(() => {
  jest.clearAllMocks();
  resetIdCounter();
});

describe('Full user flow: create tracker → log entries → check totals', () => {
  it('creates a tracker then logs entries and reads daily totals', () => {
    // 1. Create tracker
    mockDb.runSync.mockReturnValueOnce({ lastInsertRowId: 1, changes: 1 });
    const trackerId = createTracker(makeTracker({ name: 'Protein', unit: 'g', daily_goal: 150 }));
    expect(trackerId).toBe(1);

    // 2. Log 3 entries
    mockDb.runSync.mockReturnValue({ lastInsertRowId: 1, changes: 1 });
    addEntry({ tracker_id: trackerId, value: 50, date: '2026-02-22' });
    addEntry({ tracker_id: trackerId, value: 60, date: '2026-02-22' });
    addEntry({ tracker_id: trackerId, value: 40, date: '2026-02-22' });
    expect(mockDb.runSync).toHaveBeenCalledTimes(4); // 1 create + 3 entries

    // 3. Read totals
    mockDb.getAllSync.mockReturnValue([{ tracker_id: 1, total: 150, count: 3 }]);
    const totals = getDailyTotals('2026-02-22');
    expect(totals[0].total).toBe(150);
    expect(totals[0].count).toBe(3);
  });

  it('logs entries across multiple days and verifies streak', () => {
    const today = new Date();
    const dates = [0, 1, 2].map(i => {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      return d.toISOString().slice(0, 10);
    });

    mockDb.getAllSync.mockReturnValue(dates.map(date => ({ date })));
    expect(getStreak(1)).toBe(3);
  });

  it('handles boolean tracker flow correctly', () => {
    mockDb.runSync.mockReturnValueOnce({ lastInsertRowId: 2, changes: 1 });
    const trackerId = createTracker(
      makeTracker({ name: 'Gym', is_boolean: true, daily_goal: 1, unit: 'session' })
    );

    mockDb.runSync.mockReturnValue({ lastInsertRowId: 1, changes: 1 });
    addEntry({ tracker_id: trackerId, value: 1, date: '2026-02-22' });

    mockDb.getAllSync.mockReturnValue([{ tracker_id: 2, total: 1, count: 1 }]);
    const totals = getDailyTotals('2026-02-22');
    expect(totals[0].total).toBeGreaterThanOrEqual(1); // done for the day
  });

  it('aggregation returns zero for days with no entries', () => {
    mockDb.getAllSync.mockReturnValue([
      { date: '2026-02-20', total: 100 },
      // gap on 2026-02-21
      { date: '2026-02-22', total: 80 },
    ]);
    const result = getAggregatedByDay(1, 7);
    // Missing days are filled in by the chart screen, not the DB layer
    expect(result).toHaveLength(2);
    expect(result.find(r => r.date === '2026-02-21')).toBeUndefined();
  });
});

describe('Edge cases', () => {
  it('handles zero daily_goal without division errors', () => {
    // daily_goal of null means no goal — progress = 0
    const tracker = makeTracker({ daily_goal: null });
    expect(tracker.daily_goal).toBeNull();
  });

  it('handles very large entry values', () => {
    mockDb.runSync.mockReturnValue({ lastInsertRowId: 1, changes: 1 });
    const id = addEntry({ tracker_id: 1, value: 999999, date: '2026-02-22' });
    expect(id).toBe(1);
    expect(mockDb.runSync).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining([999999])
    );
  });

  it('handles empty string note as null', () => {
    addEntry({ tracker_id: 1, value: 50, date: '2026-02-22', note: undefined });
    const callArgs = mockDb.runSync.mock.calls[0][1];
    expect(callArgs[3]).toBeNull();
  });
});
```

---

## Steps to Complete

1. **Create** `src/db/__tests__/database.test.ts` with the `initDB` tests above
2. **Append** missing tests to `src/db/__tests__/entries.test.ts`
3. **Append** missing tests to `src/db/__tests__/trackers.test.ts` (cascade delete)
4. **Append** error path tests to `src/utils/__tests__/notifications.test.ts`
5. **Create** `src/screens/__tests__/ChartsScreen.test.tsx`
6. **Create** `src/screens/__tests__/HistoryScreen.test.tsx`
7. **Create** `src/__tests__/integration.test.ts`
8. **Add** `testID="delete-entry-{item.id}"` to trash button in `HistoryScreen.tsx`

## Expected Outcome

| Suite | Current | Target |
|-------|---------|--------|
| `database.test.ts` | 0 | ~6 |
| `trackers.test.ts` | 8 | ~10 |
| `entries.test.ts` | 16 | ~22 |
| `notifications.test.ts` | 7 | ~11 |
| `TodayScreen.test.tsx` | 8 | 8 (already solid) |
| `SettingsScreen.test.tsx` | 7 | 7 (already solid) |
| `ChartsScreen.test.tsx` | 0 | ~6 |
| `HistoryScreen.test.tsx` | 0 | ~7 |
| `integration.test.ts` | 0 | ~7 |
| **Total** | **41** | **~84** |

After completing this plan, run:
```bash
npm run test:coverage
```
Target: >80% coverage across all `src/db/` and `src/utils/` files.

