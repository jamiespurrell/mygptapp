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

const authSection = document.getElementById('authSection');
const appSection = document.getElementById('appSection');
const authMessage = document.getElementById('authMessage');
const authButtons = document.getElementById('authButtons');
const openSignInBtn = document.getElementById('openSignInBtn');
const openSignUpBtn = document.getElementById('openSignUpBtn');
const userControls = document.getElementById('userControls');
const welcomeUser = document.getElementById('welcomeUser');
const signOutBtn = document.getElementById('signOutBtn');
const clerkContainer = document.getElementById('clerkContainer');

let recorder;
let chunks = [];
let isRecording = false;
let clerkClient = null;
let currentUserId = null;
let tasks = [];
let notes = [];

recordBtn.addEventListener('click', async () => {
  if (isRecording || !currentUserId) {
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recorder = new MediaRecorder(stream);
    chunks = [];

    recorder.ondataavailable = (event) => chunks.push(event.data);
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'audio/webm' });
      audioPlayback.src = URL.createObjectURL(blob);
      recordingStatus.textContent = 'Recording captured! Add a title or notes, then save.';
    };

    recorder.start();
    isRecording = true;
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
});

saveNoteBtn.addEventListener('click', () => {
  if (!currentUserId || (!noteTitle.value.trim() && !noteInput.value.trim())) {
    return;
  }

  notes.unshift({
    id: crypto.randomUUID(),
    title: noteTitle.value.trim() || 'Untitled Note',
    content: noteInput.value.trim(),
    createdAt: new Date().toISOString(),
  });

  localStorage.setItem(getNoteStorageKey(), JSON.stringify(notes));
  clearNoteForm();
  renderNotes();
});

discardNoteBtn.addEventListener('click', () => {
  clearNoteForm();
  recordingStatus.textContent = 'Draft discarded.';
});

addTaskBtn.addEventListener('click', () => {
  if (!currentUserId || !taskTitle.value.trim()) {
    return;
  }

  tasks.push({
    id: crypto.randomUUID(),
    title: taskTitle.value.trim(),
    details: taskDetails.value.trim(),
    dueDate: taskDue.value,
    urgency: Number(taskUrgency.value),
    score: computePriorityScore(taskDue.value, Number(taskUrgency.value)),
  });

  taskTitle.value = '';
  taskDetails.value = '';
  taskDue.value = '';
  taskUrgency.value = '2';
  persistAndRenderTasks();
});

openSignInBtn.addEventListener('click', () => {
  if (!clerkClient) {
    return;
  }

  authMessage.textContent = 'Use your credentials to sign in.';
  clerkClient.mountSignIn(clerkContainer, {
    appearance: {
      elements: {
        card: 'box-shadow: none; background: transparent; border: 0;',
      },
    },
  });
});

openSignUpBtn.addEventListener('click', () => {
  if (!clerkClient) {
    return;
  }

  authMessage.textContent = 'Create an account to get started.';
  clerkClient.mountSignUp(clerkContainer, {
    appearance: {
      elements: {
        card: 'box-shadow: none; background: transparent; border: 0;',
      },
    },
  });
});

signOutBtn.addEventListener('click', async () => {
  if (!clerkClient) {
    return;
  }

  await clerkClient.signOut();
});

initAuth();

async function initAuth() {
  const publishableKey = window.CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    authSection.classList.remove('hidden');
    authMessage.textContent =
      'Clerk is not configured yet. Set window.CLERK_PUBLISHABLE_KEY in index.html to enable sign in/sign up.';
    return;
  }

  if (!window.Clerk) {
    authMessage.textContent = 'Unable to load Clerk. Check your internet connection and refresh.';
    return;
  }

  try {
    await window.Clerk.load({ publishableKey });
    clerkClient = window.Clerk;

    clerkClient.addListener(({ user }) => {
      syncSignedInState(user || null);
    });

    syncSignedInState(clerkClient.user || null);
  } catch (error) {
    authMessage.textContent = 'Failed to initialize Clerk. Verify your publishable key and try again.';
  }
}

function syncSignedInState(user) {
  if (!user) {
    currentUserId = null;
    tasks = [];
    notes = [];
    clearNoteForm();

    appSection.classList.add('hidden');
    authButtons.classList.remove('hidden');
    userControls.classList.add('hidden');
    authSection.classList.remove('hidden');
    authMessage.textContent = 'Sign in or create an account to access your planner.';
    voiceNotesList.textContent = 'No voice notes yet. Start recording to capture one!';
    taskList.innerHTML = '<li class="empty-item">No tasks yet. Add your first to-do above!</li>';
    return;
  }

  currentUserId = user.id;
  loadUserData();

  authButtons.classList.add('hidden');
  userControls.classList.remove('hidden');
  appSection.classList.remove('hidden');
  welcomeUser.textContent = `Signed in as ${user.primaryEmailAddress?.emailAddress || user.username || user.id}`;
  authMessage.textContent = 'Authentication successful.';

  if (clerkContainer.innerHTML.trim()) {
    clerkClient.unmountSignIn(clerkContainer);
    clerkClient.unmountSignUp(clerkContainer);
  }
}

function loadUserData() {
  tasks = JSON.parse(localStorage.getItem(getTaskStorageKey()) || '[]');
  notes = JSON.parse(localStorage.getItem(getNoteStorageKey()) || '[]');
  renderNotes();
  persistAndRenderTasks();
}

function getTaskStorageKey() {
  return `voice-notes-priority-tasks:${currentUserId}`;
}

function getNoteStorageKey() {
  return `voice-note-items:${currentUserId}`;
}

function clearNoteForm() {
  noteTitle.value = '';
  noteInput.value = '';
  audioPlayback.removeAttribute('src');
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

  if (currentUserId) {
    localStorage.setItem(getTaskStorageKey(), JSON.stringify(tasks));
  }

  renderTasks();
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

    const priority = task.score >= 120 ? 'High' : task.score >= 70 ? 'Medium' : 'Low';
    const priorityClass = priority.toLowerCase();

    li.innerHTML = `
      <div>
        <strong>${task.title}</strong><br>
        <small>${task.details || 'No details'} • Due: ${task.dueDate || 'No date'}</small>
      </div>
      <span class="priority-pill priority-${priorityClass}">${priority}</span>
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
    .map(
      (note) =>
        `<div class="saved-note"><strong>${note.title}</strong><br><small>${note.content || 'No note text'}</small></div>`,
    )
    .join('');
}
