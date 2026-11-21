import {
  MAX_TITLE_LENGTH,
  validateTaskInput,
  addTask,
  toggleTaskCompleted,
  getNextStage,
  advanceTaskStage,
  deleteTask,
  filterTasks,
  getProgressStats,
  formatEmptyStateCopy,
} from './taskModel.js';
import { loadTasks, saveTasks } from './storage.js';

const state = {
  tasks: [],
  filter: 'All',
  query: '',
};

// DOM References (resolved safely inside init() so importing app.js in non-DOM runtimes is safe)
let progressRatioEl = null;
let progressBarEl = null;
let progressFillEl = null;
let progressDetailEl = null;

let recoveryBannerEl = null;
let recoveryMessageEl = null;
let dismissRecoveryBtn = null;

let taskFormEl = null;
let titleInputEl = null;
let titleCounterEl = null;
let titleErrorEl = null;
let stageSelectEl = null;
let prioritySelectEl = null;

let filterButtons = [];
let countAllEl = null;
let countActiveEl = null;
let countDoneEl = null;

let searchInputEl = null;
let clearSearchBtn = null;

let srStatusEl = null;
let loadingSkeletonEl = null;
let emptyStateEl = null;
let emptyHeadingEl = null;
let emptyBodyEl = null;
let emptyActionBtn = null;
let taskListEl = null;

function cacheDomRefs() {
  if (typeof document === 'undefined') {
    return false;
  }

  progressRatioEl = document.getElementById('progress-ratio');
  progressBarEl = document.getElementById('progress-bar');
  progressFillEl = document.getElementById('progress-fill');
  progressDetailEl = document.getElementById('progress-detail');

  recoveryBannerEl = document.getElementById('recovery-banner');
  recoveryMessageEl = document.getElementById('recovery-message');
  dismissRecoveryBtn = document.getElementById('dismiss-recovery');

  taskFormEl = document.getElementById('task-form');
  titleInputEl = document.getElementById('task-title');
  titleCounterEl = document.getElementById('title-counter');
  titleErrorEl = document.getElementById('title-error');
  stageSelectEl = document.getElementById('task-stage');
  prioritySelectEl = document.getElementById('task-priority');

  filterButtons = Array.from(document.querySelectorAll('.filter-btn'));
  countAllEl = document.getElementById('count-all');
  countActiveEl = document.getElementById('count-active');
  countDoneEl = document.getElementById('count-done');

  searchInputEl = document.getElementById('task-search');
  clearSearchBtn = document.getElementById('clear-search');

  srStatusEl = document.getElementById('sr-status');
  loadingSkeletonEl = document.getElementById('loading-skeleton');
  emptyStateEl = document.getElementById('empty-state');
  emptyHeadingEl = document.getElementById('empty-state-heading');
  emptyBodyEl = document.getElementById('empty-state-body');
  emptyActionBtn = document.getElementById('empty-state-action');
  taskListEl = document.getElementById('task-list');

  const requiredElements = [
    progressRatioEl,
    progressBarEl,
    progressFillEl,
    progressDetailEl,
    recoveryBannerEl,
    recoveryMessageEl,
    dismissRecoveryBtn,
    taskFormEl,
    titleInputEl,
    titleCounterEl,
    titleErrorEl,
    stageSelectEl,
    prioritySelectEl,
    countAllEl,
    countActiveEl,
    countDoneEl,
    searchInputEl,
    clearSearchBtn,
    srStatusEl,
    loadingSkeletonEl,
    emptyStateEl,
    emptyHeadingEl,
    emptyBodyEl,
    emptyActionBtn,
    taskListEl,
  ];

  return requiredElements.every(Boolean) && filterButtons.length > 0;
}

function announce(message) {
  srStatusEl.textContent = '';
  // Force screen-reader live region re-announcement on identical consecutive messages
  queueMicrotask(() => {
    srStatusEl.textContent = message;
  });
}

function showBanner(message) {
  recoveryMessageEl.textContent = message;
  recoveryBannerEl.hidden = false;
}

function hideBanner() {
  recoveryBannerEl.hidden = true;
}

function persistState() {
  const result = saveTasks(state.tasks);
  if (!result.ok) {
    showBanner('Unable to save changes to local storage. Changes will remain in memory for this session.');
  }
}

function setTitleError(message) {
  if (message) {
    titleErrorEl.textContent = message;
    titleInputEl.setAttribute('aria-invalid', 'true');
  } else {
    titleErrorEl.textContent = '';
    titleInputEl.setAttribute('aria-invalid', 'false');
  }
}

function updateCharacterCounter() {
  const trimmedLen = titleInputEl.value.trim().length;
  titleCounterEl.textContent = `${trimmedLen} / ${MAX_TITLE_LENGTH}`;
  titleCounterEl.classList.toggle('is-over-limit', trimmedLen > MAX_TITLE_LENGTH);
}

