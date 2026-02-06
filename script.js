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

const TASK_STORAGE_KEY = 'voice-notes-priority-tasks';
const NOTE_STORAGE_KEY = 'voice-note-items';

let recorder;
let chunks = [];
let isRecording = false;
let latestRecordingDataUrl = '';
let selectedNoteForTask = null;

const tasks = JSON.parse(localStorage.getItem(TASK_STORAGE_KEY) || '[]');
const notes = JSON.parse(localStorage.getItem(NOTE_STORAGE_KEY) || '[]');

renderNotes();
persistAndRenderTasks();
setRecordingButtons();

recordBtn.addEventListener('click', async () => {
  if (isRecording) {
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recorder = new MediaRecorder(stream);
    chunks = [];

    recorder.ondataavailable = (event) => chunks.push(event.data);
    recorder.onstop = async () => {
      const blob = new Blob(chunks, { type: 'audio/webm' });
      const playbackUrl = URL.createObjectURL(blob);
      audioPlayback.src = playbackUrl;
      latestRecordingDataUrl = await blobToDataURL(blob);
      recordingStatus.textContent = 'Recording captured! Add a title or notes, then save.';
    };

    recorder.start();
    isRecording = true;
    setRecordingButtons();
    recordingStatus.textContent = 'Recording now...';
  } catch (error) {
    recordingStatus.textContent = 'Microphone access denied.';
  }
});

stopBtn.addEventListener('click', () => {
  if (!isRecording || !recorder) {
    return;
  }

  recorder.stop();
  isRecording = false;
  setRecordingButtons();
});

saveNoteBtn.addEventListener('click', () => {
  if (!noteTitle.value.trim() && !noteInput.value.trim()) {
    return;
  }

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
  if (!taskTitle.value.trim()) {
    return;
  }

  tasks.push({
    id: crypto.randomUUID(),
    title: taskTitle.value.trim(),
    details: taskDetails.value.trim(),
    dueDate: taskDue.value,
    urgency: Number(taskUrgency.value),
    linkedNoteId: selectedNoteForTask?.id || null,
    linkedAudioUrl: selectedNoteForTask?.audioDataUrl || '',
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
  if (!createTaskButton) {
    return;
  }

  const noteId = createTaskButton.getAttribute('data-note-id');
  const selectedNote = notes.find((note) => note.id === noteId);
  if (!selectedNote) {
    return;
  }

  selectedNoteForTask = selectedNote;
  taskTitle.value = selectedNote.title;
  taskDetails.value = selectedNote.content;
  taskTitle.focus();
  recordingStatus.textContent = 'Task fields populated from selected voice note.';
});

priorityChips.addEventListener('click', (event) => {
  const chip = event.target.closest('[data-urgency]');
  if (!chip) {
    return;
  }

  taskUrgency.value = chip.getAttribute('data-urgency');
  recordingStatus.textContent = `Priority set to ${chip.textContent.trim()}.`;
  syncChipSelection();
});

taskUrgency.addEventListener('change', syncChipSelection);
syncChipSelection();

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

  if (!dueDate) {
    return score;
  }

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
}

function getPriorityMeta(urgency) {
  if (urgency === 3) return { label: 'High', className: 'high' };
  if (urgency === 2) return { label: 'Medium', className: 'medium' };
  return { label: 'Low', className: 'low' };
}

function renderTasks() {
  taskList.innerHTML = '';

  if (!tasks.length) {
    taskList.innerHTML = '<li class="empty-item">No tasks yet. Add your first to-do above!</li>';
    return;
  }

  tasks.forEach((task) => {
    const li = document.createElement('li');
    li.className = 'task-item';

    const priority = getPriorityMeta(task.urgency);
    const linkedAudio = task.linkedAudioUrl
      ? `<audio controls class="task-audio"><source src="${task.linkedAudioUrl}" type="audio/webm"></audio>`
      : '';

    li.innerHTML = `
      <div>
        <strong>${task.title}</strong><br>
        <small>${task.details || 'No details'} • Due: ${task.dueDate || 'No date'}</small>
        ${linkedAudio}
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
