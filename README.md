# Daily Voice Notes & Task Planner

A simple dark-themed web app to:

- record and save quick voice notes,
- create daily tasks with details, due date, and priority,
- auto-rank tasks by urgency + due-date proximity,
- keep everything in browser `localStorage`.

## Run locally

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`.

## Browser APIs used

- `MediaRecorder` for voice capture
- `getUserMedia` for microphone access
