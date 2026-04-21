const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

function parseDotEnv(raw = '') {
  const out = {};
  const text = String(raw || '');
  for (const line of text.split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    const idx = s.indexOf('=');
    if (idx <= 0) continue;
    const k = s.slice(0, idx).trim();
    let v = s.slice(idx + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (k) out[k] = v;
  }
  return out;
}

function pickFirstExisting(candidates = []) {
  for (const p of candidates) {
    try {
      if (!p) continue;
      if (fs.existsSync(p)) return p;
    } catch {}
  }
  return String(candidates?.[0] || '');
}

function loadSkillEnvIntoProcess() {
  const roots = [
    path.resolve(__dirname, '..'), // workspace/skill (legacy)
    path.resolve(__dirname, '..', '..', 'ocSkill'), // workspace/ocSkill (legacy)
    path.resolve(__dirname, '..', '..', 'gitskill'), // workspace/gitskill
    path.resolve(__dirname, '..', '..', 'gitskill', 'linggan-video-tools'),
    path.resolve(__dirname, '..', '..', 'gitskill', 'video-generation-pic2api'),
    path.resolve(__dirname, '..', 'linggan-video-tools'), // sibling under gitskill
    path.resolve(__dirname, '..', 'video-generation-pic2api'), // sibling under gitskill
  ];

  const candidateDirs = [];
  for (const root of roots) {
    try {
      if (!fs.existsSync(root)) continue;
      const stat = fs.statSync(root);
      if (!stat.isDirectory()) continue;
      candidateDirs.push(root);
      const entries = fs.readdirSync(root, { withFileTypes: true })
        .filter((e) => e && e.isDirectory())
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
      for (const e of entries) {
        candidateDirs.push(path.join(root, e.name));
      }
    } catch (err) {
      console.warn('[bridge] scan env root failed:', root, err.message);
    }
  }

  const loaded = new Set();
  for (const dir of candidateDirs) {
    try {
      const envPath = path.join(dir, '.env');
      if (!fs.existsSync(envPath)) continue;
      const real = path.resolve(envPath);
      if (loaded.has(real)) continue;
      loaded.add(real);

      const kv = parseDotEnv(fs.readFileSync(envPath, 'utf8'));
      for (const [k, v] of Object.entries(kv)) {
        if (process.env[k] == null || String(process.env[k]).trim() === '') {
          process.env[k] = String(v || '');
        }
      }
    } catch (err) {
      console.warn('[bridge] load skill .env failed:', dir, err.message);
    }
  }
}

loadSkillEnvIntoProcess();

const PORT = Number(process.env.STORYBOARD_BRIDGE_PORT || 12732);
const CONFIG_PATH = process.env.STORYBOARD_BRIDGE_CONFIG || path.join(__dirname, 'bridge-config.json');
const DEFAULT_PUBLIC_CHAT_PATH = '/v1/chat/completions';
const CHAT_PATH_ALIASES = new Set(['/v1/chat/completions', '/v1/chat/completions/', '/chat/completions', '/api/chat/completions']);
const DEFAULT_GATEWAY_BASE = 'http://127.0.0.1:18789';
const DEFAULT_GATEWAY_CHAT_PATH = '/v1/chat/completions';
const DEFAULT_GATEWAY_HEALTH_PATH = '/healthz';
const DEFAULT_GATEWAY_READY_PATH = '/readyz';
const LOCAL_OPENCLAW_CONFIG_PATH = path.join(process.env.USERPROFILE || 'C:\\Users\\shuis', '.openclaw', 'openclaw.json');
const PREVIEW_ASSETS_ROOT = process.env.STORYBOARD_ASSETS_ROOT || path.join(__dirname, 'assets');
const PROJECT_INDEX_JSON_PATH = process.env.STORYBOARD_PROJECT_INDEX_JSON || path.join(PREVIEW_ASSETS_ROOT, 'project-index.json');
const PROJECT_NAME_RE = /^(episode-|cat-|trenchcoat-|opc-|auto-selection-)[a-z0-9._-]+$/i;
const LINGGAN_SCRIPT_PATH = pickFirstExisting([
  path.resolve(__dirname, '..', 'linggan-video-tools', 'scripts', 'call_generate_character_image.py'), // gitskill sibling
  path.resolve(__dirname, '..', '..', 'gitskill', 'linggan-video-tools', 'scripts', 'call_generate_character_image.py'), // explicit gitskill
  path.resolve(__dirname, '..', '..', 'ocSkill', 'linggan-video-tools', 'scripts', 'call_generate_character_image.py'), // legacy
]);
const LINGGAN_SCENE_SCRIPT_PATH = pickFirstExisting([
  path.resolve(__dirname, '..', 'linggan-video-tools', 'scripts', 'call_generate_shot_image_with_refs.py'), // gitskill sibling
  path.resolve(__dirname, '..', '..', 'gitskill', 'linggan-video-tools', 'scripts', 'call_generate_shot_image_with_refs.py'), // explicit gitskill
  path.resolve(__dirname, '..', '..', 'ocSkill', 'linggan-video-tools', 'scripts', 'call_generate_shot_image_with_refs.py'), // legacy
]);
const PIC2API_SCRIPT_PATH = pickFirstExisting([
  path.resolve(__dirname, '..', 'video-generation-pic2api', 'scripts', 'generate_video.py'), // gitskill sibling
  path.resolve(__dirname, '..', '..', 'gitskill', 'video-generation-pic2api', 'scripts', 'generate_video.py'), // explicit gitskill
]);
const DEFAULT_PUBLIC_UPLOAD_URL = process.env.OPENAI_IMAGES_UPLOAD_URL || 'https://imageproxy.zhongzhuan.chat/api/upload';
const DEFAULT_PUBLIC_UPLOAD_API_KEY = process.env.OPENAI_IMAGES_UPLOAD_API_KEY || '';
const DEFAULT_LOBSTER_TASK_SESSION_KEY = 'session:storyboard-lobster';
const DEFAULT_LOBSTER_TASK_MODEL = 'gpt-5.3-codex-spark';

function readLocalGatewayToken() {
  try {
    if (!fs.existsSync(LOCAL_OPENCLAW_CONFIG_PATH)) return '';
    const raw = fs.readFileSync(LOCAL_OPENCLAW_CONFIG_PATH, 'utf8');
    const sanitized = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw;
    const parsed = JSON.parse(sanitized);
    return String(parsed?.gateway?.auth?.token || '').trim();
  } catch {
    return '';
  }
}

function loadConfig() {
  let file = {};
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      file = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch (err) {
      console.warn('[bridge] failed to parse bridge-config.json:', err.message);
    }
  }
  const tokenFromFile = readLocalGatewayToken();
  const guard = (file && typeof file.guard === 'object' && file.guard) ? file.guard : {};
  const linggan = (file && typeof file.linggan === 'object' && file.linggan) ? file.linggan : {};
  return {
    mode: String(process.env.STORYBOARD_BRIDGE_MODE || file.mode || 'openclaw').trim().toLowerCase() || 'openclaw',
    gatewayBase: String(process.env.OPENCLAW_GATEWAY_BASE || process.env.STORYBOARD_GATEWAY_BASE || file.gatewayBase || DEFAULT_GATEWAY_BASE).trim().replace(/\/$/, ''),
    gatewayToken: String(process.env.OPENCLAW_GATEWAY_TOKEN || process.env.STORYBOARD_GATEWAY_TOKEN || file.gatewayToken || tokenFromFile || '').trim(),
    gatewayChatPath: String(process.env.STORYBOARD_GATEWAY_CHAT_PATH || file.gatewayChatPath || DEFAULT_GATEWAY_CHAT_PATH).trim() || DEFAULT_GATEWAY_CHAT_PATH,
    gatewayHealthPath: String(process.env.STORYBOARD_GATEWAY_HEALTH_PATH || file.gatewayHealthPath || DEFAULT_GATEWAY_HEALTH_PATH).trim() || DEFAULT_GATEWAY_HEALTH_PATH,
    gatewayReadyPath: String(process.env.STORYBOARD_GATEWAY_READY_PATH || file.gatewayReadyPath || DEFAULT_GATEWAY_READY_PATH).trim() || DEFAULT_GATEWAY_READY_PATH,
    defaultSessionKey: String(process.env.STORYBOARD_DEFAULT_SESSION_KEY || file.defaultSessionKey || 'main').trim() || 'main',
    allowSessionOverride: process.env.STORYBOARD_ALLOW_SESSION_OVERRIDE
      ? ['1', 'true', 'yes', 'on'].includes(String(process.env.STORYBOARD_ALLOW_SESSION_OVERRIDE).trim().toLowerCase())
      : !!file.allowSessionOverride,
    lobsterTaskSessionKey: String(process.env.STORYBOARD_LOBSTER_TASK_SESSION_KEY || file.lobsterTaskSessionKey || DEFAULT_LOBSTER_TASK_SESSION_KEY).trim() || DEFAULT_LOBSTER_TASK_SESSION_KEY,
    lobsterTaskModel: String(process.env.STORYBOARD_LOBSTER_TASK_MODEL || file.lobsterTaskModel || DEFAULT_LOBSTER_TASK_MODEL).trim() || DEFAULT_LOBSTER_TASK_MODEL,
    defaultModel: String(process.env.STORYBOARD_DEFAULT_MODEL || file.defaultModel || 'gpt-5.4').trim() || 'gpt-5.4',
    fallbackModels: Array.isArray(file.fallbackModels)
      ? file.fallbackModels.map(x => String(x || '').trim()).filter(Boolean)
      : [],
    timeoutMs: Number(process.env.STORYBOARD_TIMEOUT_MS || file.timeoutMs || 120000),
    openclawAdapter: String(process.env.STORYBOARD_OPENCLAW_ADAPTER || file.openclawAdapter || 'ready').trim().toLowerCase() || 'ready',
    linggan: {
      enabled: process.env.STORYBOARD_LINGGAN_ENABLED
        ? ['1', 'true', 'yes', 'on'].includes(String(process.env.STORYBOARD_LINGGAN_ENABLED).trim().toLowerCase())
        : linggan.enabled !== false,
      baseUrl: String(process.env.STORYBOARD_LINGGAN_BASE_URL || process.env.LINGGAN_BASE_URL || linggan.baseUrl || 'https://uuerqapsftez.sealosgzg.site/').trim(),
      token: String(process.env.STORYBOARD_LINGGAN_TOKEN || process.env.LINGGAN_TOKEN || linggan.token || '').trim(),
      apiKey: String(process.env.STORYBOARD_LINGGAN_API_KEY || process.env.LINGGAN_API_KEY || process.env.STORYBOARD_LINGGAN_API_KEY || linggan.apiKey || '').trim(),
      size: String(process.env.STORYBOARD_LINGGAN_SIZE || linggan.size || '9:16').trim(),
      timeoutSec: Number(process.env.STORYBOARD_LINGGAN_TIMEOUT_SEC || linggan.timeoutSec || 120),
      pythonCmd: String(process.env.STORYBOARD_LINGGAN_PYTHON || linggan.pythonCmd || 'python').trim() || 'python',
    },
    pic2api: (() => {
      const p = (file && typeof file.pic2api === 'object' && file.pic2api) ? file.pic2api : {};
      return {
        enabled: process.env.STORYBOARD_PIC2API_ENABLED
          ? ['1', 'true', 'yes', 'on'].includes(String(process.env.STORYBOARD_PIC2API_ENABLED).trim().toLowerCase())
          : p.enabled !== false,
        baseUrl: String(process.env.PIC2API_BASE_URL || p.baseUrl || 'https://www.pic2api.com/v1').trim(),
        apiKey: String(process.env.PIC2API_KEY || p.apiKey || '').trim(),
        defaultModel: String(process.env.STORYBOARD_PIC2API_MODEL || p.defaultModel || 'sora2-pro').trim() || 'sora2-pro',
        defaultSize: String(process.env.STORYBOARD_PIC2API_SIZE || p.defaultSize || '1024x576').trim() || '1024x576',
        defaultDuration: Number(process.env.STORYBOARD_PIC2API_DURATION || p.defaultDuration || 8),
        timeoutSec: Number(process.env.STORYBOARD_PIC2API_TIMEOUT_SEC || p.timeoutSec || 480),
        pollIntervalSec: Number(process.env.STORYBOARD_PIC2API_POLL_SEC || p.pollIntervalSec || 4),
        pythonCmd: String(process.env.STORYBOARD_PIC2API_PYTHON || p.pythonCmd || process.env.STORYBOARD_LINGGAN_PYTHON || linggan.pythonCmd || 'python').trim() || 'python',
      };
    })(),
    guard: {
      enabled: process.env.STORYBOARD_GUARD_ENABLED
        ? ['1', 'true', 'yes', 'on'].includes(String(process.env.STORYBOARD_GUARD_ENABLED).trim().toLowerCase())
        : guard.enabled !== false,
      injectSystemPrompt: process.env.STORYBOARD_GUARD_INJECT_SYSTEM
        ? ['1', 'true', 'yes', 'on'].includes(String(process.env.STORYBOARD_GUARD_INJECT_SYSTEM).trim().toLowerCase())
        : guard.injectSystemPrompt !== false,
      systemPrompt: String(process.env.STORYBOARD_GUARD_SYSTEM_PROMPT || guard.systemPrompt || '').trim(),
      allowKeywords: Array.isArray(guard.allowKeywords) ? guard.allowKeywords.map(x => String(x || '').toLowerCase()).filter(Boolean) : [],
      denyKeywords: Array.isArray(guard.denyKeywords) ? guard.denyKeywords.map(x => String(x || '').toLowerCase()).filter(Boolean) : [],
    },
  };
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function ensurePreviewAssetsRoot() {
  if (!fs.existsSync(PREVIEW_ASSETS_ROOT)) {
    fs.mkdirSync(PREVIEW_ASSETS_ROOT, { recursive: true });
  }
}

function readProjectIndexJson() {
  try {
    if (!fs.existsSync(PROJECT_INDEX_JSON_PATH)) return [];
    const raw = fs.readFileSync(PROJECT_INDEX_JSON_PATH, 'utf8');
    const data = JSON.parse(raw);
    const arr = Array.isArray(data?.projects) ? data.projects : (Array.isArray(data) ? data : []);
    return arr
      .map((it) => (typeof it === 'string' ? it : String(it?.name || '').trim()))
      .map((name) => String(name || '').trim())
      .filter((name) => PROJECT_NAME_RE.test(name));
  } catch {
    return [];
  }
}

function scanProjectsFromAssetsRoot() {
  try {
    if (!fs.existsSync(PREVIEW_ASSETS_ROOT)) return [];
    const entries = fs.readdirSync(PREVIEW_ASSETS_ROOT, { withFileTypes: true });
    return entries
      .filter((d) => d && d.isDirectory())
      .map((d) => String(d.name || '').trim())
      .filter((name) => PROJECT_NAME_RE.test(name))
      .filter((name) => fs.existsSync(path.join(PREVIEW_ASSETS_ROOT, name, 'planning')))
      .sort();
  } catch {
    return [];
  }
}

function writeProjectIndexJson(projects) {
  ensurePreviewAssetsRoot();
  const uniq = [...new Set((projects || []).map((x) => String(x || '').trim()).filter((x) => PROJECT_NAME_RE.test(x)))].sort();
  const payload = {
    updatedAt: new Date().toISOString(),
    projects: uniq,
  };
  fs.writeFileSync(PROJECT_INDEX_JSON_PATH, JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

function listProjects({ refresh = false } = {}) {
  const scanned = scanProjectsFromAssetsRoot();
  if (refresh) {
    const next = writeProjectIndexJson(scanned);
    return { source: 'scan+json', ...next };
  }

  const fromJson = readProjectIndexJson();
  const merged = [...new Set([...(fromJson || []), ...(scanned || [])])].sort();
  if (!fromJson.length && merged.length) {
    const next = writeProjectIndexJson(merged);
    return { source: 'scan+json', ...next };
  }
  return {
    source: fromJson.length ? 'json+scan-merge' : 'scan',
    updatedAt: fs.existsSync(PROJECT_INDEX_JSON_PATH) ? new Date(fs.statSync(PROJECT_INDEX_JSON_PATH).mtimeMs).toISOString() : new Date().toISOString(),
    projects: merged,
  };
}

function collectBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 2 * 1024 * 1024) {
        reject(new Error('request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

function normalizePath(p, fallback) {
  const v = String(p || '').trim();
  if (!v) return fallback;
  if (/^https?:\/\//i.test(v)) return v;
  return v.startsWith('/') ? v : `/${v}`;
}

function joinBaseAndPath(base, p, fallback) {
  const baseClean = String(base || '').trim().replace(/\/$/, '');
  const norm = normalizePath(p, fallback);
  if (/^https?:\/\//i.test(norm)) return norm;
  return `${baseClean}${norm}`;
}

async function callJson(url, { method = 'GET', headers = {}, body, timeoutMs = 120000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
  try {
    const resp = await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal,
    });
    const text = await resp.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch {}
    return { ok: resp.ok, status: resp.status, text, data };
  } catch (err) {
    return { ok: false, status: 0, text: err?.message || String(err), data: null, error: err };
  } finally {
    clearTimeout(timer);
  }
}

async function probeGateway(cfg) {
  const base = cfg.gatewayBase || DEFAULT_GATEWAY_BASE;
  const chatUrl = joinBaseAndPath(base, cfg.gatewayChatPath, DEFAULT_GATEWAY_CHAT_PATH);
  const liveUrl = joinBaseAndPath(base, cfg.gatewayHealthPath, DEFAULT_GATEWAY_HEALTH_PATH);
  const readyUrl = joinBaseAndPath(base, cfg.gatewayReadyPath, DEFAULT_GATEWAY_READY_PATH);
  const [live, ready] = await Promise.all([
    callJson(liveUrl, { method: 'GET', timeoutMs: Math.min(cfg.timeoutMs, 5000) }),
    callJson(readyUrl, { method: 'GET', timeoutMs: Math.min(cfg.timeoutMs, 5000) }),
  ]);
  return {
    base,
    chatUrl,
    liveUrl,
    readyUrl,
    live,
    ready,
    reachable: !!(live.ok || ready.ok),
  };
}

function normalizePreviewMessages(body) {
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  return messages
    .map((item) => ({
      role: String(item?.role || 'user').trim() || 'user',
      content: typeof item?.content === 'string'
        ? item.content
        : Array.isArray(item?.content)
          ? item.content.map(part => typeof part?.text === 'string' ? part.text : '').join('\n').trim()
          : String(item?.content || '').trim(),
    }))
    .filter(item => item.content);
}

function isOpenClawModelRef(v) {
  const raw = String(v || '').trim().toLowerCase();
  return raw === 'openclaw' || raw.startsWith('openclaw/') || raw.startsWith('openclaw:') || raw.startsWith('agent:');
}

function isInvalidOpenClawModelError(upstream) {
  const msg = String(upstream?.data?.error?.message || upstream?.text || '').toLowerCase();
  return msg.includes('invalid `model`')
    || msg.includes('invalid `x-openclaw-model`')
    || (msg.includes('model') && msg.includes('not allowed for agent'));
}

function isNotFoundError(upstream) {
  const status = Number(upstream?.status || 0);
  if (status === 404) return true;
  const msg = String(upstream?.data?.error?.message || upstream?.text || '').toLowerCase();
  return msg.includes('not found') || msg.includes('404');
}

function isServiceUnavailableError(upstream) {
  const status = Number(upstream?.status || 0);
  if (status === 503) return true;
  const msg = String(upstream?.data?.error?.message || upstream?.text || '').toLowerCase();
  return msg.includes('503') || msg.includes('service temporarily unavailable') || msg.includes('service unavailable');
}

function textContainsAny(text, words = []) {
  const t = String(text || '').toLowerCase();
  return words.some(w => t.includes(String(w || '').toLowerCase()));
}

function decideGuard(cfg, body) {
  const guard = cfg?.guard || {};
  if (!guard.enabled) return { blocked: false, reason: '' };

  const msgs = Array.isArray(body?.messages) ? body.messages : [];
  const userText = msgs
    .filter(m => String(m?.role || '').toLowerCase() === 'user')
    .map(m => typeof m?.content === 'string' ? m.content : JSON.stringify(m?.content || ''))
    .join('\n')
    .trim();

  const hitDeny = textContainsAny(userText, guard.denyKeywords || []);
  const hitAllow = textContainsAny(userText, guard.allowKeywords || []);

  if (hitDeny && !hitAllow) {
    return {
      blocked: true,
      reason: '请求包含网页/脚本改动相关内容，不在允许范围（仅剧本/图片/声音）。'
    };
  }
  return { blocked: false, reason: '' };
}

function injectGuardSystemPrompt(body, cfg) {
  const guard = cfg?.guard || {};
  if (!guard.enabled || !guard.injectSystemPrompt || !guard.systemPrompt) return body;
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const next = [{ role: 'system', content: guard.systemPrompt }, ...messages];
  return { ...body, messages: next };
}

function extractLastJsonBlock(text = '') {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const starts = [];
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '{') starts.push(i);
  }
  for (let i = starts.length - 1; i >= 0; i--) {
    const part = raw.slice(starts[i]).trim();
    try {
      return JSON.parse(part);
    } catch {}
  }
  return null;
}

function pickImageUrlFromLingganResponse(data) {
  if (!data || typeof data !== 'object') return '';
  return String(
    data?.sceneImageUrl
    || data?.imageUrl
    || data?.data?.url
    || data?.data?.image_url
    || data?.response?.data?.url
    || data?.response?.data?.image_url
    || ''
  ).trim();
}

function sanitizeFileStem(v = '') {
  return String(v || '')
    .trim()
    .replace(/[\\/:*?"<>|\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64) || 'character';
}

function guessExtFromContentType(contentType = '') {
  const ct = String(contentType || '').toLowerCase();
  if (ct.includes('image/png')) return '.png';
  if (ct.includes('image/jpeg') || ct.includes('image/jpg')) return '.jpg';
  if (ct.includes('image/webp')) return '.webp';
  if (ct.includes('image/gif')) return '.gif';
  return '';
}

function guessExtFromUrl(url = '') {
  const m = String(url || '').match(/\.([a-z0-9]{2,5})(?:\?|#|$)/i);
  if (!m) return '';
  const ext = `.${String(m[1] || '').toLowerCase()}`;
  return ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext) ? (ext === '.jpeg' ? '.jpg' : ext) : '';
}

function guessMimeTypeFromExt(filePath = '') {
  const ext = String(path.extname(String(filePath || '')).toLowerCase() || '');
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'application/octet-stream';
}

async function downloadImageToPreviewAssets(remoteUrl, characterName = 'character') {
  const resp = await fetch(remoteUrl, { method: 'GET' });
  if (!resp.ok) {
    throw new Error(`下载远程图片失败（HTTP ${resp.status}）`);
  }
  const ab = await resp.arrayBuffer();
  const buf = Buffer.from(ab);
  if (!buf.length) throw new Error('下载远程图片失败（空内容）');

  const ext = guessExtFromContentType(resp.headers.get('content-type')) || guessExtFromUrl(remoteUrl) || '.png';
  const relDir = path.join('generated', 'characters');
  const absDir = path.join(PREVIEW_ASSETS_ROOT, relDir);
  fs.mkdirSync(absDir, { recursive: true });

  const stem = sanitizeFileStem(characterName);
  const fileName = `${stem}-${Date.now()}${ext}`;
  const absPath = path.join(absDir, fileName);
  fs.writeFileSync(absPath, buf);

  const relUrl = `./${path.join(relDir, fileName).replace(/\\/g, '/')}`;
  return { absPath, relUrl };
}

async function downloadSceneImageToPreviewAssets(remoteUrl, project = '', segmentId = '') {
  const resp = await fetch(remoteUrl, { method: 'GET' });
  if (!resp.ok) throw new Error(`下载分镜图失败（HTTP ${resp.status}）`);

  const ab = await resp.arrayBuffer();
  const buf = Buffer.from(ab);
  if (!buf.length) throw new Error('下载分镜图失败（空内容）');

  const ext = guessExtFromContentType(resp.headers.get('content-type')) || guessExtFromUrl(remoteUrl) || '.png';
  const relDir = path.join('generated', 'scenes');
  const absDir = path.join(PREVIEW_ASSETS_ROOT, relDir);
  fs.mkdirSync(absDir, { recursive: true });

  const stem = sanitizeFileStem(`${project || 'project'}-${segmentId || 'segment'}`);
  const fileName = `${stem}-${Date.now()}${ext}`;
  const absPath = path.join(absDir, fileName);
  fs.writeFileSync(absPath, buf);

  const relUrl = `./${path.join(relDir, fileName).replace(/\\/g, '/')}`;
  return { absPath, relUrl };
}

function copyLocalSceneImageToPreviewAssets(localPath, project = '', segmentId = '') {
  const src = path.resolve(String(localPath || '').trim());
  if (!src || !fs.existsSync(src) || !fs.statSync(src).isFile()) {
    throw new Error(`本地分镜图不存在：${src}`);
  }

  const ext = path.extname(src).toLowerCase() || '.png';
  const safeExt = ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext) ? (ext === '.jpeg' ? '.jpg' : ext) : '.png';
  const relDir = path.join('generated', 'scenes');
  const absDir = path.join(PREVIEW_ASSETS_ROOT, relDir);
  fs.mkdirSync(absDir, { recursive: true });

  const stem = sanitizeFileStem(`${project || 'project'}-${segmentId || 'segment'}`);
  const fileName = `${stem}-${Date.now()}${safeExt}`;
  const absPath = path.join(absDir, fileName);
  fs.copyFileSync(src, absPath);

  const relUrl = `./${path.join(relDir, fileName).replace(/\\/g, '/')}`;
  return { absPath, relUrl };
}

function resolveSceneRefPath(imageUrl = '') {
  const raw = String(imageUrl || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (path.isAbsolute(raw)) return raw;
  const cleaned = raw.replace(/^\.\//, '');
  return path.join(PREVIEW_ASSETS_ROOT, cleaned);
}

function extractLocalImagePathFromScriptOutput(data) {
  if (!data || typeof data !== 'object') return '';
  return String(
    data?.localImagePath
    || data?.result?.localImagePath
    || ''
  ).trim();
}

async function uploadLocalFileToPublic(localPath, uploadUrl = DEFAULT_PUBLIC_UPLOAD_URL, uploadApiKey = DEFAULT_PUBLIC_UPLOAD_API_KEY) {
  const src = path.resolve(String(localPath || '').trim());
  if (!src || !fs.existsSync(src) || !fs.statSync(src).isFile()) {
    throw new Error(`参考图不存在：${src}`);
  }

  const form = new FormData();
  const buf = fs.readFileSync(src);
  const fileName = path.basename(src);
  const mimeType = guessMimeTypeFromExt(src);
  form.append('file', new Blob([buf], { type: mimeType }), fileName);

  const headers = {};
  if (String(uploadApiKey || '').trim()) {
    headers['Authorization'] = `Bearer ${String(uploadApiKey).trim()}`;
  }

  const resp = await fetch(uploadUrl, {
    method: 'POST',
    headers,
    body: form,
  });
  const text = await resp.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  if (!resp.ok) {
    throw new Error(`上传参考图失败（HTTP ${resp.status}）：${text.slice(0, 300)}`);
  }

  const url = String(
    data?.url
    || data?.data?.url
    || data?.result?.url
    || data?.file?.url
    || ''
  ).trim();
  if (!url) {
    throw new Error(`上传参考图返回缺少 url：${text.slice(0, 300)}`);
  }
  return url;
}

async function materializeCharacterRefsForScene(rawRefs = []) {
  const refs = [];
  for (const it of (Array.isArray(rawRefs) ? rawRefs : [])) {
    const name = String(it?.name || '').trim();
    const raw = String(it?.imageUrl || '').trim();
    if (!name || !raw) continue;

    if (/^https?:\/\//i.test(raw)) {
      refs.push({ name, imageUrl: raw, source: 'remote' });
      continue;
    }

    const localPath = resolveSceneRefPath(raw);
    const uploadedUrl = await uploadLocalFileToPublic(localPath);
    refs.push({ name, imageUrl: uploadedUrl, source: 'uploaded', localPath });
  }
  return refs;
}

async function tryDirectGenerateSceneImage(cfg, body = {}) {
  if (!cfg?.linggan?.enabled) {
    return { ok: false, error: 'linggan 文生图接口未启用。' };
  }
  if ((!cfg.linggan.token && !cfg.linggan.apiKey) || !fs.existsSync(LINGGAN_SCENE_SCRIPT_PATH)) {
    return { ok: false, error: '缺少直调分镜图脚本或鉴权配置。' };
  }

  const payload = body?.payload && typeof body.payload === 'object' ? body.payload : {};
  const project = String(payload?.project || '').trim();
  const segmentId = String(payload?.segmentId || '').trim();
  const script = String(payload?.script || '').trim();
  const imagePrompt = String(payload?.imagePrompt || '').trim();
  const cast = Array.isArray(payload?.cast) ? payload.cast.map(v => String(v || '').trim()).filter(Boolean) : [];
  const characterRefs = Array.isArray(payload?.characterRefs) ? payload.characterRefs : [];
  const sourceImageRaw = String(payload?.sourceImageUrl || payload?.imageUrl || '').trim();
  const sourceImageResolved = sourceImageRaw ? resolveSceneRefPath(sourceImageRaw) : '';
  const materializedRefs = await materializeCharacterRefsForScene(characterRefs);
  const refUrls = materializedRefs.map(it => String(it.imageUrl || '').trim()).filter(Boolean);

  if (!script) {
    return { ok: false, error: '缺少 script，无法直调生成分镜图。' };
  }

  const args = [
    LINGGAN_SCENE_SCRIPT_PATH,
    '--base-url', cfg.linggan.baseUrl,
    '--script', script,
    '--size', '1024*1792',
    '--timeout', String(Math.max(10, Number(cfg.linggan.timeoutSec || 120))),
    '--filename-prefix', sanitizeFileStem(`${project || 'project'}-${segmentId || 'segment'}`),
  ];
  if (imagePrompt) args.push('--prompt-override', imagePrompt);
  if (sourceImageResolved) args.push('--image-url', sourceImageResolved);
  if (cast.length) args.push('--character-names', cast.join(','));
  if (refUrls.length) args.push('--character-image-urls', refUrls.join(','));
  if (cfg.linggan.token) args.push('--token', cfg.linggan.token);
  if (cfg.linggan.apiKey) args.push('--api-key', cfg.linggan.apiKey);

  try {
    const { stdout, stderr } = await execFileAsync(cfg.linggan.pythonCmd, args, {
      cwd: path.dirname(LINGGAN_SCENE_SCRIPT_PATH),
      timeout: Math.max(15000, Number(cfg.linggan.timeoutSec || 120) * 1000 + 3000),
      maxBuffer: 4 * 1024 * 1024,
      windowsHide: true,
    });

    const parsed = extractLastJsonBlock(stdout) || extractLastJsonBlock(stderr) || {};
    const remoteImageUrl = pickImageUrlFromLingganResponse(parsed);
    const localImagePath = extractLocalImagePathFromScriptOutput(parsed);

    if (localImagePath) {
      const saved = copyLocalSceneImageToPreviewAssets(localImagePath, project, segmentId);
      return {
        ok: true,
        result: {
          ok: true,
          taskType: 'generate_scene_image',
          provider: 'linggan-video-tools/direct-script',
          project,
          segmentId,
          sceneImageUrl: saved.relUrl,
          localImageUrl: saved.relUrl,
          localImagePath: saved.absPath,
          remoteImageUrl,
          promptUsed: imagePrompt || script,
          notes: `已使用直调脚本生成；角色参考图数量：${refUrls.length}；参考图已先上传图床后再发起请求。`,
          characterRefsUsed: materializedRefs,
        },
      };
    }

    if (remoteImageUrl) {
      const saved = await downloadSceneImageToPreviewAssets(remoteImageUrl, project, segmentId);
      return {
        ok: true,
        result: {
          ok: true,
          taskType: 'generate_scene_image',
          provider: 'linggan-video-tools/direct-script',
          project,
          segmentId,
          sceneImageUrl: saved.relUrl,
          localImageUrl: saved.relUrl,
          localImagePath: saved.absPath,
          remoteImageUrl,
          promptUsed: imagePrompt || script,
          notes: `已使用直调脚本生成；角色参考图数量：${refUrls.length}；参考图已先上传图床后再发起请求。`,
          characterRefsUsed: materializedRefs,
        },
      };
    }

    return { ok: false, error: '直调脚本成功返回但未产出可用图片。', parsed, stdout, stderr };
  } catch (err) {
    return {
      ok: false,
      error: String(err?.message || '直调分镜图脚本失败'),
      stdout: String(err?.stdout || '').slice(0, 2000),
      stderr: String(err?.stderr || '').slice(0, 2000),
    };
  }
}

async function handleSaveSceneImage(req, res, bodyText) {
  let body = {};
  try {
    body = bodyText ? JSON.parse(bodyText) : {};
  } catch (err) {
    return sendJson(res, 400, { error: { type: 'invalid_json', message: `JSON 解析失败：${err.message}` } });
  }

  const imageUrl = String(body?.imageUrl || '').trim();
  const project = String(body?.project || '').trim();
  const segmentId = String(body?.segmentId || '').trim();
  if (!imageUrl) {
    return sendJson(res, 400, { error: { type: 'missing_image_url', message: '缺少 imageUrl' } });
  }

  // 已经是预览页本地相对路径时，直接返回成功，避免再次 fetch 本地相对路径导致 502。
  if (/^(\.\/|generated\/|\/generated\/)/i.test(imageUrl)) {
    return sendJson(res, 200, {
      ok: true,
      project,
      segmentId,
      remoteImageUrl: imageUrl,
      localImageUrl: imageUrl,
      localImagePath: '',
      skippedDownload: true,
    });
  }

  try {
    const saved = await downloadSceneImageToPreviewAssets(imageUrl, project, segmentId);
    return sendJson(res, 200, {
      ok: true,
      project,
      segmentId,
      remoteImageUrl: imageUrl,
      localImageUrl: saved.relUrl,
      localImagePath: saved.absPath,
    });
  } catch (err) {
    return sendJson(res, 502, {
      error: {
        type: 'scene_image_download_failed',
        message: String(err?.message || err),
      }
    });
  }
}

function guessVideoExtFromContentType(contentType = '') {
  const ct = String(contentType || '').toLowerCase();
  if (ct.includes('video/mp4')) return '.mp4';
  if (ct.includes('video/webm')) return '.webm';
  if (ct.includes('video/quicktime')) return '.mov';
  return '';
}

function guessVideoExtFromUrl(url = '') {
  const m = String(url || '').split('?')[0].match(/\.(mp4|webm|mov|m4v)$/i);
  return m ? `.${m[1].toLowerCase()}` : '';
}

function toWindowsPathIfMnt(absPath = '') {
  const m = String(absPath || '').match(/^\/mnt\/([a-zA-Z])\/(.*)$/);
  if (!m) return absPath;
  const drive = String(m[1] || '').toUpperCase();
  const tail = String(m[2] || '').replace(/\//g, '\\\\');
  return `${drive}:\\\\${tail}`;
}

async function tryWindowsCurlDownload(remoteUrl, absPath) {
  const winCurl = '/mnt/c/Windows/System32/curl.exe';
  if (!fs.existsSync(winCurl)) return false;

  const targetPath = toWindowsPathIfMnt(absPath);
  try {
    await execFileAsync(winCurl, [
      '-L',
      '--fail',
      '--connect-timeout', '20',
      '--max-time', '180',
      '-o', targetPath,
      remoteUrl,
    ], {
      windowsHide: true,
      timeout: 190000,
      maxBuffer: 8 * 1024 * 1024,
    });
    const stat = fs.existsSync(absPath) ? fs.statSync(absPath) : null;
    return !!(stat && stat.size > 0);
  } catch {
    return false;
  }
}

async function downloadVideoToPreviewAssets(remoteUrl, project = '', segmentId = '') {
  const extFromUrl = guessVideoExtFromUrl(remoteUrl) || '.mp4';
  const relDir = path.join('generated', 'videos');
  const absDir = path.join(PREVIEW_ASSETS_ROOT, relDir);
  fs.mkdirSync(absDir, { recursive: true });

  const stem = sanitizeFileStem(`${project || 'project'}-${segmentId || 'segment'}`);
  const fileName = `${stem}-${Date.now()}${extFromUrl}`;
  const absPath = path.join(absDir, fileName);
  const relUrl = `./${path.join(relDir, fileName).replace(/\\/g, '/')}`;

  // WSL 下常见 Node fetch 到 ossdown 超时，优先尝试 Windows curl.exe
  const curlFirstOk = await tryWindowsCurlDownload(remoteUrl, absPath);
  if (curlFirstOk) {
    return { absPath, relUrl };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('download_timeout')), 45000);
  let resp;
  try {
    resp = await fetch(remoteUrl, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
    });
  } catch (err) {
    const reason = String(err?.cause?.code || err?.message || err);
    const fallbackOk = await tryWindowsCurlDownload(remoteUrl, absPath);
    if (fallbackOk) return { absPath, relUrl };
    throw new Error(`下载视频网络失败：${reason}`);
  } finally {
    clearTimeout(timer);
  }

  if (!resp.ok) {
    const fallbackOk = await tryWindowsCurlDownload(remoteUrl, absPath);
    if (fallbackOk) return { absPath, relUrl };
    throw new Error(`下载视频失败（HTTP ${resp.status}）`);
  }

  const ab = await resp.arrayBuffer();
  const buf = Buffer.from(ab);
  if (!buf.length) {
    const fallbackOk = await tryWindowsCurlDownload(remoteUrl, absPath);
    if (fallbackOk) return { absPath, relUrl };
    throw new Error('下载视频失败（空内容）');
  }

  fs.writeFileSync(absPath, buf);
  return { absPath, relUrl };
}

function appendVideoJobRecord(project, record) {
  const p = String(project || '').trim();
  if (!p) return '';
  const runsDir = path.join(PREVIEW_ASSETS_ROOT, p, 'runs');
  try { fs.mkdirSync(runsDir, { recursive: true }); } catch {}
  const file = path.join(runsDir, 'video-jobs.jsonl');
  try {
    fs.appendFileSync(file, JSON.stringify(record) + '\n', 'utf8');
  } catch (err) {
    console.warn('[bridge] append video-jobs.jsonl failed:', err?.message || err);
  }
  return file;
}

function parsePic2apiScriptOutput(stdout = '', stderr = '') {
  const out = String(stdout || '');
  const err = String(stderr || '');
  const combined = `${out}\n${err}`;
  const pick = (key) => {
    const re = new RegExp(`^\\s*${key}=\\s*(.*)$`, 'mi');
    const m = combined.match(re);
    return m ? String(m[1] || '').trim() : '';
  };
  return {
    taskId: pick('task_id'),
    status: pick('status') || (combined.includes('submit_ok') ? 'submitted' : ''),
    videoUrl: pick('video_url'),
    pollStatus: pick('poll_status'),
    submitResponse: pick('submit_response'),
    lastResponse: pick('last_response'),
  };
}

async function handleVideoSaveLocal(req, res, bodyText) {
  let body = {};
  try {
    body = bodyText ? JSON.parse(bodyText) : {};
  } catch (err) {
    return sendJson(res, 400, { error: { type: 'invalid_json', message: `JSON 解析失败：${err.message}` } });
  }

  const project = String(body?.project || '').trim();
  const segmentId = String(body?.segmentId || body?.sid || '').trim();
  const taskId = String(body?.taskId || '').trim();
  const remoteVideoUrl = String(body?.remoteVideoUrl || body?.videoUrl || body?.url || '').trim();
  if (!remoteVideoUrl || !/^https?:\/\//i.test(remoteVideoUrl)) {
    return sendJson(res, 400, { error: { type: 'missing_remote_video_url', message: '缺少可下载的远程视频地址（remoteVideoUrl）' } });
  }

  try {
    const saved = await downloadVideoToPreviewAssets(remoteVideoUrl, project, segmentId);
    return sendJson(res, 200, {
      ok: true,
      taskId,
      segmentId,
      remoteVideoUrl,
      videoUrl: saved.relUrl,
      localVideoUrl: saved.relUrl,
      localVideoPath: saved.absPath,
      downloadLocalOk: true,
      status: 'completed',
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    return sendJson(res, 502, {
      ok: false,
      error: {
        type: 'video_download_failed',
        message: `下载本地失败：${String(err?.message || err)}`,
      },
    });
  }
}

async function handleVideoGenerate(req, res, bodyText) {
  const cfg = loadConfig();
  if (!cfg?.pic2api?.enabled) {
    return sendJson(res, 503, { error: { type: 'pic2api_disabled', message: 'pic2api 视频生成未启用。' } });
  }
  if (!fs.existsSync(PIC2API_SCRIPT_PATH)) {
    return sendJson(res, 500, { error: { type: 'script_missing', message: `未找到脚本：${PIC2API_SCRIPT_PATH}` } });
  }

  let body = {};
  try {
    body = bodyText ? JSON.parse(bodyText) : {};
  } catch (err) {
    return sendJson(res, 400, { error: { type: 'invalid_json', message: `JSON 解析失败：${err.message}` } });
  }

  const project = String(body?.project || '').trim();
  const segmentId = String(body?.segmentId || '').trim();
  const prompt = String(body?.prompt || body?.videoPrompt || '').trim();
  if (!prompt) {
    return sendJson(res, 400, { error: { type: 'missing_prompt', message: '缺少视频提示词（prompt）' } });
  }

  const model = String(body?.model || cfg.pic2api.defaultModel || 'sora2-pro').trim() || 'sora2-pro';
  const size = String(body?.size || cfg.pic2api.defaultSize || '1024x576').trim() || '1024x576';
  const durationNum = Number(body?.duration || cfg.pic2api.defaultDuration || 8);
  const allowedDurations = [4, 8, 12];
  const duration = allowedDurations.includes(durationNum) ? durationNum : 8;
  const timeoutSec = Math.max(30, Number(body?.timeoutSec || cfg.pic2api.timeoutSec || 480));
  const pollIntervalSec = Math.max(1, Number(body?.pollIntervalSec || cfg.pic2api.pollIntervalSec || 4));

  const headImageRaw = String(body?.imageUrl || body?.image || '').trim();
  const tailImageRaw = String(body?.imageTailUrl || body?.image_tail || '').trim();
  const headImagePath = headImageRaw ? resolveSceneRefPath(headImageRaw) : '';
  const tailImagePath = tailImageRaw ? resolveSceneRefPath(tailImageRaw) : '';

  if (headImagePath && /^https?:\/\//i.test(headImagePath)) {
    return sendJson(res, 400, { error: { type: 'remote_image_unsupported', message: '首帧图仅支持本地分镜图路径（脚本会读 base64）' } });
  }
  if (headImagePath && !fs.existsSync(headImagePath)) {
    return sendJson(res, 400, { error: { type: 'head_image_missing', message: `首帧图不存在：${headImagePath}` } });
  }
  if (tailImagePath && !fs.existsSync(tailImagePath)) {
    return sendJson(res, 400, { error: { type: 'tail_image_missing', message: `尾帧图不存在：${tailImagePath}` } });
  }

  const args = [
    PIC2API_SCRIPT_PATH,
    '--prompt', prompt,
    '--model', model,
    '--size', size,
    '--duration', String(duration),
    '--interval', String(pollIntervalSec),
    '--timeout', String(timeoutSec),
  ];
  if (headImagePath) args.push('--image', headImagePath);
  if (tailImagePath) args.push('--image-tail', tailImagePath);

  const execEnv = { ...process.env };
  if (cfg.pic2api.baseUrl) execEnv.PIC2API_BASE_URL = cfg.pic2api.baseUrl;
  if (cfg.pic2api.apiKey) execEnv.PIC2API_KEY = cfg.pic2api.apiKey;

  let stdout = '';
  let stderr = '';
  let execErr = null;
  try {
    const r = await execFileAsync(cfg.pic2api.pythonCmd, args, {
      cwd: path.dirname(PIC2API_SCRIPT_PATH),
      timeout: timeoutSec * 1000 + 15000,
      maxBuffer: 8 * 1024 * 1024,
      windowsHide: true,
      env: execEnv,
    });
    stdout = r.stdout || '';
    stderr = r.stderr || '';
  } catch (err) {
    execErr = err;
    stdout = String(err?.stdout || '');
    stderr = String(err?.stderr || '');
  }

  const parsed = parsePic2apiScriptOutput(stdout, stderr);
  const remoteVideoUrl = parsed.videoUrl;
  const createdAt = new Date().toISOString();

  if (!remoteVideoUrl) {
    const record = {
      segmentId,
      ok: false,
      statusCode: execErr ? 502 : 500,
      status: parsed.status || 'failed',
      taskId: parsed.taskId || '',
      videoUrl: '',
      variant: `pic2api/${model}`,
      createdAt,
      durationSec: duration,
      videoPrompt: prompt,
      payload: { prompt, model, size, duration, headImage: headImageRaw, tailImage: tailImageRaw },
      error: execErr ? String(execErr?.message || execErr) : '脚本未返回 video_url',
      stdoutTail: stdout.slice(-800),
      stderrTail: stderr.slice(-800),
    };
    if (project) appendVideoJobRecord(project, record);
    return sendJson(res, 502, {
      ok: false,
      error: {
        type: 'pic2api_no_video_url',
        message: record.error,
        stdoutTail: record.stdoutTail,
        stderrTail: record.stderrTail,
        parsed,
      },
    });
  }

  let localVideoUrl = '';
  let localVideoPath = '';
  try {
    const saved = await downloadVideoToPreviewAssets(remoteVideoUrl, project, segmentId);
    localVideoUrl = saved.relUrl;
    localVideoPath = saved.absPath;
  } catch (err) {
    const downloadErrMsg = `下载本地失败：${String(err?.message || err)}`;
    const record = {
      segmentId,
      ok: true,
      statusCode: 206,
      status: 'remote_only',
      taskId: parsed.taskId || '',
      videoUrl: remoteVideoUrl,
      hdVideoUrl: remoteVideoUrl,
      variant: `pic2api/${model}`,
      createdAt,
      durationSec: duration,
      videoPrompt: prompt,
      payload: { prompt, model, size, duration, headImage: headImageRaw, tailImage: tailImageRaw },
      warning: downloadErrMsg,
    };
    if (project) appendVideoJobRecord(project, record);
    return sendJson(res, 200, {
      ok: true,
      taskId: parsed.taskId || '',
      model,
      size,
      duration,
      remoteVideoUrl,
      videoUrl: remoteVideoUrl,
      localVideoUrl: '',
      localVideoPath: '',
      createdAt,
      variant: `pic2api/${model}`,
      warning: downloadErrMsg,
      downloadLocalOk: false,
    });
  }

  const record = {
    segmentId,
    ok: true,
    statusCode: 200,
    status: 'completed',
    taskId: parsed.taskId || '',
    videoUrl: localVideoUrl,
    hdVideoUrl: remoteVideoUrl,
    mediaUrl: remoteVideoUrl,
    variant: `pic2api/${model}`,
    createdAt,
    durationSec: duration,
    videoPrompt: prompt,
    payload: { prompt, model, size, duration, headImage: headImageRaw, tailImage: tailImageRaw },
  };
  if (project) appendVideoJobRecord(project, record);

  return sendJson(res, 200, {
    ok: true,
    taskId: parsed.taskId || '',
    model,
    size,
    duration,
    remoteVideoUrl,
    videoUrl: localVideoUrl,
    localVideoUrl,
    localVideoPath,
    createdAt,
    variant: `pic2api/${model}`,
  });
}

async function handleSceneImageVariant(req, res, bodyText) {
  const cfg = loadConfig();
  if (!cfg?.linggan?.enabled) {
    return sendJson(res, 503, { error: { type: 'linggan_disabled', message: 'linggan 文生图接口未启用。' } });
  }
  if ((!cfg.linggan.token && !cfg.linggan.apiKey) || !fs.existsSync(LINGGAN_SCENE_SCRIPT_PATH)) {
    return sendJson(res, 400, { error: { type: 'missing_linggan_auth', message: '缺少直调分镜图脚本或鉴权配置。' } });
  }

  let body = {};
  try {
    body = bodyText ? JSON.parse(bodyText) : {};
  } catch (err) {
    return sendJson(res, 400, { error: { type: 'invalid_json', message: `JSON 解析失败：${err.message}` } });
  }

  const project = String(body?.project || '').trim();
  const segmentId = String(body?.segmentId || '').trim();
  const imageUrl = String(body?.imageUrl || '').trim();
  const prompt = String(body?.prompt || body?.imagePrompt || '').trim();
  if (!imageUrl) {
    return sendJson(res, 400, { error: { type: 'missing_image_url', message: '缺少 imageUrl' } });
  }
  if (!prompt) {
    return sendJson(res, 400, { error: { type: 'missing_prompt', message: '缺少二创提示词。' } });
  }

  const args = [
    LINGGAN_SCENE_SCRIPT_PATH,
    '--base-url', cfg.linggan.baseUrl,
    '--script', prompt,
    '--prompt-override', prompt,
    '--image-url', imageUrl,
    '--size', '1024*1792',
    '--timeout', String(Math.max(10, Number(cfg.linggan.timeoutSec || 120))),
    '--filename-prefix', sanitizeFileStem(`${project || 'project'}-${segmentId || 'segment'}-variant`),
  ];
  if (cfg.linggan.token) args.push('--token', cfg.linggan.token);
  if (cfg.linggan.apiKey) args.push('--api-key', cfg.linggan.apiKey);

  try {
    const { stdout, stderr } = await execFileAsync(cfg.linggan.pythonCmd, args, {
      cwd: path.dirname(LINGGAN_SCENE_SCRIPT_PATH),
      timeout: Math.max(15000, Number(cfg.linggan.timeoutSec || 120) * 1000 + 3000),
      maxBuffer: 4 * 1024 * 1024,
      windowsHide: true,
    });

    const parsed = extractLastJsonBlock(stdout) || extractLastJsonBlock(stderr) || {};
    const remoteImageUrl = pickImageUrlFromLingganResponse(parsed);
    const localImagePath = extractLocalImagePathFromScriptOutput(parsed);

    if (localImagePath) {
      const saved = copyLocalSceneImageToPreviewAssets(localImagePath, project, segmentId);
      return sendJson(res, 200, {
        ok: true,
        project,
        segmentId,
        sourceImageUrl: imageUrl,
        promptUsed: prompt,
        remoteImageUrl,
        localImageUrl: saved.relUrl,
        localImagePath: saved.absPath,
        sceneImageUrl: saved.relUrl,
      });
    }

    if (remoteImageUrl) {
      const saved = await downloadSceneImageToPreviewAssets(remoteImageUrl, project, segmentId);
      return sendJson(res, 200, {
        ok: true,
        project,
        segmentId,
        sourceImageUrl: imageUrl,
        promptUsed: prompt,
        remoteImageUrl,
        localImageUrl: saved.relUrl,
        localImagePath: saved.absPath,
        sceneImageUrl: saved.relUrl,
      });
    }

    return sendJson(res, 502, {
      error: {
        type: 'scene_image_variant_failed',
        message: '二创脚本成功返回但未产出可用图片。',
        parsed,
      }
    });
  } catch (err) {
    return sendJson(res, 502, {
      error: {
        type: 'scene_image_variant_failed',
        message: String(err?.message || err),
        stdout: String(err?.stdout || '').slice(0, 2000),
        stderr: String(err?.stderr || '').slice(0, 2000),
      }
    });
  }
}

async function handleCharacterThreeView(req, res, bodyText) {
  const cfg = loadConfig();
  if (!cfg?.linggan?.enabled) {
    return sendJson(res, 503, { error: { type: 'linggan_disabled', message: 'linggan 文生图接口未启用。' } });
  }

  let body = {};
  try {
    body = bodyText ? JSON.parse(bodyText) : {};
  } catch (err) {
    return sendJson(res, 400, { error: { message: `JSON 解析失败：${err.message}` } });
  }

  const characterName = String(body?.characterName || body?.name || '').trim() || '未命名角色';
  const promptBase = String(body?.prompt || '').trim()
    || [String(body?.role || '').trim(), String(body?.designNotes || '').trim()].filter(Boolean).join('；');
  // 硬约束：角色三视图固定 16:9 横版
  const prompt = `${promptBase}\n构图硬约束：必须16:9横版（禁止9:16竖版），统一角色形象，三视图（正面/侧面/背面）一致。`;
  const size = '16:9';

  if (!prompt) {
    return sendJson(res, 400, { error: { type: 'missing_prompt', message: '缺少 prompt（或 role/designNotes）。' } });
  }

  if (!cfg.linggan.token && !cfg.linggan.apiKey) {
    return sendJson(res, 400, {
      error: {
        type: 'missing_linggan_auth',
        message: '缺少 linggan token/apiKey，请在 bridge-config.json 的 linggan 配置中填写。'
      }
    });
  }

  if (!fs.existsSync(LINGGAN_SCRIPT_PATH)) {
    return sendJson(res, 500, {
      error: {
        type: 'linggan_script_missing',
        message: `未找到脚本：${LINGGAN_SCRIPT_PATH}`,
      }
    });
  }

  const args = [
    LINGGAN_SCRIPT_PATH,
    '--base-url', cfg.linggan.baseUrl,
    '--prompt', Buffer.from(prompt, 'utf8').toString('base64'),
    '--character-name', Buffer.from(characterName, 'utf8').toString('base64'),
    '--size', size,
    '--timeout', String(Math.max(10, Number(cfg.linggan.timeoutSec || 120))),
  ];
  if (cfg.linggan.token) args.push('--token', cfg.linggan.token);
  if (cfg.linggan.apiKey) args.push('--api-key', cfg.linggan.apiKey);

  try {
    const { stdout, stderr } = await execFileAsync(cfg.linggan.pythonCmd, args, {
      cwd: path.dirname(LINGGAN_SCRIPT_PATH),
      timeout: Math.max(15000, Number(cfg.linggan.timeoutSec || 120) * 1000 + 3000),
      maxBuffer: 2 * 1024 * 1024,
      windowsHide: true,
    });

    const parsed = extractLastJsonBlock(stdout) || extractLastJsonBlock(stderr) || {};
    const remoteImageUrl = pickImageUrlFromLingganResponse(parsed);
    if (!remoteImageUrl) {
      throw new Error('linggan 返回成功但未提供图片 URL');
    }

    const downloaded = await downloadImageToPreviewAssets(remoteImageUrl, characterName);

    return sendJson(res, 200, {
      ok: true,
      characterName,
      promptUsed: prompt,
      imageUrl: downloaded.relUrl,
      localImageUrl: downloaded.relUrl,
      localImagePath: downloaded.absPath,
      remoteImageUrl,
      raw: parsed,
      stdout: String(stdout || '').slice(0, 2000),
    });
  } catch (err) {
    const stdout = String(err?.stdout || '');
    const stderr = String(err?.stderr || '');
    const parsed = extractLastJsonBlock(stdout) || extractLastJsonBlock(stderr) || null;
    return sendJson(res, 502, {
      error: {
        type: 'linggan_call_failed',
        message: String(err?.message || '调用 linggan 脚本失败'),
        parsed,
        stdout: stdout.slice(0, 2000),
        stderr: stderr.slice(0, 2000),
      }
    });
  }
}

function buildStoryboardLobsterTaskPrompt(body = {}) {
  const taskType = String(body?.taskType || '').trim() || 'unknown';
  const payload = body?.payload && typeof body.payload === 'object' ? body.payload : {};
  return [
    '你现在是“分镜预览页龙虾任务执行器”。',
    '这是来自网页的结构化任务，不要闲聊，不要解释过程。',
    '你必须自己判断当前环境中可用的能力，并优先使用当前机器里已经安装好的相关 skill / 脚本 / 工作流来完成任务。',
    '如果任务需要生成分镜图：',
    '1. 优先寻找当前环境可用的文生图/分镜图能力；',
    '2. 若存在支持角色参考图的能力，必须把当前分段角色图作为参考图一起提供；',
    '3. 若有多个可用能力，选择最合适且当前机器可直接执行的方案；',
    '4. 结果必须只返回一个 JSON 代码块，不要返回额外说明。',
    'JSON 格式固定为：',
    '{"ok":true,"taskType":"generate_scene_image","provider":"","project":"","segmentId":"","sceneImageUrl":"","remoteImageUrl":"","promptUsed":"","notes":""}',
    '如果失败，也只返回一个 JSON 代码块：',
    '{"ok":false,"taskType":"generate_scene_image","provider":"","project":"","segmentId":"","error":"","notes":""}',
    '',
    `任务类型：${taskType}`,
    '任务载荷 JSON：',
    JSON.stringify(payload, null, 2),
  ].join('\n');
}

function extractJsonFromAssistantText(text = '') {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const codeMatch = raw.match(/```json\s*([\s\S]*?)```/i) || raw.match(/```\s*([\s\S]*?)```/i);
  const candidate = codeMatch ? String(codeMatch[1] || '').trim() : raw;
  try {
    return JSON.parse(candidate);
  } catch {}
  const obj = raw.match(/\{[\s\S]*\}/);
  if (obj) {
    try { return JSON.parse(obj[0]); } catch {}
  }
  return null;
}

function isAssistantAuthUnavailableText(text = '') {
  const raw = String(text || '').trim().toLowerCase();
  return raw.includes('auth_unavailable') || (raw.startsWith('503') && raw.includes('no auth available'));
}

async function callOpenClawTaskSession(req, cfg, taskPrompt) {
  const gateway = await probeGateway(cfg);
  if (!gateway.reachable) {
    return {
      ok: false,
      status: 502,
      error: {
        type: 'openclaw_gateway_unreachable',
        message: `OpenClaw Gateway 不可达：${gateway.base}`,
        gateway,
      }
    };
  }

  const targetUrl = joinBaseAndPath(cfg.gatewayBase || DEFAULT_GATEWAY_BASE, cfg.gatewayChatPath, DEFAULT_GATEWAY_CHAT_PATH);
  const outgoingBody = {
    model: 'openclaw',
    stream: false,
    messages: [
      { role: 'user', content: taskPrompt }
    ],
  };

  const headers = {
    'Content-Type': 'application/json',
    'x-openclaw-session-key': cfg.lobsterTaskSessionKey || DEFAULT_LOBSTER_TASK_SESSION_KEY,
    'x-openclaw-message-channel': 'webchat',
  };

  const incomingAuth = String(req.headers.authorization || '').trim();
  if (incomingAuth) headers.Authorization = incomingAuth;
  else if (cfg.gatewayToken) headers.Authorization = `Bearer ${cfg.gatewayToken}`;

  const preferredModel = String(cfg.lobsterTaskModel || '').trim();
  if (preferredModel) headers['x-openclaw-model'] = preferredModel;

  let upstream = await callJson(targetUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(outgoingBody),
    timeoutMs: cfg.timeoutMs,
  });

  if (!upstream.ok && headers['x-openclaw-model'] && isInvalidOpenClawModelError(upstream)) {
    const retryHeaders = { ...headers };
    delete retryHeaders['x-openclaw-model'];
    upstream = await callJson(targetUrl, {
      method: 'POST',
      headers: retryHeaders,
      body: JSON.stringify(outgoingBody),
      timeoutMs: cfg.timeoutMs,
    });
  }

  if (!upstream.ok) {
    return {
      ok: false,
      status: upstream.status || 502,
      error: {
        type: 'lobster_task_upstream_failed',
        message: String(upstream?.data?.error?.message || upstream?.text || '龙虾任务执行失败'),
        upstream,
      }
    };
  }

  let text = String(
    upstream?.data?.choices?.[0]?.message?.content
    || upstream?.data?.choices?.[0]?.text
    || upstream?.text
    || ''
  ).trim();

  let parsed = extractJsonFromAssistantText(text);
  if ((!parsed || typeof parsed !== 'object') && headers['x-openclaw-model'] && isAssistantAuthUnavailableText(text)) {
    const retryHeaders = { ...headers };
    delete retryHeaders['x-openclaw-model'];
    upstream = await callJson(targetUrl, {
      method: 'POST',
      headers: retryHeaders,
      body: JSON.stringify(outgoingBody),
      timeoutMs: cfg.timeoutMs,
    });
    text = String(
      upstream?.data?.choices?.[0]?.message?.content
      || upstream?.data?.choices?.[0]?.text
      || upstream?.text
      || ''
    ).trim();
    parsed = extractJsonFromAssistantText(text);
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      ok: false,
      status: 502,
      error: {
        type: 'lobster_task_invalid_json',
        message: '龙虾返回了非 JSON 结果',
        rawText: text,
        upstream,
      }
    };
  }

  return { ok: true, status: 200, result: parsed, rawText: text, upstream };
}

async function isImageUrlReachable(url = '', timeoutMs = 12000){
  const u = String(url || '').trim();
  if(!u) return false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const resp = await fetch(u, { method: 'GET', signal: controller.signal });
    clearTimeout(timer);
    return !!resp.ok;
  } catch {
    return false;
  }
}

async function handleLobsterTask(req, res, bodyText) {
  const cfg = loadConfig();
  let body = {};
  try {
    body = bodyText ? JSON.parse(bodyText) : {};
  } catch (err) {
    return sendJson(res, 400, { error: { type: 'invalid_json', message: `JSON 解析失败：${err.message}` } });
  }

  const taskType = String(body?.taskType || '').trim();
  if (!taskType) {
    return sendJson(res, 400, { error: { type: 'missing_task_type', message: '缺少 taskType' } });
  }

  // generate_scene_image 优先走本机直调脚本，避免 session:storyboard-lobster 复用过期远程图链。
  if (taskType === 'generate_scene_image') {
    const direct = await tryDirectGenerateSceneImage(cfg, body);
    if (direct.ok) {
      return sendJson(res, 200, {
        ok: true,
        taskType,
        sessionKey: cfg.lobsterTaskSessionKey || DEFAULT_LOBSTER_TASK_SESSION_KEY,
        modelTried: 'linggan-video-tools/direct-script',
        result: direct.result,
      });
    }
  }

  const taskPrompt = buildStoryboardLobsterTaskPrompt(body);
  const run = await callOpenClawTaskSession(req, cfg, taskPrompt);
  if (!run.ok) {
    return sendJson(res, Number(run.status || 502), { error: run.error });
  }

  // 对 generate_scene_image 结果做统一后处理：
  // 1) 先校验 URL 可访问，防止龙虾返回历史失效图
  // 2) 再下载到本地并回填本地 URL
  let result = run.result;
  if (result && typeof result === 'object' && String(result.taskType || '') === 'generate_scene_image') {
    const remoteUrl = String(result.sceneImageUrl || result.remoteImageUrl || '').trim();
    const project = String(result.project || body?.payload?.project || '').trim();
    const segmentId = String(result.segmentId || body?.payload?.segmentId || '').trim();

    if (!remoteUrl) {
      result = {
        ...result,
        ok: false,
        error: '生成结果缺少 sceneImageUrl/remoteImageUrl',
      };
    } else {
      const reachable = await isImageUrlReachable(remoteUrl);
      if (!reachable) {
        result = {
          ...result,
          ok: false,
          error: `生成结果链接不可访问（疑似复用旧图）：${remoteUrl}`,
        };
      } else {
        try {
          const saved = await downloadSceneImageToPreviewAssets(remoteUrl, project, segmentId);
          result = {
            ...result,
            remoteImageUrl: remoteUrl,
            sceneImageUrl: saved.relUrl,
            localImageUrl: saved.relUrl,
            localImagePath: saved.absPath,
          };
        } catch (err) {
          result = {
            ...result,
            ok: false,
            error: `下载本地失败：${String(err?.message || err)}`,
          };
        }
      }
    }
  }

  return sendJson(res, 200, {
    ok: true,
    taskType,
    sessionKey: cfg.lobsterTaskSessionKey || DEFAULT_LOBSTER_TASK_SESSION_KEY,
    modelTried: cfg.lobsterTaskModel || DEFAULT_LOBSTER_TASK_MODEL,
    result,
  });
}

async function handleOpenClawCompat(req, res, bodyText) {
  const cfg = loadConfig();

  let body;
  try {
    body = bodyText ? JSON.parse(bodyText) : {};
  } catch (err) {
    return sendJson(res, 400, { error: { message: `JSON 解析失败：${err.message}` } });
  }

  const gateway = await probeGateway(cfg);
  if (!gateway.reachable) {
    return sendJson(res, 502, {
      error: {
        type: 'openclaw_gateway_unreachable',
        message: `OpenClaw Gateway 不可达：${gateway.base}`,
        gateway,
      }
    });
  }

  const guardDecision = decideGuard(cfg, body);
  if (guardDecision.blocked) {
    return sendJson(res, 403, {
      error: {
        type: 'storyboard_guard_blocked',
        message: guardDecision.reason,
        allowedScopes: ['script', 'image', 'audio']
      }
    });
  }

  body = injectGuardSystemPrompt(body, cfg);

  const requestedModel = String(body.model || cfg.defaultModel || 'openclaw').trim() || 'openclaw';
  const forwardModel = isOpenClawModelRef(requestedModel) ? requestedModel : 'openclaw';

  const outgoingBody = {
    ...body,
    model: forwardModel,
    stream: false,
    user: String(body.user || '').trim() || undefined,
  };

  const requestedSessionKey = String(body.sessionKey || body?.metadata?.sessionKey || '').trim();
  const sessionKey = cfg.allowSessionOverride
    ? (requestedSessionKey || cfg.defaultSessionKey || 'main')
    : (cfg.defaultSessionKey || 'main');
  delete outgoingBody.sessionKey;

  const baseHeaders = {
    'Content-Type': 'application/json',
    'x-openclaw-session-key': sessionKey,
    'x-openclaw-message-channel': 'webchat',
  };

  const incomingAuth = String(req.headers.authorization || '').trim();
  if (incomingAuth) {
    baseHeaders.Authorization = incomingAuth;
  } else if (cfg.gatewayToken) {
    baseHeaders.Authorization = `Bearer ${cfg.gatewayToken}`;
  }

  // 优先级：用户显式模型 > bridge 默认模型（仅当为 provider/model 时）
  const preferredProviderModel = !isOpenClawModelRef(requestedModel)
    ? requestedModel
    : (!isOpenClawModelRef(cfg.defaultModel) ? cfg.defaultModel : '');

  if (preferredProviderModel) {
    baseHeaders['x-openclaw-model'] = preferredProviderModel;
  }

  const targetUrl = joinBaseAndPath(cfg.gatewayBase || DEFAULT_GATEWAY_BASE, cfg.gatewayChatPath, DEFAULT_GATEWAY_CHAT_PATH);
  let upstream = await callJson(targetUrl, {
    method: 'POST',
    headers: baseHeaders,
    body: JSON.stringify(outgoingBody),
    timeoutMs: cfg.timeoutMs,
  });

  if (!upstream.ok && baseHeaders['x-openclaw-model'] && isInvalidOpenClawModelError(upstream)) {
    const retryHeaders = { ...baseHeaders };
    delete retryHeaders['x-openclaw-model'];
    upstream = await callJson(targetUrl, {
      method: 'POST',
      headers: retryHeaders,
      body: JSON.stringify(outgoingBody),
      timeoutMs: cfg.timeoutMs,
    });
  }

  if (!upstream.ok && isNotFoundError(upstream) && cfg.gatewayBase && !String(cfg.gatewayBase).includes(':18789')) {
    const fallbackTarget = joinBaseAndPath(DEFAULT_GATEWAY_BASE, cfg.gatewayChatPath, DEFAULT_GATEWAY_CHAT_PATH);
    upstream = await callJson(fallbackTarget, {
      method: 'POST',
      headers: baseHeaders,
      body: JSON.stringify(outgoingBody),
      timeoutMs: cfg.timeoutMs,
    });
  }

  // 网关/上游偶发 503 时，按配置模型依次兜底重试
  if (!upstream.ok && isServiceUnavailableError(upstream)) {
    const currentModelHeader = String(baseHeaders['x-openclaw-model'] || '').trim();
    const fallbackCandidates = [
      ...cfg.fallbackModels,
      'custom-154-12-46-107/gpt-5.4',
      'custom-154-12-46-107/gpt-5.3-codex',
    ]
      .map(x => String(x || '').trim())
      .filter(Boolean)
      .filter(x => !isOpenClawModelRef(x))
      .filter((x, i, arr) => arr.indexOf(x) === i)
      .filter(x => x !== currentModelHeader);

    for (const modelId of fallbackCandidates) {
      const retryHeaders = { ...baseHeaders, 'x-openclaw-model': modelId };
      const retried = await callJson(targetUrl, {
        method: 'POST',
        headers: retryHeaders,
        body: JSON.stringify(outgoingBody),
        timeoutMs: cfg.timeoutMs,
      });
      if (retried.ok) {
        upstream = retried;
        break;
      }
    }
  }

  if (!upstream.ok) {
    return sendJson(res, upstream.status || 502, upstream.data || {
      error: {
        type: 'openclaw_gateway_error',
        message: upstream.text || `OpenClaw Gateway 请求失败（HTTP ${upstream.status || 502}）`,
      }
    });
  }

  return sendJson(res, 200, upstream.data || {
    id: `chatcmpl-openclaw-bridge-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: outgoingBody.model,
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: upstream.text || ''
      },
      finish_reason: 'stop'
    }]
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || `127.0.0.1:${PORT}`}`);

    if (req.method === 'OPTIONS') return sendJson(res, 200, { ok: true });
    if (req.method === 'GET' && url.pathname === '/health') {
      const cfg = loadConfig();
      const gateway = await probeGateway(cfg);
      return sendJson(res, 200, {
        ok: true,
        service: 'storyboard-chat-bridge',
        port: PORT,
        configLoaded: fs.existsSync(CONFIG_PATH),
        mode: cfg.mode,
        publicChatPath: DEFAULT_PUBLIC_CHAT_PATH,
        defaultSessionKey: cfg.defaultSessionKey,
        allowSessionOverride: !!cfg.allowSessionOverride,
        defaultModel: cfg.defaultModel,
        fallbackModels: cfg.fallbackModels,
        openclawAdapter: cfg.openclawAdapter,
        linggan: {
          enabled: !!cfg.linggan?.enabled,
          baseUrl: cfg.linggan?.baseUrl || '',
          size: cfg.linggan?.size || '9:16',
          timeoutSec: cfg.linggan?.timeoutSec || 120,
          scriptExists: fs.existsSync(LINGGAN_SCRIPT_PATH),
          tokenConfigured: !!cfg.linggan?.token,
          apiKeyConfigured: !!cfg.linggan?.apiKey,
        },
        guard: {
          enabled: !!cfg.guard?.enabled,
          injectSystemPrompt: !!cfg.guard?.injectSystemPrompt,
          allowKeywords: cfg.guard?.allowKeywords || [],
          denyKeywords: cfg.guard?.denyKeywords || [],
        },
        gatewayTokenConfigured: !!cfg.gatewayToken,
        gateway: {
          base: gateway.base,
          chatPath: cfg.gatewayChatPath,
          chatUrl: gateway.chatUrl,
          healthPath: cfg.gatewayHealthPath,
          readyPath: cfg.gatewayReadyPath,
          liveUrl: gateway.liveUrl,
          readyUrl: gateway.readyUrl,
          liveOk: gateway.live.ok,
          liveStatus: gateway.live.status,
          readyOk: gateway.ready.ok,
          readyStatus: gateway.ready.status,
          reachable: gateway.reachable,
        }
      });
    }

    if (req.method === 'GET' && url.pathname === '/api/projects') {
      const refresh = ['1', 'true', 'yes', 'on'].includes(String(url.searchParams.get('refresh') || '').trim().toLowerCase());
      const data = listProjects({ refresh });
      return sendJson(res, 200, {
        ok: true,
        source: data.source,
        updatedAt: data.updatedAt,
        projects: data.projects,
        count: data.projects.length,
        indexPath: PROJECT_INDEX_JSON_PATH,
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/projects/rebuild') {
      const data = listProjects({ refresh: true });
      return sendJson(res, 200, {
        ok: true,
        source: data.source,
        updatedAt: data.updatedAt,
        projects: data.projects,
        count: data.projects.length,
        indexPath: PROJECT_INDEX_JSON_PATH,
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/character/threeview') {
      const bodyText = await collectBody(req);
      return handleCharacterThreeView(req, res, bodyText);
    }

    if (req.method === 'POST' && url.pathname === '/api/scene-image/save-local') {
      const bodyText = await collectBody(req);
      return handleSaveSceneImage(req, res, bodyText);
    }

    if (req.method === 'POST' && url.pathname === '/api/scene-image/variant') {
      const bodyText = await collectBody(req);
      return handleSceneImageVariant(req, res, bodyText);
    }

    if (req.method === 'POST' && url.pathname === '/api/lobster/task') {
      const bodyText = await collectBody(req);
      return handleLobsterTask(req, res, bodyText);
    }

    if (req.method === 'POST' && url.pathname === '/api/video/generate') {
      const bodyText = await collectBody(req);
      return handleVideoGenerate(req, res, bodyText);
    }

    if (req.method === 'POST' && url.pathname === '/api/video/save-local') {
      const bodyText = await collectBody(req);
      return handleVideoSaveLocal(req, res, bodyText);
    }

    if (req.method === 'POST' && CHAT_PATH_ALIASES.has(url.pathname)) {
      const bodyText = await collectBody(req);
      return handleOpenClawCompat(req, res, bodyText);
    }

    return sendJson(res, 404, { error: { message: `not found: ${req.method} ${url.pathname}` } });
  } catch (err) {
    return sendJson(res, 500, {
      error: {
        message: err?.message || String(err),
        type: 'bridge_runtime_error'
      }
    });
  }
});

server.on('error', (err) => {
  console.error('[bridge] fatal:', err);
  process.exit(1);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[bridge] storyboard-chat-bridge listening on http://127.0.0.1:${PORT}`);
  console.log(`[bridge] health: http://127.0.0.1:${PORT}/health`);
  console.log(`[bridge] config: ${CONFIG_PATH}`);
  console.log('[bridge] mode: openclaw');
});
