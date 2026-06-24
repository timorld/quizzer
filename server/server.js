// Load env vars from .env if dotenv is installed. Silently no-op otherwise — the
// app still works as long as the env vars are set some other way (systemd, shell, etc.)
try { require('dotenv').config({ path: require('path').join(__dirname, '.env') }); } catch (_) {}

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;
const DATA_DIR = path.join(__dirname, 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const DEFAULTS_FILE = path.join(DATA_DIR, 'defaults.json');
const PRESETS_FILE  = path.join(DATA_DIR, 'presets.json');
const BANK_FILE     = path.join(DATA_DIR, 'question-bank.json');


// ── DATA HELPERS ──────────────────────────────────────────
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

function readHistory() {
  try { return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')); } catch { return []; }
}

function writeHistory(hist) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(hist, null, 2));
}

function readDefaults() {
  try { return JSON.parse(fs.readFileSync(DEFAULTS_FILE, 'utf8')); } catch { return null; }
}

function writeDefaults(data) {
  fs.writeFileSync(DEFAULTS_FILE, JSON.stringify(data, null, 2));
}

function readPresets() {
  try { return JSON.parse(fs.readFileSync(PRESETS_FILE, 'utf8')); } catch { return []; }
}
function writePresets(data) {
  fs.writeFileSync(PRESETS_FILE, JSON.stringify(data, null, 2));
}

// Folder scopes ("tabs"). Existing folders without a scope are treated as 'academy'.
const BANK_SCOPES = ['academy', 'gpuGenius'];
function _normalizeScope(s) { return BANK_SCOPES.indexOf(s) >= 0 ? s : 'academy'; }
function readBank() {
  try {
    const raw = JSON.parse(fs.readFileSync(BANK_FILE, 'utf8'));
    const folders = Array.isArray(raw.folders) ? raw.folders : [];
    // Backfill scope so old folders default to 'academy' the first time they're read.
    folders.forEach(f => { f.scope = _normalizeScope(f.scope); });
    return {
      folders,
      questions: Array.isArray(raw.questions) ? raw.questions : []
    };
  } catch { return { folders: [], questions: [] }; }
}
function writeBank(data) {
  fs.writeFileSync(BANK_FILE, JSON.stringify(data, null, 2));
}

