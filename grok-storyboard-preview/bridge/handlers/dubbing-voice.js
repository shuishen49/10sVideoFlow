const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

function createDubbingVoiceHandlers({ loadConfig, sendJson, callJson }) {
  const DUBBING_VOICE_STATE = new Map();

  function dubbingVoiceStateKey(project = '', role = '') {
    return `${String(project || '').trim()}::${String(role || '').trim()}`;
  }

  function setDubbingVoiceState(project = '', role = '', payload = {}) {
    const key = dubbingVoiceStateKey(project, role);
    if (!key || key === '::') return;
    DUBBING_VOICE_STATE.set(key, {
      ...payload,
      updatedAt: new Date().toISOString(),
    });
  }

  function getDubbingVoiceState(project = '', role = '') {
    const key = dubbingVoiceStateKey(project, role);
    if (!key || key === '::') return null;
    return DUBBING_VOICE_STATE.get(key) || null;
  }

  function findDubbingVoiceStateByVoiceId(voiceId = '') {
    const target = String(voiceId || '').trim();
    if (!target) return null;
    for (const [key, state] of DUBBING_VOICE_STATE.entries()) {
      const sid = String(state?.voiceId || state?.voice || '').trim();
      if (!sid || sid !== target) continue;
      const idx = key.indexOf('::');
      const project = idx >= 0 ? key.slice(0, idx) : '';
      const role = idx >= 0 ? key.slice(idx + 2) : '';
      return { project, role, state: state || {} };
    }
    return null;
  }

  function parseApiErrorMessage(raw = null) {
    if (!raw) return '';
    if (typeof raw === 'string') return raw.trim();
    if (typeof raw !== 'object') return String(raw || '').trim();
    return String(
      raw?.message
      || raw?.error?.message
      || raw?.error
      || raw?.msg
      || raw?.detail
      || ''
    ).trim();
  }

  function isTaskNullLikeError(raw = null) {
    const msg = parseApiErrorMessage(raw);
    if (!msg) return false;
    return /task\s+can\s+not\s+be\s+null/i.test(msg);
  }

  function isProbablyMockVoiceId(voiceId = '') {
    return /^voice_[a-f0-9]{6,}$/i.test(String(voiceId || '').trim());
  }

  function isDashscopeVoiceId(voiceId = '') {
    const v = String(voiceId || '').trim();
    if (!v) return false;
    if (isProbablyMockVoiceId(v)) return false;
    return true;
  }

  function hashStringToInt(input = '') {
    const s = String(input || '');
    let h = 2166136261;
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0);
  }

  function buildWavToneDataUrl({
    seed = '',
    seconds = 1.2,
    sampleRate = 22050,
  } = {}) {
    const totalSamples = Math.max(1, Math.floor(sampleRate * Math.max(0.3, Number(seconds) || 1.2)));
    const seedNum = hashStringToInt(seed);
    const baseFreq = 220 + (seedNum % 300);
    const amp = 0.22;
    const pcm = Buffer.alloc(totalSamples * 2);

    for (let i = 0; i < totalSamples; i += 1) {
      const t = i / sampleRate;
      const fadeIn = Math.min(1, i / (sampleRate * 0.04));
      const fadeOut = Math.min(1, (totalSamples - i) / (sampleRate * 0.06));
      const env = Math.min(fadeIn, fadeOut);
      const v = Math.sin(2 * Math.PI * baseFreq * t) * amp * env;
      const s = Math.max(-1, Math.min(1, v));
      pcm.writeInt16LE(Math.floor(s * 32767), i * 2);
    }

    const byteRate = sampleRate * 2;
    const blockAlign = 2;
    const dataSize = pcm.length;
    const wav = Buffer.alloc(44 + dataSize);
    let offset = 0;
    wav.write('RIFF', offset); offset += 4;
    wav.writeUInt32LE(36 + dataSize, offset); offset += 4;
    wav.write('WAVE', offset); offset += 4;
    wav.write('fmt ', offset); offset += 4;
    wav.writeUInt32LE(16, offset); offset += 4;
    wav.writeUInt16LE(1, offset); offset += 2;
    wav.writeUInt16LE(1, offset); offset += 2;
    wav.writeUInt32LE(sampleRate, offset); offset += 4;
    wav.writeUInt32LE(byteRate, offset); offset += 4;
    wav.writeUInt16LE(blockAlign, offset); offset += 2;
    wav.writeUInt16LE(16, offset); offset += 2;
    wav.write('data', offset); offset += 4;
    wav.writeUInt32LE(dataSize, offset); offset += 4;
    pcm.copy(wav, offset);

    return `data:audio/wav;base64,${wav.toString('base64')}`;
  }

  function getDubbingApiKey() {
    const keys = [
      process.env.STORYBOARD_DUBBING_API_KEY,
      process.env.DASHSCOPE_API_KEY,
      process.env.ALIYUN_DASHSCOPE_API_KEY,
      process.env.QWEN_API_KEY,
    ];
    for (const k of keys) {
      const v = String(k || '').trim();
      if (v) return v;
    }
    return '';
  }

  function toDataAudioUrl(mime = 'audio/wav', b64 = '') {
    const clean = String(b64 || '').trim();
    if (!clean) return '';
    return `data:${mime};base64,${clean}`;
  }

  function pickDashscopePreviewAudio(output = {}) {
    if (!output || typeof output !== 'object') return '';
    const candidates = [
      output.preview_audio,
      output.previewAudio,
      output.audio,
    ].filter(Boolean);
    for (const c of candidates) {
      if (typeof c === 'string' && c.trim()) {
        if (/^data:audio\//i.test(c.trim())) return c.trim();
        return toDataAudioUrl('audio/wav', c.trim());
      }
      if (c && typeof c === 'object') {
        const data = String(c.data || c.base64 || '').trim();
        if (!data) continue;
        const format = String(c.format || c.response_format || 'wav').trim().toLowerCase();
        const mime = format.includes('mp3') ? 'audio/mpeg' : 'audio/wav';
        return toDataAudioUrl(mime, data);
      }
    }
    return '';
  }

  function sanitizePreferredName(role = '') {
    const raw = String(role || '').trim();
    const ascii = raw.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
    if (ascii) return ascii.slice(0, 32);
    return `voice_${hashStringToInt(raw || 'role').toString(16).slice(0, 10)}`;
  }

  function resolveQwenDubbingRepoRoot() {
    const candidates = [
      process.env.QWEN_VOICE_DUBBING_ROOT,
      path.resolve(__dirname, '..', '..', '..', 'qwen-voice-design-dubbing'),
      '/mnt/c/Users/Administrator/.openclaw/workspace/gitskill/qwen-voice-design-dubbing',
      'C:\\Users\\Administrator\\.openclaw\\workspace\\gitskill\\qwen-voice-design-dubbing',
    ].map((v) => String(v || '').trim()).filter(Boolean);

    for (const candidate of candidates) {
      const scriptPath = path.join(candidate, 'scripts', 'tts_with_designed_voice_qwen.py');
      if (fs.existsSync(scriptPath)) return candidate;
    }
    return '';
  }

  function toPythonCmd(cfg = {}) {
    const fromCfg = String(cfg?.dubbing?.pythonCmd || cfg?.linggan?.pythonCmd || '').trim();
    if (fromCfg) return fromCfg;
    return process.platform === 'win32' ? 'python' : 'python3';
  }

  async function callQwenRepoRealtimePreview({ cfg, voiceId, text }) {
    const repoRoot = resolveQwenDubbingRepoRoot();
    if (!repoRoot) {
      return {
        ok: false,
        reason: 'missing_qwen_repo',
        message: '未找到 qwen-voice-design-dubbing 正式目录',
      };
    }

    const scriptPath = path.join(repoRoot, 'scripts', 'tts_with_designed_voice_qwen.py');
    if (!fs.existsSync(scriptPath)) {
      return {
        ok: false,
        reason: 'missing_qwen_script',
        message: `缺少脚本: ${scriptPath}`,
      };
    }

    const envFile = path.join(repoRoot, '.env');
    const outAudio = path.join(os.tmpdir(), `qwen-dubbing-${Date.now()}-${Math.random().toString(16).slice(2)}.wav`);
    const ttsModel = String(cfg?.dubbing?.ttsModel || 'qwen3-tts-vd-realtime-2026-01-15').trim();
    const pythonCmd = toPythonCmd(cfg);
    const args = [
      scriptPath,
      '--voice-id', String(voiceId || '').trim(),
      '--text', String(text || '').trim(),
      '--model', ttsModel,
      '--out-audio', outAudio,
    ];
    if (fs.existsSync(envFile)) {
      args.push('--env-file', envFile);
    }

    try {
      const pythonCandidates = [];
      const seenPy = new Set();
      const pushPy = (cmd, prefixArgs = []) => {
        const key = `${String(cmd || '').trim()}|${prefixArgs.join(' ')}`;
        if (!cmd || seenPy.has(key)) return;
        seenPy.add(key);
        pythonCandidates.push({ cmd: String(cmd || '').trim(), prefixArgs: Array.isArray(prefixArgs) ? prefixArgs : [] });
      };

      if (pythonCmd) {
        const m = String(pythonCmd).trim().match(/^(\S+)\s+(.+)$/);
        if (m) pushPy(m[1], String(m[2] || '').trim().split(/\s+/).filter(Boolean));
        else pushPy(pythonCmd, []);
      }
      if (process.platform === 'win32') {
        const userProfile = String(process.env.USERPROFILE || 'C:\\Users\\Administrator').trim();
        const localAppData = String(process.env.LOCALAPPDATA || path.join(userProfile, 'AppData', 'Local')).trim();
        const pyExeCandidates = [
          path.join(localAppData, 'Programs', 'Python', 'Python313', 'python.exe'),
          path.join(localAppData, 'Programs', 'Python', 'Python312', 'python.exe'),
          path.join(localAppData, 'Programs', 'Python', 'Python311', 'python.exe'),
          path.join(localAppData, 'Programs', 'Python', 'Python310', 'python.exe'),
          'C:\\Python313\\python.exe',
          'C:\\Python312\\python.exe',
          'C:\\Python311\\python.exe',
          'C:\\Python310\\python.exe',
        ];
        for (const pyExe of pyExeCandidates) {
          try {
            if (pyExe && fs.existsSync(pyExe)) pushPy(pyExe, []);
          } catch {}
        }
        const pyLauncher = 'C:\\Windows\\py.exe';
        if (fs.existsSync(pyLauncher)) pushPy(pyLauncher, ['-3']);
        pushPy('py', ['-3']);
        pushPy('python', []);
        pushPy('python3', []);
      } else {
        pushPy('python3', []);
        pushPy('python', []);
        pushPy('py', ['-3']);
      }
      const filtered = pythonCandidates.filter((v) => !/\\windowsapps\\python(3)?\.exe$/i.test(String(v?.cmd || '')));
      pythonCandidates.length = 0;
      pythonCandidates.push(...filtered);

      let stdout = '';
      let stderr = '';
      let usedPythonCmd = '';
      let lastErr = null;
      for (const cand of pythonCandidates) {
        try {
          const result = await execFileAsync(cand.cmd, [...cand.prefixArgs, ...args], {
            cwd: repoRoot,
            timeout: 120000,
            maxBuffer: 10 * 1024 * 1024,
          });
          stdout = String(result?.stdout || '');
          stderr = String(result?.stderr || '');
          usedPythonCmd = [cand.cmd, ...cand.prefixArgs].join(' ').trim();
          lastErr = null;
          break;
        } catch (err) {
          lastErr = err;
          stderr = String(err?.stderr || err?.message || err || '').trim();
        }
      }

      if (lastErr) {
        return {
          ok: false,
          reason: 'qwen_script_failed',
          status: 502,
          message: String(lastErr?.message || lastErr || 'qwen 正式脚本执行失败'),
          raw: {
            repoRoot,
            scriptPath,
            pythonTried: pythonCandidates.map((v) => [v.cmd, ...(v.prefixArgs || [])].join(' ').trim()),
            stderr,
          },
        };
      }

      let parsed = null;
      try {
        parsed = JSON.parse(String(stdout || '').trim() || '{}');
      } catch {
        parsed = { rawStdout: String(stdout || '').trim() };
      }

      if (!fs.existsSync(outAudio)) {
        return {
          ok: false,
          reason: 'qwen_script_missing_audio',
          status: 502,
          message: 'qwen 正式脚本未输出音频文件',
          raw: {
            parsed,
            stderr: String(stderr || '').trim(),
          },
        };
      }

      const buf = fs.readFileSync(outAudio);
      if (!buf || !buf.length) {
        return {
          ok: false,
          reason: 'qwen_script_empty_audio',
          status: 502,
          message: 'qwen 正式脚本输出音频为空',
          raw: {
            parsed,
            stderr: String(stderr || '').trim(),
          },
        };
      }

      return {
        ok: true,
        audioUrl: `data:audio/wav;base64,${buf.toString('base64')}`,
        raw: {
          via: 'qwen_voice_design_dubbing_repo',
          repoRoot,
          scriptPath,
          pythonCmd: usedPythonCmd || pythonCmd,
          parsed,
        },
        used: 'qwen_repo_tts_with_designed_voice_script',
      };
    } catch (err) {
      return {
        ok: false,
        reason: 'qwen_script_failed',
        status: 502,
        message: String(err?.message || err || 'qwen 正式脚本执行失败'),
        raw: {
          repoRoot,
          scriptPath,
        },
      };
    } finally {
      try { if (fs.existsSync(outAudio)) fs.unlinkSync(outAudio); } catch {}
    }
  }

  async function callDashscopeVoiceDesign({ cfg, role, prompt, previewText }) {
    const apiKey = getDubbingApiKey();
    if (!apiKey) return { ok: false, reason: 'missing_api_key' };

    const dubbingCfg = (cfg && typeof cfg === 'object' && cfg.dubbing && typeof cfg.dubbing === 'object')
      ? cfg.dubbing
      : {};
    const designUrl = `${dubbingCfg.baseUrl || 'https://dashscope.aliyuncs.com'}/api/v1/services/audio/tts/customization`;
    const payload = {
      model: dubbingCfg.designModel || 'qwen-voice-design',
      input: {
        action: 'create',
        target_model: dubbingCfg.ttsModel || 'qwen3-tts-vd-realtime-2026-01-15',
        voice_prompt: prompt,
        preview_text: previewText,
        preferred_name: sanitizePreferredName(role),
        language: dubbingCfg.language || 'zh',
      },
      parameters: {
        sample_rate: 24000,
        response_format: 'wav',
      },
    };

    const upstream = await callJson(designUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      timeoutMs: 120000,
    });
    if (!upstream.ok) {
      return {
        ok: false,
        reason: 'upstream_failed',
        status: upstream.status,
        message: String(upstream?.data?.message || upstream?.data?.error?.message || upstream?.text || 'DashScope voice design failed'),
        raw: upstream.data || null,
      };
    }

    const out = (upstream.data && typeof upstream.data === 'object') ? (upstream.data.output || {}) : {};
    const voiceId = String(out.voice || out.voice_id || '').trim();
    const previewAudioUrl = pickDashscopePreviewAudio(out);
    if (!voiceId) {
      return { ok: false, reason: 'invalid_output', message: 'DashScope 未返回 voice' };
    }

    return {
      ok: true,
      voiceId,
      previewAudioUrl,
      raw: upstream.data,
    };
  }

  async function callDashscopeVoicePreview({ cfg, voiceId, text }) {
    const apiKey = getDubbingApiKey();
    if (!apiKey) return { ok: false, reason: 'missing_api_key' };

    const dubbingCfg = (cfg && typeof cfg === 'object' && cfg.dubbing && typeof cfg.dubbing === 'object')
      ? cfg.dubbing
      : {};
    const baseUrl = String(dubbingCfg.baseUrl || 'https://dashscope.aliyuncs.com').replace(/\/$/, '');
    const ttsModel = String(dubbingCfg.ttsModel || 'qwen3-tts-vd-realtime-2026-01-15').trim();
    const safeText = String(text || '').trim();
    const safeVoiceId = String(voiceId || '').trim();

    // Qwen-TTS 兼容接口：/compatible-mode/v1/audio/speech
    // 兼容不同 baseUrl 形态（可能已包含 /compatible-mode/v1 或 /api/v1）。
    // 若该通道 404/路径不匹配，不直接失败，继续回退 /services/audio/tts。
    if (/^qwen3?-tts/i.test(ttsModel)) {
      try {
        const originLikeBase = baseUrl.replace(/\/api\/v1\/?$/i, '').replace(/\/compatible-mode\/v1\/?$/i, '');
        const compatibleUrls = Array.from(new Set([
          `${baseUrl.replace(/\/$/, '')}/audio/speech`,
          `${baseUrl.replace(/\/$/, '')}/compatible-mode/v1/audio/speech`,
          `${originLikeBase.replace(/\/$/, '')}/compatible-mode/v1/audio/speech`,
          'https://dashscope.aliyuncs.com/compatible-mode/v1/audio/speech',
        ]));
        const compatiblePayloads = [
          {
            model: ttsModel,
            input: safeText,
            voice: safeVoiceId,
            response_format: 'wav',
          },
          {
            model: ttsModel,
            input: { text: safeText },
            voice: safeVoiceId,
            response_format: 'wav',
          },
        ];
        for (const compatibleUrl of compatibleUrls) {
          for (const payload of compatiblePayloads) {
            const resp = await fetch(compatibleUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify(payload),
            });
            if (resp.ok) {
              const buf = Buffer.from(await resp.arrayBuffer());
              if (buf && buf.length > 0) {
                return {
                  ok: true,
                  audioUrl: `data:audio/wav;base64,${buf.toString('base64')}`,
                  raw: { via: compatibleUrl, bytes: buf.length },
                  used: 'compatible_audio_speech_qwen_tts',
                };
              }
            } else {
              const textBody = await resp.text();
              let data = null;
              try { data = textBody ? JSON.parse(textBody) : null; } catch {}
              const msg = String(data?.message || data?.error?.message || textBody || 'DashScope compatible audio/speech failed').trim();
              const status = Number(resp.status || 0);
              // 404 常见于路径/网关差异：继续尝试其它兼容 URL 与旧链路。
              if (status === 404) continue;
              // task-null 常见于网关口径差异，继续尝试其它 payload/url。
              if (/task can not be null/i.test(msg)) continue;
              // 仅对“非 task-null 的明确 4xx”提前返回，其余交给旧链路兜底。
              if (status >= 400 && status < 500) {
                return {
                  ok: false,
                  reason: 'upstream_failed',
                  status,
                  used: 'compatible_audio_speech_qwen_tts',
                  message: msg,
                  raw: data || textBody || null,
                };
              }
            }
          }
        }
      } catch (err) {
        // 兼容接口网络失败时继续尝试旧链路
      }
    }

    // 优先尝试“文档 task 对象”结构，规避上游 `task can not be null`。
    const originLikeBase = baseUrl.replace(/\/api\/v1\/?$/i, '').replace(/\/compatible-mode\/v1\/?$/i, '');
    const ttsUrls = Array.from(new Set([
      `${baseUrl.replace(/\/$/, '')}/api/v1/services/audio/tts`,
      `${originLikeBase.replace(/\/$/, '')}/api/v1/services/audio/tts`,
      `${originLikeBase.replace(/\/$/, '')}/services/audio/tts`,
    ]));
    const preferredTtsUrl = ttsUrls.find((u) => !/\/api\/v1\/api\/v1\//i.test(u)) || ttsUrls[0];
    const attempts = [
      // 仅保留文档口径请求，避免一次 preview 触发过多上游请求。
      {
        label: 'audio_tts_doc_task_with_model',
        url: preferredTtsUrl,
        payload: {
          model: ttsModel,
          task: {
            text: safeText,
            voice: safeVoiceId,
            sample_rate: 8000,
            format: 'wav',
          },
        },
      },
    ];

    let lastErr = null;
    const attemptErrors = [];
    for (const attempt of attempts) {
      try {
        const resp = await fetch(attempt.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'audio/wav, application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(attempt.payload),
        });
        const status = Number(resp.status || 0);
        const contentType = String(resp.headers.get('content-type') || '').toLowerCase();
        const buf = Buffer.from(await resp.arrayBuffer());

        if (!resp.ok) {
          const textBody = buf.toString('utf8');
          let data = null;
          try { data = textBody ? JSON.parse(textBody) : null; } catch {}
          const errObj = {
            ok: false,
            reason: 'upstream_failed',
            status,
            used: attempt.label,
            message: String(data?.message || data?.error?.message || textBody || `DashScope voice preview failed: ${attempt.label}`),
            raw: data || null,
          };
          attemptErrors.push({ label: attempt.label, url: attempt.url, status, message: errObj.message });
          lastErr = errObj;
          continue;
        }

        if (contentType.startsWith('audio/') && buf.length > 0) {
          return {
            ok: true,
            audioUrl: `data:${contentType.split(';')[0]};base64,${buf.toString('base64')}`,
            raw: { via: attempt.url, contentType, bytes: buf.length },
            used: attempt.label,
          };
        }

        const textBody = buf.toString('utf8');
        let data = null;
        try { data = textBody ? JSON.parse(textBody) : null; } catch {}
        const out = (data && typeof data === 'object') ? (data.output || {}) : {};
        const audioUrl = pickDashscopePreviewAudio(out)
          || pickDashscopePreviewAudio(data)
          || String(out?.audio_url || out?.audioUrl || '').trim();
        if (audioUrl) {
          return {
            ok: true,
            audioUrl,
            raw: data,
            used: attempt.label,
          };
        }

        lastErr = {
          ok: false,
          reason: 'invalid_output',
          used: attempt.label,
          message: `DashScope 未返回可播放音频（${attempt.label}）`,
          raw: data || { via: attempt.url, contentType, bytes: buf.length },
        };
        attemptErrors.push({ label: attempt.label, url: attempt.url, status, message: lastErr.message });
      } catch (err) {
        const message = err?.message || String(err);
        lastErr = {
          ok: false,
          reason: 'upstream_failed',
          status: 0,
          used: attempt.label,
          message,
          raw: null,
        };
        attemptErrors.push({ label: attempt.label, url: attempt.url, status: 0, message });
      }
    }

    if (lastErr && (!lastErr.raw || typeof lastErr.raw !== 'object')) {
      lastErr.raw = { attempts: attemptErrors };
    } else if (lastErr && lastErr.raw && typeof lastErr.raw === 'object' && !lastErr.raw.attempts) {
      lastErr.raw = { ...lastErr.raw, attempts: attemptErrors };
    }
    return lastErr || { ok: false, reason: 'unknown', message: 'DashScope voice preview failed' };
  }

  async function handleDubbingVoiceDesign(req, res, bodyText) {
    let body = {};
    try {
      body = bodyText ? JSON.parse(bodyText) : {};
    } catch (err) {
      return sendJson(res, 400, { error: { type: 'invalid_json', message: `JSON 解析失败：${err.message}` } });
    }

    const project = String(body?.project || '').trim();
    const role = String(body?.role || '').trim();
    const prompt = String(body?.prompt || '').trim();

    if (!project) {
      return sendJson(res, 400, { error: { type: 'missing_project', message: '缺少 project' } });
    }
    if (!role) {
      return sendJson(res, 400, { error: { type: 'missing_role', message: '缺少 role' } });
    }
    if (!prompt) {
      return sendJson(res, 400, { error: { type: 'missing_prompt', message: '缺少 prompt' } });
    }

    const cfg = loadConfig();
    const previewText = String(body?.previewText || `${role}，您好，这是一段音色试听。`).trim();
    const useDashscope = cfg?.dubbing?.enabled !== false && String(cfg?.dubbing?.provider || 'dashscope').toLowerCase() === 'dashscope';

    if (useDashscope) {
      const designed = await callDashscopeVoiceDesign({ cfg, role, prompt, previewText });
      if (designed.ok) {
        const previewAudioUrl = String(designed.previewAudioUrl || '').trim();
        setDubbingVoiceState(project, role, {
          provider: 'dashscope',
          model: cfg?.dubbing?.designModel || 'qwen-voice-design',
          ttsModel: cfg?.dubbing?.ttsModel || 'qwen3-tts-vd-realtime-2026-01-15',
          voiceId: designed.voiceId,
          previewText,
          previewAudioUrl,
        });
        return sendJson(res, 200, {
          ok: true,
          project,
          role,
          voiceId: designed.voiceId,
          voice: designed.voiceId,
          model: cfg?.dubbing?.designModel || 'qwen-voice-design',
          provider: 'dashscope',
          ttsModel: cfg?.dubbing?.ttsModel || 'qwen3-tts-vd-realtime-2026-01-15',
          previewText,
          previewAudioUrl,
          updatedAt: new Date().toISOString(),
          raw: designed.raw || null,
        });
      }
      if (designed.reason === 'upstream_failed') {
        return sendJson(res, 502, {
          error: {
            type: 'dashscope_voice_design_failed',
            message: designed.message || 'DashScope 音色设计失败',
            status: designed.status || 502,
            details: designed.raw || null,
          }
        });
      }
      if (designed.reason === 'invalid_output') {
        return sendJson(res, 502, {
          error: {
            type: 'dashscope_voice_design_invalid_output',
            message: designed.message || 'DashScope 返回无效音色结果',
          }
        });
      }
    }

    const voiceId = `voice_${hashStringToInt(`${project}|${role}|${prompt}`).toString(16).slice(0, 10)}`;
    const previewAudioUrl = buildWavToneDataUrl({ seed: `${voiceId}:${prompt}` });

    return sendJson(res, 200, {
      ok: true,
      project,
      role,
      voiceId,
      voice: voiceId,
      model: 'local-mock-voice-design',
      provider: 'local-mock',
      previewText,
      previewAudioUrl,
      updatedAt: new Date().toISOString(),
      note: '当前环境未接入真实音色设计供应商，已返回可用本地预览音频以保证前端流程可用。',
    });
  }

  async function handleDubbingVoicePreview(req, res, bodyText) {
    let body = {};
    try {
      body = bodyText ? JSON.parse(bodyText) : {};
    } catch (err) {
      return sendJson(res, 400, { error: { type: 'invalid_json', message: `JSON 解析失败：${err.message}` } });
    }

    let project = String(body?.project || '').trim();
    let role = String(body?.role || '').trim();
    const voiceId = String(body?.voiceId || body?.voice || '').trim();
    const forceRegenerate = !!body?.forceRegenerate;
    const reuseDesignedPreview = !!body?.reuseDesignedPreview;

    if (!voiceId) {
      return sendJson(res, 400, { error: { type: 'missing_voice_id', message: '缺少 voiceId（请先设计音色）' } });
    }

    // 兼容前端旧请求体：允许仅传 voiceId（由服务端反查最近设计态补齐 project/role）
    if (!project || !role) {
      const hit = findDubbingVoiceStateByVoiceId(voiceId);
      if (hit) {
        if (!project) project = String(hit.project || '').trim();
        if (!role) role = String(hit.role || '').trim();
      }
    }

    // 允许 project/role 缺省：优先从 voiceId 反查，其次使用兜底占位，避免旧前端触发 400。
    if (!project) project = '__adhoc_project__';
    if (!role) role = String(body?.speaker || body?.name || '角色').trim() || '角色';

    const state = getDubbingVoiceState(project, role) || {};
    const text = String(body?.text || `${role || '角色'}，您好，这是一段音色试听。`).trim();
    const statePreviewAudio = String(state?.previewAudioUrl || '').trim();
    const statePreviewText = String(state?.previewText || '').trim();
    const cfg = loadConfig();
    const useDashscope = cfg?.dubbing?.enabled !== false && String(cfg?.dubbing?.provider || 'dashscope').toLowerCase() === 'dashscope';

    if (isDashscopeVoiceId(voiceId)) {
      // 试听（非刷新）优先复用“上方音色设计”阶段返回的 preview 音频，
      // 避免每次都打上游接口导致 4xx/5xx 干扰体验。
      if (!forceRegenerate && reuseDesignedPreview) {
        if (statePreviewAudio) {
          return sendJson(res, 200, {
            ok: true,
            project,
            role,
            voiceId,
            previewText: text || statePreviewText || `${role}，您好，这是一段音色试听。`,
            audioUrl: statePreviewAudio,
            provider: 'dashscope',
            model: state?.model || 'qwen-voice-design',
            ttsModel: state?.ttsModel || cfg?.dubbing?.ttsModel || 'qwen3-tts-vd-realtime-2026-01-15',
            forceRegenerate,
            reusedDesignedPreview: true,
          });
        }
        return sendJson(res, 422, {
          error: {
            type: 'missing_designed_preview_audio',
            message: '当前角色已设计音色，但未找到可复用的试听音频。请先在上方“音色设计”重新设计后再试听。',
          }
        });
      }

      if (useDashscope) {
        // 刷新语义优先走 qwen 正式仓库脚本，避免先请求 DashScope 触发 task-null 再兜底。
        if (forceRegenerate) {
          const qwenPreviewDirect = await callQwenRepoRealtimePreview({ cfg, voiceId, text });
          if (qwenPreviewDirect.ok) {
            return sendJson(res, 200, {
              ok: true,
              project,
              role,
              voiceId,
              previewText: text || statePreviewText || `${role}，您好，这是一段音色试听。`,
              audioUrl: String(qwenPreviewDirect.audioUrl || '').trim(),
              provider: 'qwen-voice-design-dubbing',
              model: state?.model || cfg?.dubbing?.designModel || 'qwen-voice-design',
              ttsModel: state?.ttsModel || cfg?.dubbing?.ttsModel || 'qwen3-tts-vd-realtime-2026-01-15',
              forceRegenerate: true,
              reusedDesignedPreview: false,
              previewSource: 'qwen_repo_script_direct_regen',
              details: qwenPreviewDirect.raw || null,
            });
          }
        }

        const previewed = await callDashscopeVoicePreview({ cfg, voiceId, text });
        if (previewed.ok) {
          const audioUrl = String(previewed.audioUrl || '').trim();
          return sendJson(res, 200, {
            ok: true,
            project,
            role,
            voiceId,
            previewText: text || statePreviewText || `${role}，您好，这是一段音色试听。`,
            audioUrl,
            provider: 'dashscope',
            model: state?.model || cfg?.dubbing?.designModel || 'qwen-voice-design',
            ttsModel: state?.ttsModel || cfg?.dubbing?.ttsModel || 'qwen3-tts-vd-realtime-2026-01-15',
            forceRegenerate,
            reusedDesignedPreview: false,
            previewSource: previewed.used || 'dashscope',
          });
        }
        const upstreamStatus = Number(previewed.status || 0);
        // 对 task-null 类报错做本地兜底，避免前端持续 400。
        if (isTaskNullLikeError(previewed.raw) || isTaskNullLikeError(previewed.message)) {
          const qwenPreview = await callQwenRepoRealtimePreview({ cfg, voiceId, text });
          if (qwenPreview.ok) {
            return sendJson(res, 200, {
              ok: true,
              project,
              role,
              voiceId,
              previewText: text || statePreviewText || `${role}，您好，这是一段音色试听。`,
              audioUrl: String(qwenPreview.audioUrl || '').trim(),
              provider: 'qwen-voice-design-dubbing',
              model: state?.model || cfg?.dubbing?.designModel || 'qwen-voice-design',
              ttsModel: state?.ttsModel || cfg?.dubbing?.ttsModel || 'qwen3-tts-vd-realtime-2026-01-15',
              forceRegenerate,
              reusedDesignedPreview: false,
              previewSource: 'qwen_repo_script',
              warning: '上游返回 task can not be null，已切换到 qwen-voice-design-dubbing 正式链路生成音频。',
              details: qwenPreview.raw || null,
            });
          }

          const forceSeed = `${voiceId}:${text}:${Date.now()}`;
          // 刷新语义：必须重新生成，不能复用“音色设计阶段”的 preview 音频。
          const fallbackAudio = forceRegenerate
            ? buildWavToneDataUrl({ seed: forceSeed })
            : (statePreviewAudio || buildWavToneDataUrl({ seed: forceSeed }));
          return sendJson(res, 200, {
            ok: true,
            project,
            role,
            voiceId,
            previewText: text || statePreviewText || `${role}，您好，这是一段音色试听。`,
            audioUrl: fallbackAudio,
            provider: 'dashscope-fallback',
            model: state?.model || cfg?.dubbing?.designModel || 'qwen-voice-design',
            ttsModel: state?.ttsModel || cfg?.dubbing?.ttsModel || 'qwen3-tts-vd-realtime-2026-01-15',
            forceRegenerate,
            reusedDesignedPreview: forceRegenerate ? false : !!statePreviewAudio,
            previewSource: forceRegenerate ? 'fallback_task_null_regen' : 'fallback_task_null',
            warning: forceRegenerate
              ? '上游返回 task can not be null，qwen 正式链路不可用，已回退到本地重生成音频（不复用设计试听）。'
              : '上游返回 task can not be null，qwen 正式链路不可用，已回退到本地可播放音频。',
            details: qwenPreview.raw || null,
          });
        }

        const statusCode = (upstreamStatus >= 400 && upstreamStatus < 500) ? upstreamStatus : 502;
        return sendJson(res, statusCode, {
          error: {
            type: statusCode === 502 ? 'dashscope_voice_preview_failed' : 'dashscope_voice_preview_bad_request',
            message: previewed.message || 'DashScope 配音试听失败',
            status: upstreamStatus || statusCode,
            details: {
              usedPayload: previewed.used || null,
              upstream: previewed.raw || null,
            },
          }
        });
      }

      return sendJson(res, 422, {
        error: {
          type: 'missing_designed_preview_audio',
          message: '当前角色已设计音色，但未找到可复用的试听音频。请先在上方“音色设计”重新设计后再试听。',
        }
      });
    }

    const audioUrl = buildWavToneDataUrl({ seed: `${voiceId}:${text}:${Date.now()}` });
    return sendJson(res, 200, {
      ok: true,
      project,
      role,
      voiceId,
      previewText: text,
      audioUrl,
      provider: 'local-mock-voice-preview',
      forceRegenerate,
      reusedDesignedPreview: false,
    });
  }

  return {
    handleDubbingVoiceDesign,
    handleDubbingVoicePreview,
  };
}

module.exports = {
  createDubbingVoiceHandlers,
};
