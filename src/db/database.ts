import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('trackit.db');

export const initDB = () => {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS tracker_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      unit TEXT NOT NULL,
      color TEXT NOT NULL,
      icon TEXT NOT NULL,
      daily_goal REAL,
      is_boolean INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tracker_id INTEGER NOT NULL,
      value REAL NOT NULL,
      date TEXT NOT NULL,
      note TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (tracker_id) REFERENCES tracker_types(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(date);
    CREATE INDEX IF NOT EXISTS idx_entries_tracker ON entries(tracker_id);
  `);

  // Seed default trackers only if table is empty
  const count = db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM tracker_types');
  if (count?.count === 0) {
    db.execSync(`
      INSERT INTO tracker_types (name, unit, color, icon, daily_goal, is_boolean) VALUES
        ('Protein', 'g', '#6C63FF', 'food-steak', 150, 0),
        ('Carbs', 'g', '#FF6584', 'bread-slice', 250, 0),
        ('Water', 'ml', '#00BCD4', 'cup-water', 2500, 0),
        ('Gym', 'session', '#4CAF50', 'dumbbell', 1, 1),
        ('Steps', 'steps', '#FF9800', 'walk', 10000, 0);
    `);
  }
};

export default db;