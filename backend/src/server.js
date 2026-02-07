import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from './db.js';
import { requireAuth } from './middleware/auth.js';

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN }));
app.use(express.json({ limit: '10mb' }));

app.get('/health', async (_req, res) => {
  await query('SELECT 1');
  res.json({ ok: true });
});

app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password || password.length < 8) {
    return res.status(400).json({ error: 'Email and password (min 8 chars) required' });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const result = await query(
      'INSERT INTO users(email, password_hash) VALUES($1, $2) RETURNING id, email',
      [email.toLowerCase(), passwordHash],
    );

    const user = result.rows[0];
    const token = jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    return res.status(201).json({ token, user });
  } catch {
    return res.status(409).json({ error: 'Email already exists' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const result = await query('SELECT id, email, password_hash FROM users WHERE email = $1', [
    email.toLowerCase(),
  ]);

  const user = result.rows[0];
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });

  return res.json({ token, user: { id: user.id, email: user.email } });
});

app.get('/api/me', requireAuth, async (req, res) => {
  res.json({ user: { id: req.user.sub, email: req.user.email } });
});

app.get('/api/tasks', requireAuth, async (req, res) => {
  const result = await query('SELECT * FROM tasks WHERE user_id = $1 ORDER BY created_at DESC', [
    req.user.sub,
  ]);
  res.json({ tasks: result.rows });
});

app.post('/api/tasks', requireAuth, async (req, res) => {
  const {
    id,
    title,
    details,
    dueDate,
    urgency = 2,
    linkedNoteId = null,
    linkedAudioUrl = null,
    archived = false,
    deletedAt = null,
  } = req.body;

  if (!id || !title) {
    return res.status(400).json({ error: 'Task id and title required' });
  }

  await query(
    `INSERT INTO tasks(
      id, user_id, title, details, due_date, urgency,
      linked_note_id, linked_audio_url, archived, deleted_at
    ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      details = EXCLUDED.details,
      due_date = EXCLUDED.due_date,
      urgency = EXCLUDED.urgency,
      linked_note_id = EXCLUDED.linked_note_id,
      linked_audio_url = EXCLUDED.linked_audio_url,
      archived = EXCLUDED.archived,
      deleted_at = EXCLUDED.deleted_at`,
    [id, req.user.sub, title, details, dueDate || null, urgency, linkedNoteId, linkedAudioUrl, archived, deletedAt],
  );

  return res.status(201).json({ ok: true });
});

app.get('/api/notes', requireAuth, async (req, res) => {
  const result = await query('SELECT * FROM notes WHERE user_id = $1 ORDER BY created_at DESC', [
    req.user.sub,
  ]);
  res.json({ notes: result.rows });
});

app.post('/api/notes', requireAuth, async (req, res) => {
  const {
    id,
    title,
    content,
    noteType = 'voice',
    audioDataUrl = null,
    archived = false,
    deletedAt = null,
    taskCreated = false,
  } = req.body;

  if (!id || !title) {
    return res.status(400).json({ error: 'Note id and title required' });
  }

  await query(
    `INSERT INTO notes(
      id, user_id, title, content, note_type, audio_data_url,
      archived, deleted_at, task_created
    ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      content = EXCLUDED.content,
      note_type = EXCLUDED.note_type,
      audio_data_url = EXCLUDED.audio_data_url,
      archived = EXCLUDED.archived,
      deleted_at = EXCLUDED.deleted_at,
      task_created = EXCLUDED.task_created`,
    [id, req.user.sub, title, content || null, noteType, audioDataUrl, archived, deletedAt, taskCreated],
  );

  return res.status(201).json({ ok: true });
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on http://localhost:${port}`);
});
