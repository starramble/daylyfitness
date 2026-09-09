import type { Exercise } from './domain';
import type { TrainingPlan } from './trainingPlan';
export interface FollowOptions { cycleSeconds: 4 | 6; warmup: boolean; }
export type SessionStage = {
  kind: 'warmup' | 'prepare' | 'work' | 'rest' | 'switch' | 'aerobic' | 'cooldown';
  duration: number;
  title: string;
  cue: string;
  voice: string;
  exercise?: Exercise;
  exerciseIndex?: number;
  set?: number;
  sets?: number;
  reps?: number;
  side?: 1 | 2;
  hold?: boolean;
};
export function doseValues(dose: string) {
  const sets = Number(dose.match(/(\d+).*组/)?.[1] ?? 2);
  const work = Number(dose.split('×')[1]?.match(/\d+/)?.[0] ?? 8);
  return { sets, work, hold: dose.includes('秒') };
}
export function buildSession(plan: TrainingPlan, options: FollowOptions): SessionStage[] {
  const stages: SessionStage[] = [];
  if (options.warmup) stages.push({ kind: 'warmup', duration: 60, title: '轻松走动 · 热身', cue: '轻松走动、活动肩髋，用 1 分钟进入训练状态；已热身可直接跳过。', voice: 'warmup-short' });
  plan.exercises.forEach(({ exercise, dose, rest }, exerciseIndex) => {
    const { sets, work, hold } = doseValues(dose);
    const unilateral = exercise.motion === 'lunge' || exercise.motion === 'loadedLunge';
    const base = { exercise, exerciseIndex, sets, reps: work, hold };
    stages.push({ ...base, kind: 'prepare', duration: 15, title: `准备 · ${exercise.name}`, cue: exercise.cues[0], voice: `exercise-${exercise.id}` });
    for (let set = 1; set <= sets; set++) {
      for (const side of (unilateral ? [1, 2] : [1]) as (1 | 2)[]) {
        if (side === 2) stages.push({ ...base, set, side, kind: 'switch', duration: 10, title: '换另一侧', cue: '重新站稳，保持同样的动作幅度。', voice: 'switch' });
        stages.push({ ...base, set, side, kind: 'work', duration: hold ? work : work * options.cycleSeconds,
          title: exercise.name, cue: hold ? '收紧核心，自然呼吸；腰部开始塌陷前结束。' : exercise.cues[0], voice: hold ? 'hold' : 'go' });
      }
      if (set < sets) stages.push({ ...base, set, kind: 'rest', duration: Number(rest.match(/\d+/)?.[0] ?? 60), title: '组间休息', cue: `下一组：${exercise.name} · 第 ${set + 1} / ${sets} 组`, voice: 'rest' });
    }
    // Rest after the final set before moving to the next exercise or the aerobic block.
    if (exerciseIndex < plan.exercises.length - 1 || plan.aerobic) stages.push({ ...base, kind: 'rest', duration: Number(rest.match(/\d+/)?.[0] ?? 60), title: '换动作前休息', cue: `接下来：${plan.exercises[exerciseIndex + 1]?.exercise.name ?? plan.aerobic!.name}`, voice: 'rest' });
  });
  if (plan.aerobic) stages.push({ kind: 'aerobic', duration: Number(plan.aerobic.duration.match(/\d+/)?.[0] ?? 10) * 60, title: plan.aerobic.name, cue: plan.aerobic.intensity, voice: 'aerobic' });
  if (stages.length) stages.push({ kind: 'cooldown', duration: 180, title: '放松与恢复', cue: plan.cooldown, voice: 'cooldown' });
  return stages;
}
export interface SessionClock { index: number; elapsed: number; done: boolean; }
export function advanceSession(stages: SessionStage[], clock: SessionClock, seconds: number): SessionClock {
  if (clock.done || seconds <= 0) return clock;
  let index = clock.index, elapsed = clock.elapsed + seconds;
  while (index < stages.length && elapsed >= stages[index].duration) { elapsed -= stages[index].duration; index++; }
  return index >= stages.length ? { index: stages.length, elapsed: 0, done: true } : { index, elapsed, done: false };
}
export function sessionSample(stage: SessionStage, elapsed: number, cycleSeconds: number) {
  const completed = stage.kind === 'work' && !stage.hold ? Math.min(stage.reps!, Math.floor((elapsed + 1e-7) / cycleSeconds)) : 0;
  return { completed, rep: Math.min(stage.reps ?? 1, completed + 1), remaining: Math.max(0, Math.ceil(stage.duration - elapsed)),
    phase: stage.kind === 'work' && !stage.hold ? (elapsed % cycleSeconds) / cycleSeconds * 100 : 0 };
}
export const formatTime = (seconds: number) => `${Math.floor(Math.max(0, seconds) / 60)}:${String(Math.ceil(Math.max(0, seconds)) % 60).padStart(2, '0')}`;
