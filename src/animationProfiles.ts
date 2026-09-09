export type ExtendedMotion = 'benchPress'|'benchFly'|'lyingExtension'|'machinePress'|'loadedSquat'|'barDeadlift'|'barHinge'|'hammerCurl'|'reverseFly'|'facePull'|'latPulldown'|'cableExtension'|'legPress'|'legExtension'|'seatedLegCurl'|'lyingLegCurl'|'loadedLunge'|'inclinePushup'|'plank';
export interface AnimationProfile {
 motion: ExtendedMotion;
 prop?: 'barbell'|'dumbbell'|'kettlebell'|'cable';
 incline?: number;
 grip?: number;
 stance?: 'front'|'back'|'goblet';
 crossed?: boolean;
 view: 'front'|'side';
 framing: 'standing'|'bench'|'floor'|'machine'|'overhead';
}
export const animationProfiles:Record<string,AnimationProfile>={
 'Barbell_Bench_Press_-_Medium_Grip':{motion:'benchPress',prop:'barbell',view:'side',framing:'bench'},
 Dumbbell_Bench_Press:{motion:'benchPress',prop:'dumbbell',view:'side',framing:'bench'},
 'Barbell_Incline_Bench_Press_-_Medium_Grip':{motion:'benchPress',prop:'barbell',incline:Math.PI/6,view:'side',framing:'bench'},
 Dumbbell_Flyes:{motion:'benchFly',prop:'dumbbell',view:'front',framing:'bench'},
 'Close-Grip_Barbell_Bench_Press':{motion:'benchPress',prop:'barbell',grip:.44,view:'side',framing:'bench'},
 Machine_Bench_Press:{motion:'machinePress',view:'side',framing:'machine'},
 Face_Pull:{motion:'facePull',prop:'cable',view:'side',framing:'machine'},
 'Close-Grip_Front_Lat_Pulldown':{motion:'latPulldown',prop:'cable',grip:.24,view:'side',framing:'machine'},
 'Full_Range-Of-Motion_Lat_Pulldown':{motion:'latPulldown',prop:'cable',crossed:true,view:'front',framing:'machine'},
 Reverse_Flyes:{motion:'reverseFly',prop:'dumbbell',view:'front',framing:'standing'},
 Hammer_Curls:{motion:'hammerCurl',prop:'dumbbell',view:'front',framing:'standing'},
 Cable_Rope_Overhead_Triceps_Extension:{motion:'cableExtension',prop:'cable',view:'side',framing:'overhead'},
 Lying_Dumbbell_Tricep_Extension:{motion:'lyingExtension',prop:'dumbbell',view:'side',framing:'bench'},
 Goblet_Squat:{motion:'loadedSquat',prop:'kettlebell',stance:'goblet',view:'side',framing:'standing'},
 Barbell_Squat:{motion:'loadedSquat',prop:'barbell',stance:'back',view:'side',framing:'standing'},
 Front_Barbell_Squat:{motion:'loadedSquat',prop:'barbell',stance:'front',view:'side',framing:'standing'},
 Dumbbell_Squat:{motion:'loadedSquat',prop:'dumbbell',view:'side',framing:'standing'},
 Barbell_Deadlift:{motion:'barDeadlift',prop:'barbell',view:'side',framing:'standing'},
 Romanian_Deadlift:{motion:'barHinge',prop:'barbell',view:'side',framing:'standing'},
 Leg_Press:{motion:'legPress',view:'side',framing:'machine'},
 Leg_Extensions:{motion:'legExtension',view:'side',framing:'machine'},
 Seated_Leg_Curl:{motion:'seatedLegCurl',view:'side',framing:'machine'},
 Lying_Leg_Curls:{motion:'lyingLegCurl',view:'side',framing:'bench'},
 Dumbbell_Lunges:{motion:'loadedLunge',prop:'dumbbell',view:'side',framing:'standing'},
 Plank:{motion:'plank',view:'side',framing:'floor'},
 'Incline_Push-Up':{motion:'inclinePushup',view:'side',framing:'floor'},
};
export const extendedPhases: Record<ExtendedMotion,[string,string,string]>={
 benchPress:['控制下放','底部稳定','推起还原'],benchFly:['缓慢打开','胸部拉伸','合拢双臂'],lyingExtension:['屈肘下放','上臂稳定','伸肘举起'],
 machinePress:['向前推起','伸展控制','缓慢回程'],loadedSquat:['吸气下蹲','底部稳定','推地站起'],barDeadlift:['推地起拉','站直控制','屈髋还原'],barHinge:['屈髋下放','后侧拉长','伸髋站起'],hammerCurl:['屈肘举起','中立握控制','缓慢下放'],reverseFly:['向两侧打开','后肩收缩','缓慢回落'],facePull:['拉向面部','肩部控制','缓慢前伸'],latPulldown:['手肘下拉','胸前控制','缓慢还原'],cableExtension:['伸肘推起','顶部控制','屈肘回程'],legPress:['控制屈膝','底部稳定','推回踏板'],legExtension:['伸膝抬起','顶部控制','缓慢回落'],seatedLegCurl:['屈膝回拉','后侧收缩','缓慢还原'],lyingLegCurl:['屈膝抬起','骨盆稳定','缓慢还原'],loadedLunge:['迈步下蹲','底部稳定','推回起点'],inclinePushup:['屈肘下降','胸部接近支撑面','推回起点'],plank:['建立支撑','持续呼吸','保持稳定'],
};
export const extendedCues: Record<ExtendedMotion,[string,string,string]>={
 benchPress:['肩胛稳定贴凳，屈肘将重量降向胸部中下段附近。','脚掌踩稳，腕肘保持支撑关系，不靠反弹或抬臀推起。','推回肩部上方，保持左右同步，接近伸肘时仍控制重量。'],
 benchFly:['肘部保持微屈，双臂沿弧线慢慢打开。','在胸部有拉伸、肩前侧舒适的位置停住，避免追求过深幅度。','保持肘角基本不变，像抱树一样合拢双臂。'],
 lyingExtension:['上臂保持稳定，屈肘让哑铃沿头部两侧下降。','哑铃与面部保持距离，避免肘部外张或折腕。','肱三头肌伸肘举起，不用整个肩部甩起哑铃。'],
 machinePress:['背部贴垫，沿器械轨迹向前推起把手。','接近伸肘时停住，避免猛锁肘或耸肩。','控制回程，身体不前后晃动。'],
 loadedSquat:['先稳定重量，再让髋膝同步弯曲下蹲。','脚跟保持着地、膝盖沿脚尖方向，控制到自身可用深度。','全脚掌推地，髋肩同步上升，顶端不后仰。'],
 barDeadlift:['拉紧杠铃、稳定背部，用脚推地；手臂作为连接，不主动弯举。','站直即可，杠铃贴近大腿，避免向后挺腰。','先髋后移、再屈膝把重量控制放回，准备下一次。'],
 barHinge:['膝微屈，臀部向后推；手臂保持伸展，杠铃沿腿部下滑。','腘绳肌有拉伸且背部可控即可，不以碰地为目标。','收缩臀部伸髋站起，重量保持靠近腿部。'],
 hammerCurl:['掌心相对，上臂贴近体侧，缓慢屈肘举起。','手腕中立，避免耸肩、甩腰或抬起上臂。','保持中立握，用约2–3秒控制下放。'],
 reverseFly:['屈髋俯身并保持躯干稳定，双臂向两侧打开。','上臂接近躯干平面时停住，肩部不耸起。','慢慢回到肩下，避免身体摇摆借力。'],
 facePull:['将绳索拉向面部，手肘向两侧后方打开。','双手分到脸两侧，颈部放松、躯干不后仰。','缓慢前伸手臂，持续控制绳索张力。'],
 latPulldown:['大腿固定，手肘向下拉，让把手沿身体前方下降。','拉向上胸前，避免探头或大幅后仰。','慢慢伸臂回程，允许肩胛自然上转。'],
 cableExtension:['上臂保持靠近头侧，伸肘把绳索推向上方。','收住下肋，避免借塌腰把手举高。','缓慢屈肘回到头后，保持肩肘舒适和绳索可控。'],
 legPress:['骨盆和背部贴垫，屈膝让踏板缓慢靠近。','到骨盆仍贴垫的位置即停，膝沿脚尖方向。','全脚掌推回踏板，接近伸膝时避免猛锁死。'],
 legExtension:['大腿固定、背部贴垫，伸膝抬起滚垫。','接近伸直时短暂停顿，臀部不要离座。','控制屈膝回落，避免配重撞击。'],
 seatedLegCurl:['大腿压垫固定，屈膝把脚跟向座椅下方拉。','保持骨盆稳定，不向前滑动或借挺腰用力。','慢慢伸膝还原，保持配重可控。'],
 lyingLegCurl:['骨盆贴垫，弯膝把脚跟向臀部方向拉。','顶部不抬髋、不挺腰，保持大腿接触支撑。','慢慢伸膝回落，避免突然卸力。'],
 loadedLunge:['向前迈步并站稳，再髋膝同步下降。','前脚踩稳，前膝沿脚尖方向，后膝不撞地。','前脚推地站起并回到原位；每组换侧练习。'],
 inclinePushup:['保持身体成一直线，屈肘让胸部靠近稳定台面。','胸髋同步下降，肘与身体约30–45度，腰部不下塌。','手掌推台面回到起点，保持收腹夹臀。'],
 plank:['前臂和脚尖支撑，肘位于肩下，身体保持直线。','这是等长保持：自然呼吸，收腹夹臀，不反复屈伸。','保持前臂推地；开始塌腰或抬臀时结束本组。'],
};
