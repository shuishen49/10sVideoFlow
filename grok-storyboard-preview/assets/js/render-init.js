let latestRenderContext = null;
let imagePromptTaskRunning = false;
let storyboardTopScrollBound = false;
const PROJECT_MANUAL_SEGMENTS_KEY = 'grok_storyboard_project_manual_segments_v1';
const PROJECT_SEGMENT_CAST_KEY = 'grok_storyboard_project_segment_cast_v1';
const PROJECT_SEGMENT_CAST_EXCLUDED_KEY = 'grok_storyboard_project_segment_cast_excluded_v1';
const PROJECT_IMAGE_PROMPT_DRAFT_KEY = 'grok_storyboard_project_image_prompt_draft_v1';
const PROJECT_SCENE_IMAGE_DRAFT_KEY = 'grok_storyboard_project_scene_image_draft_v1';
const PROJECT_SCENE_IMAGE_HISTORY_KEY = 'grok_storyboard_project_scene_image_history_v1';
const PROJECT_VIDEO_DRAFT_KEY = 'grok_storyboard_project_video_draft_v1';
const PROJECT_VIDEO_PROMPT_DRAFT_KEY = 'grok_storyboard_project_video_prompt_draft_v1';
const PROJECT_VIDEO_HISTORY_DELETED_KEY = 'grok_storyboard_project_video_history_deleted_v1';
const VIDEO_GEN_OPTIONS_KEY = 'grok_storyboard_video_gen_options_v1';
const VIDEO_GEN_TAIL_IMAGE_DRAFT_KEY = 'grok_storyboard_video_gen_tail_image_draft_v1';
const PROJECT_DUBBING_VOICE_PROFILE_KEY = 'grok_storyboard_project_dubbing_voice_profile_v1';
const PROJECT_DUBBING_RESULT_DRAFT_KEY = 'grok_storyboard_project_dubbing_result_draft_v1';
const PROJECT_DUBBING_VOICE_ROLE_MANUAL_KEY = 'grok_storyboard_project_dubbing_voice_role_manual_v1';
const PROJECT_DUBBING_VOICE_ROLE_EXCLUDED_KEY = 'grok_storyboard_project_dubbing_voice_role_excluded_v1';
const PROJECT_DUBBING_VOICE_DESIGN_KEY = 'grok_storyboard_project_dubbing_voice_design_v1';
const PROJECT_DUBBING_VOICE_PROMPT_LINE_KEY = 'grok_storyboard_project_dubbing_voice_prompt_line_v1';
let dubbingVoicePreviewAudio = null;
let dubbingVoicePreviewUtterance = null;

