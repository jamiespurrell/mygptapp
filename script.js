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

const tasks = JSON.parse(localStorage.getItem(TASK_STORAGE_KEY) || '[]');
const notes = JSON.parse(localStorage.getItem(NOTE_STORAGE_KEY) || '[]');

tasks.forEach((task) => {
  if (typeof task.archived !== 'boolean') task.archived = false;
  if (!task.deletedAt) task.deletedAt = null;
});

notes.forEach((note) => {
  if (typeof note.archived !== 'boolean') note.archived = false;
  if (!note.deletedAt) note.deletedAt = null;
  if (typeof note.taskCreated !== 'boolean') note.taskCreated = false;
});

purgeExpiredDeletedTasks();
renderNotes();
persistAndRenderTasks();
setRecordingButtons();
syncChipSelection();
syncTaskViewButtons();
syncNoteViewButtons();

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
    recordingStatus.textContent = 'Voice note deleted.';
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
});

noteViewControls.addEventListener('click', (event) => {
  const button = event.target.closest('[data-note-view]');
  if (!button) return;

  currentNoteView = button.getAttribute('data-note-view');
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

taskViewControls.addEventListener('click', (event) => {
  const viewButton = event.target.closest('[data-view]');
  if (!viewButton) return;

  currentTaskView = viewButton.getAttribute('data-view');
  syncTaskViewButtons();
  renderTasks();
});

taskList.addEventListener('click', (event) => {
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
    if (currentTaskView === 'deleted') return Boolean(task.deletedAt);
    if (task.deletedAt) return false;
    if (currentTaskView === 'archived') return task.archived;
    return !task.archived;
  });

  if (!shown.length) {
    const emptyLabel =
      currentTaskView === 'archived'
        ? 'No archived tasks yet.'
        : currentTaskView === 'deleted'
          ? 'No deleted tasks.'
          : 'No active tasks yet. Add your first to-do above!';
    taskList.innerHTML = `<li class="empty-item">${emptyLabel}</li>`;
    return;
  }

  shown.forEach((task) => {
    const li = document.createElement('li');
    li.className = 'task-item';

    const priority = getPriorityMeta(task.urgency);
    const linkedAudio = task.linkedAudioUrl
      ? `<audio controls class="task-audio"><source src="${task.linkedAudioUrl}" type="audio/webm"></audio>`
      : '';

    const deleteNotice = task.deletedAt
      ? `<p class="delete-notice">Permanently deleted in ${getDaysUntilPermanentDelete(task.deletedAt)} day(s).</p>`
      : '';

    const actions = task.deletedAt
      ? `<button class="btn btn-secondary btn-small" data-task-action="restore" data-task-id="${task.id}">Restore</button>`
      : task.archived
        ? `<button class="btn btn-secondary btn-small" data-task-action="restore" data-task-id="${task.id}">Restore</button>
           <button class="btn btn-danger btn-small" data-task-action="delete" data-task-id="${task.id}">Delete</button>`
        : `<button class="btn btn-secondary btn-small" data-task-action="archive" data-task-id="${task.id}">Archive</button>
           <button class="btn btn-danger btn-small" data-task-action="delete" data-task-id="${task.id}">Delete</button>`;

    li.innerHTML = `
      <div>
        <strong>${task.title}</strong><br>
        <small>${(task.details || 'No details').replace(/\n/g, '<br>')} • Due: ${task.dueDate || 'No date'}</small>
        ${linkedAudio}
        ${deleteNotice}
        <div class="task-actions">${actions}</div>
      </div>
      <span class="priority-pill priority-${priority.className}">${priority.label}</span>
    `;

    taskList.appendChild(li);
  });
}

function renderNotes() {
  voiceNotesList.innerHTML = '';

  const shown = notes.filter((note) => {
    if (currentNoteView === 'deleted') return Boolean(note.deletedAt);
    if (note.deletedAt) return false;
    if (currentNoteView === 'archived') return note.archived;
    return !note.archived;
  });

  if (!shown.length) {
    const emptyLabel =
      currentNoteView === 'archived'
        ? 'No archived voice notes.'
        : currentNoteView === 'deleted'
          ? 'No deleted voice notes.'
          : 'No voice notes yet. Start recording to capture one!';
    voiceNotesList.textContent = emptyLabel;
    return;
  }

  voiceNotesList.innerHTML = shown
    .slice(0, 6)
    .map((note) => {
      const noteAudio = note.audioDataUrl
        ? `<audio controls class="saved-note-audio"><source src="${note.audioDataUrl}" type="audio/webm"></audio>`
        : '';

      const stamped = `<p class="note-stamp">Captured: ${formatDateTime(note.createdAt)}</p>`;

      const actions = note.deletedAt
        ? `<button class="btn btn-secondary btn-small" data-note-action="restore" data-note-id="${note.id}">Restore</button>`
        : note.archived
          ? `<button class="btn btn-secondary btn-small" data-note-action="restore" data-note-id="${note.id}">Restore</button>
             <button class="btn btn-danger btn-small" data-note-action="delete" data-note-id="${note.id}">Delete</button>`
          : `<button class="btn btn-secondary btn-small" data-note-action="create-task" data-note-id="${note.id}" ${note.taskCreated ? 'disabled' : ''}>${note.taskCreated ? 'Task Created' : 'Create Task'}</button>
             <button class="btn btn-muted btn-small" data-note-action="archive" data-note-id="${note.id}">Archive</button>
             <button class="btn btn-danger btn-small" data-note-action="delete" data-note-id="${note.id}">Delete</button>`;

      return `<article class="saved-note"><div class="saved-note-head"><strong>${note.title}</strong></div>${stamped}<small>${note.content || 'No note text'}</small>${noteAudio}<div class="saved-note-actions">${actions}</div></article>`;
    })
    .join('');
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
