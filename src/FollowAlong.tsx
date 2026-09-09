import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Play, Pause, SkipForward, Volume2, Music2, Check, RotateCcw } from 'lucide-react';
import BodyScene from './BodyScene';
import { muscleName } from './domain';
import type { TrainingPlan } from './trainingPlan';
import { buildSession, advanceSession, sessionSample, formatTime, doseValues, type SessionClock, type FollowOptions } from './followSession';
import type { SessionAudio } from './followAudio';

export default function FollowAlong({ plan, options, sessionAudio, onExit }: { plan: TrainingPlan; options: FollowOptions; sessionAudio: SessionAudio; onExit: () => void }) {
  const { cycleSeconds, warmup } = options;
  const stages = useMemo(() => buildSession(plan, { cycleSeconds, warmup }), [plan, cycleSeconds, warmup]);
  const [clock, setClock] = useState<SessionClock>({ index: 0, elapsed: 0, done: false });
  const [status, setStatus] = useState<'loading' | 'running' | 'paused' | 'done'>('loading');
  const [music, setMusic] = useState(true), [coach, setCoach] = useState(true), [volume, setVolume] = useState(.25);
  const [message, setMessage] = useState('');
  const [skipped, setSkipped] = useState(0);
  const [modelReady, setModelReady] = useState(!plan.exercises.length);
  const [view, setView] = useState<'front' | 'side' | 'back'>('side');
  const [reset, setReset] = useState(0);
  const audio = useRef(sessionAudio.player);
  const events = useRef(new Set<string>());
  const clockRef = useRef(clock); clockRef.current = clock;
  const statusRef = useRef(status); statusRef.current = status;
  const alive = useRef(true);
  const stage = stages[clock.index];
  const activeExercise = stage?.exercise ?? plan.exercises[0]?.exercise;
  const isWork = stage?.kind === 'work';
  const showModel = !!activeExercise && (status === 'loading' || ['work', 'prepare', 'switch'].includes(stage?.kind));
  const sample = stage ? sessionSample(stage, clock.elapsed, cycleSeconds) : { completed: 0, rep: 0, remaining: 0, phase: 0 };
  const total = stages.reduce((sum, s) => sum + s.duration, 0);
  const position = stages.slice(0, clock.index).reduce((sum, s) => sum + s.duration, 0) + clock.elapsed;
  const voiceKeys = useMemo(() => [...stages.map(s => s.voice), 'complete', 'resume', 'steady', 'last', ...Array.from({ length: 30 }, (_, i) => `count-${i + 1}`)], [stages]);
  const trainingItems = plan.exercises.map(({ exercise, dose }) => ({ exercise, ...doseValues(dose) }));
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    if (activeExercise) setView(activeExercise.animation?.view ?? (['squat','hinge','row','pushup','crunch','bridge','lunge'].includes(activeExercise.motion ?? '') ? 'side' : 'front'));
  }, [activeExercise?.id]);
  const pause = (reason = '') => { statusRef.current = 'paused'; setStatus('paused'); audio.current?.pause(); setMessage(reason); };
  useEffect(() => {
    const visibility = () => { if (document.hidden && statusRef.current === 'running') pause('已切到后台，跟练自动暂停。回来后点击继续。'); };
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, []);
  useEffect(() => {
    if (status !== 'running') return;
    let frame = 0, last = performance.now(), paint = last;
    const tick = (now: number) => {
      if (statusRef.current !== 'running') return;
      const delta = Math.max(0, (now - last) / 1000); last = now;
      // If the browser stalls, stop instead of silently consuming repetitions.
      if (delta > 1) { pause('页面暂时卡顿，已暂停。准备好后继续。'); return; }
      const next = advanceSession(stages, clockRef.current, delta);
      clockRef.current = next;
      if (next.done) { setClock(next); setStatus('done'); statusRef.current = 'done'; audio.current?.pause(); audio.current?.speak('complete'); return; }
      const current = stages[next.index];
      const once = (id: string, key: string) => { const full = `${next.index}:${id}`; if (!events.current.has(full)) { events.current.add(full); audio.current?.speak(key); } };
      once('entry', current.voice);
      audio.current?.tick(stages.slice(0, next.index).reduce((sum,s) => sum + s.duration,0) + next.elapsed);
      const data = sessionSample(current, next.elapsed, cycleSeconds);
      if (current.kind === 'work' && !current.hold) {
        if (next.elapsed % cycleSeconds > .7) once(`rep-${data.rep}`, `count-${data.rep}`);
        const encouragementRep = Math.max(2, Math.floor(current.reps! / 2));
        if (data.rep === encouragementRep && next.elapsed % cycleSeconds > cycleSeconds / 2) once('steady', 'steady');
        if (data.rep === current.reps! - 1 && next.elapsed % cycleSeconds > cycleSeconds / 2) once('last', 'last');
      } else if (data.remaining <= 3 && data.remaining > 0) once(`countdown-${data.remaining}`, `count-${data.remaining}`);
      if (now - paint >= 32) { setClock({ ...next }); paint = now; }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [status, stages, cycleSeconds]);
  const start = async () => {
    setMessage(''); setStatus('loading');
    try {
      audio.current.music = music; audio.current.coach = coach; audio.current.volume = volume;
      if (music || coach) await audio.current.unlock(coach ? voiceKeys : []);
      if (!alive.current) return;
      if (document.hidden) { setStatus('paused'); setMessage('页面已在后台，回到页面后点击继续。'); return; }
      setStatus('running'); statusRef.current = 'running';
      if (clockRef.current.elapsed > 0) audio.current.speak('resume');
    } catch {
      if (!alive.current) return;
      setStatus('paused');
      setMessage('音频未能加载，请重试；也可以关闭音乐和教练口令后继续。');
    }
  };
  useEffect(() => {
    if (!modelReady) return;
    let cancelled = false;
    const launch = async () => {
      try {
        if (!await sessionAudio.unlocked) throw new Error('Audio unavailable');
        await audio.current.unlock(voiceKeys);
      } catch {
        if (cancelled) return;
        audio.current.setMusic(false); audio.current.setCoach(false);
        setMusic(false); setCoach(false);
        setMessage('音频暂时不可用，已静音开始；可以在声音设置中重新打开。');
      }
      if (cancelled) return;
      if (document.hidden) { pause('页面已在后台，回到页面后点击继续。'); return; }
      setStatus('running'); statusRef.current = 'running';
    };
    void launch();
    return () => { cancelled = true; };
  }, [modelReady, sessionAudio, voiceKeys]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat || (event.target as HTMLElement)?.closest('button, input, select, textarea, a, summary')) return;
      if (status === 'running' || status === 'paused') {
        event.preventDefault();
        if (status === 'running') pause(); else void start();
      }
    };
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  }, [status, music, coach, volume, voiceKeys]);
  const skip = () => {
    audio.current?.pause(); setSkipped(n => n + 1);
    const next = { index: clockRef.current.index + 1, elapsed: 0, done: clockRef.current.index + 1 >= stages.length };
    clockRef.current = next; setClock(next);
    if (next.done) { setStatus('done'); audio.current?.speak('complete'); }
  };
  const restart = () => { audio.current?.pause(); events.current.clear(); setClock({ index: 0, elapsed: 0, done: false }); clockRef.current = { index: 0, elapsed: 0, done: false }; setSkipped(0); setMessage(''); void start(); };
  const exit = () => { audio.current?.dispose(); onExit(); };
  const cue = isWork && activeExercise && !stage.hold ? activeExercise.cues[sample.phase < 28 ? 0 : sample.phase < 65 ? 1 : 2] : stage?.cue;
  return <main className="follow-shell">
    <header className="follow-header"><button onClick={exit}><ArrowLeft size={18} />返回计划</button><div><span>DAYLY / GUIDED TRAINING</span><h1>{plan.title}</h1></div><span className="follow-badge">{status === 'running' ? '跟练中' : status === 'paused' ? '已暂停' : status === 'done' ? '流程结束' : '跟练准备'}</span></header>
    <div className="follow-layout">
      <section className="follow-stage" aria-label="跟练演示">
        {!!activeExercise && <div className={`follow-model ${showModel ? '' : 'concealed'}`}>
          <BodyScene exercise={activeExercise} targets={[]} mode="exercise" playing={false} speed={1} phase={sample.phase}
            controlledPhase={sample.phase} mirrored={stage?.side === 2} view={view} reset={reset} onSelect={() => {}} onPhase={() => {}}
            exportCount={0} onExport={() => {}} showGuides={false} onReady={setModelReady} />
        </div>}
        {showModel && <><div className="follow-view"><span>{activeExercise!.name}</span><div>{(['front','side','back'] as const).map((v,i) => <button key={v} aria-pressed={view === v} onClick={() => setView(v)}>{['正面','侧面','背面'][i]}</button>)}<button aria-label="重置跟练视角" onClick={() => setReset(n => n + 1)}><RotateCcw size={16} /></button></div></div>
          <div className="follow-muscles">{activeExercise!.primary.map(m => <span key={m}>{muscleName(m)}</span>)}<small>红色主练 · 金色辅助</small></div></>}
        {!showModel && status !== 'done' && <div className="follow-intermission"><span>{stage?.kind === 'rest' ? 'RECOVER' : stage?.kind === 'aerobic' ? 'KEEP MOVING' : 'BREATHE'}</span><h2>{stage?.title}</h2><strong>{formatTime(sample.remaining)}</strong><p>{cue}</p>{stage?.kind === 'aerobic' && <small>快走仅提供计时和口令，没有 3D 动画。</small>}</div>}
        {status === 'done' && <div className="follow-intermission"><Check size={40} /><h2>本次跟练流程结束</h2><p>{skipped ? `跳过了 ${skipped} 个环节。` : '已按计划播放所有环节。'}按身体实际完成情况记录训练。</p><small>此处统计演示进度，不检测你是否完成动作。</small><button className="primary-btn" onClick={restart}>再练一次</button></div>}
        {showModel && <div className="follow-cue"><span>{status === 'loading' ? '准备提示' : stage?.kind === 'prepare' ? `准备 · ${sample.remaining} 秒` : stage?.kind === 'switch' ? `换侧 · ${sample.remaining} 秒` : '教练提示'}</span><p>{status === 'loading' ? activeExercise!.cues[0] : cue}</p></div>}
        {status === 'paused' && <div className="follow-pause-overlay"><Pause size={28} /><b>已暂停</b><span>计时、动作与音频已停止</span></div>}
        <div className="follow-transport" aria-label="跟练快捷操作">
          <div className="transport-status">{status === 'loading' ? <><strong>约 {Math.ceil(total / 60)} 分钟</strong><span>计次 · 音乐 · 教练口令</span></> : status === 'done' ? <><strong>流程已结束</strong><span>{skipped ? `跳过 ${skipped} 个环节` : '所有环节播放完毕'}</span></> : <><strong>{isWork && !stage.hold ? `${sample.rep} / ${stage.reps} 次` : formatTime(sample.remaining)}</strong><span>{isWork ? `第 ${stage.set} / ${stage.sets} 组` : stage?.title}</span></>}</div>
          {status === 'loading' ? <div className="auto-start-status" role="status">{modelReady ? '正在准备口令…' : '正在加载模型…'}<small>准备好后自动开始</small></div> : status === 'done' ? <button className="primary-btn" onClick={exit}>返回计划<ArrowLeft size={17} /></button> : <div className="follow-actions"><button className="primary-btn" onClick={() => status === 'running' ? pause() : start()}>{status === 'running' ? <Pause size={18} /> : <Play size={18} />}{status === 'running' ? '暂停' : '继续跟练'}</button><button onClick={skip}><SkipForward size={17} />跳过此环节</button></div>}
        </div>
      </section>
      <aside className="follow-control">
        <section className="follow-primary-info">
        {status === 'loading' ? <>
          <span className="eyebrow">即将开始</span><h2>正在准备你的跟练。</h2>
          <p className="follow-intro">加载完成后自动开始，无需再次点击。{warmup ? '先进行 1 分钟热身，已热身可随时跳过。' : '已跳过热身，接下来直接准备第一个动作。'}</p>
          <p className="follow-estimate">约 {Math.ceil(total / 60)} 分钟 · 每次 {cycleSeconds} 秒</p>
        </> : status !== 'done' ? <>
          <div className="follow-current" aria-live="polite"><span>{stage?.kind === 'work' ? `第 ${stage.set} / ${stage.sets} 组${stage.exercise?.motion === 'lunge' || stage.exercise?.motion === 'loadedLunge' ? ` · 第 ${stage.side} 侧` : ''}` : '当前环节'}</span><h2>{stage?.title}</h2></div>
          <div className="follow-counter">{isWork && !stage.hold ? <><strong>{sample.rep}</strong><span>/ {stage.reps} 次</span></> : <><strong>{formatTime(sample.remaining)}</strong><span>{isWork ? '保持' : '倒计时'}</span></>}</div>
          {isWork && !stage.hold && <p className="rep-status">本组已演示 {sample.completed} 次 · 每次 {cycleSeconds} 秒</p>}
          <progress aria-label="当前环节进度" max={stage?.duration} value={clock.elapsed} />
          {stage?.kind === 'warmup' && <button className="warmup-skip" onClick={skip}><SkipForward size={18} />已热身，直接开始</button>}

          <div className="follow-up-next"><span>接下来</span><b>{stages[clock.index + 1]?.title ?? '完成本次流程'}</b><small>流程剩余约 {Math.ceil((total - position) / 60)} 分钟</small></div>
        </> : <button className="primary-btn" onClick={exit}>返回我的计划<ArrowLeft size={16} /></button>}
        </section>
        <div className="follow-audio"><label><Music2 size={16} />节奏音乐<input type="checkbox" checked={music} onChange={e => { setMusic(e.target.checked); audio.current?.setMusic(e.target.checked); if (e.target.checked && status === 'running') void audio.current?.unlock([]).catch(() => pause('音乐暂时无法播放，准备好后重试。')); }} /></label><label><Volume2 size={16} />中文教练口令<input type="checkbox" checked={coach} disabled={status === 'loading'} onChange={e => { const on = e.target.checked; setCoach(on); audio.current?.setCoach(on); if (on && status === 'running') pause('已打开教练口令，点击继续加载并播放。'); }} /></label><label className="volume-control">音乐音量<input aria-label="音乐音量" type="range" min={0} max={.6} step={.05} value={volume} onChange={e => { const value = Number(e.target.value); setVolume(value); if (audio.current) audio.current.volume = value; }} /></label><small>本地节奏伴奏 · 口令播放时音乐自动降低</small></div>
        {message && <p className="follow-message" role="status">{message}</p>}
        <details className="follow-order" open={false}><summary>本次训练顺序</summary><ol>{trainingItems.map(({ exercise, sets, work, hold }) => <li key={exercise.id}><b>{exercise.name}</b><span>{sets} 组 × {exercise.motion === 'lunge' || exercise.motion === 'loadedLunge' ? '每侧 ' : ''}{work} {hold ? '秒' : '次'}</span></li>)}{plan.aerobic && <li><b>{plan.aerobic.name}</b><span>{plan.aerobic.duration.split('–')[0]} 分钟</span></li>}</ol></details>
        <p className="follow-note">空格键可暂停 / 继续。按自己的能力跟练，动作变形时暂停调整。屏幕次数是演示次数，不代表已检测到你的完成次数。</p>
      </aside>
    </div>
  </main>;
}
