import { mockDb } from '../../test/setup';
import { makeTracker, resetIdCounter } from '../../test/factories';

// Import after mocks are set up
import { getAllTrackers, createTracker, updateTracker, deleteTracker } from '../trackers';

beforeEach(() => {
  jest.clearAllMocks();
  resetIdCounter();
});

describe('getAllTrackers', () => {
  it('returns all trackers from db', () => {
    const trackers = [makeTracker({ name: 'Protein' }), makeTracker({ name: 'Water' })];
    mockDb.getAllSync.mockReturnValue(trackers);

    const result = getAllTrackers();

    expect(mockDb.getAllSync).toHaveBeenCalledWith(
      'SELECT * FROM tracker_types ORDER BY name ASC'
    );
    expect(result).toEqual(trackers);
  });

  it('returns empty array when no trackers exist', () => {
    mockDb.getAllSync.mockReturnValue([]);
    expect(getAllTrackers()).toEqual([]);
  });
});

describe('createTracker', () => {
  it('inserts a tracker and returns the new id', () => {
    mockDb.runSync.mockReturnValue({ lastInsertRowId: 42, changes: 1 });
    const tracker = makeTracker({ name: 'Gym' });

    const id = createTracker(tracker);

    expect(id).toBe(42);
    expect(mockDb.runSync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO tracker_types'),
      expect.arrayContaining(['Gym'])
    );
  });

  it('passes null for missing daily_goal', () => {
    const tracker = makeTracker({ daily_goal: null });
    createTracker(tracker);

    const callArgs = mockDb.runSync.mock.calls[0][1];
    expect(callArgs).toContain(null);
  });

  it('stores is_boolean as 1 for boolean trackers', () => {
    const tracker = makeTracker({ is_boolean: true });
    createTracker(tracker);

    const callArgs = mockDb.runSync.mock.calls[0][1];
    expect(callArgs).toContain(1);
  });

  it('stores is_boolean as 0 for numeric trackers', () => {
    const tracker = makeTracker({ is_boolean: false });
    createTracker(tracker);

    const callArgs = mockDb.runSync.mock.calls[0][1];
    expect(callArgs).toContain(0);
  });
});

describe('updateTracker', () => {
  it('calls UPDATE with correct id', () => {
    const tracker = makeTracker({ id: 5, name: 'Updated' });
    updateTracker(5, tracker);

    expect(mockDb.runSync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE tracker_types'),
      expect.arrayContaining([5])
    );
  });
});

describe('deleteTracker', () => {
  it('deletes tracker by id', () => {
    deleteTracker(3);

    expect(mockDb.runSync).toHaveBeenCalledWith(
      'DELETE FROM tracker_types WHERE id=?',
      [3]
    );
  });
});

