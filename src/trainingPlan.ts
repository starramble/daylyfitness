import { exercises, muscleName, type Exercise, type Equipment, type MuscleId } from './domain';
import { guideFor } from './catalog';

export const trainingGoals = [
  { id: 'muscle', name: '自选肌群', summary: '按想练的部位安排动作', description: '选择一个或多个肌群，生成对应的力量训练组合。' },
  { id: 'core', name: '腹肌强化', summary: '核心力量与躯干稳定', description: '结合卷腹和抗伸展支撑，练习腹部发力。腹肌训练不能局部减脂；腹肌可见度也受整体体脂影响。' },
  { id: 'fatLoss', name: '减脂', summary: '全身力量 + 持续有氧', description: '用力量训练维持肌肉，配合持续有氧与日常活动。减脂还需要可持续的饮食与能量管理，不按单次训练承诺减重。' },
  { id: 'cardio', name: '提升心肺', summary: '有氧耐力与呼吸节奏', description: '以快走建立有氧基础，按说话测试控制强度；先增加持续时间，再逐步提高速度。' },
  { id: 'strength', name: '全身力量', summary: '下肢、推、拉均衡训练', description: '按蹲、髋伸、推、拉选择动作，减少同类动作重复。选择能保持动作稳定的负重，组末保留约 2–3 次余力。' },
] as const;
export type TrainingGoal = typeof trainingGoals[number]['id'];
export interface PlanOptions {
  goal: TrainingGoal;
  targets: MuscleId[];
  equipment?: '全部' | Equipment;
  level: '不限' | '入门';
}
export interface PlanExercise { exercise: Exercise; dose: string; rest: string; }
export interface AerobicBlock { name: string; duration: string; intensity: string; steps: string[]; has3D: false; }
export interface TrainingPlan {
  goal: TrainingGoal;
  title: string;
  frequency: string;
  warmup: string;
  cooldown: string;
  progression: string;
  exercises: PlanExercise[];
  aerobic: AerobicBlock | null;
  notes: string[];
}

// Select one exercise per movement pattern; do not pad a plan with squat/press variants.
const fullBodyPatterns = [
  { name: '蹲类', ids: ['squat', 'Dumbbell_Squat', 'Goblet_Squat', 'Barbell_Squat', 'Leg_Press', 'Leg_Extensions'] },
  { name: '上肢推', ids: ['Incline_Push-Up', 'Dumbbell_Bench_Press', 'Barbell_Bench_Press_-_Medium_Grip', 'Machine_Bench_Press', 'pushup', 'press'] },
  { name: '上肢拉', ids: ['row', 'Close-Grip_Front_Lat_Pulldown', 'pullup'] },
  { name: '髋伸 / 腿后侧', ids: ['bridge', 'hinge', 'Romanian_Deadlift', 'Barbell_Deadlift', 'Lying_Leg_Curls', 'Seated_Leg_Curl'] },
];

// These source records are tagged bodyweight but their demonstrations need a support.
const supportRequired = new Set(['Incline_Push-Up', 'toe']);
export const isEquipmentFree = (exercise: Exercise) => exercise.equipment === '徒手' && !supportRequired.has(exercise.id);

