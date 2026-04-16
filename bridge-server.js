const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

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
const LINGGAN_SCRIPT_PATH = path.resolve(__dirname, '..', 'linggan-video-tools', 'scripts', 'call_generate_character_image.py');

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
      baseUrl: String(process.env.STORYBOARD_LINGGAN_BASE_URL || linggan.baseUrl || 'http://127.0.0.1:9000').trim(),
      token: String(process.env.STORYBOARD_LINGGAN_TOKEN || linggan.token || '').trim(),
      apiKey: String(process.env.STORYBOARD_LINGGAN_API_KEY || linggan.apiKey || '').trim(),
      size: String(process.env.STORYBOARD_LINGGAN_SIZE || linggan.size || '9:16').trim(),
      timeoutSec: Number(process.env.STORYBOARD_LINGGAN_TIMEOUT_SEC || linggan.timeoutSec || 120),
      pythonCmd: String(process.env.STORYBOARD_LINGGAN_PYTHON || linggan.pythonCmd || 'python').trim() || 'python',
    },
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
