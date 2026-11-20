import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  STAGES,
  PRIORITIES,
  FILTERS,
  MAX_TITLE_LENGTH,
  validateTaskInput,
  isValidTask,
  createTask,
  addTask,
  toggleTaskCompleted,
  getNextStage,
  advanceTaskStage,
  deleteTask,
  filterTasks,
  getProgressStats,
} from '../src/taskModel.js';

describe('taskModel constants', () => {
  it('defines the 6 pipeline stages in exact order', () => {
    assert.deepEqual(STAGES, ['Plan', 'Design', 'Build', 'Verify', 'Secure', 'Ship']);
  });

  it('defines priorities, filters, and max title length', () => {
    assert.deepEqual(PRIORITIES, ['Low', 'Medium', 'High']);
    assert.deepEqual(FILTERS, ['All', 'Active', 'Done']);
    assert.equal(MAX_TITLE_LENGTH, 80);
  });
});

describe('createTask & validation', () => {
  it('creates a valid task with defaults and trimmed title', () => {
    const task = createTask({
      title: '   Audit Firestore rules   ',
      stage: 'Secure',
      priority: 'High',
      id: 'task-1',
      createdAt: '2026-11-20T12:00:00.000Z',
    });

    assert.deepEqual(task, {
      id: 'task-1',
      title: 'Audit Firestore rules',
      stage: 'Secure',
      priority: 'High',
      completed: false,
      createdAt: '2026-11-20T12:00:00.000Z',
    });
    assert.equal(isValidTask(task), true);
  });

  it('uses Plan and Medium defaults when stage and priority are omitted', () => {
    const task = createTask({ title: 'Draft design spec' });
    assert.equal(task.stage, 'Plan');
    assert.equal(task.priority, 'Medium');
    assert.equal(task.completed, false);
    assert.ok(typeof task.id === 'string' && task.id.length > 0);
    assert.ok(!Number.isNaN(Date.parse(task.createdAt)));
  });

  it('accepts an exact 80-character title', () => {
    const title80 = 'A'.repeat(80);
    const task = createTask({ title: title80 });
    assert.equal(task.title.length, 80);
  });

  it('rejects empty or whitespace-only titles', () => {
    for (const invalidTitle of ['', '   ', '\t\n  ', null, undefined, 123]) {
      const result = validateTaskInput({ title: invalidTitle, stage: 'Plan', priority: 'Low' });
      assert.equal(result.valid, false);
      assert.match(result.error, /title/i);
      assert.throws(() => createTask({ title: invalidTitle }), /title/i);
    }
  });

  it('rejects titles exceeding 80 characters after trimming', () => {
    const title81 = 'x'.repeat(81);
    const result = validateTaskInput({ title: title81, stage: 'Build', priority: 'Medium' });
    assert.equal(result.valid, false);
    assert.match(result.error, /80/);
    assert.throws(() => createTask({ title: title81 }), /80/);
  });

  it('accepts a title that is 80 chars after trimming outer whitespace', () => {
    const padded = `   ${'b'.repeat(80)}   `;
    const task = createTask({ title: padded });
    assert.equal(task.title, 'b'.repeat(80));
  });

  it('rejects invalid stage values', () => {
    const result = validateTaskInput({ title: 'Valid', stage: 'Deploy', priority: 'Low' });
    assert.equal(result.valid, false);
    assert.match(result.error, /stage/i);
    assert.throws(() => createTask({ title: 'Valid', stage: 'Deploy' }), /stage/i);
  });

  it('rejects invalid priority values', () => {
    const result = validateTaskInput({ title: 'Valid', stage: 'Plan', priority: 'Urgent' });
    assert.equal(result.valid, false);
    assert.match(result.error, /priority/i);
    assert.throws(() => createTask({ title: 'Valid', priority: 'Urgent' }), /priority/i);
  });

  it('keeps XSS-like payload strings verbatim without mutation', () => {
    const payload = '<img src=x onerror=alert(1)>';
    const task = createTask({ title: payload, stage: 'Verify', priority: 'High' });
    assert.equal(task.title, payload);
  });
});