function renderProgress() {
  const stats = getProgressStats(state.tasks);
  progressRatioEl.textContent = `${stats.completed} / ${stats.total} Done`;
  progressBarEl.setAttribute('aria-valuenow', String(stats.percent));
  progressFillEl.style.transform = `scaleX(${stats.percent / 100})`;
  progressDetailEl.textContent = `${stats.completed} of ${stats.total} complete • ${stats.percent}%`;

  countAllEl.textContent = `(${stats.total})`;
  countActiveEl.textContent = `(${stats.active})`;
  countDoneEl.textContent = `(${stats.completed})`;
}

function renderToolbar() {
  for (const btn of filterButtons) {
    const isSelected = btn.dataset.filter === state.filter;
    btn.setAttribute('aria-pressed', String(isSelected));
  }
  clearSearchBtn.hidden = state.query.length === 0;
}

function createTaskCardElement(task) {
  const li = document.createElement('li');
  li.className = task.completed ? 'task-card is-completed' : 'task-card';
  li.dataset.taskId = task.id;

  // Top Row: 44x44 Checkbox Hit Target + Title + Metadata Badges
  const topRow = document.createElement('div');
  topRow.className = 'task-top-row';

  const toggleLabel = document.createElement('label');
  toggleLabel.className = 'task-toggle-hit';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'task-checkbox';
  checkbox.checked = task.completed;
  checkbox.dataset.action = 'toggle';
  checkbox.dataset.taskId = task.id;
  checkbox.setAttribute(
    'aria-label',
    task.completed ? `Mark "${task.title}" as active` : `Mark "${task.title}" as complete`
  );
  toggleLabel.appendChild(checkbox);

  const mainCol = document.createElement('div');
  mainCol.className = 'task-main';

  const titleEl = document.createElement('p');
  titleEl.className = 'task-title';
  titleEl.textContent = task.title;

  const badgesRow = document.createElement('div');
  badgesRow.className = 'task-badges';

  const stageBadge = document.createElement('span');
  stageBadge.className = `badge badge-stage--${task.stage.toLowerCase()}`;
  stageBadge.textContent = task.stage;

  const priorityBadge = document.createElement('span');
  priorityBadge.className = `badge badge-priority--${task.priority.toLowerCase()}`;
  priorityBadge.textContent = `${task.priority} Priority`;

  badgesRow.append(stageBadge, priorityBadge);
  mainCol.append(titleEl, badgesRow);
  topRow.append(toggleLabel, mainCol);

  // Action Row: Advance Stage + Delete
  const actionsRow = document.createElement('div');
  actionsRow.className = 'task-actions';

  const nextStage = getNextStage(task.stage);
  const advanceBtn = document.createElement('button');
  advanceBtn.type = 'button';
  advanceBtn.className = 'btn btn-secondary btn-advance';
  advanceBtn.dataset.action = 'advance';
  advanceBtn.dataset.taskId = task.id;

  if (nextStage) {
    advanceBtn.textContent = `Advance → ${nextStage}`;
    advanceBtn.setAttribute('aria-label', `Advance "${task.title}" to ${nextStage}`);
  } else {
    advanceBtn.textContent = 'Stage: Shipped';
    advanceBtn.disabled = true;
    advanceBtn.setAttribute('aria-label', `"${task.title}" is at final stage Ship`);
  }

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'btn btn-danger-ghost btn-delete';
  deleteBtn.dataset.action = 'delete';
  deleteBtn.dataset.taskId = task.id;
  deleteBtn.textContent = 'Delete';
  deleteBtn.setAttribute('aria-label', `Delete "${task.title}"`);

  actionsRow.append(advanceBtn, deleteBtn);
  li.append(topRow, actionsRow);
  return li;
}

function renderTaskList() {
  const visibleTasks = filterTasks(state.tasks, {
    filter: state.filter,
    query: state.query,
  });

  taskListEl.replaceChildren();

  if (visibleTasks.length === 0) {
    emptyStateEl.hidden = false;
    taskListEl.hidden = true;

    const emptyCopy = formatEmptyStateCopy({
      totalTasks: state.tasks.length,
      filter: state.filter,
      query: state.query,
    });
    emptyHeadingEl.textContent = emptyCopy.heading;
    emptyBodyEl.textContent = emptyCopy.body;
    emptyActionBtn.textContent = emptyCopy.actionLabel;
    emptyActionBtn.dataset.emptyAction = emptyCopy.actionType;
    return;
  }

  emptyStateEl.hidden = true;
  taskListEl.hidden = false;

  const fragment = document.createDocumentFragment();
  for (const task of visibleTasks) {
    fragment.appendChild(createTaskCardElement(task));
  }
  taskListEl.appendChild(fragment);
}

function render() {
  renderProgress();
  renderToolbar();
  renderTaskList();
}

function resetFilters() {
  state.filter = 'All';
  state.query = '';
  searchInputEl.value = '';
  render();
  announce('Filters reset');
}

