# GitHub 健身动作库调研

核查日期：2026-09-08（Asia/Shanghai）。通过 agent-reach 的 GitHub CLI 路线，执行 GitHub 仓库搜索、仓库 API、README、目录树与原始数据检查。Stars 为本次实时快照；不是动作医学准确性的评分。

## 选择结论

优先用 **yuhonas/free-exercise-db** 作为动作数据层；参考 **Workout Cool / workout.lol** 的器械和肌群筛选交互；需要多语言、后台编辑和社区管理时考虑 **wger**。这些项目都不能直接提供可用于当前 Three.js 角色的完整绑定骨骼动作库。动作条目、图片 / 视频与 3D 动画轨道是三种不同资产。

| 项目 | Stars | 已核查内容 | 适用点 | 限制 / 许可证 |
| --- | ---: | --- | --- | --- |
| [Snouzy/workout-cool](https://github.com/Snouzy/workout-cool) | 8,445 | Next.js 健身平台；训练计划、动作说明、视频 URL；仓库 data 下为 sample-exercises.csv（19 行属性、3 个独立动作） | 产品结构、器械/肌群筛选、训练计划交互 | 代码 MIT；示例数据不等于线上完整视频库。README 明确讨论视频授权成本，不能把外部视频当作 MIT 素材 |
| [wger-project/wger](https://github.com/wger-project/wger) | 6,872 | 自托管健身平台、Exercise Wiki、REST API、多语言 | 可编辑的动作后台、社区数据、多用户训练管理 | 代码 AGPL-3.0-or-later；动作/食材按具体条目 Creative Commons 许可；文档 CC-BY-SA-4.0 |
| [yuhonas/free-exercise-db](https://github.com/yuhonas/free-exercise-db) | 1,851 | 下载并统计 dist/exercises.json，876 条动作；主练、辅助、器械、难度、步骤、图片路径 | 最适合本项目先接入的静态 JSON 数据源 | 仓库声明 Public Domain / Unlicense；是说明与静态图片，不是 3D 动画；部分字段缺失 |
| [workout-lol/workout-lol](https://github.com/workout-lol/workout-lol) | 1,565 | 根据可用器械、目标肌群创建训练；Next.js + MongoDB | 与当前需求非常接近的交互参考 | MIT；最近推送 2024-09-27，需注意维护状态。未把外部演示链接视为可再分发视频 |
| [wrkout/exercises.json](https://github.com/wrkout/exercises.json) | 632 | Public Domain JSON，free-exercise-db 上游 | 追溯数据来源、原始结构 | Unlicense；README 的 2,500+ 动作 / 视频商业套餐是另一个服务，不能当作开源仓库已有内容 |
| [ExerciseDB/exercisedb-api](https://github.com/ExerciseDB/exercisedb-api) | 627 | 当前 main 树只有 LICENSE、README.md | 可比较外部 API 数据结构 | 仓库显示 AGPL-3.0，但没有完整 API 实现或 11,000+ 数据；README 指向 RapidAPI、套餐和独立条款 |

## Free Exercise DB 实际数据检查

源文件：[dist/exercises.json](https://github.com/yuhonas/free-exercise-db/blob/main/dist/exercises.json)。本地保存 `free-exercises.snapshot.json`。

- 876 条记录，876 条都有主练肌群。
- 873 条带图片路径；871 条带动作说明。
- 604 条含非空辅助肌群；空数组不等于没有任何辅助参与。
- 77 条器械字段为 null；不能默认视为徒手。
- 共 17 个肌群分类；图片链接尚未逐一下载和授权链复核。
- README 承认部分 force、mechanic、equipment 不完整，并存在少量重复图片。

字段：`id`、`name`、`force`、`level`、`mechanic`、`equipment`、`primaryMuscles`、`secondaryMuscles`、`instructions`、`category`、`images`。

当前已接入固定提交 `a859101d633a01c4a1a920d6a8ce41dabba0705f` 的全部 876 条数据。合并 8 条等价来源记录后，连同 14 个自编示例共 882 条；42 条有整理的中文指导，14 条有 3D 示意，其余仅静态肌群参考和原始步骤。缺少步骤的记录明确提示，未知器械保留“未标注”。推荐仅选中文指导条目。中文为参考来源、按变式整理的提示，未逐项通过教练验收。

本轮复核 Free Exercise DB 为 1,851 stars，wger 为 6,872；表中其他仓库沿用先前同日快照，未重新计数。来源文件与 Unlicense 均保留在项目。

## 与当前肌群 ID 的映射

| 上游分类 | 当前 ID | 处理 |
| --- | --- | --- |
| chest, biceps, triceps, forearms, lats, traps, glutes, hamstrings, adductors, calves | 同名 | 可以直接映射到肌群层级 |
| quadriceps | quads | 名称归一化 |
| shoulders | deltoids | 当前模型仅支持肩部总类，不能假装区分前中后束 |
| lower back | erectors | 作为粗粒度映射，保留原始名称与映射备注 |
| abdominals | abs | 上游粒度粗，不应自动断言腹斜肌有同等激活 |
| middle back | 待细分 | 包含不同背部肌肉，不能强行只等同于背阔肌 |
| abductors | 待新增 | 与 adductors（内收肌）不同；不能混映射 |
| neck | 待新增 | 不应直接等同于斜方肌 |

文本理解返回动作候选 ID，再由明确的动作记录映射肌群。记录原始来源，允许用户纠正；不能把关键词推断包装成实测激活。

## 3D 模型相关补充

检索到 [thebuggeddev/anatomy](https://github.com/thebuggeddev/anatomy)（3,204 stars），但实际文件主要是器官模型与页面，仓库未声明许可证，也没有核查到可直接使用的完整肌肉骨骼动画资产，因此未将其代码或模型导入本项目。

## 原始证据入口

- [Free Exercise DB README](https://github.com/yuhonas/free-exercise-db/blob/main/README.md) / [许可证](https://github.com/yuhonas/free-exercise-db/blob/main/LICENSE.md)
- [Workout Cool README 与导入说明](https://github.com/Snouzy/workout-cool/blob/main/README.md) / [data](https://github.com/Snouzy/workout-cool/tree/main/data)
- [wger README 许可证分类](https://github.com/wger-project/wger/blob/master/README.md#license)
- [ExerciseDB 当前文件列表](https://github.com/ExerciseDB/exercisedb-api)
- [wrkout README](https://github.com/wrkout/exercises.json)

## 动画扩展实现更新

2026-09-08：在数据接入基础上自行编排 26 个常用动作配置，现有 40 个可播放条目。Free Exercise DB 提供的是记录和步骤，这些新增 3D 动画并非来自该仓库的现成动画资产。尚有 842 条参考记录未配动画。实现和检查见 `artifacts/qa-expanded-animations.md`。