describe('task list operations (immutable)', () => {
  it('adds a new task to the front of the list without mutating original array', () => {
    const first = createTask({ title: 'First task', id: 't1' });
    const initial = [first];
    const next = addTask(initial, { title: 'Second task', stage: 'Build', priority: 'High', id: 't2' });

    assert.equal(initial.length, 1);
    assert.equal(next.length, 2);
    assert.equal(next[0].id, 't2');
    assert.equal(next[1].id, 't1');
  });

  it('toggles completion state for a task ID', () => {
    const tasks = [
      createTask({ title: 'Task A', id: 'a' }),
      createTask({ title: 'Task B', id: 'b' }),
    ];

    const toggledOnce = toggleTaskCompleted(tasks, 'a');
    assert.equal(tasks[0].completed, false);
    assert.equal(toggledOnce[0].completed, true);
    assert.equal(toggledOnce[1].completed, false);

    const toggledTwice = toggleTaskCompleted(toggledOnce, 'a');
    assert.equal(toggledTwice[0].completed, false);
  });

  it('advances pipeline stage through Plan -> Design -> Build -> Verify -> Secure -> Ship and no-ops past Ship', () => {
    let tasks = [createTask({ title: 'Pipeline item', stage: 'Plan', id: 'p1' })];

    const expectedSequence = ['Design', 'Build', 'Verify', 'Secure', 'Ship', 'Ship'];
    for (const expectedStage of expectedSequence) {
      tasks = advanceTaskStage(tasks, 'p1');
      assert.equal(tasks[0].stage, expectedStage);
    }

    assert.equal(getNextStage('Plan'), 'Design');
    assert.equal(getNextStage('Secure'), 'Ship');
    assert.equal(getNextStage('Ship'), null);
    assert.equal(getNextStage('Invalid'), null);
  });

  it('deletes a task by ID without affecting remaining tasks', () => {
    const tasks = [
      createTask({ title: 'Keep 1', id: '1' }),
      createTask({ title: 'Remove 2', id: '2' }),
      createTask({ title: 'Keep 3', id: '3' }),
    ];

    const remaining = deleteTask(tasks, '2');
    assert.equal(tasks.length, 3);
    assert.deepEqual(
      remaining.map((t) => t.id),
      ['1', '3']
    );
  });
});

describe('filterTasks & getProgressStats', () => {
  const sampleTasks = [
    { ...createTask({ title: 'Audit CSP headers', stage: 'Secure', priority: 'High', id: '1' }), completed: false },
    { ...createTask({ title: 'Build mobile UI', stage: 'Build', priority: 'Medium', id: '2' }), completed: true },
    { ...createTask({ title: 'Verify CLS at 375px', stage: 'Verify', priority: 'Low', id: '3' }), completed: false },
  ];

  it('filters by All, Active, and Done', () => {
    assert.equal(filterTasks(sampleTasks, { filter: 'All' }).length, 3);
    assert.deepEqual(
      filterTasks(sampleTasks, { filter: 'Active' }).map((t) => t.id),
      ['1', '3']
    );
    assert.deepEqual(
      filterTasks(sampleTasks, { filter: 'Done' }).map((t) => t.id),
      ['2']
    );
  });

  it('performs case-insensitive search combined with status filter', () => {
    assert.deepEqual(
      filterTasks(sampleTasks, { filter: 'All', query: '  csp ' }).map((t) => t.id),
      ['1']
    );
    assert.deepEqual(
      filterTasks(sampleTasks, { filter: 'Done', query: 'MOBILE' }).map((t) => t.id),
      ['2']
    );
    assert.deepEqual(filterTasks(sampleTasks, { filter: 'Active', query: 'MOBILE' }), []);
  });

  it('computes accurate progress stats including empty list', () => {
    assert.deepEqual(getProgressStats([]), {
      total: 0,
      completed: 0,
      active: 0,
      percent: 0,
    });

    assert.deepEqual(getProgressStats(sampleTasks), {
      total: 3,
      completed: 1,
      active: 2,
      percent: 33,
    });

    const allDone = sampleTasks.map((t) => ({ ...t, completed: true }));
    assert.deepEqual(getProgressStats(allDone), {
      total: 3,
      completed: 3,
      active: 0,
      percent: 100,
    });
  });
});
