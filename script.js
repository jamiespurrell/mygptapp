const recordBtn = document.getElementById('recordBtn');
const stopBtn = document.getElementById('stopBtn');
const recordingStatus = document.getElementById('recordingStatus');
const audioPlayback = document.getElementById('audioPlayback');
const noteTitle = document.getElementById('noteTitle');
const noteInput = document.getElementById('noteInput');
const saveNoteBtn = document.getElementById('saveNoteBtn');
const discardNoteBtn = document.getElementById('discardNoteBtn');
const voiceNotesList = document.getElementById('voiceNotesList');
const noteViewControls = document.getElementById('noteViewControls');

const taskTitle = document.getElementById('taskTitle');
const taskDetails = document.getElementById('taskDetails');
const taskDue = document.getElementById('taskDue');
const taskUrgency = document.getElementById('taskUrgency');
const addTaskBtn = document.getElementById('addTaskBtn');
const taskList = document.getElementById('taskList');
const priorityChips = document.getElementById('priorityChips');
const taskViewControls = document.getElementById('taskViewControls');
const taskPageSize = document.getElementById('taskPageSize');
const taskPrevBtn = document.getElementById('taskPrevBtn');
const taskNextBtn = document.getElementById('taskNextBtn');
const taskPageInfo = document.getElementById('taskPageInfo');
const taskDateFrom = document.getElementById('taskDateFrom');
const taskDateTo = document.getElementById('taskDateTo');
const taskDateRangePicker = document.getElementById('taskDateRangePicker');
const taskCalendarBtn = taskDateRangePicker.querySelector('[data-range-target="task"]');

const dateRangeDialog = document.getElementById('dateRangeDialog');
const dialogDateFrom = document.getElementById('dialogDateFrom');
const dialogDateTo = document.getElementById('dialogDateTo');
const applyDateRangeBtn = document.getElementById('applyDateRangeBtn');

const notePageSize = document.getElementById('notePageSize');
const notePrevBtn = document.getElementById('notePrevBtn');
const noteNextBtn = document.getElementById('noteNextBtn');
const notePageInfo = document.getElementById('notePageInfo');
const noteDateFrom = document.getElementById('noteDateFrom');
const noteDateTo = document.getElementById('noteDateTo');
const noteDateRangePicker = document.getElementById('noteDateRangePicker');
const noteCalendarBtn = noteDateRangePicker.querySelector('[data-range-target="note"]');

const TASK_STORAGE_KEY = 'voice-notes-priority-tasks';
const NOTE_STORAGE_KEY = 'voice-note-items';
const DELETE_RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

let recorder;
let chunks = [];
let isRecording = false;
let latestRecordingDataUrl = '';
let selectedNoteForTask = null;
let currentTaskView = 'active';
let currentNoteView = 'active';
let taskPage = 1;
let notePage = 1;
let activeRangeTarget = null;

const tasks = JSON.parse(localStorage.getItem(TASK_STORAGE_KEY) || '[]');
const notes = JSON.parse(localStorage.getItem(NOTE_STORAGE_KEY) || '[]');

tasks.forEach((task) => {
  if (typeof task.archived !== 'boolean') task.archived = false;
  if (!task.deletedAt) task.deletedAt = null;
  if (!task.createdAt) task.createdAt = new Date().toISOString();
});

notes.forEach((note) => {
  if (typeof note.archived !== 'boolean') note.archived = false;
  if (!note.deletedAt) note.deletedAt = null;
  if (typeof note.taskCreated !== 'boolean') note.taskCreated = false;
});

purgeExpiredDeletedTasks();
purgeExpiredDeletedNotes();
localStorage.setItem(NOTE_STORAGE_KEY, JSON.stringify(notes));
renderNotes();
persistAndRenderTasks();
setRecordingButtons();
syncChipSelection();
syncTaskViewButtons();
syncNoteViewButtons();
syncTaskPaginationControls(1, 1);
syncNotePaginationControls(1, 1);

document.addEventListener('click', (event) => {
  if (event.target.closest('.item-menu')) return;
  closeAllMenus();
});

