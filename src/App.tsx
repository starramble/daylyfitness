import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  Activity,
  ArrowUpRight,
  ArrowRight,
  RotateCcw,
  Play,
  Pause,
  ScanLine,
  Check,
  Plus,
  X,
  Download,
  Dumbbell,
  CircleHelp,
  Maximize2,
  Layers,
  Target,
  Move3D,
  ChevronLeft,
  ChevronRight,
  Search,
  History,
} from "lucide-react";
import ExerciseGuide from "./ExerciseGuide";
import { searchCatalog, guideFor, upstreamCount } from "./catalog";
import BodyScene from "./BodyScene";
import FollowAlong from "./FollowAlong";
import { buildSession, type FollowOptions } from "./followSession";
import { createSessionAudio, type SessionAudio } from "./followAudio";
import { motionPhase } from "./movement";
import {
  exercises, animationCount, guidedCount, equipmentOptions,
  muscles,
  identifyExercise,
  muscleName,
  type Exercise,
  type MuscleId,
  type Equipment,
} from "./domain";
import { trainingGoals, buildTrainingPlan, trainingPlanPayload, type TrainingGoal, type TrainingPlan } from "./trainingPlan";
import { readPreferences, savePreferences } from "./preferences";
export default function App() {
  const [saved] = useState(readPreferences);
  const [following, setFollowing] = useState(false);
  const [sessionAudio, setSessionAudio] = useState<SessionAudio | null>(null);
  const [followOptions, setFollowOptions] = useState<FollowOptions>({ cycleSeconds: 6, warmup: true });
  useEffect(() => () => sessionAudio?.player.dispose(), [sessionAudio]);
  const [recent, setRecent] = useState(saved.recent);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [planEditing, setPlanEditing] = useState(!saved.hasPlan);
  const panelRef = useRef<HTMLElement>(null);
  const libraryRef = useRef<HTMLElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [tab, setTab] = useState<"describe" | "target">(saved.tab);
  const [exercise, setExercise] = useState<Exercise>(exercises.find(e => e.id === saved.exerciseId)!);
  const [mode, setMode] = useState<"explore" | "exercise">(saved.tab === "target" ? "explore" : "exercise");
  const [text, setText] = useState(
    exercises.find(e => e.id === saved.exerciseId)!.name,
  );
  const [result, setResult] = useState<ReturnType<
    typeof identifyExercise
  > | null>(null);
  const [targets, setTargets] = useState<MuscleId[]>(saved.targets);
  const [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(1),
    [phase, setPhase] = useState(0),
    [progress, setProgress] = useState(0);
  const [view, setView] = useState<"front" | "back" | "side">("side"),
    [reset, setReset] = useState(0);
  const [exportCount, setExportCount] = useState(0);
  const [focusedMuscle, setFocusedMuscle] = useState<MuscleId | null>(null);
  const [showGuides, setShowGuides] = useState(true);
  const [equipmentChosen, setEquipmentChosen] = useState(saved.equipmentChosen);
  const [equipment, setEquipment] = useState<"全部" | Equipment>(saved.equipment),
    [level, setLevel] = useState<"不限" | "入门">(saved.level);
  const [goal, setGoal] = useState<TrainingGoal>(saved.goal);
  const [plan, setPlan] = useState<TrainingPlan | null>(() => saved.hasPlan ? buildTrainingPlan(saved) : null),
    [toast, setToast] = useState(""),
    [library, setLibrary] = useState(false),
    [search, setSearch] = useState("");
  const [libraryEquipment, setLibraryEquipment] = useState("全部");
  const [libraryMuscle, setLibraryMuscle] = useState("全部");
  const [librarySupport, setLibrarySupport] = useState("3D演示");
  const [libraryPage, setLibraryPage] = useState(0);
  const [help, setHelp] = useState(false),
    [expanded, setExpanded] = useState(false);
  useEffect(() => {
    setStorageAvailable(savePreferences({ goal, targets, equipment, equipmentChosen, level, tab, exerciseId: exercise.id, recent, hasPlan: !!plan }));
  }, [goal, targets, equipment, equipmentChosen, level, tab, exercise.id, recent, plan]);
  useEffect(() => {
    if (!library) return;
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setLibrary(false); event.preventDefault(); }
      if (event.key === "Tab") {
        const nodes = Array.from(libraryRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, a[href]') ?? []);
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) { last?.focus(); event.preventDefault(); }
        else if (!event.shiftKey && document.activeElement === last) { first?.focus(); event.preventDefault(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = oldOverflow; document.removeEventListener("keydown", onKey); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, [library]);
  const scrollPanel = () => {
    requestAnimationFrame(() => {
      panelRef.current?.scrollTo({ top: 0 });
      if (window.innerWidth <= 900) panelRef.current?.scrollIntoView({ block: "start" });
    });
  };
  const openPlan = () => { setTab("target"); setMode("explore"); setPlaying(false); scrollPanel(); };
  const openExercise = () => { setTab("describe"); setMode("exercise"); scrollPanel(); };
  const notify = (s: string) => {
    setToast(s);
    window.setTimeout(() => setToast(""), 2800);
  };
  const choose = (e: Exercise) => {
    setExercise(e);
    setTab("describe");
    setSearchOpen(false);
    setResult(null);
    setRecent(old => [e.id, ...old.filter(id => id !== e.id)].slice(0, 5));
    scrollPanel();
    setText(e.name);
    setFocusedMuscle(null);
    setMode("exercise");
    setPlaying(false);
    setPhase((p) => (p === 0 ? 0.001 : 0));
    setProgress(0);
    if (e.animation) setView(e.animation.view);
    else if (
      ["squat", "row", "hinge", "pushup", "crunch", "bridge", "lunge"].includes(
        e.motion ?? "",
      )
    )
      setView("side");
    else setView("front");
  };
  const changeTarget = useCallback((id: MuscleId) => {
    setGoal("muscle");
    setTargets((old) =>
      old.includes(id) ? old.filter((i) => i !== id) : [...old, id],
    );
    setTab("target");
    setMode("explore");
    setPlaying(false);
    setPlan(null);
    setPlanEditing(true);
  }, []);
  const selectMuscle = useCallback(
    (id: MuscleId) => {
      setFocusedMuscle(id);
      if (mode === "explore") changeTarget(id);
    },
    [mode, changeTarget],
  );
  const analyze = () => {
    const found = identifyExercise(text);
    setResult(found);
    if (found.length === 1 && found[0].level !== "相近动作")
      choose(found[0].exercise);
  };
  const exportPlan = () => {
    if (!plan || (!plan.exercises.length && !plan.aerobic)) return;
    const payload = trainingPlanPayload(plan, { goal, targets, equipment, level });
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "dayly-training-plan.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("训练组合已导出");
  };
  const shown = searchCatalog(exercises, search, libraryEquipment, libraryMuscle, librarySupport);
  const pageCount = Math.max(1, Math.ceil(shown.length / 30));
  const safePage = Math.min(libraryPage, pageCount - 1);
  const pageItems = shown.slice(safePage * 30, (safePage + 1) * 30);
  const goalInfo = trainingGoals.find(g => g.id === goal)!;
  const highlightedTargets: MuscleId[] = goal === "muscle" ? targets : goal === "core" ? ["abs", "obliques"] : goal === "cardio" ? [] : ["quads", "glutes", "hamstrings", "chest", "lats"];
  const isExercise = mode === "exercise";
  const stage = motionPhase(exercise.motion, progress);
  const plannedExercise = plan?.exercises.find(item => item.exercise.id === exercise.id);
  const canFollow = !!plan && (!!plan.exercises.length || !!plan.aerobic);
  const planMinutes = useMemo(() => plan ? Math.ceil(buildSession(plan, followOptions).reduce((sum, item) => sum + item.duration, 0) / 60) : 0, [plan, followOptions]);
  const generatePlan = () => { const next = buildTrainingPlan({ goal, targets, equipment, level }); setPlan(next); setPlanEditing(!next.exercises.length && !next.aerobic); scrollPanel(); };
  const changeEquipment = (value: typeof equipment) => { setEquipment(value); setEquipmentChosen(value !== "徒手"); setPlan(null); setPlanEditing(true); };
  const beginFollowing = () => {
    setSessionAudio(createSessionAudio());
    setPlaying(false);
    setFollowing(true);
    window.scrollTo({ top: 0 });
  };
  if (following && plan && sessionAudio) return <FollowAlong plan={plan} options={followOptions} sessionAudio={sessionAudio} onExit={() => { setFollowing(false); setSessionAudio(null); openPlan(); }} />;
  return (
    <div className="app-shell">
      <header className="header">
        <a href="#" className="brand" aria-label="Dayly 首页">
          <span className="brand-mark">
            <Activity size={21} />
          </span>
          dayly<span className="brand-dot">.</span>
        </a>
        <nav className="header-nav" aria-label="主导航">
          <button className={tab === "target" ? "active" : ""} aria-current={tab === "target" ? "page" : undefined} onClick={openPlan}><Target size={16} />训练计划</button>
          <button className={tab === "describe" ? "active" : ""} aria-current={tab === "describe" ? "page" : undefined} onClick={openExercise}><Activity size={16} />动作指导</button>
          <button onClick={() => setLibrary(true)}><Search size={16} />动作库 <span className="tiny-count">{animationCount}</span></button>
        </nav>
        <div className="header-end">
          <span className="local-status">
            <i />
            {storageAvailable ? "偏好保存在本机" : "本次设置未保存"}
          </span>
          <button
            className="icon-btn help-button"
            aria-label="使用说明"
            onClick={() => setHelp(!help)}
          >
            <CircleHelp size={19} />
          </button>

        </div>
      </header>
      <main>
        <section className="page-heading">
          <div>
            <div className="eyebrow">DAYLY / TRAINING DESK</div>
            <h1>{tab === "target" ? "把目标，变成今天的训练。" : "看清要领，再完成一次。"}</h1>
            <p>{tab === "target" ? "选好目标与器械，组合动作；随时切换到 3D 查看细节。" : "观察发力肌群与动作幅度，按自己的节奏练习。"}</p>
          </div>
          <button className="browse-action" onClick={() => setLibrary(true)}><Search size={17} />找动作<span>名称 / 肌群 / 器械</span></button>
        </section>
        {!!recent.length && <nav className="recent-exercises" aria-label="最近查看">
          <span><History size={14} />最近查看</span>
          {recent.map(id => { const e = exercises.find(item => item.id === id)!; return <button key={id} onClick={() => choose(e)}>{e.name}<ArrowUpRight size={12} /></button>; })}
        </nav>}
        {help && (
          <aside className="help-panel">
            <strong>从动作出发，也可以从肌肉出发。</strong>
            <p>
              拖动人体旋转、滚轮缩放。动作模式点击肌群可查看名称，播放继续；探索模式点击肌群可选择目标。输入动作名称或描述后识别；多个候选需要你选择。采用本地名称与规则匹配。动作库包含 {exercises.length} 条记录，其中 {animationCount} 个支持 3D 示意、{guidedCount} 个有中文详解，其余提供来源原文。本工具不提供摄像头动作评估。
            </p>
            <button onClick={() => setHelp(false)} aria-label="关闭说明">
              <X size={17} />
            </button>
          </aside>
        )}
        <div className={`workspace ${expanded ? "expanded" : ""} workspace-${tab}`}>
          <section className="viewer" aria-label="人体肌肉展示">
            <div className="viewer-top">
              <div className="viewer-title">
                <span className="live-dot" />
                3D 动作与肌群
              </div>
              <button
                className="icon-btn"
                aria-label={expanded ? "收起模型" : "放大模型"}
                onClick={() => setExpanded(!expanded)}
              >
                <Maximize2 size={17} />
              </button>
            </div>
            <div className="view-selector">
              {(["front", "back", "side"] as const).map((v, i) => (
                <button
                  key={v}
                  className={view === v ? "selected" : ""}
                  onClick={() => setView(v)}
                >
                  {["正面", "背面", "侧面"][i]}
                </button>
              ))}
            </div>
            <div className="model-caption">
              <span>HUMAN ANATOMY</span>
              <b>{isExercise ? exercise.name : "肌群探索"}</b>
              <small>
                {isExercise
                  ? exercise.en
                  : goal === "muscle" ? `${targets.length} 个目标肌群已选择` : `训练目标 · ${goalInfo.name}`}
              </small>
            </div>
            <BodyScene
              exercise={exercise}
              targets={highlightedTargets}
              mode={mode}
              playing={playing && !!exercise.motion}
              speed={speed}
              phase={phase}
              view={view}
              reset={reset}
              onSelect={selectMuscle}
              onPhase={setProgress}
              exportCount={exportCount}
              onExport={notify}
              showGuides={showGuides}
            />
            <div className="live-muscles" aria-label="当前高亮肌群">
              <strong>{isExercise ? "动作肌群高亮" : "目标肌群高亮"}</strong>
              <div>
                {(isExercise ? exercise.primary : highlightedTargets).map((id) => (
                  <span className="live-primary" key={id}>
                    {muscleName(id)}
                  </span>
                ))}
              </div>
              {isExercise && (
                <div>
                  {exercise.secondary.map((id) => (
                    <span className="live-secondary" key={id}>
                      {muscleName(id)}
                    </span>
                  ))}
                </div>
              )}
              {focusedMuscle && (
                <small role="status">
                  正在查看：{muscleName(focusedMuscle)}
                </small>
              )}
            </div>
            {isExercise && !!exercise.motion && (
              <button
                className="coach-toggle"
                aria-pressed={showGuides}
                onClick={() => setShowGuides((s) => !s)}
              >
                动作指导 {showGuides ? "✓" : "＋"}
              </button>
            )}
            {isExercise && !!exercise.motion && showGuides && (
              <div className="coach-readout" aria-label="实时动作指导">
                <div className="phase-steps">
                  {stage.all.map((label, i) => (
                    <span
                      key={label}
                      className={stage.index === i ? "current" : ""}
                    >
                      {label}
                    </span>
                  ))}
                </div>
                <p>{exercise.cues[stage.index]}</p>
              </div>
            )}
            <div className="axis-label">
              <Move3D size={17} />
              <span>拖动旋转 · 滚轮缩放 · 点击肌群</span>
            </div>
            <div className="viewer-side">
              <button
                className="icon-btn"
                title="导出当前姿态 GLB（不含动画）"
                aria-label="导出当前姿态3D模型"
                onClick={() => setExportCount((n) => n + 1)}
              >
                <Download size={18} />
              </button>
              <button
                className="icon-btn"
                title="重置视角"
                aria-label="重置视角"
                onClick={() => {
                  setView("front");
                  setReset((n) => n + 1);
                }}
              >
                <RotateCcw size={18} />
              </button>
              <button
                className={`icon-btn ${mode === "explore" ? "on" : ""}`}
                title="静态肌群探索"
                aria-label="静态肌群探索"
                onClick={() => {
                  setMode("explore");
                  setPlaying(false);
                  setTab("target");
                }}
              >
                <Layers size={18} />
              </button>
            </div>
            <div className="legend">
              <span>
                <i className="primary-dot" />
                {isExercise ? "主练肌群" : "目标肌群"}
              </span>
              {isExercise && (
                <span>
                  <i className="secondary-dot" />
                  辅助肌群
                </span>
              )}
              <span>
                <i className="neutral-dot" />
                其他肌群
              </span>
            </div>
            <div className="playback">
              <button
                className="play-button"
                disabled={!exercise.motion}
                aria-label={playing ? "暂停动作" : "播放动作"}
                onClick={() => {
                  setMode("exercise");
                  setPlaying(!playing);
                }}
              >
                {playing ? (
                  <Pause size={17} fill="currentColor" />
                ) : (
                  <Play size={17} fill="currentColor" />
                )}
              </button>
              <div className="timeline">
                <div className="timeline-label">
                  <strong>
                    {!exercise.motion ? "静态肌群参考" : isExercise
                      ? playing
                        ? (exercise.motion === "plank" ? "等长保持 · 自然呼吸" : "正在演示")
                        : "动作演示"
                      : "静态探索"}
                  </strong>
                  <span>
                    {!exercise.motion ? "暂无此动作动画，请查看右侧步骤" : isExercise ? stage.label : "点击播放，查看当前动作"}
                  </span>
                </div>
                <input
                  disabled={!exercise.motion}
                  aria-label="动作进度"
                  type="range"
                  min="0"
                  max="100"
                  step=".1"
                  value={isExercise ? progress : 0}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setMode("exercise");
                    setPlaying(false);
                    setPhase(v);
                    setProgress(v);
                  }}
                />
              </div>
              <button
                className="speed"
                disabled={!exercise.motion}
                aria-label="切换播放速度"
                onClick={() =>
                  setSpeed((s) => (s === 1 ? 0.5 : s === 0.5 ? 1.5 : 1))
                }
              >
                {speed}×
              </button>
              <button
                className="icon-btn"
                disabled={!exercise.motion}
                aria-label="重新播放"
                onClick={() => {
                  setPhase(phase === 0 ? 0.001 : 0);
                  setProgress(0);
                  setMode("exercise");
                  setPlaying(true);
                }}
              >
                <RotateCcw size={16} />
              </button>
            </div>
            <div className="model-note">
              Z-Anatomy / DBCLS · 红：主练 · 金：辅助 · 明暗非实测激活{" "}
              <a href="/models/NOTICE.txt" target="_blank" rel="noreferrer">
                来源与许可 ↗
              </a>
            </div>
          </section>
          <aside className="control-panel" ref={panelRef} aria-label={tab === "target" ? "训练计划工作区" : "动作指导工作区"} tabIndex={-1}>
            <div className="panel-toolbar">
              <strong>{tab === "target" ? "我的训练计划" : "动作指导"}</strong>
              {tab === "describe" ? <button onClick={openPlan}><ChevronLeft size={14} />返回计划</button> : <span>{plan ? "计划已生成" : "从目标开始"}</span>}
            </div>
            {tab === "target" && <div className="plan-action-bar" aria-label="计划快捷操作">
              <div className="plan-action-summary"><strong>{goalInfo.name}</strong><span>{goal === "cardio" || equipment === "徒手" ? "无需器械" : equipment === "全部" ? "已开启器械" : equipment} · {canFollow && !planEditing ? `${plan!.exercises.length} 个动作${plan!.aerobic ? " + 有氧" : ""} · 约 ${planMinutes} 分钟` : level}</span></div>
              {canFollow && !planEditing ? <button className="primary-btn" onClick={beginFollowing}><Play size={19} />开始跟练<ArrowRight size={18} /></button> : <button className="primary-btn" disabled={goal === "muscle" && !targets.length} onClick={generatePlan}>{plan ? "更新训练计划" : "生成训练计划"}<ArrowRight size={18} /></button>}
              {canFollow && !planEditing && <details className="quick-follow-settings"><summary>跟练设置 · {followOptions.warmup ? "热身 1 分钟" : "跳过热身"} · {followOptions.cycleSeconds} 秒 / 次</summary>
                <label>热身<select aria-label="热身安排" value={followOptions.warmup ? "yes" : "no"} onChange={e => setFollowOptions(old => ({ ...old, warmup: e.target.value === "yes" }))}><option value="yes">1 分钟</option><option value="no">已热身，直接开始</option></select></label>
                <label>动作节奏<select aria-label="动作节奏" value={followOptions.cycleSeconds} onChange={e => setFollowOptions(old => ({ ...old, cycleSeconds: Number(e.target.value) as 4 | 6 }))}><option value={6}>舒缓 · 6 秒 / 次</option><option value={4}>标准 · 4 秒 / 次</option></select></label>
              </details>}
              {goal === "muscle" && !targets.length && <small>先在下方选择想练的肌群。</small>}
            </div>}
            {tab === "describe" ? (
              <div className="panel-body">
                {plannedExercise && plan && <div className="plan-sequence">
                  <div><span>{plan.title}</span><b>动作 {plan.exercises.findIndex(item => item.exercise.id === exercise.id) + 1} / {plan.exercises.length}</b></div>
                  <div className="sequence-buttons">
                    <button disabled={plan.exercises[0].exercise.id === exercise.id} onClick={() => choose(plan.exercises[plan.exercises.findIndex(item => item.exercise.id === exercise.id) - 1].exercise)}><ChevronLeft size={15} />上一个</button>
                    <button disabled={plan.exercises.at(-1)!.exercise.id === exercise.id} onClick={() => choose(plan.exercises[plan.exercises.findIndex(item => item.exercise.id === exercise.id) + 1].exercise)}>下一个<ChevronRight size={15} /></button>
                  </div>
                </div>}
                <div className="exercise-finder"><button onClick={() => setLibrary(true)}><Search size={16} />从动作库换一个</button><button aria-expanded={searchOpen} onClick={() => setSearchOpen(!searchOpen)}><ScanLine size={16} />用描述查找</button></div>
                {searchOpen && <div className="description-search">
                <div className="section-heading">
                  <span className="step">01</span>
                  <h2>描述你想找的动作</h2>
                </div>
                <p className="subtext">输入动作名称，或描述身体如何运动。</p>
                <label className="sr-only" htmlFor="description">
                  动作描述
                </label>
                <div className="input-wrap">
                  <textarea
                    id="description"
                    value={text}
                    onChange={(e) => {
                      setText(e.target.value);
                      setResult(null);
                    }}
                    placeholder="例如：手持哑铃，上臂贴近身体，屈肘向肩膀举起"
                    maxLength={500}
                    onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); analyze(); } }}
                  />
                  <span>{text.length}/500</span>
                </div>
                <div className="examples">
                  <span>试试看</span>
                  {["俯卧撑", "哑铃弯举", "罗马尼亚硬拉"].map((n) => (
                    <button
                      key={n}
                      onClick={() => {
                        setText(n);
                        setResult(null);
                      }}
                    >
                      {n}
                      <ArrowUpRight size={11} />
                    </button>
                  ))}
                </div>
                <button
                  className="primary-btn"
                  onClick={analyze}
                  disabled={!text.trim()}
                >
                  识别动作与肌群 <ArrowRight size={17} />
                </button>
                {result !== null && (
                  <div
                    className={`recognition ${result.length ? "" : "empty"}`}
                    role="status"
                  >
                    {result.length === 0 ? (
                      <>
                        <b>暂时无法确定动作</b>
                        <p>
                          请补充器械、身体姿态和运动方向，或从动作库选择。当前不会猜测未收录的动作。
                        </p>
                        <button
                          className="inline-link"
                          onClick={() => setLibrary(true)}
                        >
                          浏览 {exercises.length} 条动作记录 →
                        </button>
                      </>
                    ) : result.length === 1 &&
                      result[0].level !== "相近动作" ? (
                      <>
                        <span>
                          <Check size={14} /> 已识别：{result[0].exercise.name}
                        </span>
                        <small>
                          {result[0].level} · 依据「{result[0].evidence[0]}」
                        </small>
                      </>
                    ) : (
                      <>
                        <b>
                          {result.some((r) => r.level === "相近动作")
                            ? "器械或动作有差异，选择库中动作后演示"
                            : "找到多个动作，请选择本次演示"}
                        </b>
                        {result.map((r) => (
                          <button
                            key={r.exercise.id}
                            onClick={() => {
                              choose(r.exercise);
                              setResult([
                                {
                                  ...r,
                                  level:
                                    r.level === "相近动作"
                                      ? "描述匹配"
                                      : r.level,
                                },
                              ]);
                            }}
                          >
                            {r.exercise.name} · {r.exercise.equipment}
                            <ArrowRight size={14} />
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}
                </div>}
                <div className="section-heading">
                  <h2>当前动作</h2>
                  <span className="pill">{exercise.equipment}</span>
                </div>
                <div className="exercise-heading">
                  <h3>{exercise.name}</h3>
                  <span>{exercise.en}</span>
                </div>
                <button
                  className="primary-btn preview-play"
                  disabled={!exercise.motion}
                  onClick={() => {
                    setMode("exercise");
                    setPlaying(!playing);
                  }}
                >
                  {playing ? <Pause size={15} /> : <Play size={15} />}{" "}
                  {!exercise.motion ? "此动作仅提供图谱与文字指导" : playing ? "暂停动作示意" : "播放动作示意"}
                  <span>3D</span>
                </button>
                <div className="muscle-row">
                  <span>
                    <i className="primary-dot" />
                    主练
                  </span>
                  <div>
                    {exercise.primary.map((id) => (
                      <button
                        key={id}
                        onClick={() => {
                          setGoal("muscle");
                          setTargets([id]);
                          setMode("explore");
                          setTab("target");
                          setPlaying(false);
                          setPlan(null);
    setPlanEditing(true);
                        }}
                      >
                        {muscleName(id)}
                        <ArrowUpRight size={12} />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="muscle-row secondary">
                  <span>
                    <i className="secondary-dot" />
                    辅助
                  </span>
                  <div>
                    {exercise.secondary.length ? (
                      exercise.secondary.map((id) => (
                        <button
                          key={id}
                          onClick={() => {
                            setGoal("muscle");
                          setTargets([id]);
                            setMode("explore");
                            setTab("target");
                            setPlaying(false);
                            setPlan(null);
    setPlanEditing(true);
                          }}
                        >
                          {muscleName(id)}
                        </button>
                      ))
                    ) : (
                      <small>此示例未单独标注</small>
                    )}
                  </div>
                </div>
                <div className="cue-title">
                  动作要领 <span>MOVEMENT NOTES</span>
                </div>
                {plannedExercise && <div className="plan-prescription">
                  <b>{plan!.title}</b>
                  <p>{plannedExercise.dose} · {plannedExercise.rest}</p>
                  <small>本次按计划训练量执行，下方通用建议供参考。</small>
                </div>}
                <ExerciseGuide exercise={exercise} />
                {exercise.motion === "squat" && (
                  <div className="squat-guidance">
                    <strong>膝盖可以适度超过脚尖</strong>
                    <p>
                      脚尖线用于观察位置，不是禁止越过的边界。保持脚跟着地、膝盖沿脚尖方向移动，在能控制的范围内下蹲。
                    </p>
                    <a
                      href="https://pubmed.ncbi.nlm.nih.gov/14636100/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      查看膝盖前移与关节负荷研究 ↗
                    </a>
                  </div>
                )}
                <p className="footnote">
                  {exercises.length} 条记录 · {animationCount} 个 3D 示意 ·{" "}
                  <button onClick={() => setLibrary(true)}>查看全部</button>
                </p>
              </div>
            ) : (
              <div className="panel-body target-body">
                <details className="plan-settings" open={planEditing} onToggle={e => setPlanEditing(e.currentTarget.open)}>
                  <summary><span>训练设置</span><small>{goalInfo.name} · {goal === "cardio" ? "徒手有氧" : equipment} · {level}</small><span className="settings-edit">修改</span></summary>
                  <div className="settings-content">
                <div className="section-heading">
                  <span className="step">01</span>
                  <h2>选择训练目标</h2>
                </div>
                <div className="goal-picker" role="group" aria-label="训练目标">
                  {trainingGoals.map(g => (
                    <button key={g.id} aria-pressed={goal === g.id}
                      className={goal === g.id ? "selected" : ""}
                      onClick={() => { setGoal(g.id); setPlan(null);
    setPlanEditing(true); setMode("explore"); setPlaying(false); }}>
                      <b>{g.name}{goal === g.id && <Check size={13} />}</b>
                      <span>{g.summary}</span>
                    </button>
                  ))}
                </div>
                <p className="goal-description">{goalInfo.description}</p>
                {goal === "muscle" && <>
                <div className="section-heading">
                  <span className="step">02</span>
                  <h2>今天，想练哪里？</h2>
                  <span className="pill">{targets.length} 已选</span>
                </div>
                <p className="subtext">
                  点击人体或下方肌群，可同时选择多个目标。
                </p>
                <div className="muscle-picker">
                  {Array.from(new Set(muscles.map((m) => m.area))).map(
                    (area) => (
                      <div className="area-row" key={area}>
                        <span>{area}</span>
                        <div>
                          {muscles
                            .filter((m) => m.area === area)
                            .map((m) => (
                              <button
                                key={m.id}
                                className={
                                  targets.includes(m.id) ? "selected" : ""
                                }
                                onClick={() => changeTarget(m.id)}
                              >
                                {m.name}
                                {targets.includes(m.id) ? (
                                  <Check size={12} />
                                ) : (
                                  <Plus size={12} />
                                )}
                              </button>
                            ))}
                        </div>
                      </div>
                    ),
                  )}
                </div>
                </>}
                {goal !== "cardio" && <div className="equipment-choice" role="group" aria-label="训练器械选择">
                  <button aria-pressed={equipment === "徒手"} onClick={() => changeEquipment("徒手")}><Check size={16} /><b>无需器械</b><span>默认 · 随时开练</span></button>
                  <button aria-pressed={equipment !== "徒手"} onClick={() => changeEquipment("全部")}><Dumbbell size={16} /><b>使用器械</b><span>我有可用器械</span></button>
                </div>}
                <div className="plan-filters">
                  {goal !== "cardio" && equipment !== "徒手" && <label>
                    指定器械
                    <select
                      value={equipment}
                      onChange={(e) => changeEquipment(e.target.value as typeof equipment)}
                    >
                      {["全部", ...equipmentOptions.filter(e => e !== "未标注" && e !== "徒手")].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </label>}
                  <label>
                    {goal === "cardio" ? "训练基础" : "动作难度"}
                    <select
                      value={level}
                      onChange={(e) => {
                        setLevel(e.target.value as typeof level);
                        setPlan(null);
    setPlanEditing(true);
                      }}
                    >
                      {["不限", "入门"].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </label>
                </div>
                  </div>
                </details>
                {plan !== null && (
                  <section className="plan-result" aria-live="polite">
                    <div className="section-heading">
                      <h2>{plan.title}</h2>
                      {(!!plan.exercises.length || !!plan.aerobic) && (
                        <button className="icon-btn" aria-label="导出训练组合" onClick={exportPlan}><Download size={16} /></button>
                      )}
                    </div>
                    {(!!plan.exercises.length || !!plan.aerobic) && <>
                      <p className="plan-frequency">{plan.frequency}</p>
                      {!!plan.exercises.length && <button className="outline-btn start-plan" onClick={() => choose(plannedExercise?.exercise ?? plan.exercises[0].exercise)}><Play size={16} />{plannedExercise && recent.includes(exercise.id) ? "继续查看动作" : "查看第一个动作"}<span>{plan.exercises.length} 个动作</span></button>}
                      <div className="plan-guidance warmup-brief"><b>先热身</b><p>{plan.warmup}</p></div>
                      {!!plan.exercises.length && <>
                        <h3 className="plan-section-title">{goal === "core" ? "核心训练" : "力量训练"} · 点击动作查看 3D 与要领</h3>
                        {plan.exercises.map(({ exercise: e, dose, rest }, i) => (
                          <button className={`plan-item ${e.id === exercise.id ? "current" : ""}`} key={e.id}
                            onClick={() => { choose(e); setTab("describe"); }}>
                            <span className="plan-num">0{i + 1}</span>
                            <div><b>{e.name}</b><small>{dose} · {e.equipment}</small><small>{rest}</small></div>
                            <Play size={14} />
                          </button>
                        ))}
                      </>}
                      {plan.aerobic && <div className="aerobic-block">
                        <div className="section-heading"><h3>{plan.aerobic.name} · {plan.aerobic.duration}</h3><span className="pill">文字指导 · 暂无 3D</span></div>
                        <p>{plan.aerobic.intensity}</p>
                        <ol>{plan.aerobic.steps.map(step => <li key={step}>{step}</li>)}</ol>
                      </div>}
                      <details className="plan-more"><summary>训练后放松与长期进阶</summary><div className="plan-guidance"><b>放松</b><p>{plan.cooldown}</p></div><div className="plan-guidance"><b>如何进阶</b><p>{plan.progression}</p></div></details>
                    </>}
                    {plan.notes.map(note => <p className="footnote" key={note}>{note}</p>)}
                  </section>
                )}
              </div>
            )}
          </aside>
        </div>
        <section className="quick-library">
          <div className="library-heading">
            <div>
              <span className="eyebrow">BUILD YOUR MOVEMENT VOCABULARY</span>
              <h2>从一个经典动作开始</h2>
            </div>
            <button className="text-btn" onClick={() => setLibrary(true)}>
              全部动作 <ArrowRight size={16} />
            </button>
          </div>
          <div className="quick-grid">
            {[exercises[0], exercises[8], exercises[4], exercises[1]].map(
              (e, i) => (
                <button
                  key={e.id}
                  className={`quick-item ${exercise.id === e.id ? "selected" : ""}`}
                  onClick={() => {
                    choose(e);
                    setTab("describe");
                    setResult(null);
                  }}
                >
                  <span className="quick-number">0{i + 1}</span>
                  <div>
                    <small>
                      {e.equipment} / {e.primary.map(muscleName).join(" · ")}
                    </small>
                    <h3>{e.name}</h3>
                    <span>{e.en}</span>
                  </div>
                  <ArrowUpRight size={20} />
                </button>
              ),
            )}
          </div>
        </section>
        <details className="proportion-reference">
          <summary>
            人体比例参考 <span>正面 · 背面 · 侧面</span>
          </summary>
          <img
            src="/references/muscle-proportions.png"
            alt="成年运动员正背侧三视图，带粗略肌群分区和身体比例对齐线"
            loading="lazy"
          />
          <p>
            用于对照头身、四肢与躯干比例；肌群色块为粗略区域示意，不作为精确解剖定位。模型已按参考调整为约
            7.5 头身。
          </p>
          <a
            href="/references/body-proportions.png"
            target="_blank"
            rel="noreferrer"
          >
            查看无肌群标注的比例原图 ↗
          </a>
        </details>
        <footer>
          <span>
            dayly. <span>让训练更有知觉。</span>
          </span>
          <span>{muscles.length} 个肌群 · {exercises.length} 条记录 · {animationCount} 个 3D 示意</span>
        </footer>
      </main>
      {library && (
        <div className="drawer-backdrop" onClick={() => setLibrary(false)}>
          <section
            className="library-drawer"
            ref={libraryRef}
            role="dialog"
            aria-modal="true"
            aria-label="动作库"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") setLibrary(false);
            }}
          >
            <div className="drawer-title">
              <div>
                <span className="eyebrow">MOVEMENT LIBRARY</span>
                <h2>
                  动作库 <small>{animationCount} 个可播放</small>
                </h2>
              </div>
              <button
                className="icon-btn"
                aria-label="关闭动作库"
                onClick={() => setLibrary(false)}
              >
                <X size={20} />
              </button>
            </div>
            <input
              autoFocus
              className="search"
              aria-label="搜索动作"
              placeholder="搜索中英文名称，如卧推 / bench press…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setLibraryPage(0); }}
            />
            <details className="catalog-about"><summary>内容范围与来源</summary><p className="catalog-summary">优先展示 {animationCount} 个可播放动作；全库有 {guidedCount} 份中文详解。另有 {exercises.length-animationCount} 条未配动画的参考资料；将「内容」切换为「全部」查看。已整合 {upstreamCount} 条开源记录。 <a href="https://github.com/yuhonas/free-exercise-db" target="_blank" rel="noreferrer">数据来源 ↗</a> · <a href="/data/free-exercise-db-LICENSE.txt" target="_blank" rel="noreferrer">Unlicense ↗</a></p></details>
            <div className="catalog-filters">
              <label>器械<select aria-label="筛选器械" value={libraryEquipment} onChange={e=>{setLibraryEquipment(e.target.value);setLibraryPage(0);}}>{["全部",...equipmentOptions].map(x=><option key={x}>{x}</option>)}</select></label>
              <label>肌群<select aria-label="筛选肌群" value={libraryMuscle} onChange={e=>{setLibraryMuscle(e.target.value);setLibraryPage(0);}}><option value="全部">全部</option>{muscles.map(m=><option value={m.id} key={m.id}>{m.name}</option>)}</select></label>
              <label>内容<select aria-label="筛选内容" value={librarySupport} onChange={e=>{setLibrarySupport(e.target.value);setLibraryPage(0);}}>{["3D演示","中文详解","参考资料","全部"].map(x=><option key={x}>{x}</option>)}</select></label>
            </div>
            <div className="catalog-pagination"><span>{shown.length} 条 · 第 {safePage+1} / {pageCount} 页</span><button disabled={safePage===0} onClick={()=>setLibraryPage(safePage-1)}>上一页</button><button disabled={safePage+1>=pageCount} onClick={()=>setLibraryPage(safePage+1)}>下一页</button></div>
            <div className="library-list">
              {shown.length ? (
                pageItems.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => {
                      choose(e);
                      setTab("describe");
                      setLibrary(false);
                      setResult(null);
                    }}
                  >
                    <span className="exercise-icon">
                      <Dumbbell size={21} />
                    </span>
                    <div>
                      <h3>{e.name}</h3>
                      <span className="catalog-badge">{e.motion ? "3D 演示 · 中文详解" : guideFor(e.id) ? "中文详解 · 静态图谱" : e.cues.length ? "原文步骤 · 静态图谱" : "来源缺少步骤 · 静态图谱"}</span>
                      <small>
                        {e.primary.map(muscleName).join(" · ") || e.unmapped?.join(" · ") || "肌群未标注"} / {e.equipment}
                      </small>
                    </div>
                    <ArrowUpRight size={17} />
                  </button>
                ))
              ) : (
                <div className="subtext"><p>当前筛选下没有对应动作。未配动画的条目可在参考资料中查阅。</p><button className="inline-link" onClick={()=>{setLibrarySupport("全部");setLibraryPage(0);}}>查找全部记录 →</button></div>
              )}
            </div>
          </section>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
    </div>
  );
}
