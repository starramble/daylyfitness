import type { ExtendedMotion, AnimationProfile } from "./animationProfiles";
import { buildCatalog, guideFor } from "./catalog";
export const muscles = [
  { id: "chest", name: "胸大肌", en: "Pectoralis major", area: "胸部" },
  { id: "deltoids", name: "三角肌", en: "Deltoid", area: "肩部" },
  { id: "biceps", name: "肱二头肌", en: "Biceps brachii", area: "手臂" },
  { id: "triceps", name: "肱三头肌", en: "Triceps brachii", area: "手臂" },
  { id: "forearms", name: "前臂肌群", en: "Forearm muscles", area: "手臂" },
  { id: "abs", name: "腹直肌", en: "Rectus abdominis", area: "核心" },
  { id: "obliques", name: "腹斜肌", en: "Obliques", area: "核心" },
  { id: "traps", name: "斜方肌", en: "Trapezius", area: "背部" },
  { id: "lats", name: "背阔肌", en: "Latissimus dorsi", area: "背部" },
  { id: "erectors", name: "竖脊肌", en: "Erector spinae", area: "背部" },
  { id: "glutes", name: "臀大肌", en: "Gluteus maximus", area: "臀腿" },
  { id: "quads", name: "股四头肌", en: "Quadriceps", area: "臀腿" },
  { id: "hamstrings", name: "腘绳肌", en: "Hamstrings", area: "臀腿" },
  { id: "adductors", name: "内收肌群", en: "Adductors", area: "臀腿" },
  { id: "calves", name: "小腿三头肌", en: "Triceps surae", area: "小腿" },
  { id: "tibialis", name: "胫骨前肌", en: "Tibialis anterior", area: "小腿" },
] as const;
export type MuscleId = (typeof muscles)[number]["id"];
export type Motion =
  | "squat"
  | "curl"
  | "raise"
  | "press"
  | "row"
  | "hinge"
  | "calf"
  | "crunch"
  | "pushup"
  | "lunge"
  | "pullup"
  | "bridge"
  | "triceps"
  | "toe"
  | ExtendedMotion;