recordBtn.addEventListener('click', async () => {
  if (isRecording) return;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recorder = new MediaRecorder(stream);
    chunks = [];

    recorder.ondataavailable = (event) => chunks.push(event.data);
    recorder.onstop = async () => {
      const blob = new Blob(chunks, { type: 'audio/webm' });
      audioPlayback.src = URL.createObjectURL(blob);
      latestRecordingDataUrl = await blobToDataURL(blob);
      recordingStatus.textContent = 'Recording captured! Add a title or notes, then save.';
    };

    recorder.start();
    isRecording = true;
    setRecordingButtons();
    recordingStatus.textContent = 'Recording now...';
  } catch {
    recordingStatus.textContent = 'Microphone access denied.';
  }
});

stopBtn.addEventListener('click', () => {
  if (!isRecording || !recorder) return;
  recorder.stop();
  isRecording = false;
  setRecordingButtons();
});

saveNoteBtn.addEventListener('click', () => {
  if (!noteTitle.value.trim() && !noteInput.value.trim()) return;

  notes.unshift({
    id: crypto.randomUUID(),
    title: noteTitle.value.trim() || 'Untitled Note',
    content: noteInput.value.trim(),
    audioDataUrl: latestRecordingDataUrl,
    createdAt: new Date().toISOString(),
    archived: false,
    deletedAt: null,
    taskCreated: false,
  });

  persistNotes();
  clearNoteForm();
  renderNotes();
  recordingStatus.textContent = 'Voice note saved.';
});

discardNoteBtn.addEventListener('click', () => {
  clearNoteForm();
  recordingStatus.textContent = 'Draft discarded.';
});

addTaskBtn.addEventListener('click', () => {
  if (!taskTitle.value.trim()) return;

  let details = taskDetails.value.trim();
  let linkedNoteId = null;
  let linkedAudioUrl = '';

  if (selectedNoteForTask) {
    linkedNoteId = selectedNoteForTask.id;
    linkedAudioUrl = selectedNoteForTask.audioDataUrl || '';
    const linkedStamp = formatDateTime(selectedNoteForTask.createdAt);
    const linkedText = `Linked voice note captured ${linkedStamp}. Listen in the Voice Notes section.`;
    details = details ? `${details}\n\n${linkedText}` : linkedText;

    selectedNoteForTask.taskCreated = true;
    persistNotes();
    renderNotes();
  }

  tasks.push({
    id: crypto.randomUUID(),
    title: taskTitle.value.trim(),
    details,
    dueDate: taskDue.value,
    urgency: Number(taskUrgency.value),
    linkedNoteId,
    linkedAudioUrl,
    archived: false,
    deletedAt: null,
    createdAt: new Date().toISOString(),
    score: computePriorityScore(taskDue.value, Number(taskUrgency.value)),
  });

  taskTitle.value = '';
  taskDetails.value = '';
  taskDue.value = '';
  taskUrgency.value = '2';
  selectedNoteForTask = null;
  persistAndRenderTasks();
  syncChipSelection();
});

voiceNotesList.addEventListener('click', (event) => {
  const menuToggle = event.target.closest('[data-menu-toggle]');
  if (menuToggle) {
    const menuId = menuToggle.getAttribute('data-menu-toggle');
    toggleMenu(menuId);
    return;
  }

  const noteActionButton = event.target.closest('[data-note-action]');
  if (!noteActionButton) return;

  const noteId = noteActionButton.getAttribute('data-note-id');
  const action = noteActionButton.getAttribute('data-note-action');
  const note = notes.find((n) => n.id === noteId);
  if (!note) return;

  if (action === 'create-task') {
    if (note.taskCreated) return;
    selectedNoteForTask = note;
    taskTitle.value = note.title;
    taskDetails.value = note.content;
    taskTitle.focus();
    recordingStatus.textContent = 'Task fields populated from selected voice note.';
  } else if (action === 'archive') {
    note.archived = true;
    recordingStatus.textContent = 'Voice note archived.';
    persistNotes();
    renderNotes();
  } else if (action === 'delete') {
    note.deletedAt = new Date().toISOString();
    note.archived = false;
    recordingStatus.textContent = `Voice note moved to Deleted (auto-removes in ${DELETE_RETENTION_DAYS} days).`;
    persistNotes();
    renderNotes();
  } else if (action === 'restore') {
    note.archived = false;
    note.deletedAt = null;
    currentNoteView = 'active';
    recordingStatus.textContent = 'Voice note restored.';
    persistNotes();
    renderNotes();
  }

  closeAllMenus();
});