function readProjectManualSegmentsMap(){
  try {
    const raw = localStorage.getItem(PROJECT_MANUAL_SEGMENTS_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

function saveProjectManualSegmentsMap(map = {}){
  try { localStorage.setItem(PROJECT_MANUAL_SEGMENTS_KEY, JSON.stringify(map || {})); } catch {}
}

function setProjectManualSegments(project = '', segments = []){
  const p = String(project || '').trim();
  if(!p) return;
  const map = readProjectManualSegmentsMap();
  map[p] = Array.isArray(segments) ? segments : [];
  saveProjectManualSegmentsMap(map);
}

function getProjectManualSegments(project = ''){
  const p = String(project || '').trim();
  if(!p) return [];
  const map = readProjectManualSegmentsMap();
  const rows = map[p];
  return Array.isArray(rows) ? rows : [];
}

function readProjectImagePromptDraftMap(){
  try {
    const raw = localStorage.getItem(PROJECT_IMAGE_PROMPT_DRAFT_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

function saveProjectImagePromptDraftMap(map = {}){
  try { localStorage.setItem(PROJECT_IMAGE_PROMPT_DRAFT_KEY, JSON.stringify(map || {})); } catch {}
}

function setProjectImagePromptDraft(project = '', sid = '', text = ''){
  const p = String(project || '').trim();
  const s = String(sid || '').trim();
  if(!p || !s) return;
  const map = readProjectImagePromptDraftMap();
  if(!map[p] || typeof map[p] !== 'object') map[p] = {};
  map[p][s] = String(text || '').trim();
  saveProjectImagePromptDraftMap(map);
}

function getProjectImagePromptDraftMap(project = ''){
  const p = String(project || '').trim();
  if(!p) return {};
  const map = readProjectImagePromptDraftMap();
  const row = map[p];
  return row && typeof row === 'object' ? row : {};
}

function readProjectSceneImageDraftMap(){
  try {
    const raw = localStorage.getItem(PROJECT_SCENE_IMAGE_DRAFT_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

function saveProjectSceneImageDraftMap(map = {}){
  try { localStorage.setItem(PROJECT_SCENE_IMAGE_DRAFT_KEY, JSON.stringify(map || {})); } catch {}
}

function setProjectSceneImageDraft(project = '', sid = '', url = ''){
  const p = String(project || '').trim();
  const s = String(sid || '').trim();
  if(!p || !s) return;
  const map = readProjectSceneImageDraftMap();
  if(!map[p] || typeof map[p] !== 'object') map[p] = {};
  map[p][s] = String(url || '').trim();
  saveProjectSceneImageDraftMap(map);
}

function getProjectSceneImageDraftMap(project = ''){
  const p = String(project || '').trim();
  if(!p) return {};
  const map = readProjectSceneImageDraftMap();
  const row = map[p];
  return row && typeof row === 'object' ? row : {};
}

function readProjectSceneImageHistoryMap(){
  try {
    const raw = localStorage.getItem(PROJECT_SCENE_IMAGE_HISTORY_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

function saveProjectSceneImageHistoryMap(map = {}){
  try { localStorage.setItem(PROJECT_SCENE_IMAGE_HISTORY_KEY, JSON.stringify(map || {})); } catch {}
}

function getProjectSceneImageHistory(project = '', sid = ''){
  const p = String(project || '').trim();
  const s = String(sid || '').trim();
  if(!p || !s) return [];
  const map = readProjectSceneImageHistoryMap();
  const list = map?.[p]?.[s];
  return Array.isArray(list) ? list.map(x => String(x || '').trim()).filter(Boolean) : [];
}

function setProjectSceneImageHistory(project = '', sid = '', urls = []){
  const p = String(project || '').trim();
  const s = String(sid || '').trim();
  if(!p || !s) return;
  const map = readProjectSceneImageHistoryMap();
  if(!map[p] || typeof map[p] !== 'object') map[p] = {};
  map[p][s] = Array.isArray(urls) ? [...new Set(urls.map(x => String(x || '').trim()).filter(Boolean))] : [];
  saveProjectSceneImageHistoryMap(map);
}

function appendProjectSceneImageHistory(project = '', sid = '', url = ''){
  const p = String(project || '').trim();
  const s = String(sid || '').trim();
  const u = String(url || '').trim();
  if(!p || !s || !u) return;
  const list = getProjectSceneImageHistory(p, s);
  const next = [u, ...list.filter(x => x !== u)];
  setProjectSceneImageHistory(p, s, next.slice(0, 50));
}

function removeProjectSceneImageHistory(project = '', sid = '', url = ''){
  const p = String(project || '').trim();
  const s = String(sid || '').trim();
  const u = String(url || '').trim();
  if(!p || !s || !u) return;
  const list = getProjectSceneImageHistory(p, s).filter(x => x !== u);
  setProjectSceneImageHistory(p, s, list);
}

function renderSceneImageCell(project = '', sid = '', imageUrl = ''){
  const p = String(project || '').trim();
  const s = String(sid || '').trim();
  const u = String(imageUrl || '').trim();
  if(!u) return '';
  return `<a href="javascript:void(0)" data-img="${escapeHtml(u)}" data-sid="${escapeHtml(s)}" data-project="${escapeHtml(p)}" class="thumb-link"><img class="thumb" src="${escapeHtml(u)}" alt="${escapeHtml(s)}"/></a><div style="margin-top:8px"><button class="btn-primary" onclick="generateSceneImageWithLobster('${escapeHtml(p)}', '${escapeHtml(s)}', this)">生成图片</button></div>`;
}

function readProjectSegmentCastMap(){
  try {
    const raw = localStorage.getItem(PROJECT_SEGMENT_CAST_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

function saveProjectSegmentCastMap(map = {}){
  try { localStorage.setItem(PROJECT_SEGMENT_CAST_KEY, JSON.stringify(map || {})); } catch {}
}

function setProjectSegmentCast(project = '', sid = '', names = []){
  const p = String(project || '').trim();
  const s = String(sid || '').trim();
  if(!p || !s) return;
  const map = readProjectSegmentCastMap();
  if(!map[p] || typeof map[p] !== 'object') map[p] = {};
  map[p][s] = Array.isArray(names) ? [...new Set(names.map(x => String(x || '').trim()).filter(Boolean))] : [];
  saveProjectSegmentCastMap(map);
}

function getProjectSegmentCast(project = '', sid = ''){
  const p = String(project || '').trim();
  const s = String(sid || '').trim();
  if(!p || !s) return [];
  const map = readProjectSegmentCastMap();
  const row = map[p] && typeof map[p] === 'object' ? map[p] : {};
  return Array.isArray(row[s]) ? row[s] : [];
}

function readProjectSegmentCastExcludedMap(){
  try {
    const raw = localStorage.getItem(PROJECT_SEGMENT_CAST_EXCLUDED_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

function saveProjectSegmentCastExcludedMap(map = {}){
  try { localStorage.setItem(PROJECT_SEGMENT_CAST_EXCLUDED_KEY, JSON.stringify(map || {})); } catch {}
}

function getProjectLevelExcludedArray(project = ''){
  const p = String(project || '').trim();
  if(!p) return [];
  const map = readProjectSegmentCastExcludedMap();
  const row = map[p];

  // 新格式：map[project] = ['角色A','角色B']
  if(Array.isArray(row)){
    return row.map(x => String(x || '').trim()).filter(Boolean);
  }

  // 兼容旧格式：map[project][sid] = ['角色A']，合并成项目级
  if(row && typeof row === 'object'){
    const merged = [];
    Object.values(row).forEach(v => {
      if(Array.isArray(v)) merged.push(...v);
    });
    return [...new Set(merged.map(x => String(x || '').trim()).filter(Boolean))];
  }

  return [];
}

function setProjectSegmentCastExcluded(project = '', _sid = '', name = '', excluded = true){
  const p = String(project || '').trim();
  const n = String(name || '').trim();
  if(!p || !n) return;

  const map = readProjectSegmentCastExcludedMap();
  const set = new Set(getProjectLevelExcludedArray(p));
  if(excluded) set.add(n);
  else set.delete(n);
  map[p] = [...set];
  saveProjectSegmentCastExcludedMap(map);
}

function getProjectSegmentCastExcludedSet(project = '', _sid = ''){
  const p = String(project || '').trim();
  if(!p) return new Set();
  return new Set(getProjectLevelExcludedArray(p));
}

function collectCastOptions(){
  const fromProject = (currentProjectCharacters || []).map(ch => String(ch?.name || ch?.id || '').trim()).filter(Boolean);
  const fromGlobal = (globalCharacterLibrary || []).map(ch => String(ch?.name || ch?.id || '').trim()).filter(Boolean);
  return [...new Set([...fromProject, ...fromGlobal])];
}

function parseSuggestedCastFromText(text = '', options = []){
  const t = String(text || '');
  const opts = Array.isArray(options) ? options : [];
  return opts.filter(name => t.includes(name));
}

async function aiSuggestSegmentCast(project, sid, scriptText, options = []){
  if(typeof requestChatCompletion !== 'function') throw new Error('聊天能力未就绪');
  const prompt = [
    '你是分镜出场人物标注助手。',
    '请根据给定剧情段文本，从候选人物中选择真正出场的人物。',
    '只返回 JSON：{"cast":["人物1","人物2"]}',
    '不要返回其他内容。',
    `候选人物：${JSON.stringify(options)}`,
    `段号：${sid}`,
    `剧情段：${scriptText}`
  ].join('\n');

  const reply = await requestChatCompletion(prompt, {
    // 针对“出场人物”识别：优先使用当前环境更快且可用的 codex 模型
    preferredModel: 'custom-154-12-46-107/gpt-5.3-codex',
    fallbackModel: 'custom-154-12-46-107/gpt-5.4',
    temperature: 0.2,
  });
  const raw = String(reply || '').trim();
  try {
    const m = raw.match(/\{[\s\S]*\}$/);
    const obj = JSON.parse(m ? m[0] : raw);
    const cast = Array.isArray(obj?.cast) ? obj.cast.map(x => String(x || '').trim()).filter(Boolean) : [];
    return cast.filter(x => options.includes(x));
  } catch {
    return parseSuggestedCastFromText(raw, options);
  }
}

function getCastImageUrl(name = ''){
  const n = String(name || '').trim();
  if(!n) return '';
  const fromProject = (currentProjectCharacters || []).find(ch => String(ch?.name || ch?.id || '').trim() === n);
  if(fromProject?.imageUrl) return String(fromProject.imageUrl).trim();
  const fromGlobal = (globalCharacterLibrary || []).find(ch => String(ch?.name || ch?.id || '').trim() === n);
  if(fromGlobal?.imageUrl) return String(fromGlobal.imageUrl).trim();
  return '';
}

function previewSegmentCastImage(event, imageUrl = '', name = ''){
  event?.preventDefault?.();
  event?.stopPropagation?.();
  const url = String(imageUrl || '').trim();
  if(!url) return;
  openLightbox(url, String(name || '角色图'));
}

function buildSegmentCastGridHtml(project, sid){
  const selected = getProjectSegmentCast(project, sid);
  const slots = selected.map(name => {
    const img = getCastImageUrl(name);
    if(img){
      return `
        <div class="cast-person-chip-wrap">
          <a href="javascript:void(0)" class="cast-person-chip cast-person-chip-photo" title="点击预览 ${escapeHtml(name)}" onclick="previewSegmentCastImage(event, '${escapeHtml(img)}', '${escapeHtml(name)}')">
            <img src="${escapeHtml(img)}" alt="${escapeHtml(name)}" class="cast-person-chip-img" />
            <small>${escapeHtml(name)}</small>
          </a>
          <button type="button" class="cast-person-remove" title="移除 ${escapeHtml(name)}" onclick="removeSegmentCast('${escapeHtml(project)}','${escapeHtml(sid)}','${escapeHtml(name)}')">×</button>
        </div>
      `;
    }
    return `
      <button type="button" class="cast-person-chip" title="点击移除 ${escapeHtml(name)}" onclick="removeSegmentCast('${escapeHtml(project)}','${escapeHtml(sid)}','${escapeHtml(name)}')">
        <span>${escapeHtml(String(name || '').slice(0,2))}</span>
        <small>${escapeHtml(name)}</small>
      </button>
    `;
  }).join('');

  return `
    <div class="cast-slot-grid" data-cast-project="${escapeHtml(project)}" data-cast-sid="${escapeHtml(sid)}">
      ${slots}
      <button type="button" class="cast-add-btn" title="添加人物" onclick="openSegmentCastSelector('${escapeHtml(project)}','${escapeHtml(sid)}')">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-6 h-6"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
      </button>
    </div>
  `;
}

function refreshSegmentCastCell(project, sid){
  const p = String(project || '');
  const s = String(sid || '');
  document.querySelectorAll('[data-cast-project][data-cast-sid]').forEach(el => {
    if(String(el.getAttribute('data-cast-project') || '') === p && String(el.getAttribute('data-cast-sid') || '') === s){
      el.outerHTML = buildSegmentCastGridHtml(project, sid);
    }
  });
}

let currentSegmentCastModal = null;

function getCastCandidateMeta(){
  const fromProjectList = (currentProjectCharacters || []).map(ch => ({
    name: String(ch?.name || ch?.id || '').trim(),
    notes: String(ch?.designNotes || ch?.role || '').trim(),
    imageUrl: String(ch?.imageUrl || '').trim(),
  })).filter(x => x.name);

  const fromGlobalList = (globalCharacterLibrary || []).map(ch => ({
    name: String(ch?.name || ch?.id || '').trim(),
    notes: String(ch?.designNotes || ch?.role || '').trim(),
    imageUrl: String(ch?.imageUrl || '').trim(),
  })).filter(x => x.name);

  const map = new Map();
  [...fromProjectList, ...fromGlobalList].forEach(it => {
    if(!map.has(it.name)) map.set(it.name, it);
    else {
      const old = map.get(it.name) || {};
      map.set(it.name, {
        name: it.name,
        notes: old.notes || it.notes || '',
        imageUrl: old.imageUrl || it.imageUrl || '',
      });
    }
  });

  return [...map.values()];
}

function closeSegmentCastModal(force = false){
  const m = q('segmentCastModal');
  if(!m) return;
  if(force){
    m.classList.remove('show');
    currentSegmentCastModal = null;
  }
}

function openCharacterEditorFromSegmentCast(){
  closeSegmentCastModal(true);
  toggleCharacterPanel(true);
}

function bindSegmentCastThumbPreview(){
  document.querySelectorAll('#segmentCastModal .segment-cast-thumb').forEach(a => {
    a.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const img = String(a.getAttribute('data-img') || '').trim();
      const sid = String(a.getAttribute('data-sid') || '').trim();
      if(!img) return;
      openLightbox(img, sid || '角色图');
    };
  });
}

function ensureSceneRemixEditorStyles(){
  if(document.getElementById('sceneRemixEditorStyle')) return;
  const style = document.createElement('style');
  style.id = 'sceneRemixEditorStyle';
  style.textContent = `
    .scene-remix-mask {
      position: fixed;
      inset: 0;
      z-index: 9999;
      padding: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,.72);
      backdrop-filter: blur(2px);
    }
    .scene-remix-dialog {
      width: min(100%, 1100px);
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      background: #14161c;
      border: 1px solid rgba(255,255,255,.14);
      border-radius: 16px;
      box-shadow: 0 18px 40px rgba(0,0,0,.48);
      overflow: hidden;
      animation: scene-remix-in .22s ease-out;
    }
    @keyframes scene-remix-in {
      from { opacity: 0; transform: translateY(10px) scale(.985); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .scene-remix-head {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 20px;
      border-bottom: 1px solid rgba(255,255,255,.08);
      background: rgba(255,255,255,.02);
    }
    .scene-remix-title {
      margin: 0;
      font-size: 17px;
      font-weight: 700;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .scene-remix-title::before { content: '🎨'; font-size: 18px; }
    .scene-remix-actions { display: flex; align-items: center; gap: 8px; }
    .scene-remix-btn {
      padding: 8px 14px;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,.18);
      background: #1c1f26;
      color: #e5e7eb;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all .2s ease;
    }
    .scene-remix-btn:hover { background: rgba(255,255,255,.12); border-color: rgba(255,255,255,.3); }
    .scene-remix-btn:disabled { opacity: .45; cursor: not-allowed; }
    .scene-remix-btn.primary {
      color: #dbeafe;
      border: 1px solid rgba(59,130,246,.45);
      background: linear-gradient(135deg, rgba(6,182,212,.34), rgba(59,130,246,.32));
      box-shadow: 0 5px 14px rgba(59,130,246,.25);
    }
    .scene-remix-body {
      flex: 1;
      min-height: 0;
      display: grid;
      grid-template-columns: 1.2fr .8fr;
      gap: 20px;
      padding: 18px 20px 20px;
      overflow: hidden;
    }
    .scene-remix-preview,
    .scene-remix-edit { min-height: 0; display: flex; flex-direction: column; }
    .scene-remix-label {
      margin-bottom: 8px;
      font-size: 12px;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: .04em;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .scene-remix-image-wrap {
      flex: 1;
      min-height: 380px;
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 12px;
      background: rgba(0,0,0,.28);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .scene-remix-image-wrap img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      display: block;
    }
    .scene-remix-hint-center {
      margin-top: 8px;
      text-align: center;
      font-size: 12px;
      color: rgba(148,163,184,.8);
    }
    .scene-remix-editor {
      width: 100%;
      flex: 1;
      min-height: 300px;
      resize: none;
      padding: 14px;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,.14);
      background: rgba(0,0,0,.24);
      color: #f8fafc;
      font-size: 14px;
      line-height: 1.62;
      box-sizing: border-box;
    }
    .scene-remix-editor:focus {
      outline: none;
      border-color: rgba(34,211,238,.8);
      box-shadow: 0 0 0 3px rgba(34,211,238,.18);
    }
    .scene-remix-tags {
      margin-top: 10px;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .scene-remix-tag {
      font-size: 12px;
      padding: 4px 10px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,.12);
      background: rgba(255,255,255,.04);
      color: #94a3b8;
      cursor: pointer;
      transition: all .2s ease;
    }
    .scene-remix-tag:hover {
      color: #22d3ee;
      border-color: rgba(34,211,238,.7);
      background: rgba(34,211,238,.12);
    }
    .scene-remix-hint {
      margin-top: 12px;
      min-height: 18px;
      color: #94a3b8;
      font-size: 12px;
      line-height: 1.5;
    }
    @media (max-width: 860px){
      .scene-remix-dialog { width: 96vw; max-height: 95vh; }
      .scene-remix-body { grid-template-columns: 1fr; overflow-y: auto; }
      .scene-remix-image-wrap { min-height: 280px; }
      .scene-remix-head { padding: 12px 14px; }
      .scene-remix-actions { gap: 6px; }
      .scene-remix-btn { padding: 7px 10px; font-size: 12px; }
    }
  `;
  document.head.appendChild(style);
}

function openSceneImageVariantEditor(project = '', sid = '', imageUrl = ''){
  const p = String(project || '').trim();
  const s = String(sid || '').trim();
  const img = String(imageUrl || '').trim();
  if(!img) return;

  ensureSceneRemixEditorStyles();

  const mask = document.createElement('div');
  mask.className = 'scene-remix-mask';
  mask.innerHTML = `
    <div class="scene-remix-dialog">
      <div class="scene-remix-head">
        <h3 class="scene-remix-title">图片二创 - 分镜 #${escapeHtml(s || '-')}</h3>
        <div class="scene-remix-actions">
          <button type="button" data-act="cancel" class="scene-remix-btn">关闭</button>
          <button type="button" data-act="apply" class="scene-remix-btn primary">生成二创图</button>
        </div>
      </div>

      <div class="scene-remix-body">
        <div class="scene-remix-preview">
          <div class="scene-remix-label"><span>图片预览</span><span style="opacity:.6;font-weight:500;">Preview</span></div>
          <div data-role="result-wrap" class="scene-remix-image-wrap">
            <img data-role="result-img" src="${escapeHtml(img)}" alt="${escapeHtml(s || 'source')}" />
          </div>
          <div class="scene-remix-hint-center">生成后会自动替换当前分镜；历史图片可随时切换或删除</div>
          <div class="scene-remix-label" style="margin-top:10px;"><span>历史图片</span><span style="opacity:.6;font-weight:500;">History</span></div>
          <div data-role="history-list" style="display:flex;gap:10px;flex-wrap:wrap;max-height:118px;overflow:auto;padding:10px 10px 8px 8px;"></div>
        </div>

        <div class="scene-remix-edit">
          <div class="scene-remix-label">输入二创提示词</div>
          <textarea data-role="editor" class="scene-remix-editor" placeholder="例如：把图片中的猫换成狗，保持原构图与光影；或：保留人物关系，只把天气改成暴雨夜。"></textarea>

          <div class="scene-remix-label" style="margin-top:10px;">常用修改建议</div>
          <div class="scene-remix-tags">
            <button type="button" class="scene-remix-tag" data-insert="改为暴雨夜景，增加霓虹灯反射">🌧️ 暴雨夜景</button>
            <button type="button" class="scene-remix-tag" data-insert="将画风改为写实电影感，增加景深">🎬 电影质感</button>
            <button type="button" class="scene-remix-tag" data-insert="保持构图，将背景换成赛博朋克都市">🏙️ 赛博都市</button>
            <button type="button" class="scene-remix-tag" data-insert="将人物表情改为愤怒，增加面部细节">💢 改变表情</button>
            <button type="button" class="scene-remix-tag" data-insert="增加强烈的丁达尔效应和光线追踪">✨ 增强光影</button>
          </div>

          <div class="scene-remix-hint" data-role="hint">💡 提示：二创会参考“当前预览图”作为基图，你可以先点历史图再生成。</div>
        </div>
      </div>
    </div>
  `;

  const close = (syncSelection = true) => {
    if(syncSelection){
      const selected = String(activeUrl || currentBaseUrl || img || '').trim();
      if(selected) updateTableSceneImage(selected);
    }
    mask.remove();
  };
  mask.addEventListener('click', (e) => { if(e.target === mask) close(true); });
  document.body.appendChild(mask);

  const editor = mask.querySelector('textarea[data-role="editor"]');
  const hint = mask.querySelector('[data-role="hint"]');
  const resultImg = mask.querySelector('img[data-role="result-img"]');
  const historyList = mask.querySelector('[data-role="history-list"]');
  const applyBtn = mask.querySelector('button[data-act="apply"]');
  const cancelBtn = mask.querySelector('button[data-act="cancel"]');

  let currentBaseUrl = img;
  let activeUrl = img;
  let historyUrls = getProjectSceneImageHistory(p, s);
  if(!historyUrls.includes(img)) historyUrls.unshift(img);
  historyUrls = [...new Set(historyUrls.filter(Boolean))].slice(0, 50);
  setProjectSceneImageHistory(p, s, historyUrls);

  const updateTableSceneImage = (url) => {
    const u = String(url || '').trim();
    if(!u) return;
    const row = [...document.querySelectorAll('#tbody tr')].find(tr => String(tr.querySelector('.meta')?.textContent || '').trim() === s);
    const cell = row?.children?.[4] || row?.querySelectorAll('td')?.[4];
    if(cell){
      cell.innerHTML = renderSceneImageCell(p, s, u);
      bindThumbPreview(cell);
    }
    setProjectSceneImageDraft(p, s, u);
    appendProjectSceneImageHistory(p, s, u);
    if(latestRenderContext && latestRenderContext.project === p){
      latestRenderContext.bindingMap = latestRenderContext.bindingMap || {};
      latestRenderContext.bindingMap[s] = u;
    }
  };

  const renderHistory = () => {
    if(!historyList) return;
    if(!historyUrls.length){
      historyList.innerHTML = '<span class="meta" style="font-size:12px;color:#94a3b8;">暂无历史图片</span>';
      return;
    }
    historyList.innerHTML = historyUrls.map((url) => {
      const selected = url === activeUrl;
      return `
        <div style="position:relative;width:84px;height:84px;overflow:visible;">
          <div style="width:100%;height:100%;border-radius:10px;overflow:hidden;border:1px solid ${selected ? 'rgba(34,211,238,.8)' : 'rgba(255,255,255,.14)'};background:rgba(255,255,255,.02);">
            <button type="button" data-role="pick-history" data-url="${escapeHtml(url)}" title="使用这张图" style="all:unset;cursor:pointer;display:block;width:100%;height:100%;">
              <img src="${escapeHtml(url)}" alt="history" style="width:100%;height:100%;object-fit:cover;display:block;" />
            </button>
          </div>
          <button type="button" data-role="delete-history" data-url="${escapeHtml(url)}" title="删除这张图" style="position:absolute;top:2px;right:2px;z-index:4;border:1px solid rgba(255,255,255,.48);border-radius:999px;background:linear-gradient(180deg,rgba(20,20,24,.96),rgba(0,0,0,.94));color:#fb7185;width:28px;height:28px;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;box-shadow:0 6px 14px rgba(0,0,0,.5),0 0 0 1px rgba(251,113,133,.2);backdrop-filter:blur(1px);">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 6l12 12M18 6L6 18"></path>
            </svg>
          </button>
        </div>
      `;
    }).join('');

    historyList.querySelectorAll('[data-role="pick-history"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const picked = String(btn.getAttribute('data-url') || '').trim();
        if(!picked) return;
        activeUrl = picked;
        currentBaseUrl = picked;
        if(resultImg) resultImg.src = picked;
        renderHistory();
        if(hint) hint.textContent = '已切换到历史图作为当前基图，可直接继续二创。';
      });
    });

    historyList.querySelectorAll('[data-role="delete-history"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const target = String(btn.getAttribute('data-url') || '').trim();
        if(!target) return;
        if(historyUrls.length <= 1){
          if(hint) hint.textContent = '至少保留 1 张历史图片，不能全部删除。';
          return;
        }
        if(!confirm('确认删除这张历史图片吗？（仅从历史列表移除，不删除服务器文件）')) return;
        historyUrls = historyUrls.filter(x => x !== target);
        removeProjectSceneImageHistory(p, s, target);
        if(activeUrl === target){
          activeUrl = historyUrls[0] || img;
          currentBaseUrl = activeUrl;
          if(resultImg) resultImg.src = activeUrl;
          updateTableSceneImage(activeUrl);
        }
        renderHistory();
        if(hint) hint.textContent = '已删除该历史图片。';
      });
    });
  };

  renderHistory();

  mask.querySelectorAll('[data-insert]').forEach((tagBtn) => {
    tagBtn.addEventListener('click', () => {
      const insertText = String(tagBtn.getAttribute('data-insert') || '').trim();
      if(!insertText || !editor) return;
      const oldVal = String(editor.value || '').trim();
      editor.value = oldVal ? `${oldVal}${oldVal.endsWith('，') || oldVal.endsWith('。') ? '' : '，'}${insertText}` : insertText;
      editor.focus();
    });
  });

  cancelBtn?.addEventListener('click', close);

  applyBtn?.addEventListener('click', async () => {
    const prompt = String(editor?.value || '').trim();
    if(!prompt){
      if(hint) hint.textContent = '请先输入二创提示词';
      return;
    }
    const oldText = applyBtn.textContent;
    applyBtn.disabled = true;
    applyBtn.textContent = '生成中…';
    if(hint) hint.textContent = '正在基于当前图片生成二创图…';
    try {
      const bridgeBase = getBridgeBase();
      const row = [...document.querySelectorAll('#tbody tr')].find(tr => String(tr.querySelector('.meta')?.textContent || '').trim() === s);
      const scriptText = String(row?.querySelector('td textarea')?.value || '').trim();
      const cast = getProjectSegmentCast(p, s);
      const characterRefs = (Array.isArray(cast) ? cast : []).map(name => ({
        name,
        imageUrl: getCastImageUrl(name),
      })).filter(it => it.name && it.imageUrl);

      const resp = await fetch(`${bridgeBase}/api/lobster/task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskType: 'generate_scene_image',
          payload: {
            project: p,
            segmentId: s,
            script: scriptText,
            imagePrompt: prompt,
            cast,
            characterRefs,
            imageUrl: currentBaseUrl || img,
            sourceImageUrl: currentBaseUrl || img,
          }
        }),
      });
      const data = await resp.json();
      if(!resp.ok) throw new Error(data?.error?.message || `HTTP ${resp.status}`);
      const result = data?.result || {};
      if(!result?.ok) throw new Error(result?.error || '龙虾未成功生成图片');

      let generatedUrl = String(result.sceneImageUrl || result.remoteImageUrl || '').trim();
      if(!generatedUrl) throw new Error('未返回可用图片地址');

      if(/^https?:\/\//i.test(generatedUrl)){
        try {
          const saveResp = await fetch(`${bridgeBase}/api/scene-image/save-local`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageUrl: generatedUrl, project: p, segmentId: s }),
          });
          const saveData = await saveResp.json();
          if(saveResp.ok && saveData?.localImageUrl){
            generatedUrl = String(saveData.localImageUrl || '').trim() || generatedUrl;
          }
        } catch {}
      }

      currentBaseUrl = generatedUrl;
      activeUrl = generatedUrl;
      if(resultImg) resultImg.src = generatedUrl;

      historyUrls = [generatedUrl, ...historyUrls.filter(x => x !== generatedUrl)].slice(0, 50);
      setProjectSceneImageHistory(p, s, historyUrls);
      renderHistory();

      updateTableSceneImage(generatedUrl);
      setStatus(`已自动替换 ${s} 的分镜图`);
      if(hint) hint.textContent = '已生成并自动替换。你可以继续输入提示词进行下一轮，或从历史图切换。';
    } catch (err) {
      if(hint) hint.textContent = `生成失败：${err?.message || err}`;
    } finally {
      applyBtn.disabled = false;
      applyBtn.textContent = oldText || '生成二创图';
    }
  });
}

function bindThumbPreview(root = document){
  const links = [...root.querySelectorAll('a.thumb-link')];
  if(!links.length) return;
  links.forEach(a => {
    a.onclick = (e) => {
      e?.preventDefault?.();
      e?.stopPropagation?.();
      const img = String(a.getAttribute('data-img') || '').trim();
      const sid = String(a.getAttribute('data-sid') || '').trim();
      const project = String(a.getAttribute('data-project') || currentProjectName || getProject() || '').trim();
      if(!img) return;
      openSceneImageVariantEditor(project, sid || '', img);
    };
  });
}

function removeRedundantSceneRemixButtons(root = document){
  const nodes = [...root.querySelectorAll('button')];
  nodes.forEach((btn) => {
    const txt = String(btn.textContent || '').trim();
    const onclick = String(btn.getAttribute('onclick') || '');
    const hitByText = txt === '二次修改';
    const hitByOnclick = onclick.includes('openSceneImageVariantEditor(');
    if(hitByText || hitByOnclick){
      btn.remove();
    }
  });
}

window.removeRedundantSceneRemixButtons = removeRedundantSceneRemixButtons;
window.openSceneImageVariantEditor = openSceneImageVariantEditor;
window.bindThumbPreview = bindThumbPreview;

function renderSegmentCastModalRows(){
  if(!currentSegmentCastModal) return;
  const box = q('segmentCastRows');
  if(!box) return;
  const { project, sid, candidates, selected } = currentSegmentCastModal;
  box.innerHTML = candidates.map(c => {
    const checked = selected.has(c.name) ? 'checked' : '';
    const nameEnc = encodeURIComponent(String(c.name || ''));
    const projectEnc = encodeURIComponent(String(project || ''));
    const sidEnc = encodeURIComponent(String(sid || ''));
    return `
      <tr class="segment-cast-row">
        <td><input type="checkbox" ${checked} onchange="toggleSegmentCastModalSelect('${escapeHtml(project)}','${escapeHtml(sid)}','${escapeHtml(c.name)}', this.checked)" /></td>
        <td>${escapeHtml(c.name)}</td>
        <td>${escapeHtml(c.notes || '-')}</td>
        <td>${c.imageUrl ? `<a href="javascript:void(0)" class="segment-cast-thumb" data-img="${escapeHtml(c.imageUrl)}" data-sid="${escapeHtml(c.name)}"><img src="${escapeHtml(c.imageUrl)}" alt="${escapeHtml(c.name)}" class="segment-cast-avatar"/></a>` : '<span class="meta">暂无</span>'}</td>
        <td>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button type="button" class="btn-ghost" onclick="renameSegmentCastCandidate('${projectEnc}','${sidEnc}','${nameEnc}')">改名</button>
            <button type="button" class="btn-ghost" onclick="deleteSegmentCastCandidate('${projectEnc}','${sidEnc}','${nameEnc}')">删除</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  bindSegmentCastThumbPreview();

  const hint = q('segmentCastSelectedHint');
  if(hint) hint.textContent = `已选 ${selected.size} 人：${[...selected].join('、') || '无'}`;
}

function renameSegmentCastCandidate(projectEnc, sidEnc, nameEnc){
  if(!currentSegmentCastModal) return;
  const project = decodeURIComponent(String(projectEnc || ''));
  const sid = decodeURIComponent(String(sidEnc || ''));
  const oldName = decodeURIComponent(String(nameEnc || '')).trim();
  if(!oldName) return;

  const nextName = String(prompt('请输入新角色名：', oldName) || '').trim();
  if(!nextName || nextName === oldName) return;

  const exists = (currentSegmentCastModal.candidates || []).some(x => String(x?.name || '').trim() === nextName);
  if(exists){
    setStatus(`角色名已存在：${nextName}`, false);
    return;
  }

  currentSegmentCastModal.candidates = (currentSegmentCastModal.candidates || []).map(c => {
    if(String(c?.name || '').trim() !== oldName) return c;
    return { ...c, name: nextName };
  });

  const selected = new Set(currentSegmentCastModal.selected || []);
  if(selected.has(oldName)){
    selected.delete(oldName);
    selected.add(nextName);
  }
  currentSegmentCastModal.selected = selected;

  renderSegmentCastModalRows();
  setStatus(`已将 ${sid} 的候选角色改名：${oldName} → ${nextName}`);
}

function deleteSegmentCastCandidate(projectEnc, sidEnc, nameEnc){
  if(!currentSegmentCastModal) return;
  const project = decodeURIComponent(String(projectEnc || ''));
  const sid = decodeURIComponent(String(sidEnc || ''));
  const name = decodeURIComponent(String(nameEnc || '')).trim();
  if(!name) return;

  const ok = confirm(`确认删除角色「${name}」吗？`);
  if(!ok) return;

  currentSegmentCastModal.candidates = (currentSegmentCastModal.candidates || []).filter(c => String(c?.name || '').trim() !== name);
  const selected = new Set(currentSegmentCastModal.selected || []);
  selected.delete(name);
  currentSegmentCastModal.selected = selected;
  setProjectSegmentCastExcluded(project, sid, name, true);

  renderSegmentCastModalRows();
  setStatus(`已从 ${sid} 候选角色中删除：${name}`);
}

function toggleSegmentCastModalSelect(project, sid, name, checked){
  if(!currentSegmentCastModal) return;
  if(checked) currentSegmentCastModal.selected.add(name);
  else currentSegmentCastModal.selected.delete(name);
  renderSegmentCastModalRows();
}

function addManualSegmentCastName(){
  if(!currentSegmentCastModal) return;
  const input = q('segmentCastManualInput');
  const name = String(input?.value || '').trim();
  if(!name) return;
  if(!currentSegmentCastModal.candidates.some(x => x.name === name)){
    currentSegmentCastModal.candidates.unshift({ name, notes: '手动添加', imageUrl: '' });
  }
  setProjectSegmentCastExcluded(currentSegmentCastModal.project, currentSegmentCastModal.sid, name, false);
  currentSegmentCastModal.selected.add(name);
  if(input) input.value = '';
  renderSegmentCastModalRows();
}

function renderSegmentCastGlobalPicker(){
  if(!currentSegmentCastModal) return;
  const wrap = q('segmentCastGlobalRows');
  if(!wrap) return;

  const globals = (globalCharacterLibrary || []).map(ch => ({
    name: String(ch?.name || ch?.id || '').trim(),
    notes: String(ch?.designNotes || ch?.role || '').trim(),
    imageUrl: String(ch?.imageUrl || '').trim(),
  })).filter(x => x.name);

  if(!globals.length){
    wrap.innerHTML = '<tr><td colspan="4" class="meta">暂无全局角色</td></tr>';
    return;
  }

  const picked = currentSegmentCastModal.globalPicked || new Set();
  wrap.innerHTML = globals.map(g => `
    <tr>
      <td><input type="checkbox" ${picked.has(g.name) ? 'checked' : ''} onchange="toggleGlobalRolePick('${escapeHtml(g.name)}', this.checked)" /></td>
      <td>${escapeHtml(g.name)}</td>
      <td>${escapeHtml(g.notes || '-')}</td>
      <td>${g.imageUrl ? `<a href="javascript:void(0)" class="segment-cast-thumb" data-img="${escapeHtml(g.imageUrl)}" data-sid="${escapeHtml(g.name)}"><img src="${escapeHtml(g.imageUrl)}" alt="${escapeHtml(g.name)}" class="segment-cast-avatar"/></a>` : '<span class="meta">暂无</span>'}</td>
    </tr>
  `).join('');
}

function toggleGlobalRolePick(name, checked){
  if(!currentSegmentCastModal) return;
  if(!currentSegmentCastModal.globalPicked) currentSegmentCastModal.globalPicked = new Set();
  if(checked) currentSegmentCastModal.globalPicked.add(name);
  else currentSegmentCastModal.globalPicked.delete(name);
}

function toggleGlobalRoleSelectAll(checked){
  if(!currentSegmentCastModal) return;
  const globals = (globalCharacterLibrary || []).map(ch => String(ch?.name || ch?.id || '').trim()).filter(Boolean);
  currentSegmentCastModal.globalPicked = checked ? new Set(globals) : new Set();
  renderSegmentCastGlobalPicker();
}

function importPickedGlobalRolesToSegmentModal(){
  if(!currentSegmentCastModal) return;
  const picked = [...(currentSegmentCastModal.globalPicked || new Set())].filter(Boolean);
  if(!picked.length){
    setStatus('请先在折叠区勾选全局角色', false);
    return;
  }

  const existing = new Set((currentSegmentCastModal.candidates || []).map(x => String(x?.name || '').trim()).filter(Boolean));
  const globals = (globalCharacterLibrary || []).map(ch => ({
    name: String(ch?.name || ch?.id || '').trim(),
    notes: String(ch?.designNotes || ch?.role || '').trim(),
    imageUrl: String(ch?.imageUrl || '').trim(),
  })).filter(x => x.name);

  let added = 0;
  for(const name of picked){
    const g = globals.find(x => x.name === name);
    if(!g) continue;
    if(!existing.has(g.name)){
      currentSegmentCastModal.candidates.push(g);
      existing.add(g.name);
      added++;
    }
    currentSegmentCastModal.selected.add(g.name);
  }

  renderSegmentCastModalRows();
  setStatus(`已导入全局角色：新增 ${added} 个，已选 ${picked.length} 个`);
}

async function aiSuggestSegmentCastForModal(){
  if(!currentSegmentCastModal) return;
  const { project, sid, candidates } = currentSegmentCastModal;
  const options = candidates.map(c => c.name);
  const tr = [...document.querySelectorAll('#tbody tr')].find(row => String(row.querySelector('.meta')?.textContent || '').trim() === sid);
  const scriptText = String(tr?.querySelector('td textarea')?.value || '').trim();

  const btn = q('segmentCastAiBtn');
  const old = btn?.textContent || 'AI推荐';
  if(btn){ btn.disabled = true; btn.textContent = 'AI推荐中…'; }
  try {
    const cast = await aiSuggestSegmentCast(project, sid, scriptText, options);
    currentSegmentCastModal.selected = new Set(cast);
    renderSegmentCastModalRows();
  } catch (err) {
    setStatus(`AI推荐出场人物失败：${err?.message || err}`, false);
  } finally {
    if(btn){ btn.disabled = false; btn.textContent = old; }
  }
}

function applySegmentCastModalSelection(){
  if(!currentSegmentCastModal) return;
  const { project, sid, selected } = currentSegmentCastModal;
  const finalNames = [...selected];
  setProjectSegmentCast(project, sid, finalNames);
  refreshSegmentCastCell(project, sid);
  setStatus(`已保存 ${sid} 出场人物：${finalNames.join('、') || '无'}`);
  closeSegmentCastModal(true);
}

async function openSegmentCastSelector(project, sid){
  try { await loadGlobalCharacterLibrary(true); } catch {}

  const candidatesAll = getCastCandidateMeta();
  const excluded = getProjectSegmentCastExcludedSet(project, sid);
  const candidates = candidatesAll.filter(c => !excluded.has(String(c?.name || '').trim()));
  if(!candidates.length){
    setStatus('暂无可选人物（该分段可能已删除全部候选）', false);
    return;
  }

  currentSegmentCastModal = {
    project,
    sid,
    candidates,
    selected: new Set(getProjectSegmentCast(project, sid)),
    globalPicked: new Set(),
  };

  const title = q('segmentCastTitle');
  if(title) title.textContent = `出场人物选择 · ${sid}`;
  const m = q('segmentCastModal');
  if(m) m.classList.add('show');
  renderSegmentCastGlobalPicker();
  renderSegmentCastModalRows();
}

function removeSegmentCast(project, sid, name){
  const next = getProjectSegmentCast(project, sid).filter(x => x !== name);
  setProjectSegmentCast(project, sid, next);
  refreshSegmentCastCell(project, sid);
}

async function addAllCharactersToAllSegments(){
  const project = String(currentProjectName || getProject() || '').trim();
  if(!project){
    setStatus('请先选择并加载项目', false);
    return;
  }

  if(typeof requestChatCompletion !== 'function'){
    setStatus('聊天能力未就绪，暂时无法进行 AI 批量推荐', false);
    return;
  }

  try { await loadGlobalCharacterLibrary(true); } catch {}

  const candidates = getCastCandidateMeta();
  const names = [...new Set(candidates.map(x => String(x?.name || '').trim()).filter(Boolean))];
  if(!names.length){
    setStatus('暂无可供 AI 判断的人物，请先在角色设定中准备角色', false);
    return;
  }

  const rows = [...document.querySelectorAll('#tbody tr')];
  if(!rows.length){
    setStatus('当前没有可处理的分段', false);
    return;
  }

  const btn = document.querySelector('button[onclick="addAllCharactersToAllSegments()"]');
  const oldText = btn?.textContent || '一键全部添加';
  if(btn){ btn.disabled = true; btn.textContent = 'AI识别中…'; }

  let success = 0;
  let failed = 0;

  try {
    for(let i = 0; i < rows.length; i++){
      const row = rows[i];
      const sid = String(row.querySelector('.meta')?.textContent || '').trim();
      const scriptText = String(row.querySelector('td textarea')?.value || '').trim();
      if(!sid || !scriptText){
        failed++;
        continue;
      }

      setStatus(`AI 正在识别出场人物：${i + 1} / ${rows.length} · ${sid}`);
      try {
        const cast = await aiSuggestSegmentCast(project, sid, scriptText, names);
        setProjectSegmentCast(project, sid, Array.isArray(cast) ? cast : []);
        refreshSegmentCastCell(project, sid);
        success++;
      } catch {
        failed++;
      }
    }

    setStatus(`AI 批量识别完成：共 ${rows.length} 个分段，成功 ${success} 个，失败 ${failed} 个` , failed === 0);
  } finally {
    if(btn){ btn.disabled = false; btn.textContent = oldText; }
  }
}

async function suggestCastForSegment(button, project, sid){
  openSegmentCastSelector(project, sid);
  await aiSuggestSegmentCastForModal();
}

function hit(text, kws){
  const t = String(text || '');
  return kws.filter(k => t.includes(k)).length;
}

function scoreVideoRelevance(seg, videoMeta){
  // 启发式评分：先用剧情文本做规则打分（0-100）
  // 维度：场景一致(30) + 动作语义(45) + 人物关系(15) + 技术状态(10)
  const s = composeScript(seg);
  const sceneText = `${seg.scene || ''} ${seg.visual || ''}`;
  const dialogueText = `${seg.dialogue || ''}`;

  const sceneKw = ['码头','夜','雨','海','闪电'];
  const actionKw = ['举刀','受伤','血','瞳孔','看见','对峙','追','跌','拎起','挑起','转身'];
  const relationKw = ['苏甜','赫连城'];

  const sceneHits = Math.min(5, hit(sceneText, sceneKw));
  const actionHits = Math.min(6, hit(`${sceneText} ${dialogueText}`, actionKw));
  const relationHits = Math.min(2, hit(`${sceneText} ${dialogueText}`, relationKw));

  let score = 0;
  score += Math.round((sceneHits / 5) * 30);
  score += Math.round((actionHits / 6) * 45);
  score += Math.round((relationHits / 2) * 15);

  if(videoMeta && (videoMeta.videoUrl || (videoMeta.status || '').toLowerCase() === 'succeeded')) score += 10;
  else if(videoMeta && String(videoMeta.statusCode || '') === '200') score += 6;

  score = Math.max(0, Math.min(100, score));

  let level = '低';
  if(score >= 80) level = '高';
  else if(score >= 60) level = '中';

  const reasons = [
    `场景命中 ${sceneHits}/5`,
    `动作命中 ${actionHits}/6`,
    `人物命中 ${relationHits}/2`,
    `任务状态 ${videoMeta?.status || (videoMeta?.videoUrl ? 'ready' : 'unknown')}`
  ];

  return { score, level, reasons, script: s };
}

function projectPaths(project){
  return {
    segments: [
      `./${project}/planning/segments-flashback-s05-s07-6s-v2.json`,
      `./${project}/planning/segments-10s.json`,
      `./${project}/planning/segments-6s.json`
    ],
    prompts: [
      `./${project}/prompts/scene-image-prompts-6s.json`,
      `./${project}/prompts/scene-image-prompts-10s.json`
    ],
    bindings: [
      `./${project}/planning/scene-image-bindings-6s.json`,
      `./${project}/planning/scene-image-bindings-10s.json`
    ],
    images: [
      `./${project}/runs/image-jobs.jsonl`,
      `./${project}/runs/detail-image-jobs.jsonl`
    ],
    videos: [
      `./${project}/runs/video-jobs.jsonl`,
      `./${project}/runs/sora-batch-s02-s04-results.json`,
      `./${project}/runs/sora-batch-s02-s04-v2-results.json`,
      `./${project}/runs/sora-local-rerun-results.json`
    ]
  };
}

async function fetchFirstJson(urls){
  let lastErr = null;
  for(const url of urls || []){
    try {
      const data = await fetchJson(url);
      return { data, url };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('No JSON candidate found');
}

async function fetchFirstText(urls){
  let lastErr = null;
  for(const url of urls || []){
    try {
      const data = await fetchText(url);
      return { data, url };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('No text candidate found');
}

async function fetchJson(url){
  const r = await fetch(url + `?t=${Date.now()}`);
  if(!r.ok) throw new Error(`HTTP ${r.status} @ ${url}`);
  return r.json();
}

async function fetchText(url){
  const r = await fetch(url + `?t=${Date.now()}`);
  if(!r.ok) throw new Error(`HTTP ${r.status} @ ${url}`);
  return r.text();
}

function isUuidLike(v){
  const s = String(v || '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function syncStoryboardTopScroll(){
  const top = document.getElementById('storyboardTopScroll');
  const topInner = document.getElementById('storyboardTopScrollInner');
  const wrap = document.getElementById('storyboardTableWrap');
  const table = document.getElementById('storyboardMainTable');
  if(!top || !topInner || !wrap || !table) return;

  const wrapClient = wrap.clientWidth || 0;
  const tableScroll = table.scrollWidth || 0;
  const needX = tableScroll > wrapClient + 1;

  top.style.display = needX ? 'block' : 'none';
  topInner.style.width = `${Math.max(tableScroll, wrapClient)}px`;

  if(Math.abs(top.scrollLeft - wrap.scrollLeft) > 1){
    top.scrollLeft = wrap.scrollLeft;
  }
}

function bindStoryboardTopScroll(){
  const top = document.getElementById('storyboardTopScroll');
  const wrap = document.getElementById('storyboardTableWrap');
  if(!top || !wrap) return;

  if(!storyboardTopScrollBound){
    let syncing = false;
    top.addEventListener('scroll', () => {
      if(syncing) return;
      syncing = true;
      wrap.scrollLeft = top.scrollLeft;
      syncing = false;
    });

    wrap.addEventListener('scroll', () => {
      if(syncing) return;
      syncing = true;
      top.scrollLeft = wrap.scrollLeft;
      syncing = false;
    });

    window.addEventListener('resize', syncStoryboardTopScroll);
    storyboardTopScrollBound = true;
  }

  syncStoryboardTopScroll();
}

function render(project, segments, promptMap, bindingMap, videoMap, multiShotMap = {}, videoPromptMap = {}, grid4ImageMap = {}){
  q('pageTitle').textContent = `${project}｜剧情分段与提示词预览`;
  const tbody = q('tbody');
  tbody.innerHTML = '';
  const imagePromptDraftMap = getProjectImagePromptDraftMap(project);
  const videoPromptDraftMap = getProjectVideoPromptDraftMap(project);

  segments.forEach((seg, idx)=>{
    const sid = String(seg.segmentId || seg.id || `S${String(idx+1).padStart(2,'0')}`);
    const script = composeScript(seg);
    const hasDraftPrompt = Object.prototype.hasOwnProperty.call(imagePromptDraftMap, sid);
    const imagePrompt = hasDraftPrompt ? String(imagePromptDraftMap[sid] || '') : (promptMap[sid] || defaultImagePrompt(seg));
    const hasVideoDraftPrompt = Object.prototype.hasOwnProperty.call(videoPromptDraftMap, sid);
    const videoPrompt = hasVideoDraftPrompt ? String(videoPromptDraftMap[sid] || '') : resolveVideoPrompt(sid, seg, videoPromptMap);
    const img = bindingMap[sid] || '';
    const multiShots = Array.isArray(multiShotMap[sid]) ? multiShotMap[sid] : [];
    const grid4 = grid4ImageMap[sid] || null;
    const vWrap = videoMap[sid] || { latest: {}, variants: [] };
    const v = vWrap.latest || {};

    const videoRecords = [];
    const seenVideoKeys = new Set();
    const collectVideoRecord = (x = {}, fallbackKey = '') => {
      const localOrPlayable = String(x.videoUrl || '').trim();
      const remote = String(x.remoteVideoUrl || x.hdVideoUrl || x.mediaUrl || '').trim();
      const finalUrl = localOrPlayable || remote;
      if(!finalUrl) return;
      const remoteOnly = x.downloadLocalOk === false || String(x.status || '').trim() === 'remote_only' || String(x.status || '').trim() === 'download_failed';
      const key = `${String(x.taskId || fallbackKey || '').trim()}|${finalUrl}`;
      if(seenVideoKeys.has(key)) return;
      seenVideoKeys.add(key);
      videoRecords.push({ url: finalUrl, remote, remoteOnly, variant: String(x.variant || '').trim() || '视频' });
    };

    collectVideoRecord(v, `${sid}-latest`);
    if(Array.isArray(vWrap.variants) && vWrap.variants.length){
      vWrap.variants.slice().reverse().slice(0, 8).forEach((x, i) => collectVideoRecord(x, `${sid}-v${i}`));
    }

    const displayVideoRecords = videoRecords.slice(0, 1);

    let videoCell = '';
    if(displayVideoRecords.length){
      videoCell = `<div style="display:flex;flex-direction:column;gap:10px">${displayVideoRecords.map((rec, i) => {
        const playUrl = rec.url || rec.remote;
        return `<div style="display:flex;flex-direction:column;gap:6px"><div class="meta" style="margin:0">${escapeHtml(rec.variant || `视频${i+1}`)}</div><video preload="metadata" playsinline muted class="thumb video-thumb" data-video="${escapeHtml(playUrl)}" data-sid="${escapeHtml(`${sid}-video-${i+1}`)}" style="width:90px;height:120px;cursor:zoom-in;background:#000" src="${escapeHtml(playUrl)}" title="点击放大播放"></video></div>`;
      }).join('')}</div>`;
    }
    videoCell += `<div style="margin-top:8px"><button class="btn-primary" onclick="openVideoGenModal('${escapeHtml(project)}', '${escapeHtml(sid)}', this)">${videoRecords.length ? '重新生成' : '生成视频'}</button></div>`;

    if(!videoRecords.length){
      videoCell = `<div style="margin-top:8px"><button class="btn-primary" onclick="openVideoGenModal('${escapeHtml(project)}', '${escapeHtml(sid)}', this)">生成视频</button></div>`;
    }

    videoCell = `<div style="display:flex;flex-direction:column;gap:8px">${videoCell}</div>`;

    const castGridHtml = buildSegmentCastGridHtml(project, sid);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx+1}</td>
      <td>
        <div class="meta">${sid}</div>
        <textarea class="script-input" data-sid="${escapeHtml(sid)}">${script}</textarea>
      </td>
      <td>
        ${castGridHtml}
        <div style="margin-top:6px">
          <button class="btn-ghost" onclick="suggestCastForSegment(this, '${escapeHtml(project)}', '${escapeHtml(sid)}')">AI推荐</button>
        </div>
      </td>
      <td>
        <div style="position:relative;">
          <textarea class="image-prompt-input" data-sid="${escapeHtml(sid)}">${imagePrompt}</textarea>
          <button type="button" onclick="expandImagePromptEditor(this)" title="扩大编辑" style="position:absolute;top:6px;right:6px;padding:4px 6px;border-radius:6px;border:1px solid rgba(255,255,255,.18);background:rgba(15,23,42,.75);color:#e5e7eb;cursor:pointer;">⤢</button>
        </div>
      </td>
      <td>${(() => {
        if(grid4 && grid4.url){
          return `
            <a href="javascript:void(0)" data-img="${grid4.url}" data-sid="${sid}-grid4" data-project="${escapeHtml(project)}" class="thumb-link"><img class="thumb" src="${grid4.url}" alt="${sid}-grid4"/></a>
            <div class="meta" style="margin-top:6px">模式：${grid4.mode || 'grid4'}</div>
            <div style="margin-top:8px">
              <button class="btn-primary" onclick="generateSceneImageWithLobster('${escapeHtml(project)}', '${escapeHtml(sid)}', this)">生成图片</button>
            </div>
          `;
        }
        if(multiShots.length){
          const shotHtml = multiShots.map(ms => `
            <div class="shot-item">
              <a href="javascript:void(0)" data-img="${ms.url}" data-sid="${ms.shotId || sid}" class="thumb-link shot-btn">
                <img class="shot-img" src="${ms.url}" alt="${ms.shotId || sid}" title="${ms.shotId || sid}"/>
              </a>
              <div class="shot-label">${ms.shotId || sid}</div>
            </div>
          `).join('');
          return `<div class="shot-grid">${shotHtml}</div><div class="meta" style="margin-top:6px">多分镜：${multiShots.length} 张</div><div style="margin-top:8px"><button class="btn-primary" onclick="generateSceneImageWithLobster('${escapeHtml(project)}', '${escapeHtml(sid)}', this)">生成图片</button></div>`;
        }
        if(img){
          return `<a href="javascript:void(0)" data-img="${img}" data-sid="${sid}" data-project="${escapeHtml(project)}" class="thumb-link"><img class="thumb" src="${img}" alt="${sid}"/></a><div style="margin-top:8px"><button class="btn-primary" onclick="generateSceneImageWithLobster('${escapeHtml(project)}', '${escapeHtml(sid)}', this)">生成图片</button></div>`;
        }
        return `<button class="btn-primary" onclick="generateSceneImageWithLobster('${escapeHtml(project)}', '${escapeHtml(sid)}', this)">生成图片</button>`;
      })()}</td>
      <td>
        <div style="position:relative;">
          <textarea class="video-prompt-input" data-sid="${escapeHtml(sid)}">${videoPrompt}</textarea>
          <button type="button" onclick="expandImagePromptEditor(this)" title="扩大编辑" style="position:absolute;top:6px;right:6px;padding:4px 6px;border-radius:6px;border:1px solid rgba(255,255,255,.18);background:rgba(15,23,42,.75);color:#e5e7eb;cursor:pointer;">⤢</button>
        </div>
      </td>
      <td>${durationLabel(seg)}</td>
      <td>${videoCell}</td>
    `;
    tbody.appendChild(tr);
  });

  // 绑定顶部人物设定图点击放大
  const characterLinks = [...document.querySelectorAll('#characterSection a.thumb-link')];
  if(characterLinks.length){
    const list = characterLinks.map((lnk, idx) => ({
      idx,
      url: String(lnk.getAttribute('data-img') || '').trim(),
      caption: String(lnk.getAttribute('data-sid') || `角色${idx+1}`).trim(),
    })).filter(x => x.url);
    characterLinks.forEach((a, idx) => {
      a.addEventListener('click', (e)=>{
        e?.preventDefault?.();
        e?.stopPropagation?.();
        const url = String(a.getAttribute('data-img') || '').trim();
        if(!url) return;
        const listIndex = list.findIndex(it => it.url === url && it.idx === idx);
        if(listIndex >= 0) openLightboxAt(list, listIndex);
        else openLightbox(url, String(a.getAttribute('data-sid') || url));
      });
    });
  }

  // 分镜图缩略图：点击直接进入“二次修改”而不是仅放大预览
  tbody.querySelectorAll('tr').forEach(tr => {
    const links = [...tr.querySelectorAll('a.thumb-link')];
    if(!links.length) return;
    links.forEach((a) => {
      a.onclick = (e) => {
        e?.preventDefault?.();
        e?.stopPropagation?.();
        if(typeof e?.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
        const img = String(a.getAttribute('data-img') || '').trim();
        const sid = String(a.getAttribute('data-sid') || '').trim();
        const p = String(a.getAttribute('data-project') || project || currentProjectName || getProject() || '').trim();
        if(!img) return;
        openSceneImageVariantEditor(p, sid || '', img);
      };
    });
  });

  // 绑定视频在线预览（按钮）
  tbody.querySelectorAll('a.video-link').forEach(a=>{
    a.addEventListener('click', ()=>{
      const url = a.getAttribute('data-video') || '';
      const sid = a.getAttribute('data-sid') || '';
      openVideoBox(url, sid);
    });
  });

  // 绑定视频缩略图：点击放大播放
  tbody.querySelectorAll('video.video-thumb').forEach(v=>{
    v.addEventListener('click', ()=>{
      const url = v.getAttribute('data-video') || v.getAttribute('src') || '';
      const sid = v.getAttribute('data-sid') || '';
      if(!url) return;
      openVideoBox(url, sid);
    });
  });

  // 手动修改剧情脚本即时保存
  bindManualScriptDraftEvents(project);

  // 手动修改 Image Prompt 即时保存
  bindManualImagePromptDraftEvents(project);

  // 手动修改 Video Prompt 即时保存
  bindManualVideoPromptDraftEvents(project);

  // 顶部横向滚动条与表格底部滚动条同步（避免 F12 后底部滚动条不可见）
  bindStoryboardTopScroll();

  setStatus(`已加载 ${project} ｜ segments: ${segments.length}`);
}

function setBatchImagePromptButtonState(running = false, text = ''){
  const btn = q('batchImagePromptBtn');
  if(!btn) return;
  btn.disabled = !!running;
  btn.textContent = text || (running ? '正在依次生成中…' : '一键生成全部分镜提示词');
}

function parsePromptTextFromReply(reply = ''){
  const raw = String(reply || '').trim();
  if(!raw) return '';

  const fenced = raw.match(/```(?:text|markdown)?\s*([\s\S]*?)```/i);
  if(fenced && fenced[1]) return String(fenced[1]).trim();

  return raw
    .replace(/^\s*【?分镜图?提示词】?[:：]?\s*/i, '')
    .replace(/^\s*image\s*prompt\s*[:：]?\s*/i, '')
    .trim();
}

function collectStoryboardRowsForPromptGen(){
  const rows = [...document.querySelectorAll('#tbody tr')];
  return rows.map((tr, idx) => {
    const sid = String(tr.querySelector('td:nth-child(2) .meta')?.textContent || '').trim();
    const script = String(tr.querySelector('td:nth-child(2) textarea.script-input, td:nth-child(2) textarea')?.value || '').trim();
    const promptTextarea = tr.querySelector('td:nth-child(4) textarea');
    return { idx, sid, script, promptTextarea };
  }).filter(it => it.sid && it.promptTextarea);
}

function persistManualScriptsByRows(project = '', rows = []){
  const p = String(project || '').trim();
  if(!p) return;

  const rowMap = {};
  rows.forEach(it => {
    const sid = String(it?.sid || '').trim();
    if(!sid) return;
    const val = String(it?.scriptTextarea?.value || '').replace(/\r/g, '').trim();
    rowMap[sid] = val;
  });
  if(!Object.keys(rowMap).length) return;

  const parseScriptToFields = (scriptText = '', fallback = {}) => {
    const cleaned = String(scriptText || '').replace(/\r/g, '').trim();
    if(!cleaned) return {
      scene: String(fallback?.scene || '').trim(),
      visual: String(fallback?.visual || fallback?.action || '').trim(),
      action: String(fallback?.action || fallback?.visual || '').trim(),
      dialogue: String(fallback?.dialogue || '').trim(),
      text: String(fallback?.text || fallback?.script || '').trim(),
    };
    const parts = cleaned
      .split(/[，,。！？；;\n]+/)
      .map(x => String(x || '').trim())
      .filter(Boolean);

    const scene = parts[0] || String(fallback?.scene || '').trim();
    const visual = parts[1] || String(fallback?.visual || fallback?.action || '').trim();
    const dialogue = parts.slice(2).join('，') || String(fallback?.dialogue || '').trim();
    return {
      scene,
      visual,
      action: visual,
      dialogue,
      text: cleaned,
      script: cleaned,
    };
  };

  const manualSegments = getProjectManualSegments(p);
  if(Array.isArray(manualSegments) && manualSegments.length){
    const nextSegments = manualSegments.map(seg => {
      const sid = String(seg?.segmentId || seg?.id || '').trim();
      if(!sid || !Object.prototype.hasOwnProperty.call(rowMap, sid)) return seg;
      const fields = parseScriptToFields(rowMap[sid], seg);
      return {
        ...seg,
        ...fields,
      };
    });
    setProjectManualSegments(p, nextSegments);
  }

  if(Array.isArray(latestOutlineSegments) && latestOutlineSegments.length){
    latestOutlineSegments = latestOutlineSegments.map(seg => {
      const sid = String(seg?.segmentId || seg?.id || '').trim();
      if(!sid || !Object.prototype.hasOwnProperty.call(rowMap, sid)) return seg;
      const fields = parseScriptToFields(rowMap[sid], seg);
      return {
        ...seg,
        ...fields,
      };
    });
  }
}

function persistGeneratedImagePromptsByRows(project = '', rows = []){
  const p = String(project || '').trim();
  if(!p) return;

  const rowMap = {};
  rows.forEach(it => {
    const sid = String(it?.sid || '').trim();
    if(!sid) return;
    const val = String(it?.promptTextarea?.value || '');
    rowMap[sid] = val;
    setProjectImagePromptDraft(p, sid, val);
  });

  const manualSegments = getProjectManualSegments(p);
  if(Array.isArray(manualSegments) && manualSegments.length){
    const nextSegments = manualSegments.map(seg => {
      const sid = String(seg?.segmentId || seg?.id || '').trim();
      if(!sid || !Object.prototype.hasOwnProperty.call(rowMap, sid)) return seg;
      return { ...seg, imagePrompt: rowMap[sid] };
    });
    setProjectManualSegments(p, nextSegments);
  }

  if(Array.isArray(latestOutlineSegments) && latestOutlineSegments.length){
    latestOutlineSegments = latestOutlineSegments.map(seg => {
      const sid = String(seg?.segmentId || seg?.id || '').trim();
      if(!sid || !Object.prototype.hasOwnProperty.call(rowMap, sid)) return seg;
      return { ...seg, imagePrompt: rowMap[sid] };
    });
  }
}

function getCharacterMetaByName(name = ''){
  const n = String(name || '').trim();
  if(!n) return null;
  const fromProject = (currentProjectCharacters || []).find(ch => String(ch?.name || ch?.id || '').trim() === n);
  if(fromProject) return fromProject;
  const fromGlobal = (globalCharacterLibrary || []).find(ch => String(ch?.name || ch?.id || '').trim() === n);
  return fromGlobal || null;
}

function buildCharacterStyleReferenceLine(cast = []){
  const names = (Array.isArray(cast) ? cast : []).map(x => String(x || '').trim()).filter(Boolean);
  if(!names.length) return '画风参考：遵循当前项目角色参考图的统一画风与人物比例，不使用泛化风格词。';

  const details = names.map(n => {
    const meta = getCharacterMetaByName(n);
    const note = String(meta?.designNotes || meta?.role || '').replace(/\s+/g,' ').trim();
    return note ? `${n}（${note.slice(0, 40)}）` : n;
  });

  return `画风参考：严格延续角色参考图风格（${details.join('、')}），保持同一世界观、统一笔触与人物比例，不使用“整体都市电影感”这类泛化描述。`;
}

function applyCharacterStyleReferenceToAllPrompts(){
  const project = (latestRenderContext && latestRenderContext.project)
    ? latestRenderContext.project
    : (latestOutlineProject || currentProjectName || getProject() || '');
  if(!project){
    setStatus('请先选择项目', false);
    return;
  }

  const rows = collectStoryboardRowsForPromptGen();
  if(!rows.length){
    setStatus('未找到可处理的分镜行', false);
    return;
  }

  let touched = 0;
  rows.forEach(row => {
    const cast = getProjectSegmentCast(project, row.sid);
    const styleLine = buildCharacterStyleReferenceLine(cast);
    const area = row.promptTextarea;
    if(!area) return;

    let text = String(area.value || '').trim();
    if(!text){
      text = styleLine;
    } else {
      text = text.replace(/整体都市电影感/g, '参考人物画风');
      if(!text.includes('画风参考：')) text = `${text}\n${styleLine}`;
    }
    area.value = text;
    touched += 1;
  });

  persistGeneratedImagePromptsByRows(project, rows);
  setStatus(`已为 ${touched} 条分镜提示词补充“参考人物画风”约束`);
}

async function expandImagePromptEditor(btn){
  const area = btn?.parentElement?.querySelector('textarea.image-prompt-input, textarea.video-prompt-input');
  if(!area) return;

  const isVideoPrompt = area.classList.contains('video-prompt-input');
  const sid = String(area.getAttribute('data-sid') || '').trim() || '-';
  const promptKindLabel = isVideoPrompt ? '视频提示词' : '分镜图提示词';
  const editorPlaceholder = isVideoPrompt ? 'AI 视频提示词...' : 'AI 分镜图提示词...';

  const mask = document.createElement('div');
  mask.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px;';
  mask.innerHTML = `
    <div class="w-full max-w-4xl max-h-[90vh] flex flex-col bg-[#1E2025] rounded-2xl border border-white/10 shadow-2xl overflow-hidden" style="width:min(100%,980px);max-height:90vh;display:flex;flex-direction:column;background:#1E2025;border:1px solid rgba(255,255,255,.1);border-radius:16px;overflow:hidden;">
      <div class="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/10" style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.1);">
        <h3 class="text-base font-medium text-white flex items-center gap-2" style="font-size:16px;font-weight:600;color:#fff;">${promptKindLabel} - 分镜 #${escapeHtml(sid)}</h3>
        <div class="flex items-center gap-2" style="display:flex;gap:8px;">
          <button type="button" data-act="regen" class="px-3 py-1.5 text-sm font-medium rounded-lg transition-colors" style="padding:6px 12px;border-radius:8px;border:1px solid rgba(96,165,250,.35);background:rgba(59,130,246,.18);color:#93c5fd;">重新生成提示词</button>
          <button type="button" data-act="cancel" class="px-3 py-1.5 text-sm text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors" style="padding:6px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.12);background:transparent;color:rgba(255,255,255,.75);">取消</button>
          <button type="button" data-act="save" class="px-4 py-1.5 text-sm font-medium bg-[#00FFCC]/30 text-[#00FFCC] hover:bg-[#00FFCC]/40 rounded-lg transition-colors" style="padding:6px 14px;border-radius:8px;border:1px solid rgba(0,255,204,.35);background:rgba(0,255,204,.2);color:#00FFCC;">保存</button>
        </div>
      </div>
      <div class="flex-1 min-h-0 p-4 overflow-hidden" style="display:flex;flex-direction:column;gap:10px;flex:1;min-height:0;padding:16px;overflow:hidden;">
        <div class="mb-3 flex items-center gap-2" style="display:flex;gap:8px;">
          <input data-role="req" placeholder="输入修改要求，例如：更压抑一些、减少镜头切换、增强情绪冲击" class="flex-1 min-w-0 px-3 py-2 rounded bg-white/5 border border-white/10 text-white/85 text-sm" style="flex:1;min-width:0;padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);color:#e5e7eb;" />
          <button type="button" data-act="opt" disabled class="px-3 py-2 text-sm rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed" style="padding:8px 10px;border-radius:8px;border:1px solid rgba(251,191,36,.3);background:rgba(251,191,36,.18);color:#fcd34d;opacity:.5;">按要求优化</button>
        </div>
        <textarea data-role="editor" placeholder="${editorPlaceholder}" class="w-full h-full min-h-[400px] p-4 rounded-lg bg-white/5 border border-white/10 text-white/90 text-sm resize-none" style="width:100%;height:100%;min-height:420px;padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:#f3f4f6;resize:none;"></textarea>
      </div>
    </div>
  `;

  const close = () => mask.remove();
  mask.addEventListener('click', (e) => { if(e.target === mask) close(); });

  document.body.appendChild(mask);

  const reqInput = mask.querySelector('input[data-role="req"]');
  const optBtn = mask.querySelector('button[data-act="opt"]');
  const regenBtn = mask.querySelector('button[data-act="regen"]');
  const saveBtn = mask.querySelector('button[data-act="save"]');
  const cancelBtn = mask.querySelector('button[data-act="cancel"]');
  const editor = mask.querySelector('textarea[data-role="editor"]');
  if(editor) editor.value = String(area.value || '');

  const refreshOptState = () => {
    if(!optBtn || !reqInput) return;
    const has = String(reqInput.value || '').trim().length > 0;
    optBtn.disabled = !has;
    optBtn.style.opacity = has ? '1' : '.5';
  };
  reqInput?.addEventListener('input', refreshOptState);
  refreshOptState();

  cancelBtn?.addEventListener('click', close);

  saveBtn?.addEventListener('click', () => {
    area.value = String(editor?.value || '').trim();
    area.dispatchEvent(new Event('input', { bubbles: true }));
    area.dispatchEvent(new Event('change', { bubbles: true }));
    area.dispatchEvent(new Event('blur', { bubbles: true }));
    close();
  });

  regenBtn?.addEventListener('click', async () => {
    if(typeof requestChatCompletion !== 'function') return;

    const row = collectStoryboardRowsForPromptGen().find(it => String(it.sid || '').trim() === sid);
    if(!row) {
      setStatus(`未找到分镜 ${sid} 对应的行`, false);
      return;
    }

    const project = (latestRenderContext && latestRenderContext.project)
      ? latestRenderContext.project
      : (latestOutlineProject || currentProjectName || getProject() || '未命名项目');
    const cast = getProjectSegmentCast(project, row.sid);
    const castLine = cast.length ? cast.join('、') : '未标注';
    const styleRefLine = cast.length
      ? buildCharacterStyleReferenceLine(cast)
      : '画风参考：沿用前文已建立的人物参考图风格与世界观一致性。';

    const oldText = regenBtn.textContent;
    regenBtn.disabled = true;
    regenBtn.textContent = '重新生成中…';

    try {
      const taskPrompt = [
        '你是短视频分镜图提示词助手。',
        '请根据给定剧情段，输出一条可直接用于图像生成模型的中文提示词。',
        '硬性要求：',
        '1) 9:16 竖版构图。',
        '2) 严格遵循当前段 script，不可改剧情。',
        '3) 必须包含：场景、人物动作、镜头景别、光线/色调、情绪。',
        '4) 人物形象必须只写“按参考图人物生成/保持参考图一致”，不得描述任何外貌细节（五官、发型、年龄脸部特征等）与穿着细节（衣服款式/颜色/材质）。',
        '5) 可以描述人物手里拿的道具或交互物，但不要改写人物外形设定。',
        '6) 明确禁止：白底棚拍、纯人像证件照、与剧情冲突背景。',
        '7) 提示词内必须写“画风参考”。若本段有出场人物，则画风参考要直接对齐该人物参考图；若本段没有出场人物，则沿用前文已建立的人物画风。',
        '8) 禁止只写“整体都市电影感”这类泛化风格词，必须体现角色参考图风格一致性。',
        '9) 只返回提示词正文，不要解释，不要代码块。',
        `【项目】${project}`,
        `【段号】${row.sid}`,
        `【出场人物】${castLine}`,
        `【画风参考约束】${styleRefLine}`,
        `【剧情段 script】${row.script}`,
      ].join('\n');

      const reply = await requestChatCompletion(taskPrompt);
      const next = parsePromptTextFromReply(reply);
      if(!next) throw new Error('AI 返回空提示词');
      if(editor) editor.value = next;
    } catch (err) {
      setStatus(`重新生成提示词失败：${err?.message || err}`, false);
    } finally {
      regenBtn.disabled = false;
      regenBtn.textContent = oldText || '重新生成提示词';
    }
  });

  optBtn?.addEventListener('click', async () => {
    const reqText = String(reqInput?.value || '').trim();
    if(!reqText || typeof requestChatCompletion !== 'function') return;

    const oldText = optBtn.textContent;
    optBtn.disabled = true;
    optBtn.textContent = '优化中…';

    try {
      const prompt = [
        '你是分镜图提示词优化助手。',
        '请根据用户修改要求，改写提示词。',
        '只返回改写后的提示词正文，不要解释，不要代码块。',
        `分镜号：${sid}`,
        `用户要求：${reqText}`,
        `当前提示词：${String(editor?.value || '').trim()}`,
      ].join('\n');

      const reply = await requestChatCompletion(prompt, {
        preferredModel: 'custom-154-12-46-107/gpt-5.3-codex',
        fallbackModel: 'custom-154-12-46-107/gpt-5.4',
        temperature: 0.3,
      });
      const next = String(reply || '').trim().replace(/^```[\s\S]*?\n?|```$/g,'').trim();
      if(next && editor) editor.value = next;
    } catch (err) {
      setStatus(`提示词优化失败：${err?.message || err}`, false);
    } finally {
      optBtn.textContent = oldText || '按要求优化';
      refreshOptState();
    }
  });
}

function bindManualScriptDraftEvents(project = ''){
  const p = String(project || '').trim();
  if(!p) return;
  const areas = [...document.querySelectorAll('#tbody textarea.script-input[data-sid]')];
  areas.forEach(area => {
    const sid = String(area.getAttribute('data-sid') || '').trim();
    if(!sid) return;
    const saveNow = () => persistManualScriptsByRows(p, [{ sid, scriptTextarea: area }]);
    area.addEventListener('input', saveNow);
    area.addEventListener('change', saveNow);
    area.addEventListener('blur', saveNow);
  });
}

function bindManualImagePromptDraftEvents(project = ''){
  const p = String(project || '').trim();
  if(!p) return;
  const areas = [...document.querySelectorAll('#tbody textarea.image-prompt-input[data-sid]')];
  areas.forEach(area => {
    const sid = String(area.getAttribute('data-sid') || '').trim();
    if(!sid) return;
    const saveNow = () => persistGeneratedImagePromptsByRows(p, [{ sid, promptTextarea: area }]);
    area.addEventListener('input', saveNow);
    area.addEventListener('change', saveNow);
    area.addEventListener('blur', saveNow);
  });
}

async function generateAllImagePrompts(){
  if(imagePromptTaskRunning){
    setStatus('正在生成分镜提示词，请等待当前任务完成', false);
    return;
  }
  if(typeof requestChatCompletion !== 'function'){
    setStatus('生成失败：聊天能力未就绪（requestChatCompletion 缺失）', false);
    return;
  }

  const rows = collectStoryboardRowsForPromptGen();
  if(!rows.length){
    setStatus('未找到可生成的分镜行', false);
    return;
  }

  const project = (latestRenderContext && latestRenderContext.project)
    ? latestRenderContext.project
    : (latestOutlineProject || currentProjectName || getProject() || '未命名项目');

  const total = rows.length;
  let ok = 0;
  let fail = 0;
  let lastStyleRefLine = '';

  try {
    imagePromptTaskRunning = true;
    setBatchImagePromptButtonState(true, `正在依次生成中… 0/${total}`);
    setStatus(`开始依次生成分镜图提示词：0/${total}`);
    if(typeof setChatStatus === 'function') setChatStatus(`正在依次生成分镜提示词（0/${total}）...`);

    for(let i = 0; i < rows.length; i++){
      const row = rows[i];
      const cast = getProjectSegmentCast(project, row.sid);
      const castLine = cast.length ? cast.join('、') : '未标注';
      const existingPrompt = String(row.promptTextarea?.value || '').trim();
      const currentStyleRef = buildCharacterStyleReferenceLine(cast);
      const styleRefLine = cast.length
        ? currentStyleRef
        : (lastStyleRefLine || currentStyleRef || '画风参考：沿用前文已建立的人物参考图风格与世界观一致性。');
      if(cast.length && currentStyleRef) lastStyleRefLine = currentStyleRef;

      const taskPrompt = [
        '你是短视频分镜图提示词助手。',
        '请根据给定剧情段，输出一条可直接用于图像生成模型的中文提示词。',
        '硬性要求：',
        '1) 9:16 竖版构图。',
        '2) 严格遵循当前段 script，不可改剧情。',
        '3) 必须包含：场景、人物外观/动作、镜头景别、光线/色调、情绪。',
        '4) 明确禁止：白底棚拍、纯人像证件照、与剧情冲突背景。',
        '5) 提示词内必须写“画风参考”。若本段有出场人物，则画风参考要直接对齐该人物参考图；若本段没有出场人物，则沿用前文已建立的人物画风。',
        '6) 禁止只写“整体都市电影感”这类泛化风格词，必须体现角色参考图风格一致性。',
        '7) 只返回提示词正文，不要解释，不要代码块。',
        `【项目】${project}`,
        `【段号】${row.sid}`,
        `【出场人物】${castLine}`,
        `【画风参考约束】${styleRefLine}`,
        `【剧情段 script】${row.script}`,
        existingPrompt ? `【当前草稿（可优化）】${existingPrompt}` : ''
      ].filter(Boolean).join('\n');

      try {
        const reply = await requestChatCompletion(taskPrompt);
        const prompt = parsePromptTextFromReply(reply);
        if(!prompt) throw new Error('AI 返回空提示词');
        row.promptTextarea.value = prompt;
        ok += 1;
      } catch (err) {
        fail += 1;
        const fallback = `当前段 script：${row.script}\n9:16竖版，人物与场景严格对应本段剧情，禁止白底棚拍、纯人像、冲突背景。`;
        row.promptTextarea.value = fallback;
      }

      // 每生成一条就立即持久化，避免中途中断导致已生成内容丢失
      persistGeneratedImagePromptsByRows(project, [row]);

      const done = i + 1;
      setBatchImagePromptButtonState(true, `正在依次生成中… ${done}/${total}`);
      setStatus(`正在依次生成分镜图提示词：${done}/${total}（已即时保存）`);
      if(typeof setChatStatus === 'function') setChatStatus(`分镜提示词生成进度：${done}/${total}（已即时保存）`);
    }

    const summary = `分镜图提示词生成完成：成功 ${ok} 条，失败 ${fail} 条，共 ${total} 条。`;
    setStatus(summary, fail === 0);
    if(typeof setChatStatus === 'function') setChatStatus(summary, fail === 0);
  } finally {
    imagePromptTaskRunning = false;
    setBatchImagePromptButtonState(false);
  }
}

async function restoreOriginalStoryOutlineFromProject(force = false){
  const project = latestOutlineProject || currentProjectName || getProject();
  if(!project){
    setStatus('恢复失败：请先选择项目', false);
    return;
  }

  try {
    const p = projectPaths(project);
    const segRes = await fetchFirstJson(p.segments);
    const segments = normalizeSegments(segRes.data);
    const extraPreviewRows = await fetchExtraPreviewRows(project);
    const allSegments = [...segments, ...extraPreviewRows];

    renderStoryOutline(project, allSegments, true);
    setStatus('已恢复原始故事大纲（来自项目分段）');
    if(typeof setChatStatus === 'function') setChatStatus('已恢复原始故事大纲。', true);
  } catch (err) {
    setStatus(`恢复原始大纲失败：${err?.message || err}`, false);
    if(typeof setChatStatus === 'function') setChatStatus(`恢复原始大纲失败：${err?.message || err}`, false);
  }
}

async function loadProject(project){
  if(!project) return setStatus('请先选择/输入项目目录', false);
  currentProjectName = String(project || '').trim();
  await loadGlobalCharacterLibrary(false);
  const p = projectPaths(project);

  try{
    const segRes = await fetchFirstJson(p.segments);
    const segments = normalizeSegments(segRes.data);
    const extraPreviewRows = await fetchExtraPreviewRows(project);
    const allSegments = [...segments, ...extraPreviewRows];

    let promptMap = {};
    try{
      const promptRes = await fetchFirstJson(p.prompts);
      promptMap = normalizePromptMap(promptRes.data);
    }catch{}

    let bindingMap = {};
    let detailShotMap = {};
    try{
      const bindRes = await fetchFirstJson(p.bindings);
      bindingMap = normalizeBindingMap(bindRes.data);
    }catch{}

    for(const candidate of (p.images || [])){
      try{
        if(candidate.endsWith('.jsonl')){
          const imageText = await fetchText(candidate);
          const rows = parseJsonl(imageText);
          bindingMap = { ...bindingMap, ...normalizeImageBindingMapFromRows(rows) };
          const detailMapPart = normalizeDetailShotMapFromRows(rows);
          for(const sid of Object.keys(detailMapPart)){
            if(!detailShotMap[sid]) detailShotMap[sid] = [];
            detailShotMap[sid].push(...detailMapPart[sid]);
          }
        } else {
          const raw = await fetchJson(candidate);
          const rows = Array.isArray(raw?.results) ? raw.results : (Array.isArray(raw) ? raw : []);
          if(rows.length){
            bindingMap = { ...bindingMap, ...normalizeImageBindingMapFromRows(rows) };
            const detailMapPart = normalizeDetailShotMapFromRows(rows);
            for(const sid of Object.keys(detailMapPart)){
              if(!detailShotMap[sid]) detailShotMap[sid] = [];
              detailShotMap[sid].push(...detailMapPart[sid]);
            }
          }
        }
      }catch{}
    }

    // 合并本地草稿（按钮即时生成后的结果），保证刷新后仍可显示
    bindingMap = { ...bindingMap, ...getProjectSceneImageDraftMap(project) };

    let videoMap = {};
    let videoPromptMap = {};
    for(const candidate of p.videos || []){
      try{
        if(candidate.endsWith('.jsonl')){
          const videoText = await fetchText(candidate);
          const rows = parseJsonl(videoText);
          videoMap = normalizeVideoMap(rows);
          videoPromptMap = mergeVideoPromptMap(videoPromptMap, normalizeVideoPromptMapFromRows(rows));
        } else {
          const raw = await fetchJson(candidate);
          const rows = Array.isArray(raw?.results) ? raw.results : (Array.isArray(raw) ? raw : []);
          if(rows.length){
            const normalized = normalizeVideoMap(rows);
            for(const sid of Object.keys(normalized)) videoMap[sid] = normalized[sid];
            videoPromptMap = mergeVideoPromptMap(videoPromptMap, normalizeVideoPromptMapFromRows(rows));
          }
        }
      }catch{}
    }

    const [multiShotMap, grid4ImageMap, planningVideoPromptMap, characters] = await Promise.all([
      fetchMultiShotMap(project, allSegments),
      fetchGrid4ImageMap(project, allSegments),
      fetchPlanningVideoPromptMap(project, allSegments),
      fetchCharacters(project)
    ]);
    videoPromptMap = mergeVideoPromptMap(videoPromptMap, planningVideoPromptMap);

    const videoDraftMap = readProjectVideoDraftMap()[project] || {};
    for(const sid of Object.keys(videoDraftMap || {})){
      const rec = videoDraftMap[sid];
      if(!rec || !rec.videoUrl) continue;
      if(!videoMap[sid]) videoMap[sid] = { latest: null, variants: [] };
      videoMap[sid].latest = rec;
    }

    if(!allSegments.length) return setStatus(`项目 ${project} 的 segments 为空`, false);
    for(const sid of Object.keys(detailShotMap)){
      const seen = new Set();
      detailShotMap[sid] = detailShotMap[sid].filter(it => {
        const key = `${it.shotId}|${it.url}`;
        if(seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      if(detailShotMap[sid].length){
        multiShotMap[sid] = detailShotMap[sid];
      }
    }

    for(const row of extraPreviewRows){
      const sid = row.segmentId;
      if(row.imagePrompt) {
        promptMap[sid] = row.imagePrompt;
      }
      if(row.imageUrl) {
        bindingMap[sid] = row.imageUrl;
      }
      if(row.videoPrompt) {
        videoPromptMap[sid] = { latest: row.videoPrompt, variants: [{ variant: 'extra-preview-row', durationSec: row.durationSec ?? null, createdAt: '', sourceFile: 'extra-preview-rows.json', prompt: row.videoPrompt }] };
      }
      if(row.videoUrl) {
        videoMap[sid] = {
          latest: {
            ok: true,
            statusCode: 200,
            status: 'completed',
            videoId: row.videoMeta?.videoId || '',
            taskId: row.videoMeta?.taskId || '',
            soraDraftId: '',
            videoUrl: row.videoUrl,
            mediaUrl: row.videoMeta?.mediaUrl || '',
            hdVideoUrl: row.videoMeta?.hdVideoUrl || '',
            thumbnailUrl: row.videoMeta?.thumbnailUrl || '',
            createdAt: row.videoMeta?.createdAt || '',
            variant: row.videoMeta?.variant || 'extra-preview-row'
          },
          variants: [{
            ok: true,
            statusCode: 200,
            status: 'completed',
            videoId: row.videoMeta?.videoId || '',
            taskId: row.videoMeta?.taskId || '',
            soraDraftId: '',
            videoUrl: row.videoUrl,
            mediaUrl: row.videoMeta?.mediaUrl || '',
            hdVideoUrl: row.videoMeta?.hdVideoUrl || '',
            thumbnailUrl: row.videoMeta?.thumbnailUrl || '',
            createdAt: row.videoMeta?.createdAt || '',
            variant: row.videoMeta?.variant || 'extra-preview-row'
          }]
        };
      }
    }

    const charDraft = getProjectCharactersDraft(project);
    const finalCharacters = charDraft.exists ? charDraft.chars : characters;

    latestRenderContext = {
      project,
      promptMap,
      bindingMap,
      videoMap,
      multiShotMap,
      videoPromptMap,
      grid4ImageMap,
    };

    const manualSegments = getProjectManualSegments(project);
    const tableSegments = manualSegments.length ? normalizeSegments(manualSegments) : allSegments;

    renderCharacters(finalCharacters, project);
    renderStoryOutline(project, allSegments);
    render(project, tableSegments, promptMap, bindingMap, videoMap, multiShotMap, videoPromptMap, grid4ImageMap);

    q('projectInput').value = project;
    q('projectSelect').value = project;

    const u = new URL(window.location.href);
    u.searchParams.set('project', project);
    history.replaceState(null, '', u.toString());
  }catch(err){
    // 即使项目资源加载失败，也尝试回填该项目已保存的手动分段表格
    const manualSegments = getProjectManualSegments(project);
    if(manualSegments.length){
      latestRenderContext = {
        project,
        promptMap: {},
        bindingMap: {},
        videoMap: {},
        multiShotMap: {},
        videoPromptMap: {},
        grid4ImageMap: {},
      };
      renderStoryOutline(project, []);
      render(project, normalizeSegments(manualSegments), {}, {}, {}, {}, {}, {});
      setStatus(`项目文件加载失败，已回填本地分段表格：${manualSegments.length} 段（${err.message}）`, false);
      return;
    }

    // 即使项目资源加载失败，也要回填该项目已保存的大纲草稿
    renderStoryOutline(project, []);
    setStatus(`加载失败：${err.message}`, false);
  }
}

async function generateSceneImageWithLobster(project, sid, button){
  const p = String(project || '').trim();
  const s = String(sid || '').trim();
  if(!p || !s){
    setStatus('缺少项目或分段编号，无法生成图片', false);
    return;
  }

  const row = [...document.querySelectorAll('#tbody tr')].find(tr => String(tr.querySelector('.meta')?.textContent || '').trim() === s);
  if(!row){
    setStatus(`未找到分段 ${s} 对应的表格行`, false);
    return;
  }

  const scriptText = String(row.querySelector('td textarea')?.value || '').trim();
  const imagePrompt = String(row.querySelector('.image-prompt-input')?.value || '').trim();
  const cast = getProjectSegmentCast(p, s);
  const characterRefs = (Array.isArray(cast) ? cast : []).map(name => ({
    name,
    imageUrl: getCastImageUrl(name),
  })).filter(it => it.name && it.imageUrl);

  const bridgeBase = getBridgeBase();
  const url = `${bridgeBase}/api/lobster/task`;
  const payload = {
    taskType: 'generate_scene_image',
    payload: {
      project: p,
      segmentId: s,
      script: scriptText,
      imagePrompt,
      cast,
      characterRefs,
    }
  };

  const oldText = button?.textContent || '生成图片';
  if(button){ button.disabled = true; button.textContent = '龙虾处理中…'; }
  setStatus(`已把 ${s} 的分镜图任务交给龙虾…`);

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();
    if(!resp.ok) throw new Error(data?.error?.message || `HTTP ${resp.status}`);

    const result = data?.result || {};
    if(result?.ok){
      let finalImageUrl = String(result.sceneImageUrl || result.remoteImageUrl || '').trim();
      const isRemoteImageUrl = /^https?:\/\//i.test(finalImageUrl);

      // 仅当返回的是远程图链接时，才尝试下载到本地；
      // 如果已经是 ./generated/... 这类本地相对路径，就不要再走 save-local，
      // 否则 bridge 端会把本地相对路径当成 fetch 目标导致 502。
      if(finalImageUrl && isRemoteImageUrl){
        try {
          const saveResp = await fetch(`${bridgeBase}/api/scene-image/save-local`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageUrl: finalImageUrl, project: p, segmentId: s }),
          });
          const saveData = await saveResp.json();
          if(saveResp.ok && saveData?.localImageUrl){
            finalImageUrl = String(saveData.localImageUrl).trim() || finalImageUrl;
          }
        } catch {}
      }

      if(finalImageUrl && button){
        const cell = button.closest('td');
        if(cell){
          cell.innerHTML = `<a href="javascript:void(0)" data-img="${escapeHtml(finalImageUrl)}" data-sid="${escapeHtml(s)}" data-project="${escapeHtml(p)}" class="thumb-link"><img class="thumb" src="${escapeHtml(finalImageUrl)}" alt="${escapeHtml(s)}"/></a><div style="margin-top:8px"><button class="btn-primary" onclick="generateSceneImageWithLobster('${escapeHtml(p)}', '${escapeHtml(s)}', this)">生成图片</button></div>`;
          bindThumbPreview(cell);
        }
      }
      if(finalImageUrl){
        setProjectSceneImageDraft(p, s, finalImageUrl);
        appendProjectSceneImageHistory(p, s, finalImageUrl);
      }
      if(finalImageUrl && latestRenderContext && latestRenderContext.project === p){
        latestRenderContext.bindingMap = latestRenderContext.bindingMap || {};
        latestRenderContext.bindingMap[s] = finalImageUrl;
      }
      setStatus(`龙虾已完成 ${s}：${result.provider || 'unknown'} ｜ ${finalImageUrl || '未返回图片地址'}`);
    } else {
      throw new Error(result?.error || '龙虾未成功生成图片');
    }
  } catch (err) {
    setStatus(`生成图片失败：${err?.message || err}`, false);
  } finally {
    if(button){ button.disabled = false; button.textContent = oldText; }
  }
}

function setBatchSceneImageButtonState(running = false, text = ''){
  const btn = q('batchSceneImageBtn');
  if(!btn) return;
  btn.disabled = !!running;
  btn.textContent = text || (running ? '一键生成中…' : '一键生成所有分镜图');
}

async function generateAllSceneImagesWithLobster(){
  const project = String(currentProjectName || getProject() || '').trim();
  if(!project){
    setStatus('请先选择并加载项目', false);
    return;
  }

  const rows = [...document.querySelectorAll('#tbody tr')];
  if(!rows.length){
    setStatus('当前没有可生成分镜图的行', false);
    return;
  }

  let ok = 0;
  let fail = 0;
  setBatchSceneImageButtonState(true, `一键生成中… 0/${rows.length}`);

  for(let i = 0; i < rows.length; i++){
    const row = rows[i];
    const sid = String(row.querySelector('.meta')?.textContent || '').trim();
    const btn = row.querySelector('button.btn-primary[onclick*="generateSceneImageWithLobster"]');

    if(!sid || !btn){
      fail += 1;
      setBatchSceneImageButtonState(true, `一键生成中… ${i+1}/${rows.length}`);
      continue;
    }

    try {
      await generateSceneImageWithLobster(project, sid, btn);
      ok += 1;
    } catch {
      fail += 1;
    }

    setBatchSceneImageButtonState(true, `一键生成中… ${i+1}/${rows.length}`);
  }

  setBatchSceneImageButtonState(false);
  setStatus(`分镜图批量生成完成：成功 ${ok} 条，失败 ${fail} 条，共 ${rows.length} 条`, fail === 0);
}

function getBridgeBase(){
  const cfg = getChatConfig();
  const base = String(cfg.base || 'http://127.0.0.1:12732').trim();
  return base.replace(/\/$/, '');
}

function saveProjectIndexLocal(names = []){
  try{
    const uniq = [...new Set((names || []).map(x => String(x || '').trim()).filter(Boolean))].sort();
    localStorage.setItem(PROJECT_INDEX_STORAGE_KEY, JSON.stringify({
      updatedAt: new Date().toISOString(),
      projects: uniq
    }));
    return uniq;
  } catch {
    return [];
  }
}

function readProjectIndexLocal(){
  try{
    const raw = localStorage.getItem(PROJECT_INDEX_STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : null;
    const arr = Array.isArray(data?.projects) ? data.projects : (Array.isArray(data) ? data : []);
    return [...new Set(arr.map(x => String(x || '').trim()).filter(Boolean))].sort();
  } catch {
    return [];
  }
}

function fillProjectSelect(names = []){
  const sel = q('projectSelect');
  const current = getProject();
  sel.innerHTML = '';
  const uniq = [...new Set((names || []).map(x => String(x || '').trim()).filter(Boolean))].sort();
  if(!uniq.length) uniq.push(DEFAULT_PROJECT_FALLBACK);
  uniq.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    sel.appendChild(opt);
  });
  if(current && uniq.includes(current)) sel.value = current;
  return uniq;
}

function createProject(){
  const raw = String(q('projectInput')?.value || '').trim();
  if(!raw){
    setStatus('请先输入项目名，例如 episode-2-20260415-140000', false);
    return;
  }

  const project = raw.replace(/\s+/g, '-');
  const local = readProjectIndexLocal();
  const next = [...new Set([project, ...local])].sort();
  saveProjectIndexLocal(next);
  fillProjectSelect(next);
  q('projectInput').value = project;
  q('projectSelect').value = project;

  // 新建后先渲染空态大纲，允许用户直接编辑并自动保存
  currentProjectName = project;
  latestOutlineProject = project;
  latestOutlineSegments = [];
  renderStoryOutline(project, []);
  setStatus(`已新建项目：${project}（本地）`);
}

async function discoverProjects(options = {}){
  const forceRefresh = !!options.forceRefresh;
  const bridgeBase = getBridgeBase();

  try{
    const route = forceRefresh ? '/api/projects?refresh=1' : '/api/projects';
    const data = await fetchJson(`${bridgeBase}${route}`);
    const names = Array.isArray(data?.projects) ? data.projects : [];
    const uniq = fillProjectSelect(names);
    saveProjectIndexLocal(uniq);
    setStatus(`已从本地项目索引加载：${uniq.length} 个（${data?.source || 'api'}）`);
    return uniq;
  } catch (err) {
    const local = readProjectIndexLocal();
    if(local.length){
      const uniq = fillProjectSelect(local);
      setStatus(`项目索引接口不可用，已使用本地缓存：${uniq.length} 个（${err.message}）`, false);
      return uniq;
    }

    try{
      const html = await (await fetch('./?t=' + Date.now())).text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const names = [...doc.querySelectorAll('a')]
        .map(a => (a.getAttribute('href') || '').replace(/\/$/, ''))
        .filter(h => !h.startsWith('.') && !h.includes('/') && /^(episode-|cat-|trenchcoat-|opc-|auto-selection-)/i.test(h));
      const uniq = fillProjectSelect(names);
      saveProjectIndexLocal(uniq);
      setStatus(`项目索引接口不可用，已回退目录解析：${uniq.length} 个`, false);
      return uniq;
    } catch (err2) {
      const uniq = fillProjectSelect([DEFAULT_PROJECT_FALLBACK]);
      setStatus(`项目发现失败，已回退默认值：${err2.message}`, false);
      return uniq;
    }
  }
}

async function rebuildProjectIndex(){
  const bridgeBase = getBridgeBase();
  try{
    setStatus('正在重建项目索引...');
    await fetchJson(`${bridgeBase}/api/projects/rebuild?t=${Date.now()}`);
    await discoverProjects({ forceRefresh: true });
  } catch (err) {
    setStatus(`重建项目索引失败：${err.message}`, false);
  }
}

function loadCurrentProject(){ loadProject(getProject()); }

function openJson(kind){
  const project = getProject();
  if(!project) return;
  const p = projectPaths(project);
  const url = p[kind];
  if(url) window.open(url, '_blank');
}

function setPanelModalState(on = false){
  const blocker = q('uiBlocker');
  if(blocker) blocker.classList.toggle('show', !!on);
  document.body.classList.toggle('panel-modal-open', !!on);
}

let currentMainPage = 'script';
function switchMainPage(page = 'script'){
  const next = String(page || 'script').trim() === 'dubbing' ? 'dubbing' : 'script';
  currentMainPage = next;

  const scriptWrap = q('scriptPageWrap');
  const dubbingWrap = q('dubbingPageWrap');
  const tabScript = q('tabScriptPage');
  const tabDubbing = q('tabDubbingPage');

  if(next === 'dubbing'){
    if(scriptWrap) scriptWrap.classList.add('panel-hidden');
    if(dubbingWrap) dubbingWrap.classList.remove('panel-hidden');
    if(tabScript){ tabScript.classList.remove('active'); tabScript.setAttribute('aria-selected', 'false'); }
    if(tabDubbing){ tabDubbing.classList.add('active'); tabDubbing.setAttribute('aria-selected', 'true'); }
    // 切换到配音页时，确保放大面板状态关闭
    toggleOutlinePanel(false);
    toggleCharacterPanel(false);
    setPanelModalState(false);
    if(typeof renderDubbingVoiceProfiles === 'function') renderDubbingVoiceProfiles();
    if(typeof restoreProjectDubbingDraftToUi === 'function') restoreProjectDubbingDraftToUi(true);
    setStatus('已切换到配音页面');
    return;
  }

  if(scriptWrap) scriptWrap.classList.remove('panel-hidden');
  if(dubbingWrap) dubbingWrap.classList.add('panel-hidden');
  if(tabScript){ tabScript.classList.add('active'); tabScript.setAttribute('aria-selected', 'true'); }
  if(tabDubbing){ tabDubbing.classList.remove('active'); tabDubbing.setAttribute('aria-selected', 'false'); }
  setStatus('已切换到剧本页面');

  // 返回剧本页时重算顶部滚动条宽度
  if(typeof bindStoryboardTopScroll === 'function') bindStoryboardTopScroll();
}

function collectSegmentsForDubbing(){
  // 1) 优先读取“左侧当前可见分镜表”的 Script 列（避免吃到旧缓存）
  const tbody = q('tbody');
  const fromTable = tbody
    ? [...tbody.querySelectorAll('tr')].map((tr, idx) => {
        const sid = String(tr.querySelector('td:nth-child(2) .meta')?.textContent || `S${String(idx + 1).padStart(2, '0')}`).trim();
        const script = String(tr.querySelector('td:nth-child(2) textarea')?.value || '').replace(/\s+/g, ' ').trim();
        return { sid, script };
      }).filter(x => x.script)
    : [];
  if(fromTable.length) return fromTable;

  // 2) 再读取左侧“故事大纲”文本框
  const outlineText = String(q('storyOutline')?.value || '').trim();
  if(outlineText){
    const chunks = outlineText
      .split(/\n{2,}|(?<=[。！？!?])\s*/g)
      .map(s => s.trim())
      .filter(Boolean)
      .slice(0, 120);
    if(chunks.length){
      return chunks.map((script, idx) => ({
        sid: `S${String(idx + 1).padStart(2, '0')}`,
        script,
      }));
    }
  }

  // 3) 最后才回退到内存分段（可能是历史数据）
  const raw = Array.isArray(latestOutlineSegments) ? latestOutlineSegments : [];
  return raw.map((seg, idx) => {
    const sid = String(seg?.segmentId || seg?.id || `S${String(idx + 1).padStart(2, '0')}`).trim();
    const script = [seg?.dialogue, seg?.action, seg?.visual, seg?.scene, seg?.script, seg?.content]
      .map(v => String(v || '').trim())
      .filter(Boolean)
      .join('；');
    return { sid, script };
  }).filter(x => x.script);
}

function pickToneByText(text = ''){
  const t = String(text || '');
  if(/[！!]|愤怒|生气|怒吼|发火|拍桌/.test(t)) return '生气地说';
  if(/[？?]|疑惑|不解|纳闷|怎么/.test(t)) return '疑惑地说';
  if(/哭|哽咽|难过|悲伤|心碎/.test(t)) return '伤心地说';
  if(/笑|开心|兴奋|激动|惊喜/.test(t)) return '兴奋地说';
  if(/低声|悄悄|小声/.test(t)) return '小声地说';
  return '平静地说';
}

function sanitizeDubbingOutput(text = ''){
  let t = String(text || '').trim();
  if(!t) return '';
  t = t.replace(/苏甜/g, '黑猫记者').replace(/赫连城/g, '龙虾助手');
  return t;
}

let dubbingLineRows = [];
const dubbingPreviewBusyRows = new Set();
const dubbingLinePreviewAudioMap = new Map();

function setDubbingPreviewBusyUi(index = -1, busy = false){
  const i = Number(index);
  if(i < 0) return;
  const wrap = q('dubbingListEditor');
  if(!wrap) return;
  const btns = wrap.querySelectorAll(`button[data-dubbing-row="${i}"][data-dubbing-action]`);
  const allowedDuringBusy = new Set(['move-up', 'move-down']);
  btns.forEach((btn) => {
    const action = String(btn.dataset.dubbingAction || '').trim();
    const baseLabel = String(btn.dataset.label || btn.textContent || '').trim();
    btn.dataset.label = baseLabel;
    if(busy){
      if(allowedDuringBusy.has(action)){
        btn.disabled = false;
        btn.style.opacity = '';
        btn.style.pointerEvents = '';
        btn.textContent = baseLabel || (action === 'move-up' ? '↑' : '↓');
        return;
      }
      btn.disabled = true;
      btn.style.opacity = '0.55';
      btn.style.pointerEvents = 'none';
      btn.textContent = action === 'refresh' ? '生成中…' : (action === 'remove' ? '处理中…' : (action === 'download-local' ? '缓存中…' : '试听中…'));
    }else{
      btn.disabled = false;
      btn.style.opacity = '';
      btn.style.pointerEvents = '';
      btn.textContent = baseLabel || (action === 'refresh' ? '刷新' : (action === 'remove' ? '删除' : '试听'));
    }
  });
  if(!busy) setDubbingLineLocalButtons(i);
}

function getDubbingLineCacheKeyByRow(row = {}){
  const speaker = String(row?.speaker || '').trim().slice(0, 1).toUpperCase();
  const role = String(row?.role || '').trim();
  const tone = String(row?.tone || '').trim();
  const text = String(row?.text || '').trim();
  return `${speaker}::${role}::${tone}::${text}`;
}

function hasCachedDubbingLineAudio(index = -1){
  const i = Number(index);
  if(i < 0 || i >= dubbingLineRows.length) return false;
  const key = getDubbingLineCacheKeyByRow(dubbingLineRows[i]);
  return !!(key && dubbingLinePreviewAudioMap.get(key)?.blobUrl);
}

function setDubbingLineLocalButtons(index = -1){
  const i = Number(index);
  if(i < 0) return;
  const wrap = q('dubbingListEditor');
  if(!wrap) return;
  const enabled = hasCachedDubbingLineAudio(i);
  const actions = ['preview', 'play-local', 'download-local'];
  actions.forEach((action) => {
    const btn = wrap.querySelector(`button[data-dubbing-row="${i}"][data-dubbing-action="${action}"]`);
    if(!btn) return;
    btn.disabled = !enabled;
    btn.style.opacity = enabled ? '' : '0.45';
    btn.style.pointerEvents = enabled ? '' : 'none';
  });
}

function clearDubbingLineCacheByRow(row = {}){
  const key = getDubbingLineCacheKeyByRow(row);
  if(!key) return;
  const cached = dubbingLinePreviewAudioMap.get(key);
  if(cached?.blobUrl){
    try { URL.revokeObjectURL(cached.blobUrl); } catch {}
  }
  dubbingLinePreviewAudioMap.delete(key);
}

function pickDubbingLineFileName(index = -1, role = ''){
  const i = Number(index);
  const safeRole = String(role || `line-${i + 1}`)
    .replace(/[\\/:*?"<>|\s]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24) || `line-${i + 1}`;
  const no = String(i + 1).padStart(2, '0');
  return `dubbing_${no}_${safeRole}.mp3`;
}

async function cacheDubbingLineAudio(index = -1, audioUrl = '', role = ''){
  const i = Number(index);
  if(i < 0 || i >= dubbingLineRows.length) return null;
  const row = dubbingLineRows[i] || {};
  const key = getDubbingLineCacheKeyByRow(row);
  if(!key || !audioUrl) return null;
  const resp = await fetch(audioUrl);
  if(!resp.ok) throw new Error(`下载音频失败 HTTP ${resp.status}`);
  const blob = await resp.blob();
  if(!blob || !blob.size) throw new Error('音频缓存为空');
  const old = dubbingLinePreviewAudioMap.get(key);
  if(old?.blobUrl){
    try { URL.revokeObjectURL(old.blobUrl); } catch {}
  }
  const blobUrl = URL.createObjectURL(blob);
  const fileName = pickDubbingLineFileName(i, role);
  const cached = { blob, blobUrl, fileName, mime: blob.type || 'audio/mpeg', createdAt: Date.now() };
  dubbingLinePreviewAudioMap.set(key, cached);
  return cached;
}

function playLocalDubbingLine(index = -1){
  const i = Number(index);
  if(i < 0 || i >= dubbingLineRows.length) return;
  const row = dubbingLineRows[i] || {};
  const role = String(row.role || '').trim();
  const key = getDubbingLineCacheKeyByRow(row);
  const cached = key ? dubbingLinePreviewAudioMap.get(key) : null;
  if(!cached?.blobUrl){
    setStatus(`第${i + 1}句暂无本地缓存，请先点“试听”生成`, false);
    setDubbingLineLocalButtons(i);
    return;
  }
  if(dubbingVoicePreviewAudio){
    try { dubbingVoicePreviewAudio.pause(); } catch {}
    dubbingVoicePreviewAudio = null;
  }
  if(dubbingVoicePreviewUtterance && window.speechSynthesis){
    try { window.speechSynthesis.cancel(); } catch {}
    dubbingVoicePreviewUtterance = null;
  }
  dubbingVoicePreviewAudio = new Audio(cached.blobUrl);
  dubbingVoicePreviewAudio.play().catch(() => {});
  setStatus(`正在播放第${i + 1}句本地缓存（${role || '未命名角色'}）`);
}

function downloadLocalDubbingLine(index = -1){
  const i = Number(index);
  if(i < 0 || i >= dubbingLineRows.length) return;
  const row = dubbingLineRows[i] || {};
  const key = getDubbingLineCacheKeyByRow(row);
  const cached = key ? dubbingLinePreviewAudioMap.get(key) : null;
  if(!cached?.blobUrl){
    setStatus(`第${i + 1}句暂无可下载音频，请先点“试听”`, false);
    setDubbingLineLocalButtons(i);
    return;
  }
  const a = document.createElement('a');
  a.href = cached.blobUrl;
  a.download = cached.fileName || pickDubbingLineFileName(i, row.role);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setStatus(`第${i + 1}句已下载到本地：${a.download}`);
}

function parseDubbingRowsFromText(text = ''){
  const lines = String(text || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const rows = [];
  lines.forEach(line => {
    if(/^#/.test(line)) return;
    const m = line.match(/^([A-Z])(?:\(([^)]+)\))?([^：:]*)[：:](.+)$/);
    if(m){
      rows.push({
        speaker: String(m[1] || '').trim() || 'A',
        role: String(m[2] || '').trim(),
        tone: String(m[3] || '').trim(),
        text: String(m[4] || '').trim(),
      });
    } else {
      rows.push({ speaker: 'A', role: '', tone: '平静地说', text: line });
    }
  });
  return rows;
}

function serializeDubbingRowsToText(rows = []){
  const list = Array.isArray(rows) ? rows : [];
  return list
    .map(row => {
      const sp = String(row?.speaker || 'A').trim().slice(0, 1).toUpperCase() || 'A';
      const role = String(row?.role || '').trim();
      const tone = String(row?.tone || '').trim();
      const text = String(row?.text || '').trim();
      if(!text) return '';
      return `${sp}${role ? `(${role})` : ''}${tone}：${text}`;
    })
    .filter(Boolean)
    .join('\n');
}

function getDubbingAvatarByRole(role = ''){
  const r = String(role || '').trim();
  if(/黑猫|猫/.test(r)) return '🐱';
  if(/龙虾/.test(r)) return '🦞';
  if(/旁白|解说|画外音/.test(r)) return '🎙️';
  return '🎤';
}

function syncDubbingTextFromEditor(shouldPersist = true){
  const outputEl = q('dubbingResult');
  if(!outputEl) return;
  outputEl.value = serializeDubbingRowsToText(dubbingLineRows);
  if(shouldPersist) persistProjectDubbingDraftFromUi();
}

function renderDubbingListEditorFromText(text = ''){
  const wrap = q('dubbingListEditor');
  if(!wrap) return;
  dubbingLineRows = parseDubbingRowsFromText(text);
  if(!dubbingLineRows.length){
    wrap.innerHTML = '<div class="meta" style="padding:12px;border:1px dashed rgba(255,255,255,.18);border-radius:12px;">暂无配音台词，点击「一键分析剧本」或「+ 新增一条」。</div>';
    return;
  }

  const rowsHtml = dubbingLineRows.map((row, idx) => {
    const avatar = getDubbingAvatarByRole(row.role);
    const roleName = escapeHtml(row.role || '未命名角色');
    const tone = escapeHtml(row.tone || '平静地说');
    const textValue = escapeHtml(row.text || '');
    const speakerValue = escapeHtml((row.speaker || 'A').toUpperCase());
    const localReady = hasCachedDubbingLineAudio(idx);
    const localBtnStyle = localReady ? '' : 'opacity:.45;pointer-events:none;';
    const previewBtnStyle = localReady ? '' : 'opacity:.45;pointer-events:none;';
    return `<div style="background:#14161c;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:12px 14px;display:flex;align-items:center;gap:12px;">
      <div style="width:150px;flex-shrink:0;display:flex;align-items:center;gap:8px;">
        <div style="width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#1c1f26;border:1px solid rgba(255,255,255,.14);">${avatar}</div>
        <div style="min-width:0;">
          <div style="font-size:13px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${roleName}</div>
          <div style="font-size:11px;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${tone}</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex:1;min-width:0;">
        <input value="${speakerValue}" oninput="updateDubbingLineField(${idx}, 'speaker', this.value)" maxlength="1" style="width:40px;border-radius:8px;border:1px solid rgba(255,255,255,.14);background:#0f1117;color:#e2e8f0;padding:7px 8px;text-align:center;" />
        <input value="${escapeHtml(row.role || '')}" oninput="updateDubbingLineField(${idx}, 'role', this.value)" placeholder="角色名" style="width:130px;border-radius:8px;border:1px solid rgba(255,255,255,.14);background:#0f1117;color:#e2e8f0;padding:7px 8px;" />
        <input value="${escapeHtml(row.tone || '')}" oninput="updateDubbingLineField(${idx}, 'tone', this.value)" placeholder="语气（如：平静地说）" style="width:160px;border-radius:8px;border:1px solid rgba(255,255,255,.14);background:#0f1117;color:#e2e8f0;padding:7px 8px;" />
        <textarea oninput="updateDubbingLineField(${idx}, 'text', this.value)" rows="1" style="flex:1;min-width:0;border-radius:8px;border:1px solid rgba(255,255,255,.14);background:#0f1117;color:#e2e8f0;padding:7px 10px;line-height:1.5;">${textValue}</textarea>
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
        <button class="btn-ghost" data-dubbing-row="${idx}" data-dubbing-action="preview" data-label="试听" title="试听" onclick="previewDubbingLine(${idx})" style="${previewBtnStyle}">试听</button>
        <button class="btn-ghost" data-dubbing-row="${idx}" data-dubbing-action="refresh" data-label="重新生成音频" title="重新生成音频" onclick="refreshDubbingLine(${idx})">重新生成音频</button>
        <button class="btn-ghost" data-dubbing-row="${idx}" data-dubbing-action="play-local" data-label="本地预览" title="播放已缓存音频" onclick="playLocalDubbingLine(${idx})" style="${localBtnStyle}">本地预览</button>
        <button class="btn-ghost" data-dubbing-row="${idx}" data-dubbing-action="download-local" data-label="下载" title="下载本地缓存音频" onclick="downloadLocalDubbingLine(${idx})" style="${localBtnStyle}">下载</button>
        <button class="btn-ghost" data-dubbing-row="${idx}" data-dubbing-action="move-up" data-label="↑" title="上移" onclick="moveDubbingLineRow(${idx}, -1)">↑</button>
        <button class="btn-ghost" data-dubbing-row="${idx}" data-dubbing-action="move-down" data-label="↓" title="下移" onclick="moveDubbingLineRow(${idx}, 1)">↓</button>
        <button class="btn-ghost" data-dubbing-row="${idx}" data-dubbing-action="remove" data-label="删除" title="删除" onclick="removeDubbingLineRow(${idx})">删除</button>
      </div>
    </div>`;
  }).join('');

  wrap.innerHTML = rowsHtml;
}

function updateDubbingLineField(index = -1, field = '', value = ''){
  const i = Number(index);
  if(i < 0 || i >= dubbingLineRows.length) return;
  const key = String(field || '').trim();
  if(!key) return;
  const oldRow = { ...(dubbingLineRows[i] || {}) };
  if(key === 'speaker') dubbingLineRows[i][key] = String(value || '').trim().slice(0, 1).toUpperCase() || 'A';
  else dubbingLineRows[i][key] = String(value || '').trim();
  clearDubbingLineCacheByRow(oldRow);
  syncDubbingTextFromEditor(true);
  setDubbingLineLocalButtons(i);
}

function addDubbingLineRow(){
  const nextSpeaker = String.fromCharCode(65 + (dubbingLineRows.length % 26));
  dubbingLineRows.push({ speaker: nextSpeaker, role: '', tone: '平静地说', text: '' });
  syncDubbingTextFromEditor(true);
  renderDubbingListEditorFromText(q('dubbingResult')?.value || '');
}

function moveDubbingLineRow(index = -1, delta = 0){
  const i = Number(index);
  const d = Number(delta);
  const j = i + d;
  if(i < 0 || i >= dubbingLineRows.length || j < 0 || j >= dubbingLineRows.length) return;
  const tmp = dubbingLineRows[i];
  dubbingLineRows[i] = dubbingLineRows[j];
  dubbingLineRows[j] = tmp;
  syncDubbingTextFromEditor(true);
  renderDubbingListEditorFromText(q('dubbingResult')?.value || '');
}

function removeDubbingLineRow(index = -1){
  const i = Number(index);
  if(i < 0 || i >= dubbingLineRows.length) return;
  clearDubbingLineCacheByRow(dubbingLineRows[i] || {});
  dubbingLineRows.splice(i, 1);
  syncDubbingTextFromEditor(true);
  renderDubbingListEditorFromText(q('dubbingResult')?.value || '');
}

async function previewDubbingLine(index = -1, forceRegenerate = false){
  const i = Number(index);
  if(i < 0 || i >= dubbingLineRows.length) return;
  if(dubbingPreviewBusyRows.has(i)) return;

  const row = dubbingLineRows[i] || {};
  const role = String(row.role || '').trim();
  const textOnly = String(row.text || '').trim();
  const toneOnly = String(row.tone || '').trim();
  if(!textOnly) return;

  const project = String(latestOutlineProject || currentProjectName || getProject() || '').trim();
  if(!project){
    setStatus('请先选择项目', false);
    return;
  }
  if(!role){
    setStatus('该台词未填写角色名，无法调用千问试听', false);
    return;
  }

  // 只朗读台词正文，不拼接 role/tone（如“黑猫记者”“平静地说”只用于音色控制）
  const previewText = textOnly;
  const base = getBridgeBase();
  let design = getProjectDubbingVoiceDesign(project, role) || {};
  let voiceId = String(design?.voiceId || design?.voice || '').trim();

  // 行内试听/刷新严格只做“已设计音色 + 当前台词 text”预览，不提交 voice design prompt。
  // 避免把角色设定提示词误带入 /api/dubbing/voice/preview，触发上游不必要分支。

  dubbingPreviewBusyRows.add(i);
  setDubbingPreviewBusyUi(i, true);
  setStatus(forceRegenerate ? `正在重新生成第${i + 1}句音频…` : `正在生成第${i + 1}句试听音频…`);

  try {
    if(!voiceId){
      throw new Error(`角色「${role}」尚未在上方“音色设计”中完成设置，请先设计音色后再试听`);
    }

    // 行内“试听”优先播放该行最近一次生成并缓存的音频（例如点过“重新生成音频”后），
    // 不要回退成上方“音色设计试听”，避免出现“试听和重新生成结果不一致”。
    const cacheKey = getDubbingLineCacheKeyByRow(row);
    const cachedLocal = (!forceRegenerate && cacheKey) ? dubbingLinePreviewAudioMap.get(cacheKey) : null;
    if(!forceRegenerate && cachedLocal?.blobUrl){
      if(dubbingVoicePreviewAudio){
        try { dubbingVoicePreviewAudio.pause(); } catch {}
        dubbingVoicePreviewAudio = null;
      }
      if(dubbingVoicePreviewUtterance && window.speechSynthesis){
        try { window.speechSynthesis.cancel(); } catch {}
        dubbingVoicePreviewUtterance = null;
      }
      dubbingVoicePreviewAudio = new Audio(cachedLocal.blobUrl);
      await dubbingVoicePreviewAudio.play().catch(() => {});
      setStatus(`正在试听第${i + 1}句（${role}，使用本行已缓存音频）`);
      setDubbingLineLocalButtons(i);
      return;
    }

    // 若该行还没有本地缓存，试听才使用上方“音色设计”返回的 preview 音频兜底。
    // 刷新(forceRegenerate=true)始终走后端重生成。
    const designedPreviewAudioUrl = String(design?.previewAudioUrl || '').trim();
    if(!forceRegenerate && designedPreviewAudioUrl){
      if(dubbingVoicePreviewAudio){
        try { dubbingVoicePreviewAudio.pause(); } catch {}
        dubbingVoicePreviewAudio = null;
      }
      if(dubbingVoicePreviewUtterance && window.speechSynthesis){
        try { window.speechSynthesis.cancel(); } catch {}
        dubbingVoicePreviewUtterance = null;
      }
      const cached = await cacheDubbingLineAudio(i, designedPreviewAudioUrl, role);
      const playUrl = String(cached?.blobUrl || designedPreviewAudioUrl).trim();
      dubbingVoicePreviewAudio = new Audio(playUrl);
      await dubbingVoicePreviewAudio.play().catch(() => {});
      setStatus(`正在试听第${i + 1}句（${role}，使用已设计音色试听）`);
      setDubbingLineLocalButtons(i);
      if(typeof renderDubbingVoiceProfiles === 'function'){
        renderDubbingVoiceProfiles();
      }
      return;
    }

    // 配音区只读取“已设计好的音色”来朗读本行台词，不在这里写回角色设计，
    // 避免点击下方“试听/刷新”污染上方“音色设计”内容。

    const previewReqBody = {
      project,
      role,
      voiceId,
      text: previewText,
      forceRegenerate: !!forceRegenerate,
      reuseDesignedPreview: !forceRegenerate,
    };
    const previewResp = await fetch(`${base}/api/dubbing/voice/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(previewReqBody),
    });
    const previewData = await previewResp.json().catch(() => ({}));
    if(!previewResp.ok || !previewData?.ok){
      throw new Error(previewData?.error?.message || previewData?.error || `试听失败 HTTP ${previewResp.status}`);
    }

    const audioUrl = String(previewData?.audioUrl || previewData?.url || design?.previewAudioUrl || '').trim();
    const finalPreviewText = String(previewData?.previewText || previewText).trim();
    const useBrowserTTS = !audioUrl;

    // 行内“试听/刷新”只用于当前台词音频预览，不回写角色音色档案，
    // 避免污染上方“音色设计”的 provider/model/voice 展示。

    if(dubbingVoicePreviewAudio){
      try { dubbingVoicePreviewAudio.pause(); } catch {}
      dubbingVoicePreviewAudio = null;
    }
    if(dubbingVoicePreviewUtterance && window.speechSynthesis){
      try { window.speechSynthesis.cancel(); } catch {}
      dubbingVoicePreviewUtterance = null;
    }

    if(useBrowserTTS && window.speechSynthesis && window.SpeechSynthesisUtterance){
      const u = new SpeechSynthesisUtterance(finalPreviewText || previewText);
      u.lang = 'zh-CN';
      u.rate = 1.05;
      dubbingVoicePreviewUtterance = u;
      window.speechSynthesis.speak(u);
      setStatus(`正在试听第${i + 1}句（${role}，浏览器预览）`);
    }else{
      if(!audioUrl) throw new Error('后端未返回可播放音频地址');
      const cached = await cacheDubbingLineAudio(i, audioUrl, role);
      const playUrl = String(cached?.blobUrl || audioUrl).trim();
      dubbingVoicePreviewAudio = new Audio(playUrl);
      await dubbingVoicePreviewAudio.play().catch(() => {});
      if(forceRegenerate){
        // 用户点击“重新生成音频”时，除播放外自动触发本地下载
        downloadLocalDubbingLine(i);
        setStatus(`第${i + 1}句音频已重新生成并自动下载（${role}）`);
      }else{
        setStatus(`正在试听第${i + 1}句（${role}，已缓存可下载）`);
      }
      setDubbingLineLocalButtons(i);
    }

    if(typeof renderDubbingVoiceProfiles === 'function'){
      renderDubbingVoiceProfiles();
    }
  } catch (err) {
    setStatus(`试听失败（${role || `第${i + 1}句`}）：${err?.message || err}`, false);
  } finally {
    dubbingPreviewBusyRows.delete(i);
    setDubbingPreviewBusyUi(i, false);
  }
}

async function refreshDubbingLine(index = -1){
  return previewDubbingLine(index, true);
}

function formatDubbingByRule(project = '', segments = []){
  const rows = Array.isArray(segments) ? segments : [];
  if(!rows.length) return '';

  const speakers = ['A', 'B', 'C', 'D', 'E'];
  let lineNo = 0;
  const out = [];

  const bannedNameRe = /(苏甜|赫连城)/g;
  const forceMap = [
    { re: /(黑猫记者|黑猫|记者)/, name: '黑猫记者', sp: 'A' },
    { re: /(龙虾助手|龙虾|助手)/, name: '龙虾助手', sp: 'B' },
    { re: /(旁白|画外音|镜头|场景|外景|内景)/, name: '旁白', sp: 'C' },
  ];

  for(const seg of rows){
    const sid = String(seg?.sid || '').trim();
    const text = String(seg?.script || '').trim();
    if(!text) continue;

    const cast = (typeof getProjectSegmentCast === 'function') ? getProjectSegmentCast(project, sid) : [];
    const chunks = text
      .split(/[。！？!?；;\n]/g)
      .map(s => s.trim())
      .filter(Boolean)
      .slice(0, 3);

    if(!chunks.length) continue;
    out.push(`# ${sid || '片段'}`);

    chunks.forEach((chunk, idx) => {
      const sp = speakers[(lineNo + idx) % speakers.length];
      const tone = pickToneByText(chunk);

      const cleanedChunk = chunk.replace(bannedNameRe, '');
      const forced = forceMap.find(item => item.re.test(cleanedChunk));
      if(forced){
        out.push(`${forced.sp}(${forced.name})${tone}：${cleanedChunk}`);
        return;
      }

      let roleName = Array.isArray(cast) && cast[idx] ? String(cast[idx]) : '';
      roleName = roleName.replace(bannedNameRe, '').trim();
      out.push(`${sp}${roleName ? `(${roleName})` : ''}${tone}：${cleanedChunk}`);
    });
    lineNo += chunks.length;
    out.push('');
  }

  return out.join('\n').trim();
}

function readProjectDubbingVoiceProfileMap(){
  try {
    const raw = localStorage.getItem(PROJECT_DUBBING_VOICE_PROFILE_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

function saveProjectDubbingVoiceProfileMap(map = {}){
  try { localStorage.setItem(PROJECT_DUBBING_VOICE_PROFILE_KEY, JSON.stringify(map || {})); } catch {}
}

function readProjectDubbingResultDraftMap(){
  try {
    const raw = localStorage.getItem(PROJECT_DUBBING_RESULT_DRAFT_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

function saveProjectDubbingResultDraftMap(map = {}){
  try { localStorage.setItem(PROJECT_DUBBING_RESULT_DRAFT_KEY, JSON.stringify(map || {})); } catch {}
}

function getProjectDubbingResultDraft(project = ''){
  const p = String(project || '').trim();
  if(!p) return '';
  const map = readProjectDubbingResultDraftMap();
  return String(map?.[p] || '').trim();
}

function setProjectDubbingResultDraft(project = '', text = ''){
  const p = String(project || '').trim();
  if(!p) return;
  const map = readProjectDubbingResultDraftMap();
  const next = String(text || '').trim();
  if(next) map[p] = next;
  else delete map[p];
  saveProjectDubbingResultDraftMap(map);
}

function readProjectDubbingVoiceRoleManualMap(){
  try {
    const raw = localStorage.getItem(PROJECT_DUBBING_VOICE_ROLE_MANUAL_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

function saveProjectDubbingVoiceRoleManualMap(map = {}){
  try { localStorage.setItem(PROJECT_DUBBING_VOICE_ROLE_MANUAL_KEY, JSON.stringify(map || {})); } catch {}
}

function getProjectDubbingVoiceManualRoles(project = ''){
  const p = String(project || '').trim();
  if(!p) return [];
  const map = readProjectDubbingVoiceRoleManualMap();
  const list = Array.isArray(map?.[p]) ? map[p] : [];
  return [...new Set(list.map(s => String(s || '').trim()).filter(Boolean))];
}

function addProjectDubbingVoiceManualRole(project = '', roleName = ''){
  const p = String(project || '').trim();
  const r = String(roleName || '').trim();
  if(!p || !r) return;
  const map = readProjectDubbingVoiceRoleManualMap();
  const list = new Set(Array.isArray(map?.[p]) ? map[p].map(s => String(s || '').trim()).filter(Boolean) : []);
  list.add(r);
  map[p] = [...list];
  saveProjectDubbingVoiceRoleManualMap(map);
}

function removeProjectDubbingVoiceManualRole(project = '', roleName = ''){
  const p = String(project || '').trim();
  const r = String(roleName || '').trim();
  if(!p || !r) return;
  const map = readProjectDubbingVoiceRoleManualMap();
  const list = new Set(Array.isArray(map?.[p]) ? map[p].map(s => String(s || '').trim()).filter(Boolean) : []);
  list.delete(r);
  if(list.size) map[p] = [...list];
  else delete map[p];
  saveProjectDubbingVoiceRoleManualMap(map);
}

function readProjectDubbingVoiceRoleExcludedMap(){
  try {
    const raw = localStorage.getItem(PROJECT_DUBBING_VOICE_ROLE_EXCLUDED_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

function saveProjectDubbingVoiceRoleExcludedMap(map = {}){
  try { localStorage.setItem(PROJECT_DUBBING_VOICE_ROLE_EXCLUDED_KEY, JSON.stringify(map || {})); } catch {}
}

function getProjectDubbingVoiceExcludedRoles(project = ''){
  const p = String(project || '').trim();
  if(!p) return new Set();
  const map = readProjectDubbingVoiceRoleExcludedMap();
  const list = Array.isArray(map?.[p]) ? map[p] : [];
  return new Set(list.map(s => String(s || '').trim()).filter(Boolean));
}

function setProjectDubbingVoiceRoleExcluded(project = '', roleName = '', excluded = true){
  const p = String(project || '').trim();
  const r = String(roleName || '').trim();
  if(!p || !r) return;
  const map = readProjectDubbingVoiceRoleExcludedMap();
  const set = new Set(Array.isArray(map?.[p]) ? map[p].map(s => String(s || '').trim()).filter(Boolean) : []);
  if(excluded) set.add(r);
  else set.delete(r);
  if(set.size) map[p] = [...set];
  else delete map[p];
  saveProjectDubbingVoiceRoleExcludedMap(map);
}

function getProjectDubbingVoiceProfiles(project = ''){
  const p = String(project || '').trim();
  if(!p) return {};
  const map = readProjectDubbingVoiceProfileMap();
  const row = map[p];
  return row && typeof row === 'object' ? row : {};
}

function setProjectRoleVoiceProfile(project = '', roleName = '', profile = null){
  const p = String(project || '').trim();
  const r = String(roleName || '').trim();
  if(!p || !r) return;
  const map = readProjectDubbingVoiceProfileMap();
  if(!map[p] || typeof map[p] !== 'object') map[p] = {};
  if(profile && typeof profile === 'object') map[p][r] = profile;
  else delete map[p][r];
  saveProjectDubbingVoiceProfileMap(map);
}

function readProjectDubbingVoiceDesignMap(){
  try {
    const raw = localStorage.getItem(PROJECT_DUBBING_VOICE_DESIGN_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

function saveProjectDubbingVoiceDesignMap(map = {}){
  try { localStorage.setItem(PROJECT_DUBBING_VOICE_DESIGN_KEY, JSON.stringify(map || {})); } catch {}
}

function getProjectDubbingVoiceDesign(project = '', roleName = ''){
  const p = String(project || '').trim();
  const r = String(roleName || '').trim();
  if(!p || !r) return null;
  const map = readProjectDubbingVoiceDesignMap();
  const row = map?.[p]?.[r];
  return row && typeof row === 'object' ? row : null;
}

function setProjectDubbingVoiceDesign(project = '', roleName = '', payload = null){
  const p = String(project || '').trim();
  const r = String(roleName || '').trim();
  if(!p || !r) return;
  const map = readProjectDubbingVoiceDesignMap();
  if(!map[p] || typeof map[p] !== 'object') map[p] = {};
  if(payload && typeof payload === 'object') map[p][r] = payload;
  else delete map[p][r];
  if(map[p] && typeof map[p] === 'object' && !Object.keys(map[p]).length) delete map[p];
  saveProjectDubbingVoiceDesignMap(map);
}

function readProjectDubbingVoicePromptLineMap(){
  try {
    const raw = localStorage.getItem(PROJECT_DUBBING_VOICE_PROMPT_LINE_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

function saveProjectDubbingVoicePromptLineMap(map = {}){
  try { localStorage.setItem(PROJECT_DUBBING_VOICE_PROMPT_LINE_KEY, JSON.stringify(map || {})); } catch {}
}

function getProjectDubbingVoicePromptLine(project = '', roleName = ''){
  const p = String(project || '').trim();
  const r = String(roleName || '').trim();
  if(!p || !r) return '';
  const map = readProjectDubbingVoicePromptLineMap();
  const line = map?.[p]?.[r];
  return String(line || '').trim();
}

function setProjectDubbingVoicePromptLine(project = '', roleName = '', lineText = ''){
  const p = String(project || '').trim();
  const r = String(roleName || '').trim();
  if(!p || !r) return;
  const map = readProjectDubbingVoicePromptLineMap();
  if(!map[p] || typeof map[p] !== 'object') map[p] = {};
  const next = String(lineText || '').trim();
  if(next) map[p][r] = next;
  else delete map[p][r];
  if(map[p] && typeof map[p] === 'object' && !Object.keys(map[p]).length) delete map[p];
  saveProjectDubbingVoicePromptLineMap(map);
}

function inferVoicePresetByName(name = ''){
  const n = String(name || '').trim();
  if(!n) return { gender: '中性', age: '青年', tone: '自然叙述', speed: '中速', emotion: '克制' };
  if(/旁白|解说|画外音/.test(n)) return { gender: '中性', age: '青年', tone: '纪录片旁白', speed: '中速偏慢', emotion: '沉稳' };
  if(/黑猫记者|记者|主持/.test(n)) return { gender: '女声', age: '青年', tone: '新闻播报', speed: '中速偏快', emotion: '专业克制' };
  if(/龙虾助手|助手/.test(n)) return { gender: '男声', age: '青年', tone: '理性助手', speed: '中速', emotion: '冷静' };
  return { gender: '中性', age: '青年', tone: '自然叙述', speed: '中速', emotion: '克制' };
}

function collectDubbingRoleNames(project = ''){
  const p = String(project || '').trim();
  const rows = [...document.querySelectorAll('#tbody tr')];
  const fromCast = rows.flatMap(tr => {
    const sid = String(tr.querySelector('.meta')?.textContent || '').trim();
    if(!sid) return [];
    return getProjectSegmentCast(p, sid);
  });
  const fromProject = (currentProjectCharacters || []).map(ch => String(ch?.name || ch?.id || '').trim()).filter(Boolean);
  const fromGlobal = (globalCharacterLibrary || []).map(ch => String(ch?.name || ch?.id || '').trim()).filter(Boolean);
  const fromProfileMap = Object.keys(getProjectDubbingVoiceProfiles(p) || {}).map(s => String(s || '').trim()).filter(Boolean);
  const fromManual = getProjectDubbingVoiceManualRoles(p);
  const fromDubbingText = String(q('dubbingResult')?.value || '').match(/\(([^(\)\n]{1,20})\)/g) || [];
  const fromDubbingNames = fromDubbingText.map(s => s.replace(/[()]/g, '').trim()).filter(Boolean);
  const excluded = getProjectDubbingVoiceExcludedRoles(p);
  const uniq = [...new Set([...fromCast, ...fromProject, ...fromGlobal, ...fromProfileMap, ...fromManual, ...fromDubbingNames])].filter(Boolean).filter(n => !excluded.has(n));
  if(!excluded.has('旁白') && !uniq.includes('旁白')) uniq.push('旁白');
  return uniq;
}

function buildVoiceProfileCard(roleName = '', profile = {}){
  const role = String(roleName || '').trim();
  const preset = inferVoicePresetByName(role);
  const cur = {
    gender: String(profile?.gender || preset.gender || '中性').trim(),
    age: String(profile?.age || preset.age || '青年').trim(),
    tone: String(profile?.tone || preset.tone || '自然叙述').trim(),
    speed: String(profile?.speed || preset.speed || '中速').trim(),
    emotion: String(profile?.emotion || preset.emotion || '克制').trim(),
  };
  return `
    <div class="voice-card" data-role-name="${escapeHtml(role)}" style="border:1px solid rgba(255,255,255,.14);border-radius:12px;padding:12px;background:rgba(15,23,42,.44);">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
        <div style="font-size:14px;font-weight:700;color:#e2e8f0;">${escapeHtml(role)}</div>
        <button type="button" class="btn-ghost" style="padding:4px 10px;font-size:12px;" onclick="resetOneDubbingVoiceProfile('${escapeHtml(role)}')">恢复默认</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-top:10px;">
        <label style="display:flex;flex-direction:column;gap:4px;font-size:12px;color:#94a3b8;">性别
          <input data-field="gender" value="${escapeHtml(cur.gender)}" placeholder="女声/男声/中性" oninput="onDubbingVoiceFieldInput('${escapeHtml(role)}', this)" style="border-radius:8px;border:1px solid rgba(255,255,255,.16);background:rgba(2,6,23,.56);color:#f8fafc;padding:7px 8px;" />
        </label>
        <label style="display:flex;flex-direction:column;gap:4px;font-size:12px;color:#94a3b8;">年龄感
          <input data-field="age" value="${escapeHtml(cur.age)}" placeholder="青年/中年" oninput="onDubbingVoiceFieldInput('${escapeHtml(role)}', this)" style="border-radius:8px;border:1px solid rgba(255,255,255,.16);background:rgba(2,6,23,.56);color:#f8fafc;padding:7px 8px;" />
        </label>
        <label style="display:flex;flex-direction:column;gap:4px;font-size:12px;color:#94a3b8;">音色风格
          <input data-field="tone" value="${escapeHtml(cur.tone)}" placeholder="新闻播报/纪录片旁白" oninput="onDubbingVoiceFieldInput('${escapeHtml(role)}', this)" style="border-radius:8px;border:1px solid rgba(255,255,255,.16);background:rgba(2,6,23,.56);color:#f8fafc;padding:7px 8px;" />
        </label>
        <label style="display:flex;flex-direction:column;gap:4px;font-size:12px;color:#94a3b8;">语速
          <input data-field="speed" value="${escapeHtml(cur.speed)}" placeholder="中速偏快" oninput="onDubbingVoiceFieldInput('${escapeHtml(role)}', this)" style="border-radius:8px;border:1px solid rgba(255,255,255,.16);background:rgba(2,6,23,.56);color:#f8fafc;padding:7px 8px;" />
        </label>
        <label style="display:flex;flex-direction:column;gap:4px;font-size:12px;color:#94a3b8;">情绪底色
          <input data-field="emotion" value="${escapeHtml(cur.emotion)}" placeholder="冷静/紧绷/温暖" oninput="onDubbingVoiceFieldInput('${escapeHtml(role)}', this)" style="border-radius:8px;border:1px solid rgba(255,255,255,.16);background:rgba(2,6,23,.56);color:#f8fafc;padding:7px 8px;" />
        </label>
      </div>
    </div>
  `;
}

function renderDubbingVoiceProfiles(){
  const project = String(latestOutlineProject || currentProjectName || getProject() || '').trim();
  const grid = q('dubbingVoiceGrid');
  const meta = q('dubbingVoiceMeta');
  if(!grid) return;
  if(!project){
    grid.innerHTML = '<div class="meta">请先在剧本页选择并加载项目。</div>';
    if(meta) meta.textContent = '未选择项目';
    return;
  }

  const names = collectDubbingRoleNames(project);
  const profileMap = getProjectDubbingVoiceProfiles(project);
  if(!names.length){
    grid.innerHTML = '<div class="meta">未识别到角色，直接在上方输入“角色名：提示词”即可创建。</div>';
    if(meta) meta.textContent = `项目：${project} · 0 个角色`;
    return;
  }

  const rows = names.map((name, i) => {
    const p = profileMap[name] || inferVoicePresetByName(name);
    const storedLine = getProjectDubbingVoicePromptLine(project, name);
    const line = storedLine || buildVoiceProfilePromptLine(name, p);
    const design = getProjectDubbingVoiceDesign(project, name);
    const designed = !!String(design?.voiceId || design?.voice || '').trim();
    const updatedAt = String(design?.updatedAt || '').trim();
    const updateText = updatedAt ? ` · ${new Date(updatedAt).toLocaleString()}` : '';
    const badge = designed ? `已设计${updateText}` : '未设计';
    return `
      <div style="display:flex;flex-direction:column;gap:6px;padding:8px 0;border-bottom:1px dashed rgba(255,255,255,.12);">
        <div style="display:flex;gap:8px;align-items:center;">
          <div class="meta" style="width:28px;flex:0 0 28px;text-align:right;">${i+1}.</div>
          <div style="width:88px;flex:0 0 88px;font-size:13px;color:#cbd5e1;font-weight:600;">${escapeHtml(name)}</div>
          <input data-role="${escapeHtml(name)}" value="${escapeHtml(line)}" oninput="onDubbingVoicePromptLineInput(this)" placeholder="角色：音色描述" style="flex:1;min-width:220px;border-radius:8px;border:1px solid rgba(255,255,255,.16);background:rgba(2,6,23,.56);color:#f8fafc;padding:7px 8px;" />
          <button type="button" class="btn-ghost" style="padding:4px 10px;font-size:12px;" onclick="designDubbingVoiceForRole('${escapeHtml(name)}', this)">设计音色</button>
          <button type="button" class="btn-ghost" style="padding:4px 10px;font-size:12px;" onclick="previewDubbingVoiceForRole('${escapeHtml(name)}', this)">试听</button>
          <button type="button" class="btn-ghost" style="padding:4px 10px;font-size:12px;" onclick="removeDubbingVoiceRole('${escapeHtml(name)}')">删除</button>
        </div>
        <div class="meta" style="margin-left:124px;">${badge}</div>
      </div>
    `;
  }).join('');

  grid.innerHTML = `<div style="border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:6px 12px;background:rgba(2,6,23,.22);">${rows}</div>`;
  if(meta) meta.textContent = `项目：${project} · 已生成 ${names.length} 个角色音色（提示词单行可改）`;
}

function onDubbingVoiceFieldInput(roleName = '', inputEl = null){
  const project = String(latestOutlineProject || currentProjectName || getProject() || '').trim();
  const role = String(roleName || '').trim();
  const field = String(inputEl?.getAttribute('data-field') || '').trim();
  if(!project || !role || !field) return;

  const map = getProjectDubbingVoiceProfiles(project);
  const old = map[role] && typeof map[role] === 'object' ? map[role] : inferVoicePresetByName(role);
  const next = {
    gender: String(old.gender || '').trim(),
    age: String(old.age || '').trim(),
    tone: String(old.tone || '').trim(),
    speed: String(old.speed || '').trim(),
    emotion: String(old.emotion || '').trim(),
  };
  next[field] = String(inputEl?.value || '').trim();
  setProjectRoleVoiceProfile(project, role, next);
}

function onDubbingVoicePromptLineInput(inputEl = null){
  const project = String(latestOutlineProject || currentProjectName || getProject() || '').trim();
  const role = String(inputEl?.getAttribute('data-role') || '').trim();
  const line = String(inputEl?.value || '').trim();
  if(!project || !role) return;
  addProjectDubbingVoiceManualRole(project, role);
  setProjectDubbingVoiceRoleExcluded(project, role, false);
  setProjectDubbingVoicePromptLine(project, role, line);
  if(!line) return;
  const body = line.includes('：') || line.includes(':') ? line.replace(/^([^：:]{1,24})[：:]/, '').trim() : line;
  const profile = parseVoicePromptToProfile(body, role);
  setProjectRoleVoiceProfile(project, role, profile);
}

function addDubbingVoiceRole(){
  const project = String(latestOutlineProject || currentProjectName || getProject() || '').trim();
  if(!project){ setStatus('请先选择项目', false); return; }
  const inputEl = q('dubbingVoiceRoleNameInput');
  const role = String(inputEl?.value || '').trim();
  if(!role){ setStatus('请先输入角色名', false); return; }
  addProjectDubbingVoiceManualRole(project, role);
  setProjectDubbingVoiceRoleExcluded(project, role, false);
  const existing = getProjectDubbingVoiceProfiles(project)?.[role];
  if(!existing) setProjectRoleVoiceProfile(project, role, inferVoicePresetByName(role));
  if(inputEl) inputEl.value = '';
  renderDubbingVoiceProfiles();
  setStatus(`已添加角色：${role}`);
}

function removeDubbingVoiceRole(roleName = ''){
  const project = String(latestOutlineProject || currentProjectName || getProject() || '').trim();
  const role = String(roleName || '').trim();
  if(!project || !role) return;
  setProjectDubbingVoiceRoleExcluded(project, role, true);
  removeProjectDubbingVoiceManualRole(project, role);
  setProjectRoleVoiceProfile(project, role, null);
  renderDubbingVoiceProfiles();
  setStatus(`已删除角色：${role}`);
}

function resetOneDubbingVoiceProfile(roleName = ''){
  const project = String(latestOutlineProject || currentProjectName || getProject() || '').trim();
  const role = String(roleName || '').trim();
  if(!project || !role) return;
  setProjectRoleVoiceProfile(project, role, inferVoicePresetByName(role));
  renderDubbingVoiceProfiles();
}

function resetDubbingVoiceProfiles(){
  const project = String(latestOutlineProject || currentProjectName || getProject() || '').trim();
  if(!project){ setStatus('请先选择项目', false); return; }
  const names = collectDubbingRoleNames(project);
  names.forEach(name => setProjectRoleVoiceProfile(project, name, inferVoicePresetByName(name)));
  renderDubbingVoiceProfiles();
  setStatus(`已重置 ${names.length} 个角色音色`);
}

function buildVoiceProfilePromptLine(roleName = '', profile = {}){
  const role = String(roleName || '').trim();
  if(!role) return '';
  const p = profile && typeof profile === 'object' ? profile : inferVoicePresetByName(role);
  const parts = [];
  const age = String(p?.age || '').trim();
  if(age) parts.push(`${age}`);
  const gender = String(p?.gender || '').trim();
  if(gender) parts.push(`${gender}`);
  const tone = String(p?.tone || '').trim();
  if(tone) parts.push(`音色风格偏${tone}`);
  const speed = String(p?.speed || '').trim();
  if(speed) parts.push(`语速${speed}`);
  const emotion = String(p?.emotion || '').trim();
  if(emotion) parts.push(`情绪底色${emotion}`);
  return `${role}：${parts.join('，')}`;
}

function normalizeVoiceFieldValue(field = '', value = ''){
  const f = String(field || '').trim();
  const v = String(value || '').trim();
  if(!v) return '';
  if(f === 'gender'){
    if(/女|女生|女性|少女|御姐|甜妹/.test(v)) return '女声';
    if(/男|男生|男性|少年|大叔/.test(v)) return '男声';
    if(/中性|不分男女/.test(v)) return '中性';
  }
  if(f === 'speed'){
    if(/很?快|偏快|快一点|快些|急促/.test(v)) return '中速偏快';
    if(/很?慢|偏慢|慢一点|慢些/.test(v)) return '中速偏慢';
    if(/中速|适中|正常/.test(v)) return '中速';
  }
  return v;
}

function parseVoicePromptToProfile(text = '', roleName = ''){
  const raw = String(text || '').replace(/。/g, '，').replace(/[;；]/g, '，');
  const profile = inferVoicePresetByName(roleName);

  const ageMatch = raw.match(/(\d{1,2})\s*岁/);
  if(ageMatch){
    const ageNum = Number(ageMatch[1]);
    if(Number.isFinite(ageNum)){
      if(ageNum <= 16) profile.age = `${ageNum}岁（少年）`;
      else if(ageNum <= 28) profile.age = `${ageNum}岁（青年）`;
      else if(ageNum <= 45) profile.age = `${ageNum}岁（中年）`;
      else profile.age = `${ageNum}岁（成熟）`;
    }
  } else if(/青年|中年|少年|幼年|老年|成熟/.test(raw)){
    const m = raw.match(/青年|中年|少年|幼年|老年|成熟/);
    if(m) profile.age = m[0];
  }

  if(/女|女生|女性|少女|御姐|甜妹/.test(raw)) profile.gender = '女声';
  else if(/男|男生|男性|少年音|大叔音/.test(raw)) profile.gender = '男声';
  else if(/中性|不分男女/.test(raw)) profile.gender = '中性';

  if(/台湾|台妹|台腔/.test(raw)){
    const currentTone = String(profile.tone || '').trim();
    profile.tone = currentTone ? `${currentTone}（台湾腔）` : '台湾腔';
  }

  if(/新闻|播报|主播/.test(raw)) profile.tone = '新闻播报';
  else if(/纪录片|旁白|解说/.test(raw)) profile.tone = '纪录片旁白';
  else if(/甜|软萌|少女感/.test(raw)) profile.tone = '甜美少女';
  else if(/冷|冷峻|克制/.test(raw)) profile.tone = '冷静克制';

  if(/很?快|偏快|快一点|快些|急促/.test(raw)) profile.speed = '中速偏快';
  else if(/很?慢|偏慢|慢一点|慢些/.test(raw)) profile.speed = '中速偏慢';
  else if(/中速|适中|正常/.test(raw)) profile.speed = '中速';

  if(/甜|温柔|治愈|亲和/.test(raw)) profile.emotion = '温暖甜美';
  else if(/专业|克制|理性/.test(raw)) profile.emotion = '专业克制';
  else if(/紧张|焦虑|压迫|紧绷/.test(raw)) profile.emotion = '紧绷';
  else if(/冷静|沉稳/.test(raw)) profile.emotion = '冷静沉稳';

  profile.gender = normalizeVoiceFieldValue('gender', profile.gender);
  profile.speed = normalizeVoiceFieldValue('speed', profile.speed);
  profile.age = String(profile.age || '').trim() || '青年';
  profile.tone = String(profile.tone || '').trim() || '自然叙述';
  profile.emotion = String(profile.emotion || '').trim() || '克制';
  return profile;
}

function setDubbingVoiceStatus(text = '', ok = true){
  const msg = String(text || '').trim();
  if(!msg) return;
  try {
    const el = q('dubbingStatus');
    if(el){
      el.textContent = msg;
      el.className = ok ? 'meta ok' : 'meta err';
    }
  } catch {}
  setStatus(msg, ok);
}

async function designDubbingVoiceForRole(roleName = '', btn = null){
  const project = String(latestOutlineProject || currentProjectName || getProject() || '').trim();
  const role = String(roleName || '').trim();
  if(!project){ setDubbingVoiceStatus('请先选择项目', false); return; }
  if(!role){ setDubbingVoiceStatus('角色名为空，无法设计音色', false); return; }

  const lineInput = document.querySelector(`#dubbingVoiceGrid input[data-role="${CSS.escape(role)}"]`);
  const lineText = String(lineInput?.value || '').trim();
  if(!lineText){ setDubbingVoiceStatus(`请先填写 ${role} 的音色描述`, false); return; }
  const promptText = lineText.includes('：') || lineText.includes(':')
    ? lineText.replace(/^([^：:]{1,24})[：:]/, '').trim()
    : lineText;

  const button = btn || null;
  const oldText = button ? String(button.textContent || '').trim() : '';
  if(button){
    button.disabled = true;
    button.textContent = '设计中...';
  }

  try {
    const base = getBridgeBase();
    const resp = await fetch(`${base}/api/dubbing/voice/design`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project, role, prompt: promptText }),
    });
    const data = await resp.json().catch(() => ({}));
    if(!resp.ok || !data?.ok){
      throw new Error(data?.error || `HTTP ${resp.status}`);
    }

    const voiceId = String(data?.voiceId || data?.voice || data?.id || '').trim();
    const designPayload = {
      voiceId,
      voice: String(data?.voice || '').trim(),
      previewText: String(data?.previewText || '').trim(),
      previewAudioUrl: String(data?.previewAudioUrl || '').trim(),
      model: String(data?.model || '').trim(),
      provider: String(data?.provider || '').trim(),
      ttsModel: String(data?.ttsModel || '').trim(),
      updatedAt: new Date().toISOString(),
      lastPrompt: promptText,
      raw: data,
    };
    setProjectDubbingVoiceDesign(project, role, designPayload);
    renderDubbingVoiceProfiles();

    // 设计成功后自动试听一次（用户要求：点“设计音色”即自动播放）
    if(dubbingVoicePreviewAudio){
      try { dubbingVoicePreviewAudio.pause(); } catch {}
      dubbingVoicePreviewAudio = null;
    }
    if(dubbingVoicePreviewUtterance && window.speechSynthesis){
      try { window.speechSynthesis.cancel(); } catch {}
      dubbingVoicePreviewUtterance = null;
    }

    const autoPreviewAudioUrl = String(data?.previewAudioUrl || '').trim();
    const autoPreviewText = String(data?.previewText || `${role}，您好，这是一段音色试听。`).trim();
    let autoPlayed = false;
    if(autoPreviewAudioUrl){
      dubbingVoicePreviewAudio = new Audio(autoPreviewAudioUrl);
      await dubbingVoicePreviewAudio.play().catch(() => {});
      autoPlayed = true;
    }else if(window.speechSynthesis && window.SpeechSynthesisUtterance){
      const utter = new SpeechSynthesisUtterance(autoPreviewText);
      utter.lang = 'zh-CN';
      utter.rate = 1.05;
      dubbingVoicePreviewUtterance = utter;
      window.speechSynthesis.speak(utter);
      autoPlayed = true;
    }

    setDubbingVoiceStatus(`${role} 音色设计完成${voiceId ? `（${voiceId}）` : ''}${autoPlayed ? '，已自动试听' : ''}`);
  } catch (err) {
    setDubbingVoiceStatus(`音色设计失败（${role}）：${err?.message || err}`, false);
  } finally {
    if(button){
      button.disabled = false;
      button.textContent = oldText || '设计音色';
    }
  }
}

async function previewDubbingVoiceForRole(roleName = '', btn = null){
  const project = String(latestOutlineProject || currentProjectName || getProject() || '').trim();
  const role = String(roleName || '').trim();
  if(!project){ setDubbingVoiceStatus('请先选择项目', false); return; }
  if(!role){ setDubbingVoiceStatus('角色名为空，无法试听', false); return; }

  const design = getProjectDubbingVoiceDesign(project, role) || {};
  const voiceId = String(design?.voiceId || design?.voice || '').trim();
  if(!voiceId){
    setDubbingVoiceStatus(`请先为 ${role} 设计音色`, false);
    return;
  }

  const button = btn || null;
  const oldText = button ? String(button.textContent || '').trim() : '';
  if(button){
    button.disabled = true;
    button.textContent = '试听中...';
  }

  try {
    // 上方“试听”优先播放刚刚设计成功返回的 preview 音频，避免无意义再请求导致 422
    const localDesignedPreviewAudio = String(design?.previewAudioUrl || '').trim();
    const localDesignedPreviewText = String(design?.previewText || `${role}，您好，这是一段音色试听。`).trim();
    if(localDesignedPreviewAudio){
      if(dubbingVoicePreviewAudio){
        try { dubbingVoicePreviewAudio.pause(); } catch {}
        dubbingVoicePreviewAudio = null;
      }
      if(dubbingVoicePreviewUtterance && window.speechSynthesis){
        try { window.speechSynthesis.cancel(); } catch {}
        dubbingVoicePreviewUtterance = null;
      }
      dubbingVoicePreviewAudio = new Audio(localDesignedPreviewAudio);
      await dubbingVoicePreviewAudio.play().catch(() => {});
      setDubbingVoiceStatus(`正在试听 ${role} 的音色（复用已设计音频）`);
      renderDubbingVoiceProfiles();
      return;
    }

    const base = getBridgeBase();
    const resp = await fetch(`${base}/api/dubbing/voice/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project,
        role,
        voiceId,
        text: localDesignedPreviewText,
        reuseDesignedPreview: true,
      }),
    });
    const data = await resp.json().catch(() => ({}));
    if(!resp.ok || !data?.ok){
      throw new Error(data?.error || `HTTP ${resp.status}`);
    }
    const audioUrl = String(data?.audioUrl || data?.url || '').trim();
    const previewText = String(data?.previewText || design?.previewText || `${role}，您好，这是一段音色试听。`).trim();
    const provider = String(data?.provider || data?.model || design?.model || '').trim().toLowerCase();
    const useBrowserTTS = !audioUrl;

    setProjectDubbingVoiceDesign(project, role, {
      ...design,
      voiceId,
      previewAudioUrl: audioUrl,
      previewText,
      updatedAt: new Date().toISOString(),
    });

    if(dubbingVoicePreviewAudio){
      try { dubbingVoicePreviewAudio.pause(); } catch {}
      dubbingVoicePreviewAudio = null;
    }
    if(dubbingVoicePreviewUtterance && window.speechSynthesis){
      try { window.speechSynthesis.cancel(); } catch {}
      dubbingVoicePreviewUtterance = null;
    }

    if(useBrowserTTS && window.speechSynthesis){
      const utter = new SpeechSynthesisUtterance(previewText || `${role}，您好，这是一段音色试听。`);
      utter.lang = 'zh-CN';
      utter.rate = 1.05;
      dubbingVoicePreviewUtterance = utter;
      window.speechSynthesis.speak(utter);
      setDubbingVoiceStatus(`正在试听 ${role} 的音色（浏览器预览）`);
    }else{
      if(!audioUrl) throw new Error('后端未返回可播放音频地址');
      dubbingVoicePreviewAudio = new Audio(audioUrl);
      await dubbingVoicePreviewAudio.play().catch(() => {});
      setDubbingVoiceStatus(`正在试听 ${role} 的音色`);
    }

    renderDubbingVoiceProfiles();
  } catch (err) {
    setDubbingVoiceStatus(`试听失败（${role}）：${err?.message || err}`, false);
  } finally {
    if(button){
      button.disabled = false;
      button.textContent = oldText || '试听';
    }
  }
}

function applyDubbingVoicePrompt(){
  const project = String(latestOutlineProject || currentProjectName || getProject() || '').trim();
  if(!project){ setStatus('请先选择项目', false); return; }
  const inputEl = q('dubbingVoicePromptInput');
  const raw = String(inputEl?.value || '').trim();
  if(!raw){ setStatus('请先输入音色提示词', false); return; }

  const lines = raw.split(/\n+/).map(s => s.trim()).filter(Boolean);
  if(!lines.length){ setStatus('提示词为空', false); return; }

  let hit = 0;
  let genericApplied = 0;
  const roleNames = collectDubbingRoleNames(project);

  lines.forEach(line => {
    const m = line.match(/^([^：:]{1,24})[：:](.+)$/);
    if(m){
      const role = String(m[1] || '').trim();
      const prompt = String(m[2] || '').trim();
      if(!role || !prompt) return;
      const profile = parseVoicePromptToProfile(prompt, role);
      setProjectRoleVoiceProfile(project, role, profile);
      hit += 1;
      return;
    }

    if(!roleNames.length) return;
    roleNames.forEach(role => {
      const profile = parseVoicePromptToProfile(line, role);
      setProjectRoleVoiceProfile(project, role, profile);
      genericApplied += 1;
    });
  });

  if(!hit && !genericApplied){
    setStatus('未识别到有效提示词，请按“角色名：描述”逐行输入，或输入一行通用描述', false);
    return;
  }

  renderDubbingVoiceProfiles();
  setStatus(`已一键设置音色：角色定向 ${hit} 条，通用覆盖 ${genericApplied} 个角色`);
}

async function copyDubbingVoiceProfiles(){
  const project = String(latestOutlineProject || currentProjectName || getProject() || '').trim();
  if(!project){ setStatus('请先选择项目', false); return; }
  const names = collectDubbingRoleNames(project);
  const map = getProjectDubbingVoiceProfiles(project);
  const lines = [
    `项目：${project}`,
    '音色设计：',
    ...names.map((name, i) => {
      const p = map[name] || inferVoicePresetByName(name);
      const promptLike = buildVoiceProfilePromptLine(name, p);
      return `${i+1}. ${promptLike || `${name}：性别${p.gender || '-'}，年龄感${p.age || '-'}，音色${p.tone || '-'}，语速${p.speed || '-'}，情绪${p.emotion || '-'}`}`;
    })
  ];
  const text = lines.join('\n');
  try {
    if(navigator?.clipboard?.writeText){
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setStatus('已复制音色设定');
  } catch (err) {
    setStatus(`复制音色设定失败：${err?.message || err}`, false);
  }
}

function persistProjectDubbingDraftFromUi(){
  const project = String(latestOutlineProject || currentProjectName || getProject() || '').trim();
  if(!project) return;
  const outputEl = q('dubbingResult');
  const text = String(outputEl?.value || '').trim();
  setProjectDubbingResultDraft(project, text);
}

function restoreProjectDubbingDraftToUi(force = false){
  const project = String(latestOutlineProject || currentProjectName || getProject() || '').trim();
  if(!project) return;
  const outputEl = q('dubbingResult');
  if(!outputEl) return;
  const current = String(outputEl.value || '').trim();
  const saved = getProjectDubbingResultDraft(project);

  if(force){
    outputEl.value = saved || '';
    const statusEl = q('dubbingStatus');
    if(statusEl){
      statusEl.textContent = saved
        ? '已恢复本项目上次保存的配音稿草稿'
        : '等待分析（将直接使用左侧剧本内容）';
    }
    if(typeof renderDubbingListEditorFromText === 'function') renderDubbingListEditorFromText(outputEl.value || '');
    return;
  }

  if(!current && saved){
    outputEl.value = saved;
    const statusEl = q('dubbingStatus');
    if(statusEl) statusEl.textContent = '已恢复本项目上次保存的配音稿草稿';
  }
  if(typeof renderDubbingListEditorFromText === 'function') renderDubbingListEditorFromText(outputEl.value || '');
}

async function oneClickAnalyzeScriptForDubbing(){
  const project = latestOutlineProject || currentProjectName || getProject();
  const btn = q('analyzeDubbingBtn');
  const statusEl = q('dubbingStatus');
  const outputEl = q('dubbingResult');
  const segments = collectSegmentsForDubbing();

  if(!segments.length){
    if(statusEl) statusEl.textContent = '未找到可分析的剧本内容，请先加载项目并生成分镜';
    setStatus('配音分析失败：没有可用分镜', false);
    return;
  }

  if(btn) btn.disabled = true;
  if(statusEl) statusEl.textContent = `正在分析 ${segments.length} 段剧本…`;

  try {
    let result = '';
    if(typeof requestChatCompletion === 'function'){
      const brief = segments.map(s => ({ sid: s.sid, script: s.script })).slice(0, 120);
      const prompt = [
        '你是影视配音编剧助手。',
        '请把给定剧本片段改写为可直接配音的“角色对话稿”。',
        '硬性要求：',
        '1) 每句都用“A/B/C...”作为说话人前缀，可附角色名，例如 A(张三)。',
        '2) 每句必须包含语气，例如：生气地说、疑惑地说、平静地说、兴奋地说。',
        '3) 输出格式严格为：A(角色)语气地说：台词',
        '4) 保持剧情语义，不要胡编新剧情，不要输出解释。',
        '5) 若出现“黑猫记者/龙虾助手”，必须保持该角色设定，不得改成其他人名。',
        '6) 必须基于左侧剧本/分镜当前内容生成，禁止混入历史项目角色与剧情。',
        '7) 禁止输出“苏甜”“赫连城”；如必须指代对应人物，请使用“黑猫记者”“龙虾助手”。',
        `项目：${project || '未命名项目'}`,
        `片段数据：${JSON.stringify(brief)}`
      ].join('\n');

      const reply = await requestChatCompletion(prompt, {
        preferredModel: 'custom-154-12-46-107/gpt-5.3-codex',
        fallbackModel: 'custom-154-12-46-107/gpt-5.4',
        temperature: 0.4,
      });
      result = sanitizeDubbingOutput(String(reply || '').trim());
    }

    if(!result){
      result = formatDubbingByRule(project, segments);
    }

    result = sanitizeDubbingOutput(result);
    if(outputEl) outputEl.value = result || '';
    persistProjectDubbingDraftFromUi();
    if(statusEl) statusEl.textContent = `分析完成：已生成 ${segments.length} 段配音稿（已保存草稿）`;
    setStatus('配音稿生成完成（已保存草稿）');
  } catch (err) {
    const fallback = sanitizeDubbingOutput(formatDubbingByRule(project, segments));
    if(outputEl) outputEl.value = fallback || '';
    persistProjectDubbingDraftFromUi();
    if(statusEl) statusEl.textContent = `分析接口异常，已使用本地规则生成并保存草稿：${err?.message || err}`;
    setStatus(`配音分析异常，已回退本地生成并保存草稿：${err?.message || err}`, false);
  } finally {
    if(btn) btn.disabled = false;
  }
}

async function copyDubbingResult(){
  const text = String(q('dubbingResult')?.value || '').trim();
  const statusEl = q('dubbingStatus');
  if(!text){
    if(statusEl) statusEl.textContent = '暂无可复制内容';
    setStatus('复制失败：配音稿为空', false);
    return;
  }

  try {
    if(navigator?.clipboard?.writeText){
      await navigator.clipboard.writeText(text);
    } else {
      const ta = q('dubbingResult');
      if(ta){
        ta.focus();
        ta.select();
        document.execCommand('copy');
      }
    }
    if(statusEl) statusEl.textContent = '已复制配音稿到剪贴板';
    setStatus('已复制配音稿');
  } catch (err) {
    if(statusEl) statusEl.textContent = `复制失败：${err?.message || err}`;
    setStatus(`复制失败：${err?.message || err}`, false);
  }
}

function toggleOutlinePanel(show = true){
  const panel = q('outlinePanelWrap');
  const other = q('characterPanelWrap');
  if(!panel) return;

  if(show){
    if(other){ other.classList.remove('panel-expanded', 'panel-overlay-mode'); other.classList.add('panel-hidden'); }
    panel.classList.remove('panel-hidden');
    panel.classList.add('panel-expanded', 'panel-overlay-mode');
    setPanelModalState(true);
  } else {
    panel.classList.remove('panel-expanded', 'panel-overlay-mode');
    panel.classList.add('panel-hidden');
    setPanelModalState(false);
  }
}

async function toggleCharacterPanel(show = true){
  const panel = q('characterPanelWrap');
  const other = q('outlinePanelWrap');
  if(!panel) return;

  if(show){
    if(other){ other.classList.remove('panel-expanded', 'panel-overlay-mode'); other.classList.add('panel-hidden'); }

    // 默认自动刷新全局角色库，不需要手动点按钮
    try {
      await loadGlobalCharacterLibrary(true);
      renderCharacters(currentProjectCharacters, currentProjectName || getProject());
    } catch {}

    panel.classList.remove('panel-hidden');
    panel.classList.add('panel-expanded', 'panel-overlay-mode');
    setPanelModalState(true);
  } else {
    panel.classList.remove('panel-expanded', 'panel-overlay-mode');
    panel.classList.add('panel-hidden');
    setPanelModalState(false);
  }
}

function applyManualSegmentsToPreviewRows(segments = []){
  const normalized = normalizeSegments(segments).map((seg, idx) => {
    const sid = String(seg.segmentId || seg.id || `S${String(idx + 1).padStart(2, '0')}`).trim();
    return {
      ...seg,
      id: sid,
      segmentId: sid,
      durationSec: Number(seg.durationSec || 0) || undefined,
      scene: String(seg.scene || '').trim(),
      visual: String(seg.visual || seg.action || '').trim(),
      action: String(seg.action || seg.visual || '').trim(),
      dialogue: String(seg.dialogue || '').trim(),
    };
  });

  if(!normalized.length){
    setStatus('未解析到有效分段，无法写入表格', false);
    return false;
  }

  const project = (latestRenderContext && latestRenderContext.project)
    ? latestRenderContext.project
    : (latestOutlineProject || currentProjectName || getProject() || 'manual-segments');

  // 按项目持久化，刷新后仍可恢复到下方表格
  setProjectManualSegments(project, normalized);

  // 没有项目上下文时，也允许用空映射直接渲染出表格
  const ctx = latestRenderContext || {
    project,
    promptMap: {},
    bindingMap: {},
    videoMap: {},
    multiShotMap: {},
    videoPromptMap: {},
    grid4ImageMap: {},
  };

  latestOutlineProject = project;
  latestOutlineSegments = normalized.slice();

  render(
    project,
    normalized,
    ctx.promptMap || {},
    ctx.bindingMap || {},
    ctx.videoMap || {},
    ctx.multiShotMap || {},
    ctx.videoPromptMap || {},
    ctx.grid4ImageMap || {}
  );

  setStatus(`已将 AI 分段写入表格：${normalized.length} 段`);
  return true;
}

document.addEventListener('keydown', (e)=>{
  if(e.key === 'Escape'){
    closeOutlineZoom({target:{id:'outlineZoom'}}, true);
    closeLightbox({target:{id:'lightbox'}}, true);
    closeVideoBox({target:{id:'videobox'}}, true);
  }
  if(q('lightbox').classList.contains('show')){
    if(e.key === 'ArrowLeft') lightboxPrev(e);
    if(e.key === 'ArrowRight') lightboxNext(e);
  }
});

(function init(){
  fillChatConfigUi();
  loadChat();
  renderChat();
  refreshEditModeUi();

  const blocker = q('uiBlocker');
  if(blocker){
    blocker.addEventListener('click', (e)=>{
      e.preventDefault();
      e.stopPropagation();
      // 模态交互：必须点击面板内“收起”按钮关闭，不允许点蒙版关闭
    });
  }

  const outlineBox = q('storyOutline');
  if(outlineBox){
    const persistOutlineDraft = ()=>{
      const p = latestOutlineProject || getProject();
      saveStoryOutlineDraft(p, outlineBox.value || '');
    };
    outlineBox.addEventListener('input', persistOutlineDraft);
    outlineBox.addEventListener('change', persistOutlineDraft);
    window.addEventListener('beforeunload', persistOutlineDraft);
  }

  const chatInput = q('chatInput');
  if(chatInput){
    chatInput.addEventListener('keydown', (e)=>{
      if(e.key === 'Enter' && !e.shiftKey){
        e.preventDefault();
        sendChat();
      }
    });
  }

  const dubbingBox = q('dubbingResult');
  if(dubbingBox){
    const persistDubbingDraft = ()=>{ persistProjectDubbingDraftFromUi(); };
    dubbingBox.addEventListener('input', persistDubbingDraft);
    dubbingBox.addEventListener('change', persistDubbingDraft);
    window.addEventListener('beforeunload', persistDubbingDraft);
  }
  if(typeof renderDubbingListEditorFromText === 'function'){
    renderDubbingListEditorFromText(String(dubbingBox?.value || ''));
  }

  discoverProjects().then(()=>{
    const fromQuery = new URL(window.location.href).searchParams.get('project');
    const pick = fromQuery || q('projectSelect').value || 'episode-1-20260320-113900';
    q('projectInput').value = pick;
    loadProject(pick);
  });
})();

let videoGenModalCtx = { project: '', sid: '', button: null, sceneImageUrl: '', tailImageDataUrl: '', tailImageName: '' };

function readVideoGenOptions(){
  try {
    const raw = localStorage.getItem(VIDEO_GEN_OPTIONS_KEY);
    const data = raw ? JSON.parse(raw) : null;
    return data && typeof data === 'object' ? data : {};
  } catch { return {}; }
}

function writeVideoGenOptions(opts = {}){
  try { localStorage.setItem(VIDEO_GEN_OPTIONS_KEY, JSON.stringify(opts || {})); } catch {}
}

function readVideoGenTailImageDraftMap(){
  try {
    const raw = localStorage.getItem(VIDEO_GEN_TAIL_IMAGE_DRAFT_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === 'object' ? data : {};
  } catch { return {}; }
}

function writeVideoGenTailImageDraftMap(map = {}){
  try { localStorage.setItem(VIDEO_GEN_TAIL_IMAGE_DRAFT_KEY, JSON.stringify(map || {})); } catch {}
}

function getVideoGenTailDraft(project = '', sid = ''){
  const p = String(project || '').trim();
  const s = String(sid || '').trim();
  if(!p || !s) return null;
  const map = readVideoGenTailImageDraftMap();
  const row = map?.[p]?.[s];
  if(!row || typeof row !== 'object') return null;
  const dataUrl = String(row.dataUrl || '').trim();
  if(!/^data:image\//i.test(dataUrl)) return null;
  return {
    dataUrl,
    name: String(row.name || '').trim(),
    updatedAt: String(row.updatedAt || '').trim(),
  };
}

function setVideoGenTailDraft(project = '', sid = '', dataUrl = '', name = ''){
  const p = String(project || '').trim();
  const s = String(sid || '').trim();
  if(!p || !s) return;
  const map = readVideoGenTailImageDraftMap();
  if(!map[p] || typeof map[p] !== 'object') map[p] = {};
  const clean = String(dataUrl || '').trim();
  if(!clean){
    if(map[p]){
      delete map[p][s];
      if(Object.keys(map[p]).length === 0) delete map[p];
    }
    writeVideoGenTailImageDraftMap(map);
    return;
  }
  map[p][s] = {
    dataUrl: clean,
    name: String(name || '').trim(),
    updatedAt: new Date().toISOString(),
  };
  writeVideoGenTailImageDraftMap(map);
}

function renderVideoGenTailImagePreview(){
  const box = q('videoGenTailImageBox');
  const hint = q('videoGenTailHint');
  const clearBtn = q('videoGenTailClearBtn');
  const dataUrl = String(videoGenModalCtx?.tailImageDataUrl || '').trim();
  const name = String(videoGenModalCtx?.tailImageName || '').trim();

  if(box){
    if(dataUrl){
      box.innerHTML = `<img src="${escapeHtml(dataUrl)}" alt="尾帧图" loading="lazy" />`;
    } else {
      box.innerHTML = '<div class="video-gen-empty">未上传尾帧图（可选）</div>';
    }
  }
  if(hint){
    hint.textContent = dataUrl
      ? `尾帧图已就绪：${name || '已选择图片'}（将作为 reference_images 的第2张）`
      : '不上传则仅使用首帧图（或纯文生视频）。';
  }
  if(clearBtn) clearBtn.disabled = !dataUrl;
}

async function onVideoGenTailFileChange(input){
  const file = input?.files?.[0];
  if(!file) return;
  const maxBytes = 5 * 1024 * 1024;
  if(file.size > maxBytes){
    setStatus('尾帧图不能超过 5MB', false);
    input.value = '';
    return;
  }
  if(!/^image\//i.test(String(file.type || ''))){
    setStatus('尾帧图仅支持图片格式', false);
    input.value = '';
    return;
  }
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('读取文件失败'));
    reader.readAsDataURL(file);
  }).catch(err => {
    setStatus(`读取尾帧图失败：${err?.message || err}`, false);
    return '';
  });

  if(!dataUrl) return;
  videoGenModalCtx.tailImageDataUrl = dataUrl;
  videoGenModalCtx.tailImageName = String(file.name || '').trim();
  setVideoGenTailDraft(videoGenModalCtx.project, videoGenModalCtx.sid, dataUrl, file.name || '');
  renderVideoGenTailImagePreview();
  input.value = '';
}

function clearVideoGenTailImage(){
  videoGenModalCtx.tailImageDataUrl = '';
  videoGenModalCtx.tailImageName = '';
  setVideoGenTailDraft(videoGenModalCtx.project, videoGenModalCtx.sid, '', '');
  renderVideoGenTailImagePreview();
  const input = q('videoGenTailFile');
  if(input) input.value = '';
}

function getAllowedVideoDurations(model = ''){
  // 当前 pic2api 脚本 generate_video.py 仅支持 4/8/12
  return [4, 8, 12];
}

function getAllowedVideoSizes(model = ''){
  const m = String(model || '').trim();
  // veo3.1-ref 仅支持 16:9（横屏）
  if(/^veo3\.1-ref$/i.test(m)) return ['1024x576'];
  return ['1024x576', '576x1024'];
}

function normalizeVideoSize(model = '', size = '1024x576'){
  const allowed = getAllowedVideoSizes(model);
  const raw = String(size || '1024x576').trim();
  if(allowed.includes(raw)) return raw;
  return allowed[0] || '1024x576';
}

function setVideoGenSizeOptions(model = '', preferredSize = '1024x576'){
  const select = q('videoGenSize');
  const picked = normalizeVideoSize(model, preferredSize);
  if(!select) return picked;
  const allowed = getAllowedVideoSizes(model);
  const labelMap = {
    '1024x576': '1024x576（横屏）',
    '576x1024': '576x1024（竖屏）',
  };
  select.innerHTML = allowed.map(v => `<option value="${v}">${labelMap[v] || v}</option>`).join('');
  select.value = picked;
  return picked;
}

function normalizeVideoDuration(model = '', duration = 8){
  const allowed = getAllowedVideoDurations(model);
  const num = Number(duration || 8);
  if(allowed.includes(num)) return num;
  return allowed.includes(8) ? 8 : allowed[0];
}

function setVideoGenDurationOptions(model = '', preferredDuration = 8){
  const select = q('videoGenDuration');
  if(!select) return normalizeVideoDuration(model, preferredDuration);
  const allowed = getAllowedVideoDurations(model);
  const picked = normalizeVideoDuration(model, preferredDuration);
  select.innerHTML = allowed.map(v => `<option value="${v}">${v}</option>`).join('');
  select.value = String(picked);
  return picked;
}

function readProjectVideoDraftMap(){
  try {
    const raw = localStorage.getItem(PROJECT_VIDEO_DRAFT_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === 'object' ? data : {};
  } catch { return {}; }
}

function readProjectVideoPromptDraftMap(){
  try {
    const raw = localStorage.getItem(PROJECT_VIDEO_PROMPT_DRAFT_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === 'object' ? data : {};
  } catch { return {}; }
}

function readProjectVideoHistoryDeletedMap(){
  try {
    const raw = localStorage.getItem(PROJECT_VIDEO_HISTORY_DELETED_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === 'object' ? data : {};
  } catch { return {}; }
}

function saveProjectVideoHistoryDeletedMap(map = {}){
  try { localStorage.setItem(PROJECT_VIDEO_HISTORY_DELETED_KEY, JSON.stringify(map || {})); } catch {}
}

function buildVideoHistoryDeleteKey(record = {}){
  const taskId = String(record?.taskId || '').trim();
  const url = String(record?.videoUrl || record?.remoteVideoUrl || record?.hdVideoUrl || record?.mediaUrl || '').trim();
  const createdAt = String(record?.createdAt || '').trim();
  const variant = String(record?.variant || '').trim();
  return [taskId, url, createdAt, variant].join('|');
}

function markProjectVideoHistoryDeleted(project = '', sid = '', record = null){
  const p = String(project || '').trim();
  const s = String(sid || '').trim();
  if(!p || !s || !record || typeof record !== 'object') return;
  const key = buildVideoHistoryDeleteKey(record);
  if(!key || key === '|||') return;
  const map = readProjectVideoHistoryDeletedMap();
  if(!map[p] || typeof map[p] !== 'object') map[p] = {};
  if(!Array.isArray(map[p][s])) map[p][s] = [];
  if(!map[p][s].includes(key)) map[p][s].push(key);
  saveProjectVideoHistoryDeletedMap(map);
}

function isProjectVideoHistoryDeleted(project = '', sid = '', record = null){
  const p = String(project || '').trim();
  const s = String(sid || '').trim();
  if(!p || !s || !record || typeof record !== 'object') return false;
  const key = buildVideoHistoryDeleteKey(record);
  if(!key || key === '|||') return false;
  const map = readProjectVideoHistoryDeletedMap();
  const rows = Array.isArray(map?.[p]?.[s]) ? map[p][s] : [];
  return rows.includes(key);
}

function setProjectVideoDraft(project = '', sid = '', record = null){
  const p = String(project || '').trim();
  const s = String(sid || '').trim();
  if(!p || !s) return;
  const map = readProjectVideoDraftMap();
  if(!map[p] || typeof map[p] !== 'object') map[p] = {};
  map[p][s] = record || null;
  try { localStorage.setItem(PROJECT_VIDEO_DRAFT_KEY, JSON.stringify(map)); } catch {}
}

function setProjectVideoPromptDraft(project = '', sid = '', text = ''){
  const p = String(project || '').trim();
  const s = String(sid || '').trim();
  if(!p || !s) return;
  const map = readProjectVideoPromptDraftMap();
  if(!map[p] || typeof map[p] !== 'object') map[p] = {};
  map[p][s] = String(text || '').trim();
  try { localStorage.setItem(PROJECT_VIDEO_PROMPT_DRAFT_KEY, JSON.stringify(map)); } catch {}
}

function getProjectVideoDraft(project = '', sid = ''){
  const p = String(project || '').trim();
  const s = String(sid || '').trim();
  if(!p || !s) return null;
  const map = readProjectVideoDraftMap();
  return map[p] && map[p][s] ? map[p][s] : null;
}

function getProjectVideoPromptDraftMap(project = ''){
  const p = String(project || '').trim();
  if(!p) return {};
  const map = readProjectVideoPromptDraftMap();
  const row = map[p];
  return row && typeof row === 'object' ? row : {};
}

function persistVideoPromptsByRows(project = '', rows = []){
  const p = String(project || '').trim();
  if(!p) return;
  rows.forEach((it) => {
    const sid = String(it?.sid || '').trim();
    if(!sid) return;
    const text = String(it?.promptTextarea?.value || '');
    setProjectVideoPromptDraft(p, sid, text);
  });
}

function collectStoryboardRowsForVideoPromptGen(){
  const rows = [...document.querySelectorAll('#tbody tr')];
  return rows.map((tr, idx) => {
    const sid = String(tr.querySelector('td:nth-child(2) .meta')?.textContent || '').trim();
    const script = String(tr.querySelector('td:nth-child(2) textarea')?.value || '').trim();
    const cast = String(tr.querySelector('td:nth-child(3) .cast-list')?.textContent || '').trim();
    const promptTextarea = tr.querySelector('td:nth-child(6) textarea');
    return { idx, sid, script, cast, promptTextarea };
  }).filter(it => it.sid && it.promptTextarea);
}

function bindManualVideoPromptDraftEvents(project = ''){
  const p = String(project || '').trim();
  if(!p) return;
  const areas = [...document.querySelectorAll('#tbody textarea.video-prompt-input[data-sid]')];
  areas.forEach(area => {
    const sid = String(area.getAttribute('data-sid') || '').trim();
    if(!sid) return;
    const saveNow = () => persistVideoPromptsByRows(p, [{ sid, promptTextarea: area }]);
    area.addEventListener('input', saveNow);
    area.addEventListener('change', saveNow);
    area.addEventListener('blur', saveNow);
  });
}

function setBatchVideoPromptButtonState(running = false, text = ''){
  const btn = q('batchVideoPromptBtn');
  if(!btn) return;
  btn.disabled = !!running;
  btn.textContent = text || (running ? '正在依次生成中…' : '一键生成全部视频提示词');
}

let videoPromptTaskRunning = false;

async function generateAllVideoPrompts(){
  if(videoPromptTaskRunning){
    setStatus('正在生成视频提示词，请等待当前任务完成', false);
    return;
  }
  if(typeof requestChatCompletion !== 'function'){
    setStatus('生成失败：聊天能力未就绪（requestChatCompletion 缺失）', false);
    return;
  }

  const rows = collectStoryboardRowsForVideoPromptGen();
  if(!rows.length){
    setStatus('未找到可生成的视频提示词行', false);
    return;
  }

  const project = String(currentProjectName || latestOutlineProject || getProject() || '未命名项目').trim();
  const total = rows.length;
  let ok = 0;
  let fail = 0;

  try {
    videoPromptTaskRunning = true;
    setBatchVideoPromptButtonState(true, `正在依次生成中… 0/${total}`);
    setStatus(`开始依次生成视频提示词：0/${total}`);
    if(typeof setChatStatus === 'function') setChatStatus(`正在依次生成视频提示词（0/${total}）...`);

    for(let i = 0; i < total; i++){
      const row = rows[i];
      const existingPrompt = String(row.promptTextarea?.value || '').trim();
      const duration = String((latestRenderContext?.segments || []).find(seg => String(seg.segmentId || seg.id || '').trim() === row.sid)?.durationSec || 8).trim();
      const styleRule = (typeof VIDEO_STYLE_RULE === 'string' && VIDEO_STYLE_RULE.trim())
        ? VIDEO_STYLE_RULE.trim()
        : '9:16 竖版，meme漫画风，角色与场景保持统一。';

      const taskPrompt = [
        '你是短视频分镜的视频提示词助手。',
        '请根据给定剧情段，输出一条可直接用于视频生成模型的中文提示词。',
        '硬性要求：',
        '1) 必须是9:16竖版。',
        '2) 严格遵循当前段script，不可改剧情。',
        '3) 必须体现：人物动作、镜头运动/景别、场景环境、光线氛围、情绪节奏。',
        '4) 禁止与剧情冲突、禁止空泛词堆砌。',
        '5) 只返回提示词正文，不要解释，不要代码块。',
        `【项目】${project}`,
        `【段号】${row.sid}`,
        `【建议时长】${duration}秒`,
        `【出场人物】${row.cast || '未标注'}`,
        `【风格约束】${styleRule}`,
        `【剧情段script】${row.script}`,
        existingPrompt ? `【当前草稿（可优化）】${existingPrompt}` : ''
      ].filter(Boolean).join('\n');

      try {
        const reply = await requestChatCompletion(taskPrompt, {
          preferredModel: 'custom-154-12-46-107/gpt-5.3-codex',
          fallbackModel: 'custom-154-12-46-107/gpt-5.4',
          temperature: 0.4,
        });
        const prompt = parsePromptTextFromReply(reply);
        if(!prompt) throw new Error('AI 返回空提示词');
        row.promptTextarea.value = prompt;
        ok += 1;
      } catch (err) {
        fail += 1;
        row.promptTextarea.value = ensureVideoStyle(`8秒短视频，9:16，严格遵循剧情段：${row.script}。人物动作自然，镜头连贯，氛围匹配剧情。`);
      }

      persistVideoPromptsByRows(project, [row]);
      const done = i + 1;
      setBatchVideoPromptButtonState(true, `正在依次生成中… ${done}/${total}`);
      setStatus(`正在依次生成视频提示词：${done}/${total}（已即时保存）`);
      if(typeof setChatStatus === 'function') setChatStatus(`视频提示词生成进度：${done}/${total}（已即时保存）`);
    }

    const summary = `视频提示词生成完成：成功 ${ok} 条，失败 ${fail} 条，共 ${total} 条。`;
    setStatus(summary, fail === 0);
    if(typeof setChatStatus === 'function') setChatStatus(summary, fail === 0);
  } finally {
    videoPromptTaskRunning = false;
    setBatchVideoPromptButtonState(false);
  }
}

function getVideoHistoryRecords(project = '', sid = ''){
  const p = String(project || '').trim();
  const s = String(sid || '').trim();
  if(!p || !s) return [];

  const pool = [];
  const draft = getProjectVideoDraft(p, s);
  if(draft && typeof draft === 'object') pool.push(draft);

  const vm = latestRenderContext?.videoMap || {};
  const row = vm?.[s] || null;
  if(row?.latest && typeof row.latest === 'object') pool.push(row.latest);
  if(Array.isArray(row?.variants)){
    row.variants.forEach(it => { if(it && typeof it === 'object') pool.push(it); });
  }

  const dedup = new Map();
  pool.forEach((it) => {
    const url = String(it?.videoUrl || it?.remoteVideoUrl || it?.hdVideoUrl || it?.mediaUrl || '').trim();
    const key = [String(it?.taskId || '').trim(), url, String(it?.createdAt || '').trim(), String(it?.variant || '').trim()].join('|');
    if(!url && !String(it?.taskId || '').trim()) return;
    if(!dedup.has(key)) dedup.set(key, it);
  });

  return [...dedup.values()].filter((it) => !isProjectVideoHistoryDeleted(p, s, it)).sort((a, b) => {
    const ta = Date.parse(String(a?.createdAt || '')) || 0;
    const tb = Date.parse(String(b?.createdAt || '')) || 0;
    return tb - ta;
  });
}

function isLocalVideoAssetUrl(url = ''){
  const u = String(url || '').trim();
  if(!u) return false;
  return /^\.\/generated\//i.test(u) || /^\/generated\//i.test(u);
}

function removeVideoHistoryRecord(project = '', sid = '', record = null){
  const p = String(project || '').trim();
  const s = String(sid || '').trim();
  if(!p || !s || !record || typeof record !== 'object') return;

  markProjectVideoHistoryDeleted(p, s, record);
  const targetKey = buildVideoHistoryDeleteKey(record);

  if(latestRenderContext && latestRenderContext.project === p){
    const vm = latestRenderContext.videoMap || (latestRenderContext.videoMap = {});
    const row = vm[s] || null;
    if(row){
      const variants = Array.isArray(row.variants) ? row.variants.filter((it) => buildVideoHistoryDeleteKey(it) !== targetKey) : [];
      row.variants = variants;
      if(row.latest && buildVideoHistoryDeleteKey(row.latest) === targetKey){
        row.latest = variants[0] || null;
      }
      if(!row.latest && variants.length) row.latest = variants[0];
      vm[s] = row;
    }
  }

  const draft = getProjectVideoDraft(p, s);
  if(draft && buildVideoHistoryDeleteKey(draft) === targetKey){
    const latest = ((latestRenderContext?.videoMap || {})[s] || {}).latest || null;
    setProjectVideoDraft(p, s, latest && typeof latest === 'object' ? latest : null);
  }
}

async function saveRemoteVideoToLocal({ project = '', sid = '', taskId = '', remoteVideoUrl = '' } = {}){
  const base = getBridgeBase();
  const resp = await fetch(`${base}/api/video/save-local`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project,
      segmentId: sid,
      taskId,
      remoteVideoUrl,
    }),
  });
  const data = await resp.json().catch(()=>({}));
  if(!resp.ok || !data?.ok){
    const msg = data?.error?.message || data?.error?.type || `HTTP ${resp.status}`;
    throw new Error(msg);
  }
  return data;
}

function renderVideoGenHistory(project = '', sid = ''){
  const box = q('videoGenHistory');
  if(!box) return;

  const rows = getVideoHistoryRecords(project, sid);
  // 失败且没有任何视频地址的记录不展示（避免占位噪音）
  const visibleRows = rows.filter((rec) => {
    const url = String(rec?.videoUrl || rec?.remoteVideoUrl || rec?.hdVideoUrl || rec?.mediaUrl || '').trim();
    const local = String(rec?.localVideoUrl || '').trim();
    return !!(url || local);
  });

  if(!visibleRows.length){
    box.innerHTML = '<div class="meta" style="opacity:.78">暂无历史记录</div>';
    return;
  }

  box.innerHTML = visibleRows.map((rec, idx) => {
    const url = String(rec?.videoUrl || rec?.remoteVideoUrl || rec?.hdVideoUrl || rec?.mediaUrl || '').trim();
    const remote = String(rec?.remoteVideoUrl || rec?.hdVideoUrl || rec?.mediaUrl || '').trim();
    const local = isLocalVideoAssetUrl(rec?.videoUrl) ? String(rec?.videoUrl || '').trim() : (isLocalVideoAssetUrl(rec?.localVideoUrl) ? String(rec?.localVideoUrl || '').trim() : '');
    const state = String(rec?.status || '').trim() || 'completed';
    const variant = String(rec?.variant || '-').trim();
    const created = String(rec?.createdAt || '').trim();
    const taskId = String(rec?.taskId || '').trim();
    const warning = String(rec?.warning || '').trim();
    const remoteOnly = rec?.downloadLocalOk === false || state === 'remote_only' || /下载本地失败/i.test(warning);
    const prettyState = /^failed|error/i.test(state) ? 'failed' : state;

    const actions = [];
    const previewUrl = local || remote || url;
    if(previewUrl){
      const previewLabel = local ? '预览本地视频' : '在线预览';
      actions.push(`<a href="javascript:void(0)" class="video-link" data-video="${escapeHtml(previewUrl)}" data-sid="${escapeHtml(sid)}">${previewLabel}</a>`);
    }
    if(remote && !local){
      actions.push(`<a href="javascript:void(0)" class="video-link video-save-local" data-remote="${escapeHtml(remote)}" data-task="${escapeHtml(taskId)}">下载到本地</a>`);
    }
    if(remoteOnly && remote){
      actions.push(`<a href="${escapeHtml(remote)}" target="_blank" rel="noopener" class="video-link">远程地址</a>`);
    }

    return `
      <div class="history-item" data-task="${escapeHtml(taskId || '')}">
        <div class="history-item-head" style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <div style="display:flex;align-items:center;gap:8px;min-width:0;">
            <span style="font-weight:700;font-size:13px;">#${visibleRows.length - idx}</span>
            <span class="history-tag ${/^failed|error/i.test(prettyState) ? 'failed' : ''}">${escapeHtml(prettyState)} ${variant ? `｜ ${escapeHtml(variant)}` : ''}</span>
          </div>
          <button type="button" data-role="delete-video-history" data-idx="${idx}" title="删除这条记录" style="border:1px solid rgba(251,113,133,.45);border-radius:999px;background:linear-gradient(180deg,rgba(38,12,20,.95),rgba(17,7,12,.96));color:#fb7185;width:26px;height:26px;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;flex-shrink:0;box-shadow:0 6px 14px rgba(0,0,0,.4);">✕</button>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:8px;">
          <div>
            ${created ? `<div class="meta" style="margin:0">${escapeHtml(created)}</div>` : ''}
            ${taskId ? `<div class="meta" style="margin:0;font-family:monospace;opacity:.66;">${escapeHtml(taskId)}</div>` : ''}
            ${warning ? `<div class="meta" style="margin:2px 0 0;color:#fca5a5;">${escapeHtml(warning)}</div>` : ''}
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">${actions.join('')}</div>
        </div>
      </div>
    `;
  }).join('');

  box.querySelectorAll('a.video-link[data-video]').forEach((a) => {
    a.addEventListener('click', () => {
      openVideoBox(a.getAttribute('data-video') || '', a.getAttribute('data-sid') || '');
    });
  });

  box.querySelectorAll('button[data-role="delete-video-history"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = Number(btn.getAttribute('data-idx') || -1);
      if(!(idx >= 0 && idx < visibleRows.length)) return;
      const target = visibleRows[idx];
      if(!target) return;
      if(!confirm('确认删除这条视频历史吗？（仅从当前项目历史中隐藏，不删除服务器文件）')) return;
      removeVideoHistoryRecord(project, sid, target);
      renderVideoGenHistory(project, sid);
      const statusEl = q('videoGenStatus');
      if(statusEl) statusEl.textContent = '已删除该条历史记录';
    });
  });

  box.querySelectorAll('a.video-save-local').forEach((a) => {
    a.addEventListener('click', async () => {
      const remoteVideoUrl = String(a.getAttribute('data-remote') || '').trim();
      const taskId = String(a.getAttribute('data-task') || '').trim();
      if(!remoteVideoUrl) return;
      const oldText = a.textContent;
      a.textContent = '下载中…';
      a.style.pointerEvents = 'none';
      const statusEl = q('videoGenStatus');
      if(statusEl) statusEl.textContent = '正在下载到本地…';
      try {
        const saved = await saveRemoteVideoToLocal({ project, sid, taskId, remoteVideoUrl });
        const historyRows = getVideoHistoryRecords(project, sid);
        const matched = historyRows.find((x) => String(x?.taskId || '').trim() === taskId && String(x?.remoteVideoUrl || x?.hdVideoUrl || x?.mediaUrl || x?.videoUrl || '').trim() === remoteVideoUrl) || {};
        applyVideoResultToCell(project, sid, {
          taskId: taskId || saved.taskId || '',
          videoUrl: saved.localVideoUrl || saved.videoUrl || '',
          remoteVideoUrl: saved.remoteVideoUrl || remoteVideoUrl,
          createdAt: saved.createdAt || matched?.createdAt || new Date().toISOString(),
          variant: matched?.variant || '',
          status: 'completed',
          statusCode: 200,
          warning: '',
          downloadLocalOk: true,
        });
        renderVideoGenHistory(project, sid);
        if(statusEl) statusEl.textContent = '已下载到本地，可直接本地预览';
      } catch (err) {
        if(statusEl) statusEl.textContent = `下载失败：${err?.message || err}`;
        a.textContent = oldText;
        a.style.pointerEvents = '';
      }
    });
  });
}

function onVideoGenModelChange(){
  const model = q('videoGenModel')?.value || 'sora2-pro';
  const currentDuration = Number(q('videoGenDuration')?.value || 8);
  const currentSize = q('videoGenSize')?.value || '1024x576';
  setVideoGenSizeOptions(model, currentSize);
  setVideoGenDurationOptions(model, currentDuration);
}

function openVideoGenModal(project, sid, button){
  const p = String(project || '').trim();
  const s = String(sid || '').trim();
  if(!p || !s){ setStatus('缺少项目或分段编号', false); return; }
  const row = [...document.querySelectorAll('#tbody tr')].find(tr => String(tr.querySelector('.meta')?.textContent || '').trim() === s);
  const tds = row ? [...row.querySelectorAll('td')] : [];
  const videoPromptText = row ? String(tds[5]?.querySelector('textarea')?.value || '').trim() : '';
  const sceneImageUrl = (latestRenderContext?.bindingMap || {})[s] || '';
  const tailDraft = getVideoGenTailDraft(p, s);
  videoGenModalCtx = {
    project: p,
    sid: s,
    button: button || null,
    sceneImageUrl: sceneImageUrl || '',
    tailImageDataUrl: String(tailDraft?.dataUrl || '').trim(),
    tailImageName: String(tailDraft?.name || '').trim(),
  };
  const previewBox = q('videoGenPreviewImageBox');
  if(previewBox){
    if(sceneImageUrl){
      previewBox.innerHTML = `<img src="${escapeHtml(sceneImageUrl)}" alt="${escapeHtml(s)}" loading="lazy" />`;
    } else {
      previewBox.innerHTML = '<div class="video-gen-empty">当前分段暂无分镜图，生成时将不带首帧参考。</div>';
    }
  }

  const opts = readVideoGenOptions();
  q('videoGenTitle').textContent = `生成视频｜${s}`;
  const modelValue = opts.model || 'sora2-pro';
  q('videoGenModel').value = modelValue;
  setVideoGenSizeOptions(modelValue, opts.size || '1024x576');
  setVideoGenDurationOptions(modelValue, opts.duration || 8);
  // 有首帧图时默认勾选，避免历史本地配置把 imageUrl 意外清空
  q('videoGenUseHead').checked = !!sceneImageUrl;
  q('videoGenHeadHint').textContent = sceneImageUrl
    ? `将使用分镜图作为首帧：${sceneImageUrl}`
    : '当前分段没有分镜图，无法使用首帧';
  q('videoGenUseHead').disabled = !sceneImageUrl;
  renderVideoGenTailImagePreview();
  q('videoGenPrompt').value = videoPromptText;
  q('videoGenApplyAll').checked = !!opts.applyAll;
  q('videoGenStatus').textContent = '空闲';
  q('videoGenSubmitBtn').disabled = false;
  q('videoGenSubmitBtn').textContent = '开始生成';
  renderVideoGenHistory(p, s);
  q('videoGenModal').classList.add('show');
}

function closeVideoGenModal(e, force=false){
  if(force || !e || e.target?.id === 'videoGenModal'){
    q('videoGenModal').classList.remove('show');
  }
}

async function submitVideoGenModal(){
  const ctx = videoGenModalCtx;
  if(!ctx?.project || !ctx?.sid){ return; }
  const prompt = String(q('videoGenPrompt').value || '').trim();
  if(!prompt){ q('videoGenStatus').textContent = '请填写视频提示词'; return; }

  const model = q('videoGenModel').value || 'sora2-pro';
  const size = normalizeVideoSize(model, q('videoGenSize').value || '1024x576');
  q('videoGenSize').value = size;
  const duration = normalizeVideoDuration(model, Number(q('videoGenDuration').value || 8));
  q('videoGenDuration').value = String(duration);
  const useHead = !!q('videoGenUseHead').checked && !q('videoGenUseHead').disabled;
  const applyAll = !!q('videoGenApplyAll').checked;
  const sceneImageUrl = String((latestRenderContext?.bindingMap || {})[ctx.sid] || ctx.sceneImageUrl || '').trim();
  const tailImageDataUrl = String(ctx?.tailImageDataUrl || '').trim();

  writeVideoGenOptions({ model, size, duration, useHead, applyAll });

  q('videoGenSubmitBtn').disabled = true;
  q('videoGenSubmitBtn').textContent = '提交中…';
  q('videoGenStatus').textContent = '提交任务，等待 pic2api 轮询…';

  try {
    const result = await runVideoGenerate({
      project: ctx.project,
      sid: ctx.sid,
      prompt,
      model, size, duration,
      imageUrl: useHead ? sceneImageUrl : '',
      imageTailDataUrl: tailImageDataUrl,
    });

    const doneMsg = result?.downloadLocalOk === false
      ? `完成（仅远程）：${result.videoUrl}${result?.warning ? ` ｜ ${result.warning}` : ''}`
      : `完成：${result.videoUrl}`;
    q('videoGenStatus').textContent = doneMsg;
    applyVideoResultToCell(ctx.project, ctx.sid, result);
    renderVideoGenHistory(ctx.project, ctx.sid);
    setStatus(`视频生成完成 ${ctx.sid}：${result.videoUrl}`, true);
  } catch (err) {
    q('videoGenStatus').textContent = `失败：${err?.message || err}`;
    renderVideoGenHistory(ctx.project, ctx.sid);
    setStatus(`视频生成失败：${err?.message || err}`, false);
  } finally {
    q('videoGenSubmitBtn').disabled = false;
    q('videoGenSubmitBtn').textContent = '开始生成';
  }
}

async function runVideoGenerate({ project, sid, prompt, model, size, duration, imageUrl = '', imageTailDataUrl = '' }){
  const base = getBridgeBase();
  const payload = {
    project,
    segmentId: sid,
    prompt,
    model,
    size,
    duration,
    imageUrl: imageUrl || '',
  };
  const tailData = String(imageTailDataUrl || '').trim();
  if(/^data:image\//i.test(tailData)){
    payload.imageTailDataUrl = tailData;
  }
  const resp = await fetch(`${base}/api/video/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await resp.json().catch(()=>({}));
  if(!resp.ok || !data?.ok){
    const msg = data?.error?.message || data?.error?.type || `HTTP ${resp.status}`;
    throw new Error(msg);
  }
  return data;
}

function applyVideoResultToCell(project, sid, result){
  if(!result?.videoUrl) return;
  const isRemoteOnly = result?.downloadLocalOk === false || /remote_only/i.test(String(result?.status || ''));
  const record = {
    ok: true,
    statusCode: Number(result.statusCode || (isRemoteOnly ? 206 : 200)),
    status: String(result.status || (isRemoteOnly ? 'remote_only' : 'completed')),
    videoId: '',
    taskId: result.taskId || '',
    soraDraftId: '',
    videoUrl: result.videoUrl,
    remoteVideoUrl: result.remoteVideoUrl || '',
    hdVideoUrl: result.remoteVideoUrl || '',
    mediaUrl: result.remoteVideoUrl || '',
    localVideoUrl: result.localVideoUrl || result.videoUrl || '',
    thumbnailUrl: '',
    createdAt: result.createdAt || new Date().toISOString(),
    variant: result.variant || `pic2api/${result.model || 'sora2-pro'}`,
    warning: result.warning || '',
    downloadLocalOk: result.downloadLocalOk !== false,
  };
  setProjectVideoDraft(project, sid, record);

  if(latestRenderContext && latestRenderContext.project === project){
    const vm = latestRenderContext.videoMap || (latestRenderContext.videoMap = {});
    if(!vm[sid]) vm[sid] = { latest: null, variants: [] };
    vm[sid].latest = record;
    vm[sid].variants = vm[sid].variants || [];
    vm[sid].variants.push(record);
  }

  const row = [...document.querySelectorAll('#tbody tr')].find(tr => String(tr.querySelector('.meta')?.textContent || '').trim() === sid);
  if(!row) return;
  const tds = [...row.querySelectorAll('td')];
  const videoTd = tds[7];
  if(!videoTd) return;

  const vWrap = (latestRenderContext?.videoMap || {})[sid] || { latest: record, variants: [record] };
  const latest = vWrap.latest || {};
  const videoRecords = [];
  const seenVideoKeys = new Set();
  const collectVideoRecord = (x = {}, fallbackKey = '') => {
    const localOrPlayable = String(x.videoUrl || '').trim();
    const remote = String(x.remoteVideoUrl || x.hdVideoUrl || x.mediaUrl || '').trim();
    const finalUrl = localOrPlayable || remote;
    if(!finalUrl) return;
    const key = `${String(x.taskId || fallbackKey || '').trim()}|${finalUrl}`;
    if(seenVideoKeys.has(key)) return;
    seenVideoKeys.add(key);
    videoRecords.push({
      url: finalUrl,
      remote,
      variant: String(x.variant || '').trim() || '视频',
    });
  };

  collectVideoRecord(latest, `${sid}-latest`);
  if(Array.isArray(vWrap.variants) && vWrap.variants.length){
    vWrap.variants.slice().reverse().slice(0, 8).forEach((x, i) => collectVideoRecord(x, `${sid}-v${i}`));
  }

  const displayVideoRecords = videoRecords.slice(0, 1);

  let videoCell = '';
  if(displayVideoRecords.length){
    videoCell = `<div style="display:flex;flex-direction:column;gap:10px">${displayVideoRecords.map((rec, i) => {
      const playUrl = rec.url || rec.remote;
      return `<div style="display:flex;flex-direction:column;gap:6px"><div class="meta" style="margin:0">${escapeHtml(rec.variant || `视频${i+1}`)}</div><video preload="metadata" playsinline muted class="thumb video-thumb" data-video="${escapeHtml(playUrl)}" data-sid="${escapeHtml(`${sid}-video-${i+1}`)}" style="width:90px;height:120px;cursor:zoom-in;background:#000" src="${escapeHtml(playUrl)}" title="点击放大播放"></video></div>`;
    }).join('')}</div>`;
  }
  videoCell += `<div style="margin-top:8px"><button class="btn-primary" onclick="openVideoGenModal('${escapeHtml(project)}', '${escapeHtml(sid)}', this)">${videoRecords.length ? '重新生成' : '生成视频'}</button></div>`;

  if(!videoRecords.length){
    videoCell = `<div style="margin-top:8px"><button class="btn-primary" onclick="openVideoGenModal('${escapeHtml(project)}', '${escapeHtml(sid)}', this)">生成视频</button></div>`;
  }

  videoTd.innerHTML = `<div style="display:flex;flex-direction:column;gap:8px">${videoCell}</div>`;

  videoTd.querySelectorAll('a.video-link').forEach(a => {
    a.addEventListener('click', ()=>{
      openVideoBox(a.getAttribute('data-video') || '', a.getAttribute('data-sid') || '');
    });
  });
  videoTd.querySelectorAll('video.video-thumb').forEach(v => {
    v.addEventListener('click', ()=>{
      const url = v.getAttribute('data-video') || v.getAttribute('src') || '';
      const sidKey = v.getAttribute('data-sid') || '';
      if(!url) return;
      openVideoBox(url, sidKey);
    });
  });
}

function setBatchVideoButtonState(running = false, text = ''){
  const btn = q('batchVideoBtn');
  if(!btn) return;
  btn.disabled = !!running;
  btn.textContent = text || (running ? '一键生成中…' : '一键生成全部视频');
}

async function generateAllVideos(){
  const project = String(currentProjectName || getProject() || '').trim();
  if(!project){ setStatus('请先选择并加载项目', false); return; }

  const rows = [...document.querySelectorAll('#tbody tr')];
  if(!rows.length){ setStatus('当前没有可生成视频的行', false); return; }

  const opts = readVideoGenOptions();
  const model = opts.model || 'sora2-pro';
  const size = opts.size || '1024x576';
  const duration = normalizeVideoDuration(model, Number(opts.duration || 8));
  const useHead = opts.useHead !== false;

  let ok = 0, fail = 0;
  setBatchVideoButtonState(true, `一键生成中… 0/${rows.length}`);
  setStatus(`开始一键生成全部视频（${model} ｜ ${size} ｜ ${duration}s）`);

  for(let i = 0; i < rows.length; i++){
    const row = rows[i];
    const sid = String(row.querySelector('.meta')?.textContent || '').trim();
    const tds = [...row.querySelectorAll('td')];
    const prompt = String(tds[5]?.querySelector('textarea')?.value || '').trim();

    if(!sid){ fail += 1; setBatchVideoButtonState(true, `一键生成中… ${i+1}/${rows.length}`); continue; }
    if(!prompt){
      fail += 1;
      setStatus(`跳过 ${sid}：缺少视频提示词`, false);
      setBatchVideoButtonState(true, `一键生成中… ${i+1}/${rows.length}`);
      continue;
    }

    const sceneImageUrl = (latestRenderContext?.bindingMap || {})[sid] || '';
    try {
      const result = await runVideoGenerate({
        project, sid, prompt, model, size, duration,
        imageUrl: useHead ? sceneImageUrl : '',
      });
      applyVideoResultToCell(project, sid, result);
      ok += 1;
    } catch (err) {
      fail += 1;
      setStatus(`${sid} 视频生成失败：${err?.message || err}`, false);
    }
    setBatchVideoButtonState(true, `一键生成中… ${i+1}/${rows.length}`);
  }

  setBatchVideoButtonState(false);
  setStatus(`视频批量生成完成：成功 ${ok}｜失败 ${fail}｜共 ${rows.length}`, fail === 0);
}
