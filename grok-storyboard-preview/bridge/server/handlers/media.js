const fs = require('fs');
const path = require('path');

function createMediaHandlers(ctx) {
  const {
    sendJson,
    loadConfig,
    execFileAsync,
    PREVIEW_ASSETS_ROOT,
    LINGGAN_SCRIPT_PATH,
    LINGGAN_SCENE_SCRIPT_PATH,
    PIC2API_SCRIPT_PATH,
    DEFAULT_PUBLIC_UPLOAD_URL,
    DEFAULT_PUBLIC_UPLOAD_API_KEY,
  } = ctx;

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
  const timeoutSec = Math.max(30, Number(body?.timeoutSec || cfg.pic2api.timeoutSec || process.env.STORYBOARD_PIC2API_TIMEOUT_SEC || 480));
  const pollIntervalSec = Math.max(1, Number(body?.pollIntervalSec || cfg.pic2api.pollIntervalSec || process.env.STORYBOARD_PIC2API_POLL_SEC || 4));

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

  return {
    tryDirectGenerateSceneImage,
    downloadSceneImageToPreviewAssets,
    handleSaveSceneImage,
    handleVideoGenerate,
    handleVideoSaveLocal,
    handleSceneImageVariant,
    handleCharacterThreeView,
  };
}

module.exports = {
  createMediaHandlers,
};