export type Equipment = "徒手" | "哑铃" | "单杠" | "杠铃" | "绳索" | "器械" | "弹力带" | "壶铃" | "曲杆" | "健身球" | "药球" | "泡沫轴" | "其他" | "未标注";
export interface Exercise {
  id: string;
  name: string;
  en: string;
  equipment: Equipment;
  primary: MuscleId[];
  secondary: MuscleId[];
  motion: Motion | null;
  animation?: AnimationProfile;
  sourceId?: string;
  sourceInstructions?: string[];
  unmapped?: string[];
  category?: string;
  aliases: string[];
  cues: string[];
  dose: string;
  difficulty: string;
}
const authoredExercises: Exercise[] = [
  {
    id: "squat",
    name: "徒手深蹲",
    en: "BODYWEIGHT SQUAT",
    equipment: "徒手",
    primary: ["quads", "glutes"],
    secondary: ["adductors", "abs", "erectors"],
    motion: "squat",
    aliases: ["深蹲", "squat", "蹲下再站起", "下蹲", "屈膝下蹲"],
    cues: [
      "脚掌踩稳，髋膝同步屈曲，臀部向后下方移动。",
      "底部保持脚跟着地，膝盖沿脚尖方向，不向内扣。",
      "全脚掌推地，髋膝同步伸展；不要靠过度挺腰站起。",
    ],
    dose: "3 组 × 10–12 次",
    difficulty: "入门",
  },
  {
    id: "curl",
    name: "哑铃弯举",
    en: "DUMBBELL CURL",
    equipment: "哑铃",
    primary: ["biceps"],
    secondary: ["forearms"],
    motion: "curl",
    aliases: ["弯举", "curl", "屈肘举起哑铃", "手臂弯曲举起", "哑铃向肩膀"],
    cues: [
      "站稳，掌心向前，上臂贴近身体。",
      "屈肘将哑铃举向肩部，上臂尽量不动。",
      "缓慢放下，避免摆动身体借力。",
    ],
    dose: "3 组 × 10–12 次",
    difficulty: "入门",
  },
  {
    id: "raise",
    name: "哑铃侧平举",
    en: "LATERAL RAISE",
    equipment: "哑铃",
    primary: ["deltoids"],
    secondary: ["traps"],
    motion: "raise",
    aliases: [
      "侧平举",
      "lateral raise",
      "双臂向两侧抬起",
      "向两侧抬",
      "手臂向两侧",
    ],
    cues: [
      "轻握哑铃，肘部保持微屈。",
      "向两侧抬起手臂，至接近肩高。",
      "避免耸肩，控制下放速度。",
    ],
    dose: "3 组 × 12–15 次",
    difficulty: "入门",
  },
  {
    id: "press",
    name: "哑铃肩上推举",
    en: "OVERHEAD PRESS",
    equipment: "哑铃",
    primary: ["deltoids"],
    secondary: ["triceps", "traps", "abs"],
    motion: "press",
    aliases: [
      "肩上推举",
      "肩推",
      "overhead press",
      "举过头顶",
      "推过头顶",
      "向头顶推",
      "推举",
    ],
    cues: [
      "哑铃置于肩侧，前臂近似垂直。",
      "收紧腹部，将重量向上推起。",
      "避免腰部过度后仰，缓慢回到肩侧。",
    ],
    dose: "3 组 × 8–12 次",
    difficulty: "进阶",
  },
  {
    id: "row",
    name: "俯身哑铃划船",
    en: "BENT-OVER ROW",
    equipment: "哑铃",
    primary: ["lats"],
    secondary: ["traps", "biceps", "erectors"],
    motion: "row",
    aliases: ["划船", "row", "哑铃拉向腰", "俯身拉", "拉向髋部", "拉向腰部"],
    cues: [
      "屈髋俯身，脊柱保持自然曲线。",
      "手肘向身后移动，将哑铃拉向腰侧。",
      "躯干保持稳定，控制还原。",
    ],
    dose: "3 组 × 10–12 次",
    difficulty: "进阶",
  },
  {
    id: "hinge",
    name: "哑铃罗马尼亚硬拉",
    en: "ROMANIAN DEADLIFT",
    equipment: "哑铃",
    primary: ["hamstrings", "glutes"],
    secondary: ["erectors", "forearms"],
    motion: "hinge",
    aliases: [
      "罗马尼亚硬拉",
      "硬拉",
      "rdl",
      "deadlift",
      "髋部后推",
      "臀部向后推",
      "屈髋俯身",
    ],
    cues: [
      "膝盖微屈，哑铃贴近腿部。",
      "臀部向后推，感受大腿后侧被拉长。",
      "足底踩稳，用髋部伸展带动站起。",
    ],
    dose: "3 组 × 8–12 次",
    difficulty: "进阶",
  },
  {
    id: "calf",
    name: "站姿提踵",
    en: "STANDING CALF RAISE",
    equipment: "徒手",
    primary: ["calves"],
    secondary: [],
    motion: "calf",
    aliases: ["提踵", "踮脚", "抬起脚跟", "calf raise"],
    cues: [
      "站稳，可轻扶固定支撑物。",
      "抬高脚跟，在顶部短暂停顿。",
      "缓慢落下，避免弹跳。",
    ],
    dose: "3 组 × 15–20 次",
    difficulty: "入门",
  },
  {
    id: "crunch",
    name: "仰卧卷腹",
    en: "ABDOMINAL CRUNCH",
    equipment: "徒手",
    primary: ["abs"],
    secondary: ["obliques"],
    motion: "crunch",
    aliases: ["卷腹", "crunch", "肩胛离地", "腹部卷起"],
    cues: [
      "仰卧屈膝，双脚平放地面。",
      "呼气卷起上背，让肩胛骨离地。",
      "不拉扯头颈，缓慢回落。",
    ],
    dose: "3 组 × 12–15 次",
    difficulty: "入门",
  },
  {
    id: "pushup",
    name: "标准俯卧撑",
    en: "PUSH-UP",
    equipment: "徒手",
    primary: ["chest"],
    secondary: ["triceps", "deltoids", "abs"],
    motion: "pushup",
    aliases: ["俯卧撑", "push up", "pushup", "push-up", "双手撑地", "撑地推起"],
    cues: [
      "手掌固定略宽于肩，收紧腹臀，头、躯干与腿保持直线。",
      "控制下降至胸部接近地面，手肘向后外侧弯曲，不塌腰。",
      "手掌推地，整体撑起至手臂伸直；保持腰背与头颈稳定。",
    ],
    dose: "3 组 × 6–12 次",
    difficulty: "进阶",
  },
  {
    id: "lunge",
    name: "原地弓步蹲",
    en: "SPLIT SQUAT",
    equipment: "徒手",
    primary: ["quads", "glutes"],
    secondary: ["adductors", "abs"],
    motion: "lunge",
    aliases: [
      "弓步蹲",
      "箭步蹲",
      "分腿蹲",
      "split squat",
      "lunge",
      "前后站立下蹲",
    ],
    cues: [
      "双脚前后错开，左右保持一定宽度。",
      "垂直下蹲，前膝朝向脚尖。",
      "用前脚稳稳推地站起，完成后换侧。",
    ],
    dose: "3 组 × 每侧 8–12 次",
    difficulty: "进阶",
  },
  {
    id: "pullup",
    name: "正握引体向上",
    en: "PULL-UP",
    equipment: "单杠",
    primary: ["lats"],
    secondary: ["biceps", "traps", "forearms"],
    motion: "pullup",
    aliases: [
      "引体向上",
      "pull up",
      "pullup",
      "pull-up",
      "单杠拉起",
      "拉到下巴",
    ],
    cues: [
      "正握单杠，握距略宽于肩。",
      "下沉肩部，手肘向下拉，带动身体上升。",
      "避免摆荡，缓慢控制下降。",
    ],
    dose: "3 组 × 3–8 次",
    difficulty: "进阶",
  },
  {
    id: "bridge",
    name: "仰卧臀桥",
    en: "GLUTE BRIDGE",
    equipment: "徒手",
    primary: ["glutes"],
    secondary: ["hamstrings", "abs"],
    motion: "bridge",
    aliases: ["臀桥", "glute bridge", "仰卧抬臀", "抬起臀部", "臀部抬起"],
    cues: [
      "仰卧屈膝，脚掌踩稳。",
      "收紧臀部抬起髋部，躯干与大腿接近直线。",
      "避免过度挺腰，控制还原。",
    ],
    dose: "3 组 × 12–15 次",
    difficulty: "入门",
  },
  {
    id: "triceps",
    name: "哑铃颈后臂屈伸",
    en: "TRICEPS EXTENSION",
    equipment: "哑铃",
    primary: ["triceps"],
    secondary: ["abs"],
    motion: "triceps",
    aliases: ["臂屈伸", "颈后", "triceps extension", "伸直手肘"],
    cues: [
      "轻重量哑铃举过头顶，上臂保持稳定。",
      "屈肘将重量缓慢放至头后。",
      "伸肘举起，避免肘部过度外张。",
    ],
    dose: "3 组 × 10–12 次",
    difficulty: "进阶",
  },
  {
    id: "toe",
    name: "靠墙抬脚尖",
    en: "TIBIALIS RAISE",
    equipment: "徒手",
    primary: ["tibialis"],
    secondary: [],
    motion: "toe",
    aliases: ["抬脚尖", "胫骨前肌", "tibialis raise", "脚尖抬起"],
    cues: [
      "背靠墙，双脚略向前放。",
      "脚跟着地，抬起脚尖。",
      "缓慢还原，小幅度开始。",
    ],
    dose: "3 组 × 15–20 次",
    difficulty: "入门",
  },
];
export const exercises = buildCatalog(authoredExercises);
export const animationCount = exercises.filter(e => e.motion).length;
export const guidedCount = exercises.filter(e => guideFor(e.id)).length;
export const equipmentOptions = [...new Set(exercises.map(e => e.equipment))];
// Feature groups allow paraphrases; every group must match before suggesting an action.
const descriptions: Record<string, RegExp[]> = {
  squat: [/蹲|屈膝/, /站起|起身|臀.*后|髋.*后/],
  curl: [/哑铃|掌心/, /肘|手臂弯曲/, /肩|弯|屈/],
  raise: [/手臂|双臂|哑铃/, /两侧|两边|侧面/, /抬|举/],
  press: [/哑铃/, /头顶|头上/, /推|举/],
  row: [/俯身|俯下|前倾/, /拉/, /腰|髋|肘/],
  hinge: [/髋|臀/, /向后|后推/, /俯身|前倾|大腿后/],
  calf: [/脚跟/, /抬|提|离地/],
  pushup: [/撑地|手掌.*地|双手.*地/, /屈肘|弯.*肘/, /推|撑起/],
  bridge: [/仰卧|躺/, /臀|髋/, /抬|提/],
  crunch: [/仰卧|躺/, /上背|肩胛/, /抬|离地|卷/],
};
export function identifyExercise(text: string): {
  exercise: Exercise;
  evidence: string[];
  level: "名称匹配" | "描述匹配" | "相近动作";
}[] {
  const input = text.toLowerCase().replace(/[，。！？、,!?]/g, " ");
  if (!input.trim()) return [];
  return exercises
    .map((exercise) => {
      const evidence = exercise.aliases.filter((alias) =>
        input.includes(alias),
      );
      const negated = exercise.aliases.some((alias) =>
        ["不是", "不要", "不做", "不想做", "避免", "而非", "不练"].some(
          (prefix) =>
            input.includes(prefix + alias) ||
            input.includes(prefix + "做" + alias),
        ),
      );
      if (negated)
        return { exercise, evidence: [], level: "描述匹配" as const };
      const patterns = descriptions[exercise.id];
      if (!evidence.length && patterns?.every((pattern) => pattern.test(input)))
        evidence.push(...patterns.map((pattern) => input.match(pattern)![0]));
      const equipmentMention = input.match(/杠铃|壶铃|绳索|哑铃|徒手|单杠/);
      const mismatch =
        equipmentMention && equipmentMention[0] !== exercise.equipment;
      return {
        exercise,
        evidence,
        level: (mismatch
          ? "相近动作"
          : evidence.some(
                (x) =>
                  exercise.name.includes(x) || x === exercise.en.toLowerCase(),
              )
            ? "名称匹配"
            : "描述匹配") as "名称匹配" | "描述匹配" | "相近动作",
      };
    })
    .filter((x) => x.evidence.length)
    .sort(
      (a, b) =>
        Math.max(...b.evidence.map((x) => x.length)) -
        Math.max(...a.evidence.map((x) => x.length)),
    );
}
export function recommend(
  targets: MuscleId[],
  equipment: "全部" | Equipment,
  level: "入门" | "不限",
) {
  return exercises
    .filter(
      (e) =>
        !!guideFor(e.id) && !!e.motion &&
        (equipment === "全部" || e.equipment === equipment) &&
        (level === "不限" || e.difficulty === "入门"),
    )
    .map((exercise) => ({
      exercise,
      score: targets.reduce(
        (s, t) =>
          s +
          (exercise.primary.includes(t)
            ? 3
            : exercise.secondary.includes(t)
              ? 1
              : 0),
        0,
      ),
    }))
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((e) => e.exercise);
}
export const muscleName = (id: MuscleId) =>
  muscles.find((m) => m.id === id)!.name;
