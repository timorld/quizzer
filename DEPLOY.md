# Deploying to quizzer.nvidia.com

## Step 1 — Open a terminal in the project folder

Navigate to the `03 SCORM Builder` folder first. All commands below must be run from there:

```
C:\Users\tpraag\OneDrive - NVIDIA Corporation\Documents\PROJECTS\CLAUDE CODE SANDBOX\03 SCORM Builder
```

In VS Code you can right-click the folder in Explorer → **Open in Integrated Terminal**.

---

## Step 2 — Upload the files

> ⚠️ **Always upload assets together with the HTML.** The builder references icons and images from `assets/` using relative paths — if assets is missing or outdated on the server, buttons and icons will appear broken.

**Standard deploy (use this every time) — run as separate commands:**
```powershell
scp scorm-builder.html tpraag@quizzer.nvidia.com:/var/www/scorm-quizzer/public/
scp -r assets tpraag@quizzer.nvidia.com:/var/www/scorm-quizzer/public/
```

Then SSH in and fix permissions (required after every upload — SCP from Windows doesn't set Linux permissions):
```bash
chmod -R 755 /var/www/scorm-quizzer/public/assets/
```

**If you only need to upload assets (e.g. added a new SVG or image):**
```powershell
scp -r assets tpraag@quizzer.nvidia.com:/var/www/scorm-quizzer/public/
```

---

## What gets updated

| Local file | Where it lands on the server |
|---|---|
| `scorm-builder.html` | `/var/www/scorm-quizzer/public/` |
| `assets/` (whole folder) | `/var/www/scorm-quizzer/public/assets/` |

---

## Notes

- Never touch `server/` — the API and database live there
- No server restart needed — PM2 only serves the Node API, static files are served directly
