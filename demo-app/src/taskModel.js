export const STAGES = Object.freeze(['Plan', 'Design', 'Build', 'Verify', 'Secure', 'Ship']);
export const PRIORITIES = Object.freeze(['Low', 'Medium', 'High']);
export const FILTERS = Object.freeze(['All', 'Active', 'Done']);
export const MAX_TITLE_LENGTH = 80;
export const MAX_ID_LENGTH = 128;

const STAGE_SET = new Set(STAGES);
const PRIORITY_SET = new Set(PRIORITIES);
const FILTER_SET = new Set(FILTERS);

function generateTaskId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function validateTaskInput({ title, stage = 'Plan', priority = 'Medium' } = {}) {
  if (typeof title !== 'string') {
    return { valid: false, error: 'Task title is required.' };
  }

  const trimmedTitle = title.trim();
  if (trimmedTitle.length === 0) {
    return { valid: false, error: 'Task title cannot be empty.' };
  }

  if (trimmedTitle.length > MAX_TITLE_LENGTH) {
    return {
      valid: false,
      error: `Task title must be ${MAX_TITLE_LENGTH} characters or fewer.`,
    };
  }

  if (typeof stage !== 'string' || !STAGE_SET.has(stage)) {
    return { valid: false, error: `Invalid pipeline stage: ${String(stage)}.` };
  }

  if (typeof priority !== 'string' || !PRIORITY_SET.has(priority)) {
    return { valid: false, error: `Invalid priority level: ${String(priority)}.` };
  }

  return {
    valid: true,
    value: {
      title: trimmedTitle,
      stage,
      priority,
    },
  };
}

export function isValidTask(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return false;
  }

  const { id, title, stage, priority, completed, createdAt } = candidate;

  if (typeof id !== 'string' || id.trim().length === 0 || id.length > MAX_ID_LENGTH) {
    return false;
  }

  if (typeof title !== 'string') {
    return false;
  }
  const trimmedTitle = title.trim();
  if (trimmedTitle.length === 0 || trimmedTitle.length > MAX_TITLE_LENGTH) {
    return false;
  }

  if (typeof stage !== 'string' || !STAGE_SET.has(stage)) {
    return false;
  }

  if (typeof priority !== 'string' || !PRIORITY_SET.has(priority)) {
    return false;
  }

  if (typeof completed !== 'boolean') {
    return false;
  }

  if (typeof createdAt !== 'string' || Number.isNaN(Date.parse(createdAt))) {
    return false;
  }

  return true;
}

export function createTask({
  title,
  stage = 'Plan',
  priority = 'Medium',
  id,
  createdAt,
} = {}) {
  const validation = validateTaskInput({ title, stage, priority });
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  let taskId;
  if (typeof id === 'string' && id.trim().length > 0) {
    const trimmedId = id.trim();
    if (trimmedId.length > MAX_ID_LENGTH) {
      throw new Error(`Task id must be ${MAX_ID_LENGTH} characters or fewer.`);
    }
    taskId = trimmedId;
  } else {
    taskId = generateTaskId();
  }
  const timestamp =
    typeof createdAt === 'string' && !Number.isNaN(Date.parse(createdAt))
      ? createdAt
      : new Date().toISOString();

  return {
    id: taskId,
    title: validation.value.title,
    stage: validation.value.stage,
    priority: validation.value.priority,
    completed: false,
    createdAt: timestamp,
  };
}

export function addTask(tasks, input) {
  const task = createTask(input);
  return [task, ...tasks];
}

export function toggleTaskCompleted(tasks, taskId) {
  return tasks.map((task) =>
    task.id === taskId ? { ...task, completed: !task.completed } : task
  );
}

export function getNextStage(stage) {
  const idx = STAGES.indexOf(stage);
  if (idx === -1 || idx >= STAGES.length - 1) {
    return null;
  }
  return STAGES[idx + 1];
}

export function advanceTaskStage(tasks, taskId) {
  return tasks.map((task) => {
    if (task.id !== taskId) return task;
    const nextStage = getNextStage(task.stage);
    if (!nextStage) return task;
    return { ...task, stage: nextStage };
  });
}

export function deleteTask(tasks, taskId) {
  return tasks.filter((task) => task.id !== taskId);
}

export function filterTasks(tasks, { filter = 'All', query = '' } = {}) {
  const activeFilter = FILTER_SET.has(filter) ? filter : 'All';
  const normalizedQuery = typeof query === 'string' ? query.trim().toLowerCase() : '';

  return tasks.filter((task) => {
    if (activeFilter === 'Active' && task.completed) return false;
    if (activeFilter === 'Done' && !task.completed) return false;
    if (normalizedQuery.length > 0) {
      return task.title.toLowerCase().includes(normalizedQuery);
    }
    return true;
  });
}

export function getProgressStats(tasks) {
  const total = tasks.length;
  let completed = 0;
  for (const task of tasks) {
    if (task.completed) completed += 1;
  }
  const active = total - completed;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { total, completed, active, percent };
}

export function formatEmptyStateCopy({ totalTasks = 0, filter = 'All', query = '' } = {}) {
  if (totalTasks === 0) {
    return {
      heading: 'No sprint tasks yet',
      body: 'Add your first pipeline item to start tracking progress from Plan to Ship.',
      actionLabel: 'Create First Task',
      actionType: 'focus-composer',
    };
  }

  const activeFilter = FILTER_SET.has(filter) ? filter : 'All';
  const trimmedQuery = typeof query === 'string' ? query.trim() : '';

  let body;
  if (trimmedQuery.length > 0) {
    body =
      activeFilter === 'All'
        ? `No tasks match "${trimmedQuery}".`
        : `No ${activeFilter.toLowerCase()} tasks match "${trimmedQuery}".`;
  } else {
    body =
      activeFilter === 'All'
        ? 'There are currently no tasks.'
        : `There are currently no ${activeFilter.toLowerCase()} tasks.`;
  }

  return {
    heading: 'No matching tasks',
    body,
    actionLabel: 'Reset Filters',
    actionType: 'reset-filters',
  };
}
