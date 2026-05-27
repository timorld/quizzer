# SCORM Builder — Colleague Guide

The app is live at **quizzer.nvidia.com**. This guide is for when you need to make a change to it.

---

## Step 1 — Get the project on your computer

You'll need [Git](https://git-scm.com/downloads) installed. Then open a terminal, navigate to where you want the project to live, and run:

```bash
git clone https://github.com/timorld/quizzer.git
```

This creates a `quizzer` folder right where you are. If you want it in a specific location, you can navigate there first — for example on a Mac:

```bash
cd ~/Documents/Projects
git clone https://github.com/timorld/quizzer.git
```

Or on Windows:

```bash
cd C:\Users\YourName\Documents\Projects
git clone https://github.com/timorld/quizzer.git
```

You only need to do this once.

If you already have it from before, just make sure it's up to date:

```bash
cd quizzer
git pull
```

---

## Step 2 — Make the change using an AI coding agent

Open the `quizzer` folder in [Claude Code](https://claude.ai/code) (or another AI coding tool like Cursor or Copilot). Describe what you want to change in plain English — the AI will find the right place in the code and make the edit for you.

Almost everything in this app lives in one file: **`scorm-builder.html`**.

---

## Step 3 — Test it locally

No server setup needed. Just open `scorm-builder.html` directly in your browser (double-click it or drag it into a browser window) and try out your change.

> Note: history and presets won't save in local mode (that needs the server), but all quiz building and SCORM export features work fine.

---

## Step 4 — Push your change to GitHub

Once you're happy with the result, open a terminal in the `quizzer` folder and run:

```bash
git add .
git commit -m "Short description of what you changed"
git push
```

Keep the message short and specific, e.g. `"Add GPU Genius Fast Track Exam quiz type"`.

---

## Step 5 — Update the live server

> **You'll need sudo access to the server.** If you don't have it, ask Timor to add you.

SSH into the server using your NVIDIA username and password:

```bash
ssh user-name@quizzer.nvidia.com
```

It will prompt for your NVIDIA password. Once you're in, pull the latest code:

```bash
cd /var/www/scorm-quizzer
git pull
```

The change is now live on **quizzer.nvidia.com**. No restart needed — unless you also edited `server/server.js`, in which case run:

```bash
pm2 restart scorm-api
```

---

## Something went wrong?

Undo the last change safely:

```bash
cd /var/www/scorm-quizzer
git revert HEAD
git push
```

This rolls the server back without losing the git history.
