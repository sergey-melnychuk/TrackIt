import { mockDb } from '../../test/setup';
import { makeEntry, makeTracker, resetIdCounter } from '../../test/factories';
import {
  addEntry, getDailyTotals, getEntriesForTracker,
  getAggregatedByDay, deleteEntry, exportAllData, getStreak,
} from '../entries';

beforeEach(() => {
  jest.clearAllMocks();
  resetIdCounter();
});

describe('addEntry', () => {
  it('inserts entry and returns new id', () => {
    mockDb.runSync.mockReturnValue({ lastInsertRowId: 7, changes: 1 });
    const entry = makeEntry({ tracker_id: 1, value: 75, date: '2026-02-22' });

    const id = addEntry(entry);

    expect(id).toBe(7);
    expect(mockDb.runSync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO entries'),
      expect.arrayContaining([1, 75, '2026-02-22'])
    );
  });

  it('passes note when provided', () => {
    addEntry(makeEntry({ note: 'post workout' }));
    const callArgs = mockDb.runSync.mock.calls[0][1];
    expect(callArgs).toContain('post workout');
  });

  it('passes null note when not provided', () => {
    addEntry(makeEntry({ note: undefined }));
    const callArgs = mockDb.runSync.mock.calls[0][1];
    expect(callArgs).toContain(null);
  });
});

describe('getDailyTotals', () => {
  it('returns totals grouped by tracker for given date', () => {
    const totals = [
      { tracker_id: 1, total: 150, count: 2 },
      { tracker_id: 2, total: 2000, count: 3 },
    ];
    mockDb.getAllSync.mockReturnValue(totals);

    const result = getDailyTotals('2026-02-22');

    expect(result).toEqual(totals);
    expect(mockDb.getAllSync).toHaveBeenCalledWith(
      expect.stringContaining('WHERE date=?'),
      ['2026-02-22']
    );
  });

  it('returns empty array when no entries for date', () => {
    mockDb.getAllSync.mockReturnValue([]);
    expect(getDailyTotals('2026-01-01')).toEqual([]);
  });
});

describe('getEntriesForTracker', () => {
  it('queries with correct tracker id and day range', () => {
    mockDb.getAllSync.mockReturnValue([]);
    getEntriesForTracker(3, 30);

    expect(mockDb.getAllSync).toHaveBeenCalledWith(
      expect.any(String),
      [3, '-30 days']
    );
  });

  it('defaults to 30 days', () => {
    mockDb.getAllSync.mockReturnValue([]);
    getEntriesForTracker(1);

    const callArgs = mockDb.getAllSync.mock.calls[0][1];
    expect(callArgs).toContain('-30 days');
  });
});

describe('getAggregatedByDay', () => {
  it('returns daily aggregated totals', () => {
    const agg = [
      { date: '2026-02-20', total: 100 },
      { date: '2026-02-21', total: 130 },
      { date: '2026-02-22', total: 90 },
    ];
    mockDb.getAllSync.mockReturnValue(agg);

    const result = getAggregatedByDay(1, 7);

    expect(result).toEqual(agg);
    expect(mockDb.getAllSync).toHaveBeenCalledWith(
      expect.stringContaining('GROUP BY date'),
      [1, '-7 days']
    );
  });
});

describe('deleteEntry', () => {
  it('deletes entry by id', () => {
    deleteEntry(99);
    expect(mockDb.runSync).toHaveBeenCalledWith(
      'DELETE FROM entries WHERE id=?',
      [99]
    );
  });
});

describe('exportAllData', () => {
  it('joins entries with tracker info', () => {
    mockDb.getAllSync.mockReturnValue([]);
    exportAllData();

    expect(mockDb.getAllSync).toHaveBeenCalledWith(
      expect.stringContaining('JOIN tracker_types')
    );
  });

  it('orders by date descending', () => {
    mockDb.getAllSync.mockReturnValue([]);
    exportAllData();

    expect(mockDb.getAllSync).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY e.date DESC')
    );
  });
});

describe('getStreak', () => {
  it('returns 0 when no entries', () => {
    mockDb.getAllSync.mockReturnValue([]);
    expect(getStreak(1)).toBe(0);
  });

  it('returns 1 for a single entry today', () => {
    const today = new Date().toISOString().slice(0, 10);
    mockDb.getAllSync.mockReturnValue([{ date: today }]);
    expect(getStreak(1)).toBe(1);
  });

  it('counts consecutive days correctly', () => {
    const today = new Date();
    const dates = [0, 1, 2, 3].map(i => {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      return { date: d.toISOString().slice(0, 10) };
    });
    mockDb.getAllSync.mockReturnValue(dates);
    expect(getStreak(1)).toBe(4);
  });

  it('stops streak at gap', () => {
    const today = new Date();
    const dates = [0, 1, 3, 4].map(i => { // gap at day 2
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      return { date: d.toISOString().slice(0, 10) };
    });
    mockDb.getAllSync.mockReturnValue(dates);
    expect(getStreak(1)).toBe(2);
  });

  it('counts streak starting from yesterday if nothing logged today', () => {
    const today = new Date();
    const dates = [1, 2, 3].map(i => {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      return { date: d.toISOString().slice(0, 10) };
    });
    mockDb.getAllSync.mockReturnValue(dates);
    expect(getStreak(1)).toBe(3);
  });
});

