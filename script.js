const recordBtn = document.getElementById('recordBtn');
const transcribeBtn = document.getElementById('transcribeBtn');
const recordingStatus = document.getElementById('recordingStatus');
const audioPlayback = document.getElementById('audioPlayback');
const noteInput = document.getElementById('noteInput');
const taskTitle = document.getElementById('taskTitle');
const taskDue = document.getElementById('taskDue');
const taskUrgency = document.getElementById('taskUrgency');
const addTaskBtn = document.getElementById('addTaskBtn');
const parseNoteBtn = document.getElementById('parseNoteBtn');
const taskList = document.getElementById('taskList');

let recorder;
let chunks = [];
let isRecording = false;
const STORAGE_KEY = 'voice-notes-priority-tasks';

const tasks = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
renderTasks();

recordBtn.addEventListener('click', async () => {
  if (!isRecording) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recorder = new MediaRecorder(stream);
      chunks = [];

      recorder.ondataavailable = (event) => chunks.push(event.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        audioPlayback.src = URL.createObjectURL(blob);
      };

      recorder.start();
      isRecording = true;
      recordBtn.textContent = 'Stop Recording';
      recordingStatus.textContent = 'Recording...';
    } catch (error) {
      recordingStatus.textContent = 'Microphone access denied.';
    }
    return;
  }

  recorder.stop();
  isRecording = false;
  recordBtn.textContent = 'Start Recording';
  recordingStatus.textContent = 'Saved recording.';
});

transcribeBtn.addEventListener('click', () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    recordingStatus.textContent = 'Speech recognition is not available in this browser.';
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = false;

  recordingStatus.textContent = 'Listening for speech...';
  recognition.start();

  recognition.onresult = (event) => {
    noteInput.value = event.results[0][0].transcript;
    recordingStatus.textContent = 'Transcription captured.';
  };

  recognition.onerror = () => {
    recordingStatus.textContent = 'Could not transcribe audio.';
  };
});

addTaskBtn.addEventListener('click', () => {
  if (!taskTitle.value.trim()) {
    return;
  }

  tasks.push(createTask(taskTitle.value.trim(), taskDue.value, Number(taskUrgency.value)));
  persistAndRender();
  taskTitle.value = '';
});

parseNoteBtn.addEventListener('click', () => {
  const parts = noteInput.value
    .split(/[\n\.;,]/)
    .map((p) => p.trim())
    .filter(Boolean);

  parts.forEach((text) => {
    tasks.push(createTask(text, '', inferUrgency(text)));
  });

  persistAndRender();
});

function createTask(title, dueDate, urgency) {
  const createdAt = new Date().toISOString();
  const score = computePriorityScore(dueDate, urgency);
  return {
    id: crypto.randomUUID(),
    title,
    dueDate,
    urgency,
    createdAt,
    score,
  };
}

function inferUrgency(text) {
  const lowered = text.toLowerCase();
  if (/(urgent|asap|today|immediately|important)/.test(lowered)) {
    return 3;
  }
  if (/(soon|tomorrow|this week)/.test(lowered)) {
    return 2;
  }
  return 1;
}

function computePriorityScore(dueDate, urgency) {
  let score = urgency * 30;

  if (dueDate) {
    const now = new Date();
    const due = new Date(dueDate);
    const days = Math.ceil((due - now) / (1000 * 60 * 60 * 24));

    if (days <= 0) score += 100;
    else if (days <= 1) score += 60;
    else if (days <= 3) score += 40;
    else if (days <= 7) score += 20;
  }

  return score;
}

function persistAndRender() {
  tasks.forEach((task) => {
    task.score = computePriorityScore(task.dueDate, task.urgency);
  });
  tasks.sort((a, b) => b.score - a.score);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  renderTasks();
}

function renderTasks() {
  taskList.innerHTML = '';

  tasks.forEach((task) => {
    const li = document.createElement('li');
    li.className = 'task-item';

    const priority = task.score >= 120 ? 'High' : task.score >= 70 ? 'Medium' : 'Low';
    const priorityClass = priority.toLowerCase();

    li.innerHTML = `
      <div>
        <strong>${task.title}</strong><br />
        <small>Due: ${task.dueDate || 'No due date'} | Urgency: ${task.urgency}</small>
      </div>
      <div class="priority-pill priority-${priorityClass}">${priority}</div>
    `;

    taskList.appendChild(li);
  });
}