noteViewControls.addEventListener('click', (event) => {
  const button = event.target.closest('[data-note-view]');
  if (!button) return;

  currentNoteView = button.getAttribute('data-note-view');
  notePage = 1;
  syncNoteViewButtons();
  renderNotes();
});

priorityChips.addEventListener('click', (event) => {
  const chip = event.target.closest('[data-urgency]');
  if (!chip) return;

  taskUrgency.value = chip.getAttribute('data-urgency');
  recordingStatus.textContent = `Priority set to ${chip.textContent.trim()}.`;
  syncChipSelection();
});

taskUrgency.addEventListener('change', syncChipSelection);

taskPageSize.addEventListener('change', () => {
  taskPage = 1;
  renderTasks();
});

notePageSize.addEventListener('change', () => {
  notePage = 1;
  renderNotes();
});

noteDateFrom.addEventListener('change', () => {
  notePage = 1;
  renderNotes();
});

noteDateTo.addEventListener('change', () => {
  notePage = 1;
  renderNotes();
});

taskDateFrom.addEventListener('change', () => {
  taskPage = 1;
  renderTasks();
});

taskDateTo.addEventListener('change', () => {
  taskPage = 1;
  renderTasks();
});

noteCalendarBtn.addEventListener('click', () => {
  openRangeDialog('note');
});

taskCalendarBtn.addEventListener('click', () => {
  openRangeDialog('task');
});

applyDateRangeBtn.addEventListener('click', () => {
  if (!activeRangeTarget) return;

  if (activeRangeTarget === 'note') {
    noteDateFrom.value = dialogDateFrom.value;
    noteDateTo.value = dialogDateTo.value;
    notePage = 1;
    renderNotes();
  }

  if (activeRangeTarget === 'task') {
    taskDateFrom.value = dialogDateFrom.value;
    taskDateTo.value = dialogDateTo.value;
    taskPage = 1;
    renderTasks();
  }

  dateRangeDialog.close();
});

taskPrevBtn.addEventListener('click', () => {
  taskPage = Math.max(1, taskPage - 1);
  renderTasks();
});

taskNextBtn.addEventListener('click', () => {
  taskPage += 1;
  renderTasks();
});

notePrevBtn.addEventListener('click', () => {
  notePage = Math.max(1, notePage - 1);
  renderNotes();
});

noteNextBtn.addEventListener('click', () => {
  notePage += 1;
  renderNotes();
});

taskViewControls.addEventListener('click', (event) => {
  const viewButton = event.target.closest('[data-view]');
  if (!viewButton) return;

  currentTaskView = viewButton.getAttribute('data-view');
  taskPage = 1;
  syncTaskViewButtons();
  renderTasks();
});

taskList.addEventListener('click', (event) => {
  const menuToggle = event.target.closest('[data-menu-toggle]');
  if (menuToggle) {
    const menuId = menuToggle.getAttribute('data-menu-toggle');
    toggleMenu(menuId);
    return;
  }

  const actionButton = event.target.closest('[data-task-action]');
  if (!actionButton) return;

  const taskId = actionButton.getAttribute('data-task-id');
  const action = actionButton.getAttribute('data-task-action');
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return;

  if (action === 'archive') {
    task.archived = true;
    recordingStatus.textContent = 'Task archived.';
  } else if (action === 'restore') {
    task.archived = false;
    task.deletedAt = null;
    currentTaskView = 'active';
    recordingStatus.textContent = 'Task restored.';
  } else if (action === 'delete') {
    task.deletedAt = new Date().toISOString();
    task.archived = false;
    recordingStatus.textContent = `Task moved to Deleted (auto-removes in ${DELETE_RETENTION_DAYS} days).`;
  }

  persistAndRenderTasks();
  closeAllMenus();
});

