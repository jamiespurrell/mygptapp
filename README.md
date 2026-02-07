# Daily Voice Notes & Task Planner

A simple dark-themed web app to:

- record and save quick voice notes,
- create daily tasks with details, due date, and priority,
- auto-rank tasks by urgency + due-date proximity,
- authenticate users with Clerk sign in/sign up,
- keep each signed-in user's data in browser `localStorage`.

## Run locally

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`.

## Configure Clerk

1. Create an app in Clerk and copy your **Publishable Key**.
2. Open `index.html` and set:

```html
<script>
  window.CLERK_PUBLISHABLE_KEY = 'pk_test_xxx';
</script>
```

3. Refresh the app. Users can then sign in or sign up from the auth panel.

## Browser APIs used

- `MediaRecorder` for voice capture
- `getUserMedia` for microphone access
