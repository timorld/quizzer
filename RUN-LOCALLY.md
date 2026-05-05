# Running Locally

## 1. Start the API server

```bash
cd server
npm install        # first time only
npm run dev        # starts on http://localhost:3001 with auto-reload
```

## 2. Open the builder

Open `scorm-builder.html` directly in your browser — no other server needed.

The builder auto-detects localhost and points API calls to `http://localhost:3001`.

---

## What the API stores

| File | Contents |
|---|---|
| `server/data/history.json` | Saved quiz history |
| `server/data/defaults.json` | "Set as Defaults" settings |

These files are created automatically on first use.

---

## Stopping the server

`Ctrl+C` in the terminal running `npm run dev`.
