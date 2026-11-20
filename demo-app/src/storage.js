import { isValidTask } from './taskModel.js';

export const STORAGE_KEY = 'sprint_pulse_tasks_v1';

function getDefaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function resolveStorage(injectedStorage) {
  if (injectedStorage === undefined) {
    return getDefaultStorage();
  }
  return injectedStorage;
}

function normalizeTask(item) {
  return {
    id: item.id.trim(),
    title: item.title.trim(),
    stage: item.stage,
    priority: item.priority,
    completed: item.completed,
    createdAt: item.createdAt,
  };
}

function tryPersist(storage, tasks) {
  if (!storage || typeof storage.setItem !== 'function') {
    return { ok: false, error: 'Storage is unavailable.' };
  }
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unable to save tasks to storage.',
    };
  }
}

export function loadTasks(injectedStorage) {
  const storage = resolveStorage(injectedStorage);
  if (!storage || typeof storage.getItem !== 'function') {
    return { tasks: [], recovered: false };
  }

  let raw;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { tasks: [], recovered: true };
  }

  if (raw === null || raw === undefined || raw === '') {
    return { tasks: [], recovered: false };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    tryPersist(storage, []);
    return { tasks: [], recovered: true };
  }

  if (!Array.isArray(parsed)) {
    tryPersist(storage, []);
    return { tasks: [], recovered: true };
  }

  const validTasks = [];
  let hadInvalidItems = false;

  for (const item of parsed) {
    if (isValidTask(item)) {
      validTasks.push(normalizeTask(item));
    } else {
      hadInvalidItems = true;
    }
  }

  if (hadInvalidItems) {
    tryPersist(storage, validTasks);
    return { tasks: validTasks, recovered: true };
  }

  return { tasks: validTasks, recovered: false };
}

export function saveTasks(tasks, injectedStorage) {
  const storage = resolveStorage(injectedStorage);
  const sanitized = Array.isArray(tasks)
    ? tasks.filter(isValidTask).map(normalizeTask)
    : [];
  return tryPersist(storage, sanitized);
}
