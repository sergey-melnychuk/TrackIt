import { parseISO } from 'date-fns';

import db from './database';

export type Entry = {
  id: number;
  tracker_id: number;
  value: number;
  date: string;
  note?: string;
};

export type DailyTotal = {
  tracker_id: number;
  total: number;
  count: number;
};

export const addEntry = (e: Omit<Entry, 'id'>): number => {
  const result = db.runSync(
    `INSERT INTO entries (tracker_id, value, date, note) VALUES (?, ?, ?, ?)`,
    [e.tracker_id, e.value, e.date, e.note ?? null]
  );
  return result.lastInsertRowId;
};

export const getDailyTotals = (date: string): DailyTotal[] => {
  return db.getAllSync<DailyTotal>(
    `SELECT tracker_id, SUM(value) as total, COUNT(*) as count
     FROM entries WHERE date=? GROUP BY tracker_id`,
    [date]
  );
};

export const getEntriesForTracker = (trackerId: number, days: number = 30): Entry[] => {
  return db.getAllSync<Entry>(
    `SELECT * FROM entries WHERE tracker_id=?
     AND date >= date('now', ?)
     ORDER BY date ASC`,
    [trackerId, `-${days} days`]
  );
};

export const getAggregatedByDay = (trackerId: number, days: number = 30) => {
  return db.getAllSync<{ date: string; total: number }>(
    `SELECT date, SUM(value) as total FROM entries
     WHERE tracker_id=? AND date >= date('now', ?)
     GROUP BY date ORDER BY date ASC`,
    [trackerId, `-${days} days`]
  );
};

export const deleteEntry = (id: number) => {
  db.runSync('DELETE FROM entries WHERE id=?', [id]);
};

export const exportAllData = () => {
  return db.getAllSync<Entry & { tracker_name: string; unit: string }>(
    `SELECT e.*, t.name as tracker_name, t.unit
     FROM entries e JOIN tracker_types t ON e.tracker_id = t.id
     ORDER BY e.date DESC`
  );
};

export const getStreak = (trackerId: number): number => {
  const rows = db.getAllSync<{ date: string }>(
    `SELECT DISTINCT date FROM entries WHERE tracker_id=? ORDER BY date DESC`,
    [trackerId]
  );

  if (rows.length === 0) return 0;

  let streak = 0;
  let cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  for (const row of rows) {
    const d = parseISO(row.date);
    d.setHours(0, 0, 0, 0);
    const diff = Math.round((cursor.getTime() - d.getTime()) / 86400000);
    if (diff === 0 || diff === 1) {
      streak++;
      cursor = d;
    } else {
      break;
    }
  }

  return streak;
};
