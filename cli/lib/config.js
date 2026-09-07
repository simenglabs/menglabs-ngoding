import fs from 'fs';
import path from 'path';
import os from 'os';

const GLOBAL_DIR = path.join(os.homedir(), '.menglabs');
const GLOBAL_FILE = path.join(GLOBAL_DIR, 'config.json');
const LOCAL_FILE = path.join(process.cwd(), '.menglabs.json');

export function loadConfig() {
  const env = {
    apiBase: process.env.MENGLABS_API || process.env.API_BASE || '',
    apiKey: process.env.MENGLABS_KEY || process.env.AGENT_API_KEY || '',
    perencanaanId: process.env.MENGLABS_PERENCANAAN || process.env.PERENCANAAN_ID || ''
  };
  let fileCfg = {};
  for (const p of [GLOBAL_FILE, LOCAL_FILE]) {
    try { if (fs.existsSync(p)) fileCfg = { ...fileCfg, ...JSON.parse(fs.readFileSync(p, 'utf8')) }; } catch {}
  }
  return {
    apiBase: env.apiBase || fileCfg.apiBase || fileCfg.API_BASE || 'http://localhost:5173',
    apiKey: env.apiKey || fileCfg.apiKey || fileCfg.AGENT_API_KEY || 'sk-agent-local-2026',
    perencanaanId: env.perencanaanId || fileCfg.perencanaanId || fileCfg.perencanaanId || '',
    _file: LOCAL_FILE,
    _globalFile: GLOBAL_FILE
  };
}

export function saveConfig(patch, { global = false } = {}) {
  const file = global ? GLOBAL_FILE : LOCAL_FILE;
  let cur = {};
  try { if (fs.existsSync(file)) cur = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
  const next = { ...cur, ...patch };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(next, null, 2));
  return file;
}

export function requireConfig() {
  const c = loadConfig();
  if (!c.apiBase) throw new Error('apiBase belum set. Jalankan: npx menglabs-ngoding init --url https://your-host --key sk-...');
  return c;
}