function handleFormSubmit(event) {
  event.preventDefault();

  const rawTitle = titleInputEl.value;
  const stage = stageSelectEl.value;
  const priority = prioritySelectEl.value;

  const validation = validateTaskInput({ title: rawTitle, stage, priority });
  if (!validation.valid) {
    setTitleError(validation.error);
    titleInputEl.focus();
    return;
  }

  state.tasks = addTask(state.tasks, validation.value);
  persistState();

  setTitleError('');
  titleInputEl.value = '';
  updateCharacterCounter();
  render();
  announce('Task added');
  titleInputEl.focus();
}

function focusTaskControl(taskId, action) {
  const candidates = taskListEl.querySelectorAll(`[data-action="${action}"]`);
  for (const el of candidates) {
    if (el instanceof HTMLElement && el.dataset.taskId === taskId && !el.hasAttribute('disabled')) {
      el.focus();
      return true;
    }
  }
  return false;
}

function handleTaskDelete(taskId) {
  const beforeVisible = filterTasks(state.tasks, {
    filter: state.filter,
    query: state.query,
  });
  const deletedIndex = beforeVisible.findIndex((t) => t.id === taskId);

  state.tasks = deleteTask(state.tasks, taskId);
  persistState();
  render();
  announce('Task deleted');

  // Keyboard focus management after deletion
  const afterVisible = filterTasks(state.tasks, {
    filter: state.filter,
    query: state.query,
  });

  if (afterVisible.length > 0) {
    const nextFocusIndex = Math.min(Math.max(deletedIndex, 0), afterVisible.length - 1);
    const targetId = afterVisible[nextFocusIndex].id;
    if (focusTaskControl(targetId, 'toggle')) {
      return;
    }
  }

  if (state.tasks.length > 0) {
    searchInputEl.focus();
  } else {
    titleInputEl.focus();
  }
}

function bindEvents() {
  taskFormEl.addEventListener('submit', handleFormSubmit);

  titleInputEl.addEventListener('input', () => {
    updateCharacterCounter();
    if (titleErrorEl.textContent) {
      const check = validateTaskInput({
        title: titleInputEl.value,
        stage: stageSelectEl.value,
        priority: prioritySelectEl.value,
      });
      if (check.valid) {
        setTitleError('');
      }
    }
  });

  dismissRecoveryBtn.addEventListener('click', () => {
    hideBanner();
    titleInputEl.focus();
  });

  for (const btn of filterButtons) {
    btn.addEventListener('click', () => {
      const nextFilter = btn.dataset.filter;
      if (nextFilter && nextFilter !== state.filter) {
        state.filter = nextFilter;
        render();
        announce(`Showing ${nextFilter.toLowerCase()} tasks`);
      }
    });
  }

  searchInputEl.addEventListener('input', () => {
    state.query = searchInputEl.value;
    render();
  });

  searchInputEl.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && searchInputEl.value.length > 0) {
      event.preventDefault();
      state.query = '';
      searchInputEl.value = '';
      render();
      announce('Search cleared');
      searchInputEl.focus();
    }
  });

  clearSearchBtn.addEventListener('click', () => {
    state.query = '';
    searchInputEl.value = '';
    render();
    announce('Search cleared');
    searchInputEl.focus();
  });

  emptyActionBtn.addEventListener('click', () => {
    if (emptyActionBtn.dataset.emptyAction === 'reset-filters') {
      resetFilters();
      searchInputEl.focus();
    } else {
      titleInputEl.focus();
    }
  });

  taskListEl.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.dataset.action !== 'toggle') return;

    const taskId = target.dataset.taskId;
    if (!taskId) return;

    state.tasks = toggleTaskCompleted(state.tasks, taskId);
    const updated = state.tasks.find((t) => t.id === taskId);
    persistState();
    render();
    announce(updated && updated.completed ? 'Marked complete' : 'Marked active');
    focusTaskControl(taskId, 'toggle');
  });

  taskListEl.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const actionBtn = target.closest('button[data-action]');
    if (!(actionBtn instanceof HTMLButtonElement)) return;

    const action = actionBtn.dataset.action;
    const taskId = actionBtn.dataset.taskId;
    if (!taskId) return;

    if (action === 'advance') {
      const current = state.tasks.find((t) => t.id === taskId);
      const nextStage = current ? getNextStage(current.stage) : null;
      if (!nextStage) return;

      state.tasks = advanceTaskStage(state.tasks, taskId);
      persistState();
      render();
      announce(`Moved to ${nextStage}`);
      if (!focusTaskControl(taskId, 'advance')) {
        focusTaskControl(taskId, 'toggle');
      }
    } else if (action === 'delete') {
      handleTaskDelete(taskId);
    }
  });
}

export function init() {
  if (!cacheDomRefs()) {
    return false;
  }

  const loaded = loadTasks();
  state.tasks = loaded.tasks;

  // Hide synchronous hydration skeleton cleanly
  loadingSkeletonEl.hidden = true;
  loadingSkeletonEl.setAttribute('aria-busy', 'false');

  if (loaded.recovered) {
    showBanner('Saved sprint data was corrupted and safely recovered.');
  }

  updateCharacterCounter();
  bindEvents();
  render();
  return true;
}

if (typeof document !== 'undefined' && document.getElementById('task-form')) {
  init();
}
