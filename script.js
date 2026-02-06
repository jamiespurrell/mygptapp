const recordBtn = document.getElementById('recordBtn');
const stopBtn = document.getElementById('stopBtn');
const recordingStatus = document.getElementById('recordingStatus');
const audioPlayback = document.getElementById('audioPlayback');
const noteTitle = document.getElementById('noteTitle');
const noteInput = document.getElementById('noteInput');
const saveNoteBtn = document.getElementById('saveNoteBtn');
const discardNoteBtn = document.getElementById('discardNoteBtn');
const voiceNotesList = document.getElementById('voiceNotesList');

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

let recorder;
let chunks = [];
let isRecording = false;
let latestRecordingDataUrl = '';
let selectedNoteForTask = null;
let currentTaskView = 'active';

const tasks = JSON.parse(localStorage.getItem(TASK_STORAGE_KEY) || '[]');
const notes = JSON.parse(localStorage.getItem(NOTE_STORAGE_KEY) || '[]');

tasks.forEach((task) => {
  if (typeof task.archived !== 'boolean') task.archived = false;
});

renderNotes();
persistAndRenderTasks();
setRecordingButtons();
syncChipSelection();
syncTaskViewButtons();

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
  });

  localStorage.setItem(NOTE_STORAGE_KEY, JSON.stringify(notes));
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

  tasks.push({
    id: crypto.randomUUID(),
    title: taskTitle.value.trim(),
    details: taskDetails.value.trim(),
    dueDate: taskDue.value,
    urgency: Number(taskUrgency.value),
    linkedNoteId: selectedNoteForTask?.id || null,
    linkedAudioUrl: selectedNoteForTask?.audioDataUrl || '',
    archived: false,
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
  const createTaskButton = event.target.closest('[data-action="create-task"]');
  if (!createTaskButton) return;

  const noteId = createTaskButton.getAttribute('data-note-id');
  const selectedNote = notes.find((note) => note.id === noteId);
  if (!selectedNote) return;

  selectedNoteForTask = selectedNote;
  taskTitle.value = selectedNote.title;
  taskDetails.value = selectedNote.content;
  taskTitle.focus();
  recordingStatus.textContent = 'Task fields populated from selected voice note.';
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
    recordingStatus.textContent = 'Task restored.';
  } else if (action === 'delete') {
    const idx = tasks.findIndex((t) => t.id === taskId);
    if (idx >= 0) tasks.splice(idx, 1);
    recordingStatus.textContent = 'Task deleted.';
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
  const days = Math.ceil((due - today) / (1000 * 60 * 60 * 24));

  if (days <= 0) score += 100;
  else if (days <= 1) score += 60;
  else if (days <= 3) score += 40;
  else if (days <= 7) score += 20;

  return score;
}

function persistAndRenderTasks() {
  tasks.forEach((task) => {
    task.score = computePriorityScore(task.dueDate, task.urgency);
  });

  tasks.sort((a, b) => b.score - a.score);
  localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(tasks));
  renderTasks();
  syncTaskViewButtons();
}

function getPriorityMeta(urgency) {
  if (urgency === 3) return { label: 'High', className: 'high' };
  if (urgency === 2) return { label: 'Medium', className: 'medium' };
  return { label: 'Low', className: 'low' };
}

function renderTasks() {
  taskList.innerHTML = '';

  const shown = tasks.filter((task) => (currentTaskView === 'archived' ? task.archived : !task.archived));
  if (!shown.length) {
    taskList.innerHTML = `<li class="empty-item">${currentTaskView === 'archived' ? 'No archived tasks yet.' : 'No active tasks yet. Add your first to-do above!'}</li>`;
    return;
  }

  shown.forEach((task) => {
    const li = document.createElement('li');
    li.className = 'task-item';

    const priority = getPriorityMeta(task.urgency);
    const linkedAudio = task.linkedAudioUrl
      ? `<audio controls class="task-audio"><source src="${task.linkedAudioUrl}" type="audio/webm"></audio>`
      : '';

    const actions = task.archived
      ? `<button class="btn btn-secondary btn-small" data-task-action="restore" data-task-id="${task.id}">Restore</button>
         <button class="btn btn-danger btn-small" data-task-action="delete" data-task-id="${task.id}">Delete</button>`
      : `<button class="btn btn-secondary btn-small" data-task-action="archive" data-task-id="${task.id}">Archive</button>
         <button class="btn btn-danger btn-small" data-task-action="delete" data-task-id="${task.id}">Delete</button>`;

    li.innerHTML = `
      <div>
        <strong>${task.title}</strong><br>
        <small>${task.details || 'No details'} • Due: ${task.dueDate || 'No date'}</small>
        ${linkedAudio}
        <div class="task-actions">${actions}</div>
      </div>
      <span class="priority-pill priority-${priority.className}">${priority.label}</span>
    `;

    taskList.appendChild(li);
  });
}

function renderNotes() {
  if (!notes.length) {
    voiceNotesList.textContent = 'No voice notes yet. Start recording to capture one!';
    return;
  }

  voiceNotesList.innerHTML = notes
    .slice(0, 4)
    .map((note) => {
      const noteAudio = note.audioDataUrl
        ? `<audio controls class="saved-note-audio"><source src="${note.audioDataUrl}" type="audio/webm"></audio>`
        : '';
      return `<article class="saved-note"><div class="saved-note-head"><strong>${note.title}</strong></div><small>${note.content || 'No note text'}</small>${noteAudio}<div class="saved-note-actions"><button class="btn btn-secondary" data-action="create-task" data-note-id="${note.id}">Create Task</button></div></article>`;
    })
    .join('');
}

function syncChipSelection() {
  const selectedUrgency = Number(taskUrgency.value);
  const chips = priorityChips.querySelectorAll('[data-urgency]');
  chips.forEach((chip) => {
    chip.classList.toggle('chip-selected', Number(chip.getAttribute('data-urgency')) === selectedUrgency);
  });
}

function syncTaskViewButtons() {
  const archivedCount = tasks.filter((task) => task.archived).length;
  const activeCount = tasks.length - archivedCount;

  taskViewControls.querySelectorAll('[data-view]').forEach((btn) => {
    const view = btn.getAttribute('data-view');
    btn.classList.toggle('view-active', view === currentTaskView);
    if (view === 'active') btn.textContent = `Active Tasks (${activeCount})`;
    if (view === 'archived') btn.textContent = `Archived Tasks (${archivedCount})`;
  });
}