function setRecordingButtons() {
  recordBtn.disabled = isRecording;
  stopBtn.disabled = !isRecording;
}

function clearNoteForm() {
  noteTitle.value = '';
  noteInput.value = '';
  audioPlayback.removeAttribute('src');
  latestRecordingDataUrl = '';
}

function blobToDataURL(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result || '');
    reader.readAsDataURL(blob);
  });
}

function computePriorityScore(dueDate, urgency) {
  let score = urgency * 30;
  if (!dueDate) return score;

  const today = new Date();
  const due = new Date(dueDate);
  const days = Math.ceil((due - today) / DAY_MS);

  if (days <= 0) score += 100;
  else if (days <= 1) score += 60;
  else if (days <= 3) score += 40;
  else if (days <= 7) score += 20;

  return score;
}

function purgeExpiredDeletedTasks() {
  const now = Date.now();
  for (let i = tasks.length - 1; i >= 0; i -= 1) {
    const deletedAt = tasks[i].deletedAt;
    if (!deletedAt) continue;
    if (now - new Date(deletedAt).getTime() >= DELETE_RETENTION_DAYS * DAY_MS) {
      tasks.splice(i, 1);
    }
  }
}


function purgeExpiredDeletedNotes() {
  const now = Date.now();
  for (let i = notes.length - 1; i >= 0; i -= 1) {
    const deletedAt = notes[i].deletedAt;
    if (!deletedAt) continue;
    if (now - new Date(deletedAt).getTime() >= DELETE_RETENTION_DAYS * DAY_MS) {
      notes.splice(i, 1);
    }
  }
}

function persistAndRenderTasks() {
  purgeExpiredDeletedTasks();
  tasks.forEach((task) => {
    task.score = computePriorityScore(task.dueDate, task.urgency);
  });

  tasks.sort((a, b) => b.score - a.score);
  localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(tasks));
  renderTasks();
  syncTaskViewButtons();
}

function persistNotes() {
  purgeExpiredDeletedNotes();
  localStorage.setItem(NOTE_STORAGE_KEY, JSON.stringify(notes));
  syncNoteViewButtons();
}

function getPriorityMeta(urgency) {
  if (urgency === 3) return { label: 'High', className: 'high' };
  if (urgency === 2) return { label: 'Medium', className: 'medium' };
  return { label: 'Low', className: 'low' };
}

function getDaysUntilPermanentDelete(deletedAt) {
  const elapsedDays = Math.floor((Date.now() - new Date(deletedAt).getTime()) / DAY_MS);
  return Math.max(0, DELETE_RETENTION_DAYS - elapsedDays);
}

function renderTasks() {
  taskList.innerHTML = '';

  const shown = tasks.filter((task) => {
    const taskDate = getComparableDate(task.createdAt || task.dueDate);
    if (!isWithinSelectedRange(taskDate, taskDateFrom.value, taskDateTo.value)) return false;

    if (currentTaskView === 'deleted') return Boolean(task.deletedAt);
    if (task.deletedAt) return false;
    if (currentTaskView === 'archived') return task.archived;
    return !task.archived;
  });

  const pageSize = Number(taskPageSize.value);
  const { items: pagedTasks, totalPages, safePage } = paginateItems(shown, taskPage, pageSize);
  taskPage = safePage;
  syncTaskPaginationControls(taskPage, totalPages);

  if (!pagedTasks.length) {
    const emptyLabel =
      currentTaskView === 'archived'
        ? 'No archived tasks yet.'
        : currentTaskView === 'deleted'
          ? 'No deleted tasks.'
          : 'No active tasks yet. Add your first to-do above!';
    taskList.innerHTML = `<li class="empty-item">${emptyLabel}</li>`;
    return;
  }

  pagedTasks.forEach((task) => {
    const li = document.createElement('li');
    li.className = 'task-item';

    const priority = getPriorityMeta(task.urgency);
    const linkedAudio = task.linkedAudioUrl
      ? `<audio controls class="task-audio"><source src="${task.linkedAudioUrl}" type="audio/webm"></audio>`
      : '';

    const deleteNotice = task.deletedAt
      ? `<p class="delete-notice">Permanently deleted in ${getDaysUntilPermanentDelete(task.deletedAt)} day(s).</p>`
      : '';

    const menuItems = task.deletedAt
      ? [`<button type="button" class="menu-item" data-task-action="restore" data-task-id="${task.id}">Restore</button>`]
      : task.archived
        ? [
            `<button type="button" class="menu-item" data-task-action="restore" data-task-id="${task.id}">Restore</button>`,
            `<button type="button" class="menu-item danger" data-task-action="delete" data-task-id="${task.id}">Delete</button>`,
          ]
        : [
            `<button type="button" class="menu-item" data-task-action="archive" data-task-id="${task.id}">Archive</button>`,
            `<button type="button" class="menu-item danger" data-task-action="delete" data-task-id="${task.id}">Delete</button>`,
          ];

    const taskMenu = buildActionMenu(`task-${task.id}`, menuItems.join(''));

    li.innerHTML = `
      <div class="task-main">
        <div class="task-head-row">
          <strong>${task.title}</strong>
          ${taskMenu}
        </div>
        <div class="task-priority-row">
          <span class="priority-pill priority-${priority.className}">${priority.label}</span>
        </div>
        <small>${(task.details || 'No details').replace(/\n/g, '<br>')} • Due: ${task.dueDate || 'No date'}</small>
        ${linkedAudio}
        ${deleteNotice}
      </div>
    `;

    taskList.appendChild(li);
  });
}

