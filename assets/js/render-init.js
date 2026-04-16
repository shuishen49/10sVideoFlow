let latestRenderContext = null;
const PROJECT_MANUAL_SEGMENTS_KEY = 'grok_storyboard_project_manual_segments_v1';
const PROJECT_SEGMENT_CAST_KEY = 'grok_storyboard_project_segment_cast_v1';

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

  const reply = await requestChatCompletion(prompt);
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

async function suggestCastForSegment(button, project, sid){
  const tr = button?.closest?.('tr');
  if(!tr) return;
  const scriptArea = tr.querySelector('td textarea');
  const select = tr.querySelector('select.segment-cast-select');
  if(!select) return;

  const options = collectCastOptions();
  if(!options.length){
    setStatus('暂无可用人物候选，请先在角色设定里准备人物', false);
    return;
  }

  const oldText = button.textContent;
  button.disabled = true;
  button.textContent = 'AI推荐中…';
  try {
    const scriptText = String(scriptArea?.value || '').trim();
    const cast = await aiSuggestSegmentCast(project, sid, scriptText, options);

    [...select.options].forEach(opt => {
      opt.selected = cast.includes(String(opt.value || ''));
    });
    setProjectSegmentCast(project, sid, cast);
    setStatus(`已为 ${sid} 推荐出场人物：${cast.join('、') || '无'}`);
  } catch (err) {
    setStatus(`AI推荐出场人物失败：${err?.message || err}`, false);
  } finally {
    button.disabled = false;
    button.textContent = oldText || 'AI推荐';
  }
}

