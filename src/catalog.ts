import { animationProfiles, extendedCues } from "./animationProfiles";
import raw from './data/free-exercises.json';
import names from './data/chinese-names.json';
import guides from './data/guides.json';
import type { Exercise, Equipment, MuscleId } from './domain';
export type Guide = (typeof guides)[keyof typeof guides];
export const guideFor = (id: string): Guide | undefined => (guides as Record<string, Guide>)[id];
export const SOURCE_COMMIT = 'a859101d633a01c4a1a920d6a8ce41dabba0705f';
export const sourceUrl = (id: string) => `https://github.com/yuhonas/free-exercise-db/blob/${SOURCE_COMMIT}/exercises/${id}.json`;
// Only equivalent motions are merged. Standing and seated / barbell and dumbbell variants remain separate.
export const sourceMatches: Record<string, string> = {
 squat:'Bodyweight_Squat',curl:'Dumbbell_Bicep_Curl',raise:'Side_Lateral_Raise',
 row:'Bent_Over_Two-Dumbbell_Row',crunch:'Crunches',pushup:'Pushups',
 pullup:'Pullups',bridge:'Butt_Lift_Bridge',
};
const mapping: Record<string, MuscleId> = {
 chest:'chest',shoulders:'deltoids',biceps:'biceps',triceps:'triceps',forearms:'forearms',
 abdominals:'abs',traps:'traps',lats:'lats','lower back':'erectors',glutes:'glutes',
 quadriceps:'quads',hamstrings:'hamstrings',adductors:'adductors',calves:'calves',
};
const equipmentMap: Record<string, Equipment> = {
 'body only':'徒手',dumbbell:'哑铃',barbell:'杠铃',cable:'绳索',machine:'器械',bands:'弹力带',
 kettlebells:'壶铃','e-z curl bar':'曲杆','exercise ball':'健身球','medicine ball':'药球','foam roll':'泡沫轴',other:'其他',
};
const unique = <T,>(a:T[]) => [...new Set(a)];
export function buildCatalog(authored:Exercise[]):Exercise[] {
 const merged = new Set(Object.values(sourceMatches));
 const upstream: Exercise[] = raw.filter(e=>!merged.has(e.id)).map(e=>{
  const name=(names as Record<string,string>)[e.id] || e.name;
  const primary=unique(e.primaryMuscles.flatMap(m=>mapping[m]?[mapping[m]]:[]));
  const secondary=unique(e.secondaryMuscles.flatMap(m=>mapping[m]?[mapping[m]]:[])).filter(m=>!primary.includes(m));
  const guide=guideFor(e.id);
  return {id:e.id,name,en:e.name,equipment:equipmentMap[e.equipment ?? ''] ?? '未标注',
   primary,secondary,motion:animationProfiles[e.id]?.motion ?? null,animation:animationProfiles[e.id],aliases:unique([name.toLowerCase(),e.name.toLowerCase()]),
   cues:animationProfiles[e.id] ? extendedCues[animationProfiles[e.id].motion] : guide?.steps ?? e.instructions,dose:guide ? (e.id==='Plank'?'2–3 组 × 15–30 秒':'2–3 组 × 8–12 次'):'未设定组次',
   difficulty:({beginner:'入门',intermediate:'进阶',expert:'高阶'} as Record<string,string>)[e.level] ?? '未标注',
   sourceId:e.id,sourceInstructions:e.instructions,
   unmapped:unique([...e.primaryMuscles,...e.secondaryMuscles].filter(m=>!mapping[m])),
   category:e.category,
  };
 });
 upstream.sort((a,b)=>Number(!!guideFor(b.id))-Number(!!guideFor(a.id)));
 return [...authored.map(e=>({...e,sourceId:sourceMatches[e.id],sourceInstructions:raw.find(r=>r.id===sourceMatches[e.id])?.instructions})),...upstream];
}
export function searchCatalog(catalog:Exercise[], query:string, equipment='全部', muscle='全部', support='全部') {
 const terms=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
 return catalog.filter(e=>(equipment==='全部'||e.equipment===equipment) &&
  (muscle==='全部'||[...e.primary,...e.secondary].includes(muscle as MuscleId)) &&
  (support==='全部'||(support==='3D演示'?!!e.motion:support==='参考资料'?!e.motion:!!guideFor(e.id))) &&
  terms.every(t=>[e.name,e.en,...e.aliases,e.equipment].join(' ').toLowerCase().includes(t)));
}
export const upstreamCount = raw.length;