export function buildTrainingPlan(options: PlanOptions): TrainingPlan {
  const { goal, targets, equipment = '徒手', level } = options;
  const beginner = level === '入门';
  const eligible = exercises.filter(e => e.motion && guideFor(e.id)
    && (equipment === '徒手' ? isEquipmentFree(e) : equipment === '全部' || e.equipment === equipment)
    && (!beginner || e.difficulty === '入门'));
  const notes: string[] = [];
  let selected: Exercise[] = [];
  if (goal === 'muscle') {
    selected = eligible.map(exercise => ({ exercise, score: targets.reduce((sum, t) => sum + (exercise.primary.includes(t) ? 3 : exercise.secondary.includes(t) ? 1 : 0), 0) }))
      .filter(item => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 4).map(item => item.exercise);
    const missing = targets.filter(t => !selected.some(e => e.primary.includes(t)));
    if (missing.length) notes.push(`未直接覆盖：${missing.map(muscleName).join('、')}。可调整器械或难度，辅助参与不等同于主练。`);
  } else if (goal === 'core') {
    selected = eligible.filter(e => e.primary.includes('abs') || e.primary.includes('obliques')).slice(0, 3);
    notes.push('重点是躯干控制，不追求次数堆积。卷腹避免拉扯颈部；平板支撑在腰部开始塌陷前结束。');
  } else if (goal !== 'cardio') {
    const missing: string[] = [];
    for (const pattern of fullBodyPatterns) {
      const match = pattern.ids.map(id => eligible.find(e => e.id === id)).find(Boolean);
      if (match) selected.push(match); else missing.push(pattern.name);
    }
    if (missing.length) notes.push(`当前器械与难度下缺少${missing.join('、')}的可播放动作；这是当前可完成的组合；可调整难度，或在有器械时主动开启器械训练。`);
  }
  if (!selected.length && goal !== 'cardio') notes.push('当前筛选没有合适的力量动作。可调整肌群或难度；有器械时再主动选择器械训练。');
  const aerobic: AerobicBlock | null = goal === 'cardio' || goal === 'fatLoss' ? {
    name: '快走',
    duration: goal === 'cardio' ? (beginner ? '10–15 分钟' : '20–30 分钟') : (beginner ? '10–15 分钟' : '15–20 分钟'),
    intensity: '中等强度：呼吸加快，能说完整句子，但不容易唱歌。',
    steps: [
      '选择平坦、安全的步行路线，抬头看前方，肩部放松，手臂自然摆动。',
      '从舒适步速逐渐加快，小步自然落地，保持均匀呼吸，不憋气。',
      '如果只能说零碎词语，就减速；无法连续完成时，可拆成 2 段，段间慢走 1–2 分钟。',
    ],
    has3D: false,
  } : null;
  const frequency = goal === 'cardio' ? '每周 3–5 次，从每周 3 次开始'
    : goal === 'fatLoss' ? '力量每周 2–3 次，间隔至少 1 天；快走每周 3–5 次，可分开完成'
    : '每周 2–3 次，同一肌群训练之间间隔至少 1 天';
  return {
    goal,
    title: `${trainingGoals.find(g => g.id === goal)!.name}计划`,
    frequency,
    warmup: goal === 'cardio' ? '先轻松走 1 分钟，再逐渐提速。' : selected.some(e => e.equipment !== '徒手') ? '先轻松走或原地踏步 1 分钟，再用轻负重或徒手试做各动作 1 组，熟悉幅度。' : '先轻松走或原地踏步 1 分钟，再徒手试做各动作 1 组，熟悉幅度。',
    cooldown: '结束后轻松走 3–5 分钟，让呼吸逐渐平稳。',
    progression: aerobic
      ? '连续一周能轻松完成，再给一次快走增加 5 分钟；不要同时增加速度和时长。逐步向每周累计 150 分钟中等强度有氧靠近，无需第一周达标。'
      : '连续两次训练都能稳定完成次数上限，再小幅增加负重或难度；平板支撑每次增加约 5 秒，动作变形就结束。',
    exercises: selected.map(exercise => ({
      exercise,
      dose: exercise.motion === 'plank' ? `${beginner ? 2 : 3} 组 × 15–30 秒`
        : goal === 'core' ? `${beginner ? 2 : 3} 组 × 8–12 次`
        : goal === 'fatLoss' ? '2 组 × 10–12 次'
        : goal === 'strength' ? `${beginner ? 2 : 3} 组 × 8–12 次` : exercise.dose,
      rest: goal === 'core' ? '组间休息 45–60 秒' : goal === 'fatLoss' ? '组间休息 60–90 秒' : '组间休息 90–120 秒',
    })),
    aerobic,
    notes,
  };
}

export function trainingPlanPayload(plan: TrainingPlan, options: PlanOptions) {
  return {
    title: plan.title,
    createdAt: new Date().toISOString(),
    goal: { id: plan.goal, name: trainingGoals.find(g => g.id === plan.goal)!.name },
    targets: options.goal === 'muscle' ? options.targets.map(muscleName) : options.goal === 'core' ? ['腹直肌', '腹斜肌'] : [],
    equipment: plan.goal === 'cardio' ? '徒手' : options.equipment ?? '徒手',
    level: options.level,
    frequency: plan.frequency,
    warmup: plan.warmup,
    cooldown: plan.cooldown,
    progression: plan.progression,
    note: trainingGoals.find(g => g.id === plan.goal)!.description,
    notes: plan.notes,
    aerobic: plan.aerobic,
    exercises: plan.exercises.map(({ exercise: e, dose, rest }) => ({
      name: e.name, setsAndReps: dose, rest, equipment: e.equipment,
      primary: e.primary.map(muscleName), secondary: e.secondary.map(muscleName),
      cues: e.cues, guidance: guideFor(e.id), has3D: !!e.motion,
    })),
  };
}
