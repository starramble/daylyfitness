import { exercises, equipmentOptions, muscles, type Equipment, type MuscleId } from './domain';
import { trainingGoals, type TrainingGoal } from './trainingPlan';
export const preferenceKey = 'dayly.workspace.v1';
export interface WorkspacePreferences {
  goal: TrainingGoal;
  targets: MuscleId[];
  equipment: '全部' | Equipment;
  equipmentChosen: boolean;
  level: '不限' | '入门';
  tab: 'target' | 'describe';
  exerciseId: string;
  recent: string[];
  hasPlan: boolean;
}
const defaults: WorkspacePreferences = {
  goal: 'strength', targets: ['quads', 'glutes'], equipment: '徒手', equipmentChosen: false, level: '入门',
  tab: 'target', exerciseId: 'squat', recent: [], hasPlan: false,
};
// The catalog can change between visits; discard unknown IDs and malformed settings.
export function parsePreferences(raw: string | null): WorkspacePreferences {
  let saved: Partial<WorkspacePreferences> = {};
  try { const parsed = JSON.parse(raw ?? '{}'); if (parsed && typeof parsed === 'object') saved = parsed; } catch { /* Use defaults for damaged storage. */ }
  return {
    goal: trainingGoals.some(g => g.id === saved.goal) ? saved.goal! : defaults.goal,
    targets: Array.isArray(saved.targets) ? [...new Set(saved.targets.filter(t => muscles.some(m => m.id === t)))] : defaults.targets,
    equipment: saved.equipment === '全部' ? (saved.equipmentChosen === true ? '全部' : '徒手') : equipmentOptions.includes(saved.equipment as Equipment) ? saved.equipment! : defaults.equipment,
    equipmentChosen: saved.equipmentChosen === true || (!!saved.equipment && saved.equipment !== '全部' && saved.equipment !== '徒手' && equipmentOptions.includes(saved.equipment as Equipment)),
    level: saved.level === '不限' || saved.level === '入门' ? saved.level : defaults.level,
    tab: saved.tab === 'describe' ? 'describe' : 'target',
    exerciseId: exercises.some(e => e.id === saved.exerciseId) ? saved.exerciseId! : defaults.exerciseId,
    recent: Array.isArray(saved.recent) ? [...new Set(saved.recent.filter(id => exercises.some(e => e.id === id)))].slice(0, 5) : [],
    hasPlan: saved.hasPlan === true,
  };
}
export function readPreferences(): WorkspacePreferences {
  try { return parsePreferences(localStorage.getItem(preferenceKey)); } catch { return parsePreferences(null); }
}
export function savePreferences(value: WorkspacePreferences): boolean {
  try { localStorage.setItem(preferenceKey, JSON.stringify(value)); return true; } catch { return false; }
}
