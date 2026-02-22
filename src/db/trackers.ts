import db from './database';

export type Tracker = {
  id: number;
  name: string;
  unit: string;
  color: string;
  icon: string;
  daily_goal: number | null;
  is_boolean: boolean;
};

export const getAllTrackers = (): Tracker[] => {
  return db.getAllSync<Tracker>('SELECT * FROM tracker_types ORDER BY name ASC');
};

export const createTracker = (t: Omit<Tracker, 'id'>): number => {
  const result = db.runSync(
    `INSERT INTO tracker_types (name, unit, color, icon, daily_goal, is_boolean)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [t.name, t.unit, t.color, t.icon, t.daily_goal ?? null, t.is_boolean ? 1 : 0]
  );
  return result.lastInsertRowId;
};

export const updateTracker = (id: number, t: Partial<Omit<Tracker, 'id'>>) => {
  db.runSync(
    `UPDATE tracker_types SET name=?, unit=?, color=?, icon=?, daily_goal=?, is_boolean=? WHERE id=?`,
    [t.name!, t.unit!, t.color!, t.icon!, t.daily_goal ?? null, t.is_boolean ? 1 : 0, id]
  );
};

export const deleteTracker = (id: number) => {
  db.runSync('DELETE FROM tracker_types WHERE id=?', [id]);
};

