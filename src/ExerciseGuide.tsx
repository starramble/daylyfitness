import type { Exercise } from './domain';
import { guideFor, sourceUrl } from './catalog';
export default function ExerciseGuide({exercise:e}:{exercise:Exercise}) {
 const guide=guideFor(e.id);
 return <section className="exercise-guide" key={e.id} aria-label="详细动作指导">
  <div className="guide-status">{e.motion?'3D 动作示意':'静态肌群参考 · 暂无此动作动画'} · {guide?'中文详解':'来源原文'}</div>
  {!!e.unmapped?.length && <p className="mapping-note">来源还标注了 {e.unmapped.join('、')}；当前模型没有对应的独立分区，因此未高亮这些部位。</p>}
  {guide ? <>
   <h4>准备姿势</h4><p>{guide.setup}</p>
   <h4>怎样完成一次</h4><ol>{guide.steps.map(s=><li key={s}>{s}</li>)}</ol>
   <h4>呼吸与节奏</h4><p>{guide.breathing} 动作平稳，控制回程，避免反弹借力。</p>
   <details open><summary>常见错误与纠正</summary><p>{guide.mistake}</p><p><b>调整：</b>{guide.correction}</p></details>
   <details><summary>降低 / 增加难度</summary><p><b>先简化：</b>{guide.easier}</p><p><b>再进阶：</b>{guide.harder}</p></details>
   <details><summary>组次与练习边界</summary><p>{guide.dosage}</p><p>热身后从轻负荷开始；出现锐痛、麻木或关节痛时停止。已有伤病或无法判断姿势时，请现场教练评估。</p></details>
  </> : <>
   <p>以下为动作库的英文原始步骤，尚未逐条翻译和教练复核。肌群标签来自该记录，不表示实测激活强度。</p>
   {e.sourceInstructions?.length ? <ol lang="en">{e.sourceInstructions.map((s,i)=><li key={i}>{s}</li>)}</ol> : <p>此来源记录没有执行步骤，暂不能作为动作指导。请选择有「中文详解」的动作。</p>}
  </>}
  {e.sourceId && <details><summary>来源与原始步骤</summary><a href={sourceUrl(e.sourceId)} target="_blank" rel="noreferrer">Free Exercise DB · 固定版本 ↗</a>{guide && <><p>中文内容为结合动作变式整理的练习提示，并非逐字翻译；3D 示意尚未经过教练逐项验收。</p><ol lang="en">{e.sourceInstructions?.map((s,i)=><li key={i}>{s}</li>)}</ol></>}</details>}
 </section>;
}
