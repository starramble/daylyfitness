"""Build local Mandarin coaching clips with macOS Tingting. No speech service needed at runtime."""
import json, pathlib, subprocess, tempfile
root = pathlib.Path(__file__).resolve().parents[1]
output = root / 'public/audio/coach'
output.mkdir(parents=True, exist_ok=True)
lines = {
 'warmup-short': '先用一分钟轻松走动，活动肩膀和髋部。如果已经热身，可以直接开始。',
 'warmup': '先热身五分钟，轻松走动，活动关节，让身体慢慢进入状态。',
 'prepare': '准备开始，调整站位，跟上自己的节奏。',
 'go': '开始。', 'rest': '这一组完成了。放松一下，均匀呼吸。',
 'switch': '换另一侧，重新站稳，准备开始。',
 'aerobic': '接下来快走。呼吸加快，但保持能说完整句子的强度。',
 'cooldown': '主要训练结束。轻松走动三分钟，让呼吸慢慢平稳。',
 'complete': '跟练流程结束，做得很好。今天的每一份坚持，都在积累进步。',
 'steady': '保持节奏，动作稳住。', 'last': '最后两次，加油，保持动作质量。',
 'hold': '收紧核心，自然呼吸，稳稳保持。', 'resume': '继续，保持自己的节奏。',
}
for n in range(1, 31): lines[f'count-{n}'] = str(n)
# Exercise name and first setup cue are announced while the model is still preparing.
raw = subprocess.check_output(['./node_modules/.bin/tsx', '-e', 'import {exercises} from "./src/domain.ts";console.log(JSON.stringify(exercises.filter(e=>e.motion).map(e=>({id:e.id,text:`接下来，${e.name}。${e.cues[0]}`}))))'], cwd=root, text=True)
for e in json.loads(raw): lines['exercise-' + e['id']] = e['text']
with tempfile.TemporaryDirectory() as temporary:
 for key, text in lines.items():
  dest = output / (key + '.mp3')
  if dest.exists(): continue
  aiff = pathlib.Path(temporary) / 'voice.aiff'
  subprocess.run(['say', '-v', 'Tingting', '-r', '205', '-o', str(aiff), text], check=True)
  subprocess.run(['/opt/homebrew/bin/ffmpeg', '-y', '-v', 'error', '-i', str(aiff), '-af', 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,apad=pad_dur=0.08', '-ar', '24000', '-ac', '1', '-b:a', '64k', str(dest)], check=True)
(output / 'manifest.json').write_text(json.dumps(lines, ensure_ascii=False, indent=2))
print(f'Generated {len(lines)} coach clips at {output}')
