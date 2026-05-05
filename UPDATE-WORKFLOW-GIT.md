# Update Workflow

How to make changes to the SCORM Quiz Builder and deploy them to the server.

---

## Your Setup at a Glance

| | Location |
|---|---|
| **Local files** | `C:\Users\tpraag\OneDrive - NVIDIA Corporation\Documents\PROJECTS\CLAUDE CODE SANDBOX\03 SCORM Builder` |
| **GitHub repo** | https://github.com/timorld/quizzer |
| **Live server** | `/var/www/scorm-quizzer` on the Linux server |
| **Process manager** | pm2, process name: `scorm-api` |

---

## Every Time You Make Changes

### Step 1 — Edit files locally
Make your changes to `scorm-builder.html`, `server/server.js`, or any other file on your Windows machine.

### Step 2 — Commit and push to GitHub
Open a terminal in the project folder and run:

```bash
git add .
git commit -m "Brief description of what you changed"
git push
```

> **Tip:** Keep commit messages short and descriptive, e.g.  
> `"Add review button to passed banner"`  
> `"Fix hotspot image display in review"`

### Step 3 — Pull on the server
SSH into the server and run:

```bash
cd /var/www/scorm-quizzer
git pull
```

### Step 4 — Restart (only if server.js changed)
If you edited `server/server.js`, restart the app:

```bash
pm2 restart scorm-api
```

You **don't** need to restart for changes to `scorm-builder.html` or asset files — they're served as static files and take effect immediately after `git pull`.

---

## Quick Reference

| You changed | After `git pull`, do you need to restart? |
|---|---|
| `scorm-builder.html` | No |
| `assets/` | No |
| `server/server.js` | **Yes** — `pm2 restart scorm-api` |
| `server/package.json` | **Yes** — also run `npm install` first |

---

## Checking the Server is Healthy

```bash
pm2 list                        # should show scorm-api as "online"
pm2 logs scorm-api --lines 20   # view recent logs
```

---

## If Something Goes Wrong

Roll back to the previous version:

```bash
cd /var/www/scorm-quizzer
git log --oneline    # find the commit you want to go back to
git pull             # make sure you're up to date first
```

Or if a bad update broke the server, restore from the backup:

```bash
pm2 stop scorm-api
sudo mv /var/www/scorm-quizzer /var/www/scorm-quizzer-broken
sudo cp -r /var/www/scorm-quizzer-backup /var/www/scorm-quizzer
pm2 restart scorm-api
```

---

## Adding the Guide to GitHub

After creating this file, commit it:

```bash
git add UPDATE-WORKFLOW.md
git commit -m "Add update workflow guide"
git push
```