// One-time migration: persist the scope backfill to disk on startup so the
// data file reflects the new schema, not just the in-memory view. Idempotent —
// running again is a no-op once every folder already has a scope.
function _migrateBankScopeOnDisk() {
  try {
    if (!fs.existsSync(BANK_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(BANK_FILE, 'utf8'));
    const folders = Array.isArray(raw.folders) ? raw.folders : [];
    let changed = false;
    folders.forEach(f => {
      if (BANK_SCOPES.indexOf(f.scope) < 0) { f.scope = 'academy'; changed = true; }
    });
    if (changed) {
      writeBank({ folders, questions: Array.isArray(raw.questions) ? raw.questions : [] });
      console.log('[bank] migrated ' + folders.length + ' folder(s) to default scope "academy"');
    }
  } catch (e) {
    console.warn('[bank] scope migration skipped:', e && e.message);
  }
}
_migrateBankScopeOnDisk();

// ── MIDDLEWARE ────────────────────────────────────────────
app.use(express.json({ limit: '100mb' }));
app.use(express.static(path.join(__dirname, '..'))); // serve scorm-builder.html + ASSETS/ locally

// ── HISTORY ENDPOINTS ─────────────────────────────────────
app.get('/api/history', (req, res) => {
  res.json(readHistory());
});

app.post('/api/history', (req, res) => {
  const entry = req.body;
  if (!entry || !entry.id) return res.status(400).json({ error: 'Missing id' });
  let hist = readHistory();
  hist = hist.filter(h => h.id !== entry.id); // avoid duplicates
  hist.unshift(entry);
  writeHistory(hist);
  res.json({ ok: true });
});

app.delete('/api/history/:id', (req, res) => {
  const hist = readHistory().filter(h => h.id !== req.params.id);
  writeHistory(hist);
  res.json({ ok: true });
});

app.delete('/api/history', (req, res) => {
  writeHistory([]);
  res.json({ ok: true });
});

// ── DEFAULTS ENDPOINTS ────────────────────────────────────
app.get('/api/defaults', (req, res) => {
  res.json(readDefaults());
});

app.post('/api/defaults', (req, res) => {
  if (!req.body) return res.status(400).json({ error: 'Missing body' });
  writeDefaults(req.body);
  res.json({ ok: true });
});

// ── PRESETS ENDPOINTS ─────────────────────────────────────
app.get('/api/presets', (req, res) => res.json(readPresets()));

app.post('/api/presets', (req, res) => {
  const { id, name, settings } = req.body;
  if (!id || !name) return res.status(400).json({ error: 'Missing id or name' });
  const presets = readPresets().filter(p => p.id !== id);
  presets.push({ id, name, settings });
  writePresets(presets);
  res.json({ ok: true });
});

app.delete('/api/presets/:id', (req, res) => {
  writePresets(readPresets().filter(p => p.id !== req.params.id));
  res.json({ ok: true });
});

// ── QUESTION BANK ENDPOINTS ───────────────────────────────
// Shared bank: folders form a tree (parentId === null for top level), questions
// belong to exactly one folder. Data shape: { folders: [{id,name,parentId,sortOrder}],
// questions: [{id,folderId,...questionFields}] }.
app.get('/api/bank', (req, res) => res.json(readBank()));

app.post('/api/bank/folders', (req, res) => {
  const { id, name, parentId, sections, scope } = req.body || {};
  if (!id || !name) return res.status(400).json({ error: 'Missing id or name' });
  const bank = readBank();
  if (bank.folders.some(f => f.id === id)) return res.status(409).json({ error: 'Folder id already exists' });
  // Inherit scope from parent when nesting, otherwise honor the client's scope.
  // Scope cannot change after creation — keeps each tab's tree self-contained.
  let folderScope = _normalizeScope(scope);
  if (parentId) {
    const parent = bank.folders.find(f => f.id === parentId);
    if (!parent) return res.status(404).json({ error: 'parentId does not exist' });
    folderScope = parent.scope;
  }
  const now = Date.now();
  const entry = { id, name: String(name), parentId: parentId || null, sortOrder: bank.folders.length, updatedAt: now, scope: folderScope };
  if (Array.isArray(sections)) entry.sections = sections.map(String).filter(Boolean);
  bank.folders.push(entry);
  writeBank(bank);
  res.json({ ok: true });
});

app.patch('/api/bank/folders/:id', (req, res) => {
  const bank = readBank();
  const f = bank.folders.find(f => f.id === req.params.id);
  if (!f) return res.status(404).json({ error: 'Folder not found' });
  const { name, parentId, sortOrder, sections } = req.body || {};
  if (typeof name === 'string' && name.trim()) f.name = name.trim();
  if (parentId !== undefined) {
    if (parentId === f.id) return res.status(400).json({ error: 'Folder cannot be its own parent' });
    const descendantIds = _collectDescendantFolderIds(bank.folders, f.id);
    if (parentId && descendantIds.has(parentId)) return res.status(400).json({ error: 'Cannot move folder into its own descendant' });
    // Cross-scope moves are not allowed — folders stay in their tab.
    if (parentId) {
      const newParent = bank.folders.find(x => x.id === parentId);
      if (!newParent) return res.status(404).json({ error: 'parentId does not exist' });
      if ((newParent.scope || 'academy') !== (f.scope || 'academy')) {
        return res.status(400).json({ error: 'Cannot move folder across tabs' });
      }
    }
    f.parentId = parentId || null;
  }
  if (typeof sortOrder === 'number') f.sortOrder = sortOrder;
  if (Array.isArray(sections)) f.sections = sections.map(String).filter(Boolean);
  f.updatedAt = Date.now();
  writeBank(bank);
  res.json({ ok: true });
});

app.delete('/api/bank/folders/:id', (req, res) => {
  const bank = readBank();
  const id = req.params.id;
  const cascade = req.query.cascade === '1' || req.query.cascade === 'true';
  const descendants = _collectDescendantFolderIds(bank.folders, id);
  const allFolderIds = new Set([id, ...descendants]);
  const childQuestions = bank.questions.filter(q => allFolderIds.has(q.folderId));
  if (!cascade && (descendants.size || childQuestions.length)) {
    return res.status(409).json({ error: 'Folder is not empty', childFolders: descendants.size, childQuestions: childQuestions.length });
  }
  bank.folders = bank.folders.filter(f => !allFolderIds.has(f.id));
  bank.questions = bank.questions.filter(q => !allFolderIds.has(q.folderId));
  writeBank(bank);
  res.json({ ok: true, deletedFolders: allFolderIds.size, deletedQuestions: childQuestions.length });
});

function _bumpFolder(bank, folderId) {
  if (!folderId) return;
  const f = bank.folders.find(x => x.id === folderId);
  if (f) f.updatedAt = Date.now();
}

app.post('/api/bank/questions', (req, res) => {
  const q = req.body;
  if (!q || !q.id) return res.status(400).json({ error: 'Missing id' });
  if (!q.folderId) return res.status(400).json({ error: 'Missing folderId' });
  const bank = readBank();
  if (!bank.folders.some(f => f.id === q.folderId)) return res.status(404).json({ error: 'folderId does not exist' });
  const existingIdx = bank.questions.findIndex(x => x.id === q.id);
  if (existingIdx >= 0) {
    // Update in place so editing a question doesn't reorder it to the bottom
    bank.questions[existingIdx] = q;
  } else {
    bank.questions.push(q);
  }
  _bumpFolder(bank, q.folderId);
  writeBank(bank);
  res.json({ ok: true });
});

app.patch('/api/bank/questions/:id', (req, res) => {
  const bank = readBank();
  const idx = bank.questions.findIndex(q => q.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Question not found' });
  const patch = req.body || {};
  if (patch.folderId && !bank.folders.some(f => f.id === patch.folderId)) {
    return res.status(404).json({ error: 'folderId does not exist' });
  }
  // Block cross-scope question moves — questions stay in their tab.
  if (patch.folderId) {
    const oldF = bank.folders.find(f => f.id === bank.questions[idx].folderId);
    const newF = bank.folders.find(f => f.id === patch.folderId);
    if (oldF && newF && (oldF.scope || 'academy') !== (newF.scope || 'academy')) {
      return res.status(400).json({ error: 'Cannot move questions across tabs' });
    }
  }
  const oldFolder = bank.questions[idx].folderId;
  bank.questions[idx] = Object.assign({}, bank.questions[idx], patch, { id: bank.questions[idx].id });
  _bumpFolder(bank, bank.questions[idx].folderId);
  if (patch.folderId && oldFolder && oldFolder !== patch.folderId) _bumpFolder(bank, oldFolder);
  writeBank(bank);
  res.json({ ok: true });
});

app.delete('/api/bank/questions/:id', (req, res) => {
  const bank = readBank();
  const q = bank.questions.find(x => x.id === req.params.id);
  bank.questions = bank.questions.filter(x => x.id !== req.params.id);
  if (q) _bumpFolder(bank, q.folderId);
  writeBank(bank);
  res.json({ ok: true });
});

// Reorder questions within a folder. Body: { folderId, orderedIds }. The given
// ids replace, in-place, the array slots currently occupied by ids in that
// folder. Questions in other folders keep their absolute positions, so the
// global order outside the touched folder is preserved.
app.post('/api/bank/questions/reorder', (req, res) => {
  const { folderId, orderedIds } = req.body || {};
  if (!folderId || !Array.isArray(orderedIds)) return res.status(400).json({ error: 'Missing folderId or orderedIds' });
  const bank = readBank();
  const idToQ = new Map(bank.questions.map(q => [q.id, q]));
  for (const id of orderedIds) {
    const q = idToQ.get(id);
    if (!q) return res.status(400).json({ error: 'Unknown id: ' + id });
    if (q.folderId !== folderId) return res.status(400).json({ error: 'id ' + id + ' is not in folder ' + folderId });
  }
  const idSet = new Set(orderedIds);
  const orderQueue = orderedIds.slice();
  const result = [];
  for (const q of bank.questions) {
    if (idSet.has(q.id)) {
      const nextId = orderQueue.shift();
      result.push(idToQ.get(nextId));
    } else {
      result.push(q);
    }
  }
  bank.questions = result;
  writeBank(bank);
  res.json({ ok: true });
});

function _collectDescendantFolderIds(folders, rootId) {
  const out = new Set();
  const queue = [rootId];
  while (queue.length) {
    const cur = queue.shift();
    folders.filter(f => f.parentId === cur).forEach(f => { out.add(f.id); queue.push(f.id); });
  }
  return out;
}

// ── AI PROXY ──────────────────────────────────────────────
// Forwards browser requests to the configured AI inference endpoint, keeping
// the API key server-side. Configured via env vars:
//   NVIDIA_API_KEY      (required)
//   NVIDIA_API_ENDPOINT (optional, default below)
//   NVIDIA_API_MODEL    (optional, default below)
// Requires Node 18+ for the built-in fetch().
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || '';
const NVIDIA_API_ENDPOINT = process.env.NVIDIA_API_ENDPOINT || 'https://inference-api.nvidia.com/v1/chat/completions';
const NVIDIA_API_MODEL = process.env.NVIDIA_API_MODEL || 'openai/openai/gpt-5-mini';

function _ts() { return '[' + new Date().toISOString() + ']'; }

app.post('/api/ai-convert', async (req, res) => {
  if (!NVIDIA_API_KEY) {
    console.error(_ts() + ' AI proxy: NVIDIA_API_KEY env var is not set');
    return res.status(503).json({ error: 'AI service not configured. Set NVIDIA_API_KEY on the server.' });
  }
  try {
    const upstream = await fetch(NVIDIA_API_ENDPOINT, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + NVIDIA_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ model: NVIDIA_API_MODEL }, req.body || {}))
    });
    const text = await upstream.text();
    if (!upstream.ok) {
      console.error(_ts() + ' AI proxy: upstream returned ' + upstream.status + ': ' + text.slice(0, 500));
      return res.status(upstream.status).json({
        error: 'AI service returned ' + upstream.status + (upstream.status === 401 || upstream.status === 403 ? ' — the API key may be expired or invalid. Please notify your administrator.' : ''),
        upstream_status: upstream.status,
        upstream_body: text.slice(0, 500)
      });
    }
    res.type('application/json').send(text);
  } catch (e) {
    console.error(_ts() + ' AI proxy: network error: ' + e.message);
    res.status(502).json({ error: 'Could not reach the AI service: ' + e.message });
  }
});

