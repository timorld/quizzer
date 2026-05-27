# Remote-Loaded Player Test

This is a side experiment — it doesn't touch the live SCORM builder at all. The goal is to prove that ALM can load the quiz player from a remote URL (GitLab Pages), so that future player updates don't require re-uploading every SCORM.

If this works in ALM, we'll plan the full rollout.

---

## How it will work

Today, every generated SCORM has the player JS + CSS *baked into* the ZIP. To test the remote-loaded approach, we:

1. Extract the player files from `scorm-builder.html` into `player/`.
2. Host them on GitLab Pages so they have a public URL.
3. Generate one SCORM from the live builder, then swap two `<script>` tags in its `index.html` to point at the GitLab URLs.
4. Upload that modified SCORM to ALM and run a learner through it.

The live SCORM Builder app (`scorm-builder.html`) is **not modified**. This folder is self-contained.

---

## Step 1 — Extract the player files

From this folder, run:

```bash
node extract.js
```

This reads the three `<script type="text/plain">` template blocks from `../scorm-builder.html` and writes:

```
player/scorm-api.js     (the SCORM 1.2 API wrapper)
player/quiz-player.js   (the quiz player — UI logic, scoring, state, etc.)
player/quiz-player.css  (all the player styles)
```

Re-run this any time the builder's player changes — it always reflects the current state of `scorm-builder.html`.

---

## Step 2 — Host the player files on GitHub Pages

Repo: `https://github.com/timorld/quizzer-player`

1. From this `test-remote-player/player/` folder, push the three files:

   ```bash
   cd player
   git init
   git add scorm-api.js quiz-player.js quiz-player.css
   git commit -m "Initial player files"
   git branch -M main
   git remote add origin https://github.com/timorld/quizzer-player.git
   git push -u origin main
   ```

2. On github.com → your repo → **Settings → Pages**:
   - **Source**: Deploy from a branch
   - **Branch**: `main`, folder `/ (root)`
   - Click **Save**
   - Wait ~30-60 seconds for the first deploy. The Pages section will show *"Your site is live at …"* when ready.

3. Your files will be at:

   ```
   https://timorld.github.io/quizzer-player/scorm-api.js
   https://timorld.github.io/quizzer-player/quiz-player.js
   https://timorld.github.io/quizzer-player/quiz-player.css
   ```

4. Verify by opening one of those URLs in your browser — you should see the file content, served over HTTPS.

> **Tip for later:** once the test passes, move the files into a `/v1/` folder. Then breaking changes ship as `/v2/` without disturbing existing quizzes.

---

## Step 3 — Generate a baseline SCORM from the live app

1. Open the live SCORM Builder.
2. Create a small test quiz — 2-3 questions is enough.
3. Click **Download SCORM**. Save the ZIP somewhere.

This gives you a complete, working SCORM with the player bundled inside. We're going to modify two lines of its `index.html`.

---

## Step 4 — Swap the script tags for remote URLs

1. Unzip the SCORM you just downloaded.
2. Open `index.html` in a text editor.
3. Near the bottom of the `<body>`, find these two lines:

   ```html
   <script src="js/scorm-api.js"></script>
   <script src="js/quiz-player.js"></script>
   ```

4. Replace them with:

   ```html
   <script src="https://timorld.github.io/quizzer-player/scorm-api.js"></script>
   <script src="https://timorld.github.io/quizzer-player/quiz-player.js"></script>
   ```

5. Save `index.html`.
6. (Optional) Delete `js/scorm-api.js` and `js/quiz-player.js` from the unzipped folder — they're dead weight now. If you do this, also remove the two `<file href="js/...">` lines from `imsmanifest.xml` so the manifest stays accurate.
7. Re-zip the contents (the root must contain `imsmanifest.xml`, not a nested folder).

---

## Step 5 — Upload to ALM and test

1. Upload the modified ZIP to ALM as a new content module.
2. Launch it as a learner.
3. **What you're looking for**:
   - ✅ Quiz loads normally, looks identical to the bundled version
   - ✅ Browser DevTools → Network tab shows `quiz-player.js` and `scorm-api.js` being fetched from `gitlab.io`, not from the SCORM bundle
   - ✅ ALM tracks the attempt the same way (score, pass/fail, suspend data)

**If something goes wrong, check:**
- **404 in DevTools** → Pages URL is wrong, or Pages isn't enabled yet (check **Settings → Pages** — the green "live at" link only appears after a successful deploy).
- **CSP / Content-Security-Policy error** → ALM is blocking external scripts. This is rare for SCO content but possible. If it happens, this approach won't work without ALM admin cooperation.
- **CORS error on the script load** → unlikely (cross-origin `<script src>` is always allowed), but if you see it, check that GitHub Pages is serving the file as `application/javascript` and not some weird MIME.
- **Quiz loads but breaks** → most likely the player template you extracted is out of sync with the SCORM you generated. Re-run `extract.js` and re-host before testing.

---

## Step 6 — Test the actual value: live updates

The whole point of this approach. Once a quiz is uploaded:

1. Make some visible change in `player/quiz-player.js` (e.g., change a button label or add a `console.log`).
2. Commit + push to GitLab.
3. Wait ~30 seconds for GitLab Pages to redeploy.
4. Re-launch the quiz in ALM (no re-upload).
5. Your change should appear, without touching the SCORM in ALM.

If that works → the approach is viable.

---

## File layout

```
test-remote-player/
├── extract.js                  # one-shot extractor
├── player/                     # populated by extract.js
│   ├── scorm-api.js
│   ├── quiz-player.js
│   └── quiz-player.css
└── README.md                   # this file
```

The live builder (`../scorm-builder.html`) is untouched.

---

## After the test

If the test succeeds, talk to me and we'll plan the migration:
- Add a toggle in the live builder for **"Inline player (current)"** vs **"Remote player"**
- Decide on versioning strategy (`/v1/` rolling, `/v2/` for breaking changes)
- Decide where to host long-term (public GitHub vs NVIDIA-internal hosting)
- Plan how to migrate existing ALM quizzes if/when desired (one-time re-upload to switch them over)
