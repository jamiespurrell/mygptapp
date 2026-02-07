'use client';

import { SignedIn, SignedOut, useUser } from '@clerk/nextjs';
import { useEffect, useMemo, useRef, useState } from 'react';

type Task = {
  id: string;
  title: string;
  details: string;
  dueDate: string;
  urgency: number;
  score: number;
};

type Note = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
};

export default function HomePage() {
  const { user } = useUser();
  const userId = user?.id;
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDetails, setTaskDetails] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const [taskUrgency, setTaskUrgency] = useState('2');
  const [tasks, setTasks] = useState<Task[]>([]);

  const [noteTitle, setNoteTitle] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [notes, setNotes] = useState<Note[]>([]);
  const [recordingStatus, setRecordingStatus] = useState('Ready to record.');
  const [audioUrl, setAudioUrl] = useState('');

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);

  const taskStorageKey = useMemo(() => (userId ? `voice-notes-priority-tasks:${userId}` : ''), [userId]);
  const noteStorageKey = useMemo(() => (userId ? `voice-note-items:${userId}` : ''), [userId]);

  useEffect(() => {
    if (!taskStorageKey || !noteStorageKey) {
      setTasks([]);
      setNotes([]);
      return;
    }

    setTasks(JSON.parse(localStorage.getItem(taskStorageKey) || '[]'));
    setNotes(JSON.parse(localStorage.getItem(noteStorageKey) || '[]'));
  }, [taskStorageKey, noteStorageKey]);

  useEffect(() => {
    if (!taskStorageKey) return;
    localStorage.setItem(taskStorageKey, JSON.stringify(tasks));
  }, [tasks, taskStorageKey]);

  useEffect(() => {
    if (!noteStorageKey) return;
    localStorage.setItem(noteStorageKey, JSON.stringify(notes));
  }, [notes, noteStorageKey]);

  function computePriorityScore(dueDate: string, urgency: number) {
    let score = urgency * 30;
    if (!dueDate) return score;

    const today = new Date();
    const due = new Date(dueDate);
    const days = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (days <= 0) score += 100;
    else if (days <= 1) score += 60;
    else if (days <= 3) score += 40;
    else if (days <= 7) score += 20;

    return score;
  }

  async function startRecording() {
    if (isRecording) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => chunksRef.current.push(event.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioUrl(URL.createObjectURL(blob));
        setRecordingStatus('Recording captured! Add a title or notes, then save.');
      };

      recorder.start();
      setIsRecording(true);
      setRecordingStatus('Recording now...');
    } catch {
      setRecordingStatus('Microphone access denied.');
    }
  }

  function stopRecording() {
    if (!recorderRef.current || !isRecording) return;
    recorderRef.current.stop();
    setIsRecording(false);
  }

  function saveTask() {
    if (!taskTitle.trim()) return;

    const next: Task = {
      id: crypto.randomUUID(),
      title: taskTitle.trim(),
      details: taskDetails.trim(),
      dueDate: taskDue,
      urgency: Number(taskUrgency),
      score: computePriorityScore(taskDue, Number(taskUrgency)),
    };

    setTasks((prev) => [...prev, next].sort((a, b) => b.score - a.score));
    setTaskTitle('');
    setTaskDetails('');
    setTaskDue('');
    setTaskUrgency('2');
  }

  function saveNote() {
    if (!noteTitle.trim() && !noteInput.trim()) return;

    setNotes((prev) => [
      {
        id: crypto.randomUUID(),
        title: noteTitle.trim() || 'Untitled Note',
        content: noteInput.trim(),
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);

    setNoteTitle('');
    setNoteInput('');
    setAudioUrl('');
  }

  return (
    <main className="app">
      <SignedOut>
        <section className="panel auth-panel">
          <h2>Sign in to continue</h2>
          <p className="status">Use the Sign In or Sign Up buttons above to access your planner.</p>
        </section>
      </SignedOut>

      <SignedIn>
        <section className="layout">
          <article className="panel">
            <h2>Voice Notes</h2>
            <div className="row buttons-inline">
              <button className="btn btn-primary" onClick={startRecording}>Start Recording</button>
              <button className="btn btn-danger" onClick={stopRecording}>Stop Recording</button>
            </div>
            <p className="status">{recordingStatus}</p>
            <audio controls src={audioUrl} />

            <label htmlFor="noteTitle">Title</label>
            <input id="noteTitle" value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} placeholder="Morning planning" />

            <label htmlFor="noteInput">Notes</label>
            <textarea id="noteInput" value={noteInput} onChange={(e) => setNoteInput(e.target.value)} placeholder="Context or follow up" rows={4} />

            <div className="row stack-mobile">
              <button className="btn btn-primary btn-wide" onClick={saveNote}>Save Voice Note</button>
              <button
                className="btn btn-muted btn-wide"
                onClick={() => {
                  setNoteTitle('');
                  setNoteInput('');
                  setAudioUrl('');
                  setRecordingStatus('Draft discarded.');
                }}
              >
                Discard
              </button>
            </div>

            <div className="empty-box">
              {notes.length
                ? notes.slice(0, 4).map((note) => (
                    <div key={note.id} className="saved-note">
                      <strong>{note.title}</strong>
                      <br />
                      <small>{note.content || 'No note text'}</small>
                    </div>
                  ))
                : 'No voice notes yet. Start recording to capture one!'}
            </div>
          </article>

          <article className="panel">
            <h2>Daily To-Do List</h2>

            <label htmlFor="taskTitle">Task</label>
            <input id="taskTitle" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Plan weekly meals" />

            <label htmlFor="taskDetails">Details (optional)</label>
            <textarea id="taskDetails" value={taskDetails} onChange={(e) => setTaskDetails(e.target.value)} placeholder="Add helpful notes" rows={4} />

            <label htmlFor="taskUrgency">Priority</label>
            <select id="taskUrgency" value={taskUrgency} onChange={(e) => setTaskUrgency(e.target.value)}>
              <option value="3">High</option>
              <option value="2">Medium</option>
              <option value="1">Low</option>
            </select>

            <label htmlFor="taskDue">Due date (optional)</label>
            <input id="taskDue" type="date" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} />

            <button className="btn btn-primary btn-wide" onClick={saveTask}>Add Task</button>

            <ul className="task-list">
              {tasks.length ? (
                tasks.map((task) => {
                  const priority = task.score >= 120 ? 'High' : task.score >= 70 ? 'Medium' : 'Low';
                  return (
                    <li key={task.id} className="task-item">
                      <div>
                        <strong>{task.title}</strong>
                        <br />
                        <small>{task.details || 'No details'} • Due: {task.dueDate || 'No date'}</small>
                      </div>
                      <span className={`priority-pill priority-${priority.toLowerCase()}`}>{priority}</span>
                    </li>
                  );
                })
              ) : (
                <li className="empty-item">No tasks yet. Add your first to-do above!</li>
              )}
            </ul>
          </article>
        </section>
      </SignedIn>
    </main>
  );
}