function renderNotes() {
  voiceNotesList.innerHTML = '';

  const shown = notes.filter((note) => {
    const noteDate = getComparableDate(note.createdAt);
    if (!isWithinSelectedRange(noteDate, noteDateFrom.value, noteDateTo.value)) return false;

    if (currentNoteView === 'deleted') return Boolean(note.deletedAt);
    if (note.deletedAt) return false;
    if (currentNoteView === 'archived') return note.archived;
    return !note.archived;
  });

  const pageSize = Number(notePageSize.value);
  const { items: pagedNotes, totalPages, safePage } = paginateItems(shown, notePage, pageSize);
  notePage = safePage;
  syncNotePaginationControls(notePage, totalPages);

  if (!pagedNotes.length) {
    const emptyLabel =
      currentNoteView === 'archived'
        ? 'No archived voice notes.'
        : currentNoteView === 'deleted'
          ? 'No deleted voice notes.'
          : 'No voice notes yet. Start recording to capture one!';
    voiceNotesList.textContent = emptyLabel;
    return;
  }

  voiceNotesList.innerHTML = pagedNotes
    .map((note) => {
      const noteAudio = note.audioDataUrl
        ? `<audio controls class="saved-note-audio"><source src="${note.audioDataUrl}" type="audio/webm"></audio>`
        : '';

      const stamped = `<p class="note-stamp">Captured: ${formatDateTime(note.createdAt)}</p>`;
      const deleteNotice = note.deletedAt
        ? `<p class="delete-notice">Permanently deleted in ${getDaysUntilPermanentDelete(note.deletedAt)} day(s).</p>`
        : '';

      const menuItems = note.deletedAt
        ? [`<button type="button" class="menu-item" data-note-action="restore" data-note-id="${note.id}">Restore</button>`]
        : note.archived
          ? [
              `<button type="button" class="menu-item" data-note-action="restore" data-note-id="${note.id}">Restore</button>`,
              `<button type="button" class="menu-item danger" data-note-action="delete" data-note-id="${note.id}">Delete</button>`,
            ]
          : [
              `<button type="button" class="menu-item ${note.taskCreated ? 'disabled-item' : ''}" data-note-action="create-task" data-note-id="${note.id}" ${note.taskCreated ? 'disabled' : ''}>${note.taskCreated ? 'Task Created' : 'Create Task'}</button>`,
              `<button type="button" class="menu-item" data-note-action="archive" data-note-id="${note.id}">Archive</button>`,
              `<button type="button" class="menu-item danger" data-note-action="delete" data-note-id="${note.id}">Delete</button>`,
            ];

      const noteMenu = buildActionMenu(`note-${note.id}`, menuItems.join(''));

      return `<article class="saved-note"><div class="saved-note-head"><strong>${note.title}</strong>${noteMenu}</div>${stamped}<small>${note.content || 'No note text'}</small>${noteAudio}${deleteNotice}</article>`;
    })
    .join('');
}

