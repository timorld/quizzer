# AI Assistant — Setup & Key Rotation

This is the SCORM Quizzer's AI-assisted file-conversion feature. When a user uploads a file in a format the app can't natively parse (or a `.pptx`), the app asks GPT-5-mini (or whichever model you configure) to convert it into the custom AIKEN dialect used internally.

The API key is held **only on the server**, in an environment variable. Users never enter or see it.

---

## Where the key lives

`/var/www/scorm-quizzer/server/.env`

This file is **gitignored** and never committed. It contains:

```bash
NVIDIA_API_KEY=sk-...
NVIDIA_API_ENDPOINT=https://inference-api.nvidia.com/v1/chat/completions   # optional
NVIDIA_API_MODEL=openai/openai/gpt-5-mini                                  # optional
```

Only `NVIDIA_API_KEY` is required. The endpoint and model fall back to the defaults above if omitted.

---

## Rotating the API key

The flow when your key expires or you want to replace it:

```bash
# 1. SSH into the server
ssh quizzer

# 2. Edit the env file
nano /var/www/scorm-quizzer/server/.env
# Replace the NVIDIA_API_KEY value, save and exit

# 3. Restart the Node server
ps aux | grep "node /var/www/scorm-quizzer" | grep -v grep
# Note the PID, then:
kill <PID>
cd /var/www/scorm-quizzer/server
nohup node server.js > /tmp/quizzer.log 2>&1 &

# 4. Verify
curl http://localhost:3001/api/ai-status
# Should print: { "ok": true, "configured": true, "model": "...", "reply": "ok" }
```

Or, from any browser logged into the app:

> **Settings → Advanced Settings → AI Assistant → Test Connection** → look for the green ✓

---

## Initial setup (only if redeploying from scratch)

If you ever wipe the server and start fresh:

```bash
cd /var/www/scorm-quizzer
git pull
cd server
npm install                          # installs express + dotenv
cp .env.example .env
nano .env                            # fill in NVIDIA_API_KEY
chmod 600 .env                       # restrict read perms to your user
nohup node server.js > /tmp/quizzer.log 2>&1 &
```

---

## Troubleshooting

### Symptom: Users see "AI service returned 401" or "the API key may be expired"
- **Cause:** key is expired, revoked, or wrong.
- **Fix:** rotate it (see above).

### Symptom: Users see "AI service not configured"
- **Cause:** `.env` is missing, or `NVIDIA_API_KEY` is empty, or the Node server didn't reload after a `.env` change.
- **Fix:** check `cat /var/www/scorm-quizzer/server/.env` for the key, then restart the server.

### Symptom: Settings → Test Connection shows "✗ Not configured"
- Same as above — the server hasn't picked up the key.
- Make sure you killed and restarted the Node process, not just edited `.env`. Node only reads `.env` at startup.

### Symptom: Server logs show repeated `AI proxy: upstream returned 429`
- **Cause:** rate-limited by the AI catalog.
- **Fix:** wait it out, or upgrade your tier.

### Where the logs live
```bash
tail -f /tmp/quizzer.log
```
All AI proxy failures are timestamped:
```
[2026-04-15T12:34:56.789Z] AI proxy: upstream returned 401: { ... }
```

---

## Security notes

- The `.env` file is gitignored — **never commit it**.
- `chmod 600 .env` so only the `tpraag` user can read it.
- The key never leaves the server: the browser POSTs to `/api/ai-convert` and the Node process forwards to NVIDIA with the key in the Authorization header.
- If you suspect the key has been exposed, rotate it immediately on the NVIDIA catalog *and* in `.env`.

---

## Files involved (for reference)

| File | Purpose |
|---|---|
| `server/.env` | Holds the API key (gitignored) |
| `server/.env.example` | Template — committed to repo |
| `server/server.js` | Has the `/api/ai-convert` and `/api/ai-status` routes |
| `server/package.json` | Lists `dotenv` and `express` deps |
| `scorm-builder.html` | Calls `/api/ai-convert` from the browser; shows status + `mailto:tpraag@nvidia.com` link on failures |
