import os
import re
import json
import base64
import wave
import threading
import subprocess
from pathlib import Path

import requests
import dashscope
from dotenv import load_dotenv
from dashscope.audio.qwen_tts_realtime import QwenTtsRealtime, QwenTtsRealtimeCallback, AudioFormat

ROOT = Path(r"C:\Users\Administrator\.openclaw\workspace")
PROJECT = ROOT / r"projects\grok-drama\opc-blackcat-xingxiaoyun-20260327-1955"
OUT = PROJECT / r"outputs\voice\route-a-20260406"
OUT.mkdir(parents=True, exist_ok=True)

SKILL_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(SKILL_ROOT / '.env', override=True)
API_KEY = os.getenv('DASHSCOPE_API_KEY', '').strip()
if not API_KEY:
    raise RuntimeError('Missing DASHSCOPE_API_KEY in qwen-voice-design-dubbing/.env')
dashscope.api_key = API_KEY

TTS_MODEL = 'qwen3-tts-vd-realtime-2026-01-15'

SCRIPT_LINES = [
    ('黑猫记者', '我这两张A4试卷，怎么弄成一张A3啊？'),
    ('小龙虾', '别急，我帮你。'),
    ('黑猫记者', '我发你了。'),
    ('小龙虾', '行，我先给你排一下。'),
    ('黑猫记者', '怎么排？'),
    ('小龙虾', '先把这个A3版面切成两个A4，切割线别压到字。'),
    ('黑猫记者', '哦，位置要准，方向也要对。'),
    ('小龙虾', '对，然后直接按A4把试卷打印出来。'),
    ('黑猫记者', '打印完呢？'),
    ('小龙虾', '你再把两张A4对齐。'),
    ('黑猫记者', '再用透明胶带粘起来？'),
    ('小龙虾', '对，沿中缝贴好就行。'),
    ('黑猫记者', '懂了，这样就成一张A3效果的大试卷了。'),
    ('小龙虾', '没错。'),
]

VOICE_PROMPTS = {
    '黑猫记者': {
        'preferred_name': 'blackcat26',
        'voice_prompt': '26岁年轻女生音色，带明显台湾腔，声线偏萝莉感，清亮甜一点，但不能太幼稚，语气机灵、灵动、反应快，像会采访、会追问的女生。语速偏快，吐字清楚，情绪自然，带一点可爱和俏皮，但整体真实，不要夸张卡通腔，不要播音腔，不要御姐感，不要过于成熟低沉。适合短视频角色对白与轻松对话场景。',
        'preview_text': '你好呀，我是黑猫记者，今天这个问题我来帮你问清楚。',
    },
    '小龙虾': {
        'preferred_name': 'lobsterai',
        'voice_prompt': '年轻男性声音，20到30岁之间，清爽自然，语气稳，像一个聪明、耐心、会解释问题的AI助手。中速偏快，吐字清晰，情绪平和，带一点轻松感，但不要油腻，不要播音腔，不要太严肃，不要太低沉，也不要太夸张搞笑。适合教学解释、步骤说明、短视频对话场景。',
        'preview_text': '别急，我一步一步告诉你，照着做就行。',
    }
}


def slug(s: str) -> str:
    return re.sub(r'[^a-zA-Z0-9_-]+', '_', s)


def pcm_to_wav_bytes(pcm_bytes: bytes, sample_rate: int = 24000) -> bytes:
    from io import BytesIO
    bio = BytesIO()
    with wave.open(bio, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm_bytes)
    return bio.getvalue()