function buildActionMenu(menuId, itemsHtml) {
  return `
    <div class="item-menu" data-menu-id="${menuId}">
      <button type="button" class="menu-trigger" data-menu-toggle="${menuId}" aria-label="Open actions menu">⋯</button>
      <div class="menu-panel">${itemsHtml}</div>
    </div>
  `;
}

function toggleMenu(menuId) {
  const targetMenu = document.querySelector(`[data-menu-id="${menuId}"]`);
  if (!targetMenu) return;

  const isOpen = targetMenu.classList.contains('menu-open');
  closeAllMenus();
  if (!isOpen) targetMenu.classList.add('menu-open');
}

function closeAllMenus() {
  document.querySelectorAll('.item-menu.menu-open').forEach((menu) => menu.classList.remove('menu-open'));
}

function formatDateTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString([], {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function syncChipSelection() {
  const selectedUrgency = Number(taskUrgency.value);
  const chips = priorityChips.querySelectorAll('[data-urgency]');
  chips.forEach((chip) => {
    chip.classList.toggle('chip-selected', Number(chip.getAttribute('data-urgency')) === selectedUrgency);
  });
}

function openRangeDialog(target) {
  activeRangeTarget = target;

  if (target === 'note') {
    dialogDateFrom.value = noteDateFrom.value;
    dialogDateTo.value = noteDateTo.value;
  }

  if (target === 'task') {
    dialogDateFrom.value = taskDateFrom.value;
    dialogDateTo.value = taskDateTo.value;
  }

  if (typeof dateRangeDialog.showModal === 'function') dateRangeDialog.showModal();
}

function getComparableDate(input) {
  if (!input) return null;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function isWithinSelectedRange(date, fromValue, toValue) {
  if (!date) return false;

  const from = fromValue ? new Date(`${fromValue}T00:00:00`) : null;
  const to = toValue ? new Date(`${toValue}T23:59:59`) : null;

  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

function paginateItems(items, page, pageSize) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    totalPages,
    safePage,
  };
}

function syncTaskPaginationControls(page, totalPages) {
  taskPageInfo.textContent = `Page ${page} of ${totalPages}`;
  taskPrevBtn.disabled = page <= 1;
  taskNextBtn.disabled = page >= totalPages;
}

function syncNotePaginationControls(page, totalPages) {
  notePageInfo.textContent = `Page ${page} of ${totalPages}`;
  notePrevBtn.disabled = page <= 1;
  noteNextBtn.disabled = page >= totalPages;
}

function syncTaskViewButtons() {
  const deletedCount = tasks.filter((task) => task.deletedAt).length;
  const archivedCount = tasks.filter((task) => !task.deletedAt && task.archived).length;
  const activeCount = tasks.filter((task) => !task.deletedAt && !task.archived).length;

  taskViewControls.querySelectorAll('[data-view]').forEach((btn) => {
    const view = btn.getAttribute('data-view');
    btn.classList.toggle('view-active', view === currentTaskView);
    if (view === 'active') btn.textContent = `Active Tasks (${activeCount})`;
    if (view === 'archived') btn.textContent = `Archived Tasks (${archivedCount})`;
    if (view === 'deleted') btn.textContent = `Deleted Tasks (${deletedCount})`;
  });
}

function syncNoteViewButtons() {
  const deletedCount = notes.filter((note) => note.deletedAt).length;
  const archivedCount = notes.filter((note) => !note.deletedAt && note.archived).length;
  const activeCount = notes.filter((note) => !note.deletedAt && !note.archived).length;

  noteViewControls.querySelectorAll('[data-note-view]').forEach((btn) => {
    const view = btn.getAttribute('data-note-view');
    btn.classList.toggle('view-active', view === currentNoteView);
    if (view === 'active') btn.textContent = `Voice Notes (${activeCount})`;
    if (view === 'archived') btn.textContent = `Archived (${archivedCount})`;
    if (view === 'deleted') btn.textContent = `Deleted (${deletedCount})`;
  });
}
