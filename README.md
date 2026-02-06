# Voice Notes Daily Planner

A super simple web app to:

- record voice notes,
- transcribe speech (browser support required),
- turn notes into tasks,
- and rank tasks by priority.

## Run locally

```bash
python3 -m http.server 8000
```

Then open: `http://localhost:8000`

## How priority works

Each task gets a score based on:

- **Urgency** (low/medium/high), and
- **Due date** (overdue and near-term tasks score higher).

The task list is always sorted highest score first.

## Notes

- Voice recording uses the browser `MediaRecorder` API.
- Speech recognition uses `SpeechRecognition` / `webkitSpeechRecognition` when available.
- Tasks are stored in `localStorage`.
