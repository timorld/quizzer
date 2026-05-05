const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;
const DATA_DIR = path.join(__dirname, 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const DEFAULTS_FILE = path.join(DATA_DIR, 'defaults.json');
const PRESETS_FILE  = path.join(DATA_DIR, 'presets.json');


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

// ── START ─────────────────────────────────────────────────
app.listen(PORT, 'localhost', () => {
  console.log(`SCORM Quizzer running at http://localhost:${PORT}/scorm-builder.html`);
});