app.get('/api/ai-status', async (req, res) => {
  if (!NVIDIA_API_KEY) {
    return res.json({ ok: false, configured: false, error: 'NVIDIA_API_KEY env var is not set on the server' });
  }
  try {
    const upstream = await fetch(NVIDIA_API_ENDPOINT, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + NVIDIA_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: NVIDIA_API_MODEL, messages: [{ role: 'user', content: 'reply with the single word: ok' }], max_tokens: 30 })
    });
    if (!upstream.ok) {
      const txt = await upstream.text();
      console.error(_ts() + ' AI status check failed: ' + upstream.status + ': ' + txt.slice(0, 300));
      return res.json({ ok: false, configured: true, status: upstream.status, error: 'Upstream returned ' + upstream.status + (upstream.status === 401 || upstream.status === 403 ? ' — the API key may be expired or invalid.' : '') });
    }
    const data = await upstream.json();
    const reply = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || '').trim();
    res.json({ ok: true, configured: true, model: NVIDIA_API_MODEL, reply: reply.slice(0, 60) });
  } catch (e) {
    console.error(_ts() + ' AI status check error: ' + e.message);
    res.json({ ok: false, configured: true, error: e.message });
  }
});

// ── START ─────────────────────────────────────────────────
app.listen(PORT, 'localhost', () => {
  console.log(`SCORM Quizzer running at http://localhost:${PORT}/scorm-builder.html`);
});
