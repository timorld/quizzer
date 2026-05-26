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