function onSegmentCastChange(project, sid, selectEl){
  const selected = [...(selectEl?.selectedOptions || [])].map(o => String(o.value || '').trim()).filter(Boolean);
  setProjectSegmentCast(project, sid, selected);
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

function render(project, segments, promptMap, bindingMap, videoMap, multiShotMap = {}, videoPromptMap = {}, grid4ImageMap = {}){
  q('pageTitle').textContent = `${project}｜剧情分段与提示词预览`;
  const tbody = q('tbody');
  tbody.innerHTML = '';

  segments.forEach((seg, idx)=>{
    const sid = String(seg.segmentId || seg.id || `S${String(idx+1).padStart(2,'0')}`);
    const script = composeScript(seg);
    const imagePrompt = promptMap[sid] || defaultImagePrompt(seg);
    const videoPrompt = resolveVideoPrompt(sid, seg, videoPromptMap);
    const img = bindingMap[sid] || '';
    const multiShots = Array.isArray(multiShotMap[sid]) ? multiShotMap[sid] : [];
    const grid4 = grid4ImageMap[sid] || null;
    const vWrap = videoMap[sid] || { latest: {}, variants: [] };
    const v = vWrap.latest || {};

    let videoCell = '<span class="meta">暂无</span>';
    if(v.videoUrl){
      videoCell = `<a href="javascript:void(0)" data-video="${v.videoUrl}" data-sid="${sid}" class="video-link">在线预览</a><div class="meta">status: ${v.status || '-'} ｜ videoDraftId(UUID): ${isUuidLike(v.soraDraftId) ? v.soraDraftId : '-'}</div>`;
    }else if(v.videoId || v.taskId || v.status || v.statusCode || v.soraDraftId){
      videoCell = `<div class="meta">status: ${v.status || '-'} ｜ code: ${v.statusCode ?? '-'}</div><div class="meta">videoDraftId(UUID): ${isUuidLike(v.soraDraftId) ? v.soraDraftId : '-'}</div>`;
    }

    if(Array.isArray(vWrap.variants) && vWrap.variants.length){
      const rows = vWrap.variants.slice().reverse().slice(0, 8).map(x => {
        const links = [];
        if(x.videoUrl) links.push(`<a href="javascript:void(0)" data-video="${x.videoUrl}" data-sid="${sid}-${x.variant || 'video'}" class="video-link">本地</a>`);
        if(x.mediaUrl) links.push(`<a href="${x.mediaUrl}" target="_blank">Grok</a>`);
        if(x.hdVideoUrl) links.push(`<a href="${x.hdVideoUrl}" target="_blank">HD</a>`);
        if(x.thumbnailUrl) links.push(`<a href="${x.thumbnailUrl}" target="_blank">封面</a>`);
        return `<div class="meta" style="margin-top:6px;padding-top:6px;border-top:1px dashed rgba(255,255,255,.12)"><div><b>${x.variant || 'variant'}</b> ｜ ${x.createdAt || '-'} ｜ ${x.status || 'unknown'}</div><div>${links.join(' ｜ ') || '无链接'}</div></div>`;
      }).join('');
      videoCell += `<div class="meta" style="margin-top:6px"><b>视频历史</b></div>${rows}`;
    }

    const qa = scoreVideoRelevance(seg, v);
    const scoreColor = qa.score >= 80 ? '#34d399' : (qa.score >= 60 ? '#fbbf24' : '#f87171');
    const qaCell = `<div style="font-weight:700;color:${scoreColor}">${qa.score} / 100（${qa.level}）</div><div class="meta">${qa.reasons.join('｜')}</div>`;

    const castOptions = collectCastOptions();
    const savedCast = getProjectSegmentCast(project, sid);
    const castOptionsHtml = castOptions.length
      ? castOptions.map(name => `<option value="${escapeHtml(name)}" ${savedCast.includes(name) ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('')
      : '<option value="">（暂无人物）</option>';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx+1}</td>
      <td>
        <div class="meta">${sid}</div>
        <textarea>${script}</textarea>
      </td>
      <td>
        <div class="meta">可手动多选，或让 AI 推荐</div>
        <select class="segment-cast-select" multiple onchange="onSegmentCastChange('${escapeHtml(project)}','${escapeHtml(sid)}', this)">${castOptionsHtml}</select>
        <div style="margin-top:6px">
          <button class="btn-ghost" onclick="suggestCastForSegment(this, '${escapeHtml(project)}', '${escapeHtml(sid)}')">AI推荐</button>
        </div>
      </td>
      <td>
        <div class="img-rule">强约束：9:16 竖版 + 严格遵循当前段 script + 禁止白底棚拍/纯人像/冲突背景。</div>
        <textarea>${imagePrompt}</textarea>
      </td>
      <td>${(() => {
        if(grid4 && grid4.url){
          return `
            <a href="javascript:void(0)" data-img="${grid4.url}" data-sid="${sid}-grid4" class="thumb-link"><img class="thumb" src="${grid4.url}" alt="${sid}-grid4"/></a>
            <div class="meta" style="margin-top:6px">模式：${grid4.mode || 'grid4'}</div>
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
          return `<div class="shot-grid">${shotHtml}</div><div class="meta" style="margin-top:6px">多分镜：${multiShots.length} 张</div>`;
        }
        if(img){
          return `<a href="javascript:void(0)" data-img="${img}" data-sid="${sid}" class="thumb-link"><img class="thumb" src="${img}" alt="${sid}"/></a>`;
        }
        return '<span class="meta">暂无</span>';
      })()}</td>
      <td><div class="img-rule">强约束：Video Prompt 里要直接写清楚具体风格描述，不能只写“保持一致”这类不给模型信息的空话。</div><textarea>${videoPrompt}</textarea></td>
      <td>${durationLabel(seg)}</td>
      <td>${videoCell}</td>
      <td>${qaCell}</td>
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

  // 绑定缩略图点击放大（支持同一行左右切换）
  tbody.querySelectorAll('tr').forEach(tr => {
    const links = [...tr.querySelectorAll('a.thumb-link')];
    if(!links.length) return;
    const list = links.map((lnk, idx) => ({
      url: lnk.getAttribute('data-img') || '',
      caption: lnk.getAttribute('data-sid') || `#${idx+1}`,
    })).filter(x => x.url);

    links.forEach((a, idx) => {
      a.addEventListener('click', ()=>{
        openLightboxAt(list, idx);
      });
    });
  });

  // 绑定视频在线预览
  tbody.querySelectorAll('a.video-link').forEach(a=>{
    a.addEventListener('click', ()=>{
      const url = a.getAttribute('data-video') || '';
      const sid = a.getAttribute('data-sid') || '';
      openVideoBox(url, sid);
    });
  });

  setStatus(`已加载 ${project} ｜ segments: ${segments.length}`);
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

  discoverProjects().then(()=>{
    const fromQuery = new URL(window.location.href).searchParams.get('project');
    const pick = fromQuery || q('projectSelect').value || 'episode-1-20260320-113900';
    q('projectInput').value = pick;
    loadProject(pick);
  });
})();
