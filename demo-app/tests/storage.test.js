import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createTask } from '../src/taskModel.js';
import { STORAGE_KEY, loadTasks, saveTasks } from '../src/storage.js';

function createMemoryStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

describe('storage persistence', () => {
  it('returns empty tasks without recovery when storage is empty', () => {
    const storage = createMemoryStorage();
    const result = loadTasks(storage);
    assert.deepEqual(result, { tasks: [], recovered: false });
  });

  it('saves and loads valid tasks faithfully', () => {
    const storage = createMemoryStorage();
    const tasks = [
      createTask({
        id: 't1',
        title: 'Write storage tests',
        stage: 'Build',
        priority: 'High',
        createdAt: '2026-11-20T10:00:00.000Z',
      }),
      {
        ...createTask({
          id: 't2',
          title: '<script>alert(1)</script>',
          stage: 'Verify',
          priority: 'Low',
          createdAt: '2026-11-20T10:05:00.000Z',
        }),
        completed: true,
      },
    ];

    const saveResult = saveTasks(tasks, storage);
    assert.equal(saveResult.ok, true);

    const loaded = loadTasks(storage);
    assert.equal(loaded.recovered, false);
    assert.deepEqual(loaded.tasks, tasks);
  });

  it('recovers gracefully from malformed JSON and resets storage', () => {
    const storage = createMemoryStorage({
      [STORAGE_KEY]: '{not valid json[[[',
    });

    const loaded = loadTasks(storage);
    assert.deepEqual(loaded, { tasks: [], recovered: true });
    assert.equal(storage.getItem(STORAGE_KEY), '[]');
  });

  it('recovers gracefully when stored JSON is not an array', () => {
    const storage = createMemoryStorage({
      [STORAGE_KEY]: JSON.stringify({ tasks: [] }),
    });

    const loaded = loadTasks(storage);
    assert.deepEqual(loaded, { tasks: [], recovered: true });
    assert.equal(storage.getItem(STORAGE_KEY), '[]');
  });

  it('filters out invalid schema items, strips unknown keys, and flags recovered: true', () => {
    const validItem = {
      id: 'ok-1',
      title: '  Valid stored task  ',
      stage: 'Design',
      priority: 'Medium',
      completed: false,
      createdAt: '2026-11-20T11:00:00.000Z',
      extraMaliciousKey: 'ignored',
    };
    const invalidStage = {
      id: 'bad-1',
      title: 'Bad stage',
      stage: 'UnknownStage',
      priority: 'Low',
      completed: false,
      createdAt: '2026-11-20T11:00:00.000Z',
    };
    const tooLongTitle = {
      id: 'bad-2',
      title: 'z'.repeat(81),
      stage: 'Plan',
      priority: 'High',
      completed: false,
      createdAt: '2026-11-20T11:00:00.000Z',
    };
    const missingBool = {
      id: 'bad-3',
      title: 'Wrong completed type',
      stage: 'Plan',
      priority: 'High',
      completed: 'yes',
      createdAt: '2026-11-20T11:00:00.000Z',
    };

    const storage = createMemoryStorage({
      [STORAGE_KEY]: JSON.stringify([validItem, invalidStage, tooLongTitle, missingBool, null]),
    });

    const loaded = loadTasks(storage);
    assert.equal(loaded.recovered, true);
    assert.equal(loaded.tasks.length, 1);
    assert.deepEqual(loaded.tasks[0], {
      id: 'ok-1',
      title: 'Valid stored task',
      stage: 'Design',
      priority: 'Medium',
      completed: false,
      createdAt: '2026-11-20T11:00:00.000Z',
    });
    assert.equal('extraMaliciousKey' in loaded.tasks[0], false);
  });

  it('handles storage quota and access exceptions without throwing', () => {
    const throwingStorage = {
      getItem() {
        throw new Error('SecurityError: storage disabled');
      },
      setItem() {
        throw new Error('QuotaExceededError: storage full');
      },
    };

    const loadResult = loadTasks(throwingStorage);
    assert.deepEqual(loadResult, { tasks: [], recovered: true });

    const saveResult = saveTasks(
      [createTask({ id: 't1', title: 'Task 1' })],
      throwingStorage
    );
    assert.equal(saveResult.ok, false);
    assert.match(saveResult.error, /QuotaExceededError/i);
  });

  it('handles null/unavailable storage gracefully', () => {
    assert.deepEqual(loadTasks(null), { tasks: [], recovered: false });
    const saveResult = saveTasks([], null);
    assert.equal(saveResult.ok, false);
  });
});