def create_voice(role: str):
    conf = VOICE_PROMPTS[role]
    url = 'https://dashscope.aliyuncs.com/api/v1/services/audio/tts/customization'
    headers = {'Authorization': f'Bearer {API_KEY}', 'Content-Type': 'application/json'}
    payload = {
        'model': 'qwen-voice-design',
        'input': {
            'action': 'create',
            'target_model': TTS_MODEL,
            'voice_prompt': conf['voice_prompt'],
            'preview_text': conf['preview_text'],
            'preferred_name': conf['preferred_name'],
            'language': 'zh',
        },
        'parameters': {
            'sample_rate': 24000,
            'response_format': 'wav'
        }
    }
    r = requests.post(url, headers=headers, json=payload, timeout=120)
    r.raise_for_status()
    data = r.json()
    voice = data['output']['voice']
    audio_b64 = data['output']['preview_audio']['data']
    preview_path = OUT / f'{slug(role)}_preview.wav'
    preview_path.write_bytes(base64.b64decode(audio_b64))
    return {
        'role': role,
        'voice': voice,
        'preview': str(preview_path),
        'tts_model': TTS_MODEL,
    }


class CollectCallback(QwenTtsRealtimeCallback):
    def __init__(self):
        self.complete_event = threading.Event()
        self.audio_chunks = []
        self.error = None

    def on_open(self) -> None:
        pass

    def on_close(self, close_status_code, close_msg) -> None:
        if close_status_code not in (1000, None):
            self.error = f'close code={close_status_code}, msg={close_msg}'
        self.complete_event.set()

    def on_event(self, message) -> None:
        try:
            event_type = message.get('type', '')
            if event_type == 'response.audio.delta':
                self.audio_chunks.append(base64.b64decode(message['delta']))
            elif event_type == 'error':
                self.error = json.dumps(message, ensure_ascii=False)
                self.complete_event.set()
            elif event_type == 'session.finished':
                self.complete_event.set()
        except Exception as e:
            self.error = str(e)
            self.complete_event.set()


def synthesize_line(tts_model: str, voice: str, text: str) -> bytes:
    callback = CollectCallback()
    q = QwenTtsRealtime(
        model=tts_model,
        callback=callback,
        url='wss://dashscope.aliyuncs.com/api-ws/v1/realtime',
    )
    q.connect()
    q.update_session(
        voice=voice,
        response_format=AudioFormat.PCM_24000HZ_MONO_16BIT,
        mode='server_commit'
    )
    q.append_text(text)
    q.finish()
    callback.complete_event.wait(timeout=120)
    try:
        q.close()
    except Exception:
        pass
    if callback.error:
        raise RuntimeError(callback.error)
    pcm = b''.join(callback.audio_chunks)
    if not pcm:
        raise RuntimeError(f'No audio for text: {text}')
    return pcm_to_wav_bytes(pcm, sample_rate=24000)


def main():
    voices = {}
    meta = {'voices': {}, 'lines': []}
    for role in ['黑猫记者', '小龙虾']:
        info = create_voice(role)
        voices[role] = info
        meta['voices'][role] = info
        print(f'VOICE {role}: {info["voice"]}')

    concat_list = OUT / 'concat.txt'
    concat_entries = []

    for idx, (role, text) in enumerate(SCRIPT_LINES, start=1):
        audio_wav = synthesize_line(voices[role]['tts_model'], voices[role]['voice'], text)
        line_path = OUT / f'{idx:02d}_{slug(role)}.wav'
        line_path.write_bytes(audio_wav)
        concat_entries.append(f"file '{line_path.as_posix()}'")
        meta['lines'].append({'index': idx, 'role': role, 'text': text, 'file': str(line_path)})
        print(f'LINE {idx:02d} OK {role}')

    concat_list.write_text('\n'.join(concat_entries) + '\n', encoding='utf-8')
    final_wav = OUT / 'dub_final_all_roles.wav'
    final_mp3 = OUT / 'dub_final_all_roles.mp3'
    subprocess.run(['ffmpeg', '-y', '-f', 'concat', '-safe', '0', '-i', str(concat_list), '-c', 'copy', str(final_wav)], check=True)
    subprocess.run(['ffmpeg', '-y', '-i', str(final_wav), '-codec:a', 'libmp3lame', '-q:a', '2', str(final_mp3)], check=True)
    (OUT / 'meta.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding='utf-8')
    print('FINAL', final_mp3)


if __name__ == '__main__':
    main()
