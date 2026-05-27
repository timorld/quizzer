# Remote-Loaded Player — How It Works

A short reference for the experimental "Remote Player" toggle in **Advanced Settings**.

---

## Why it exists

Normally, every SCORM ZIP has the quiz player JS + CSS baked inside. So when you change something in the player, the only way to push that change to learners is to **re-upload every SCORM in ALM**, which:

- Is a lot of manual work
- Resets ALM's learner-tracking records for that content

The remote-loaded approach swaps two `<script>` tags in `index.html` so the player loads from a public URL on the internet (GitHub Pages) instead of from inside the ZIP. Once that's done, **updating the player** is just a git push — no SCORM re-upload, no ALM reset.

---

## What the toggle does

Location: **Generate tab → Advanced Settings → Remote-Loaded Player**.

- **OFF** (default, and what every refresh resets to) — standard SCORM, player bundled inside. Use this for production exports.
- **ON** — exported SCORM is the remote-loaded variant. The download button changes to **Download Remote SCORM**, a confirmation dialog pops up before download, and the filename gets a `_remote` suffix so you can spot remote SCORMs at a glance.

The toggle is **session-only**. It deliberately doesn't persist — refresh the page and it's OFF again. This keeps you from accidentally shipping remote SCORMs to production.

---

## Where the remote player lives

- **GitHub repo:** [`github.com/timorld/quizzer-player`](https://github.com/timorld/quizzer-player) (public)
- **Served from:** `https://timorld.github.io/quizzer-player/`
- **Files:**
  - `scorm-api.js` — SCORM 1.2 API wrapper
  - `quiz-player.js` — quiz UI logic, scoring, state (also injects the CSS link at runtime)
  - `quiz-player.css` — all player styles

These three files **must stay in sync** with the templates inside [scorm-builder.html](scorm-builder.html) (`tpl-api`, `tpl-player`, `tpl-css`). If a learner launches a remote SCORM and the remote player expects a config field or API call that the SCORM's `index.html` doesn't provide, the quiz will break.

---

## The full update workflow

You changed something in the SCORM player (anywhere in [scorm-builder.html](scorm-builder.html) inside `tpl-api`, `tpl-player`, or `tpl-css`) and want to push it live to every already-deployed remote SCORM.

```powershell
cd test-remote-player

# 1. Pull the latest templates out of scorm-builder.html into player/
node extract.js

# 2. Commit and push the player repo
cd player
git status                      # sanity check — what's changed?
git diff                        # eyeball the diff
git add scorm-api.js quiz-player.js quiz-player.css
git commit -m "Describe what changed"
git push
```

Wait roughly **30–60 seconds** for GitHub Pages to rebuild. Verify by opening one of the URLs above directly in a browser and confirming your change is in the served file.

Re-launch a remote SCORM in ALM. The new player should show up — no re-upload needed.

---

## How to verify it actually works

Before trusting the change is live:

1. Launch a remote SCORM in ALM.
2. Open browser DevTools → Network tab.
3. Confirm `quiz-player.js` and `scorm-api.js` are being fetched from `timorld.github.io`, not from inside the ZIP.
4. Confirm the file size / hash matches what you just pushed (DevTools shows `200` for a fresh fetch, `304` if cached).

If the change isn't showing up:
- Hard-refresh the browser (Ctrl+Shift+R) — Pages assets can be aggressively cached.
- Wait another minute and try again — Pages occasionally takes longer than 60s.
- Check **GitHub → repo → Actions** for a failed Pages deploy.

---

## Pitfalls and gotchas

**`extract.js` overwrites whatever's in `player/`.**
Right now `test-remote-player/player/` may contain the original blue accent + "This is a remote-loaded player" banner test patches. Running `node extract.js` will replace those files with the clean templates from [scorm-builder.html](scorm-builder.html), wiping the test customizations. That's usually what you want once the experiment is done — but be aware.

**The remote SCORM's `index.html` still has CSS inlined.**
[scorm-builder.html](scorm-builder.html) bakes CSS into `<style>` inside `index.html` (it's not loaded as a file). The remote `quiz-player.js` has an IIFE at the top that injects a `<link>` to the remote CSS — that's what lets CSS changes also propagate. Don't remove that IIFE in `quiz-player.js`, or CSS will go stale.

**You can break already-deployed quizzes.**
If you push a change to the remote player that's incompatible with the `index.html` baked into existing SCORMs (e.g. expecting a new `window.QUIZ_CONFIG` field that older SCORMs don't set), those quizzes break in ALM. Older SCORMs *cannot* be updated to send new config fields without re-uploading. So: **additive changes to the player are safe; changes that require a new contract with index.html are not.**

**Network dependency.**
Learner browsers must reach `timorld.github.io` at quiz launch time. If GitHub Pages goes down (rare) or NVIDIA's network blocks it (theoretical), every remote SCORM stops working. Inline SCORMs are immune.

---

## Versioning, when this matures

Right now everything lives at the repo root. If we move past the experiment, the suggested pattern is:

- Move current files to `/v1/scorm-api.js`, `/v1/quiz-player.js`, `/v1/quiz-player.css`
- Have [scorm-builder.html](scorm-builder.html) point new SCORMs at `/v1/...`
- Breaking changes ship as `/v2/...`, leaving `/v1/` untouched so older deployed SCORMs keep working

Nothing in the current toggle does this yet. The URL is hardcoded as `https://timorld.github.io/quizzer-player/`.

---

## How to back out

If a remote-player push breaks production quizzes and you need to recover fast:

1. `cd test-remote-player/player`
2. `git log --oneline` — find the last good commit
3. `git revert <bad-commit-sha>` — creates a new commit that undoes it
4. `git push`
5. Wait ~30s for Pages to redeploy

This is *much* faster than re-uploading every SCORM in ALM. That's the whole point.

---

## File layout reference

```
test-remote-player/
├── extract.js                  # extracts templates from ../scorm-builder.html
├── player/                     # ← separate git repo, pushed to github.com/timorld/quizzer-player
│   ├── scorm-api.js
│   ├── quiz-player.js
│   └── quiz-player.css
└── README.md                   # step-by-step setup (one-time)
```

Parent repo's [.gitignore](.gitignore) excludes `test-remote-player/player/` so the inner repo doesn't get double-tracked.
