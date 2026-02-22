import { Tracker } from '../db/trackers';
import { Entry } from '../db/entries';

let idCounter = 1;

export const makeTracker = (overrides: Partial<Tracker> = {}): Tracker => ({
  id: idCounter++,
  name: 'Test Tracker',
  unit: 'g',
  color: '#6C63FF',
  icon: 'dumbbell',
  daily_goal: 100,
  is_boolean: false,
  ...overrides,
});

export const makeBooleanTracker = (overrides: Partial<Tracker> = {}): Tracker =>
  makeTracker({ unit: 'session', is_boolean: true, daily_goal: 1, ...overrides });

export const makeEntry = (overrides: Partial<Entry> = {}): Entry => ({
  id: idCounter++,
  tracker_id: 1,
  value: 50,
  date: '2026-02-22',
  note: undefined,
  ...overrides,
});

export const resetIdCounter = () => { idCounter = 1; };

