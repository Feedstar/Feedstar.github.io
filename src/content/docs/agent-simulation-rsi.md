---
publishedDate: '2026-11-11'
title: "Agent 在仿真中的应用与递归自我改进"
description: "从资产建设、任务编排到机器人能力与 RSI，梳理 Agent 贯穿仿真生命周期的研究进展，结合图示与视频讨论可验证的持续改进。"
category: "研究综述"
tags: ["Agent", "仿真", "RSI", "具身智能", "MuJoCo", "Isaac"]
order: 7
cover: /document-covers/agent-simulation-rsi.webp
---

**综合研究报告 · 资产建设 / 任务编排 / 机器人能力 / RSI**  
资料截至 2026 年 11 月 11 日

> **仿真正从机器人能力的测试场，扩展为 Agent 建设环境、组织实验和持续改进能力的工作空间。** 这一变化连接了资产、数据、策略与工具，也使评价重点从“完成一次任务”延伸到“能否以可验证的方式持续进步”。

研究范围覆盖 Agent 在仿真生命周期中的应用及 RSI 的证据进展。分析依据论文、作者项目和企业公开成果；实验结果来自作者报告，未进行独立复现，各项指标需结合对应实验条件理解。

## 01 研究总览：Agent 贯穿仿真的完整生命周期

Agent 在仿真中的价值，体现在四类相互连接的工作中：**建设可用环境、组织可执行任务、驱动机器人能力、利用反馈改进系统。** 其中，资产和实验 Agent 主要调用工程工具；具身 Agent 则通过感知、规划与控制作用于环境。

<a class="document-image-link" href="/document-assets/agent-simulation-rsi/01-system-map.webp" target="_blank" rel="noopener" aria-label="查看原图：Agent 与仿真的完整生命周期">
<img src="/document-assets/agent-simulation-rsi/01-system-map.webp" alt="Agent 与仿真的完整生命周期" width="1600" height="900" loading="lazy" decoding="async" />
</a>

*图 1｜综合架构示意。环境建设、任务执行和能力改进共享实验记录与版本信息。*

| 应用层 | Agent 的核心职责 | 可交付成果 | 评价重点 |
|---|---|---|---|
| **资产与环境** | 生成、检索、装配、标注和物理修复 | 可交互物体、场景、数字孪生 | 物理有效性与训练可用性 |
| **任务与实验** | 定义目标、拆分任务、生成奖励、安排训练 | 任务规格、课程、数据和实验记录 | 可执行性、覆盖度与成本 |
| **机器人能力** | 感知、规划、调用技能、执行动作和恢复 | 操作、导航、全身控制能力 | 成功率、鲁棒性与迁移 |
| **持续改进** | 诊断失败、选择修改对象、复测并保留版本 | 新技能、策略、工具及改进流程 | 持久收益与后续改进效率 |

当前研究呈现四项趋势：

- **资产验收向下游延伸。** 几何与物理检查之外，机器人能否操作、能否生成训练数据，正成为更直接的指标。
- **任务编排开始形成工程闭环。** 类型化规格、执行检查、失败修复与版本记录，使语言生成能够进入可重复实验。
- **动作驱动采用多层能力组合。** 高层推理、VLA、运动规划、技能策略和低层控制各自承担不同职责。
- **RSI 研究开始细分改进对象。** 技能积累、策略训练、世界估计修正与改进工具更新，需要分别评价。

这些判断综合自 SceneSmith、Artisan、HARBOR 及具身 RSI 研究；不构成所有平台已达到同等成熟度的判断。[R08 · SceneSmith](https://scenesmith.github.io/) · [R10 · Artisan](https://arxiv.org/html/2610.13947v3) · [R33 · HARBOR](https://arxiv.org/abs/2606.08610) · [R01 · RSI 机制与评价综述](https://arxiv.org/abs/2610.38266)

## 02 概念与演进：从自动化试验到持久能力改进

### 2.1 Agent、策略与 Harness 的分工

**Agent 负责围绕目标组织行动与反馈；策略负责将观测映射为动作；Harness 提供模型外的工具、记忆、提示、接口和执行流程。** 同一个系统可以同时包含三者。

例如，“把杯子放入柜内”需要目标理解与步骤安排，也需要抓取、避障、关节控制和结果检查。仿真则提供可重置环境、观测、交互结果与训练条件。模型能力与这些外部机制共同决定系统表现。

### 2.2 关键演进脉络

| 阶段 | 代表工作 | 主要推进 |
|---|---|---|
| **环境与课程共同演化** | POET、ACCEL | 自动寻找有学习价值的环境与难度，建立开放式训练思路 |
| **语言模型进入开发环节** | GenSim、RoboGen、Eureka、Voyager | 生成任务、奖励和技能代码，将失败反馈接入迭代 |
| **生成与具身学习协同扩展** | Holodeck、DrEureka、Articulate-Anything、VLA | 扩大环境供给，探索可动对象、策略适配与真实迁移 |
| **2026 年的系统化闭环** | SceneSmith、Artisan、HARBOR、RPG、EmbodiRSI、ENPIRE | 连接环境建设、实验工程、持续训练及真实机器人验证 |

来源：[R05 · POET](https://proceedings.mlr.press/v119/wang20l.html) · [R06 · ACCEL](https://proceedings.mlr.press/v162/parker-holder22a.html) · [R22 · GenSim](https://gen-sim.github.io/) · [R25 · Eureka](https://arxiv.org/abs/2310.12931) · [R76 · Voyager](https://voyager.minedojo.org/)。各系统的闭环强度不同；年代序列反映研究方向扩展。

### 2.3 RSI 的证据应分层理解

RSI 的证据可按 2026 年综述提出的 L0–L3 框架分层理解。**它是研究性分类框架，并非行业认证标准。** [R01](https://arxiv.org/abs/2610.38266)

| 层级 | 发生的变化 | 对应证据 |
|---|---|---|
| **L0：任务内适应** | 当前任务中重新规划、重试或调整状态 | 本次执行改善 |
| **L1：持久能力提升** | 保存技能、策略或数据，后续任务可复用 | 冻结新版本后仍有收益 |
| **L2：改进流程被继承** | 修改诊断、实验选择或记忆管理工具 | 修改后的流程实际参与后续改进 |
| **L3：改进器收益得到验证** | 新流程产生改进的能力更强 | 相同起点、相同预算下优于旧流程 |

**RSI 的核心研究问题，是改进能力能否随系统迭代而提升。** 因此，单次成功、训练分数上升和技能库扩充分别提供不同强度的证据。

## 03 资产建设：从三维模型到可训练环境

### 3.1 六层验收决定资产的实际价值

仿真资产同时包含外形、结构、交互语义和物理配置。进入机器人训练之前，还需要验证任务条件及数据生成流程。

<a class="document-image-link" href="/document-assets/agent-simulation-rsi/02-asset-gates.webp" target="_blank" rel="noopener" aria-label="查看原图：仿真资产的六层验收">
<img src="/document-assets/agent-simulation-rsi/02-asset-gates.webp" alt="仿真资产的六层验收" width="1600" height="1120" loading="lazy" decoding="async" />
</a>

*图 2｜资产验收框架。六层检查为综合工程归纳，具体判据随任务与后端变化。*

“抽屉可以打开”还涉及滑动轴、限位、摩擦、把手可达性和机器人行程。资产在物理上有效，仍可能因操作空间不足或示范迁移失败而无法用于训练。

### 3.2 四类技术路线逐步形成互补

| 路线 | 代表成果 | Agent 或模型的作用 | 主要约束 |
|---|---|---|---|
| **生成结构化几何** | PartCrafter | 由图像生成可分离的语义部件，为后续装配提供输入 | 分件结果仍需关节与动力学配置 |
| **编写可动对象程序** | Articulate-Anything、Articraft、Artisan | 组织检索、代码生成、结构检查与物理反馈 | 机构正确性与修复成本 |
| **检索并保持既有机构** | AffordCraft | 调整可靠对象的尺度与位姿，保留关节后做物理检查 | 资产库覆盖与检索质量 |
| **构造完整交互场景** | Holodeck、SceneSmith、SAGE | 分配布局、对象、语义和交互空间 | 场景约束、密度与任务可行性 |

来源：[R16 · PartCrafter](https://arxiv.org/abs/2506.05573) · [R15 · Articulate-Anything](https://arxiv.org/abs/2410.13882) · [R11 · Articraft](https://arxiv.org/abs/2605.15187) · [R20 · AffordCraft](https://arxiv.org/abs/2610.06643) · [R07 · Holodeck](https://arxiv.org/abs/2312.09067)。PartCrafter 是结构化生成模型；场景 Agent 可以将其作为工具调用。

### 3.3 SceneSmith：分阶段建设完整场景

SceneSmith 将场景建设拆为**布局、家具、墙面、天花板和小型操作对象**五个阶段，由设计、评价和编排角色共同修订。生成环境进一步用于遥操作和策略评测，体现出从场景供给到具身使用的衔接。[R08](https://scenesmith.github.io/)

<a class="document-image-link" href="/document-assets/agent-simulation-rsi/scenesmith-scenes.webp" target="_blank" rel="noopener" aria-label="查看原图：SceneSmith 作者展示的室内场景">
<img src="/document-assets/agent-simulation-rsi/scenesmith-scenes.webp" alt="SceneSmith 作者展示的室内场景" width="1946" height="1265" loading="lazy" decoding="async" />
</a>

*图 3｜SceneSmith 作者生成场景。原图来源：[SceneSmith 官方项目](https://scenesmith.github.io/)。图片展示场景构造结果，实验指标以论文为准。*

<figure class="document-video" id="video-scenesmith-build">
<video controls playsinline preload="none" poster="/document-assets/agent-simulation-rsi/scenesmith-scenes.webp" width="1920" height="1080" aria-label="SceneSmith：从提示逐步建设餐厅">
<source src="https://scenesmith.github.io/static/videos/scene_buildup/158.mp4" type="video/mp4" />
你的浏览器暂不支持视频播放。<a href="https://scenesmith.github.io/static/videos/scene_buildup/158.mp4">打开视频</a>
</video>
<figcaption>SceneSmith：从提示逐步建设餐厅<span>作者 / 机构公开演示</span></figcaption>
</figure>

**视频 1｜SceneSmith 场景建设。** 餐厅从布局到家具、餐具逐步形成。[官方项目](https://scenesmith.github.io/) · [播放原视频](https://scenesmith.github.io/static/videos/scene_buildup/158.mp4)

SAGE 则以具身任务为条件，通过视觉评价和物理稳定性检查修订场景。SAGE-10K 提供 10,000 个场景，覆盖 50 类房间和多种风格；其图像条件生成强调语义一致性。[R09 · SAGE](https://arxiv.org/html/2602.10116v2)

**跨仿真器导出仍是一项独立验证工作。** SceneSmith 原生面向 Drake，官方将 MuJoCo 和 USD / Isaac 导出标为实验性；导出成功之后，还需检查关节、碰撞和任务行为。[SceneSmith 代码](https://github.com/nepfaff/scenesmith)

### 3.4 Artisan：把验收延伸至机器人示范

Artisan 通过多角色协作和仿真反馈修复可动对象，并使用示范采集检验资产用途。其 RoboCasa365 实验包含八项操作任务，每种资产来源各有 80 个候选。[R10 · 论文 v3，附录 E.2](https://arxiv.org/html/2610.13947v3)

<a class="document-image-link" href="/document-assets/agent-simulation-rsi/artisan-assets.webp" target="_blank" rel="noopener" aria-label="查看原图：Artisan 可动对象与部件级结构">
<img src="/document-assets/agent-simulation-rsi/artisan-assets.webp" alt="Artisan 可动对象与部件级结构" width="1602" height="696" loading="lazy" decoding="async" />
</a>

*图 4｜Artisan 作者展示的可动对象及部件结构。原图来源：[Artisan 官方项目](https://physicalvision.github.io/artisan/)。*

<a class="document-image-link" href="/document-assets/agent-simulation-rsi/03-artisan-funnel.webp" target="_blank" rel="noopener" aria-label="查看原图：Artisan 资产的两轮筛选结果">
<img src="/document-assets/agent-simulation-rsi/03-artisan-funnel.webp" alt="Artisan 资产的两轮筛选结果" width="1600" height="990" loading="lazy" decoding="async" />
</a>

*图 5｜根据 Artisan 论文 v3 附录 E.2 重绘。每组初始资产数均为 80；第二轮为第一轮子集。统计单位为资产，衡量既定示范流程的可用性。*

原生资产、Artisan 和 Articraft 分别有 **78、76、31** 个候选通过物理与任务可行性筛选，最终分别有 **61、35、6** 个支持成功生成示范。部分损耗来自机构与参考轨迹不兼容。

这一结果表明，**资产生产应与操作约束、示范方法和训练流程共同设计。** 仅扩大资产数量，无法直接推导可用训练经验的增长。

<figure class="document-video" id="video-artisan-collision">
<video controls playsinline preload="none" poster="https://physicalvision.github.io/artisan/assets/clips/collision.webp" width="1920" height="1080" aria-label="Artisan：关节运动与碰撞验证">
<source src="https://physicalvision.github.io/artisan/assets/clips/collision.mp4" type="video/mp4" />
你的浏览器暂不支持视频播放。<a href="https://physicalvision.github.io/artisan/assets/clips/collision.mp4">打开视频</a>
</video>
<figcaption>Artisan：关节运动与碰撞验证<span>作者 / 机构公开演示</span></figcaption>
</figure>

**视频 2｜Artisan 关节与碰撞检查。** 动态演示揭示静态外观难以暴露的机构问题。[官方项目](https://physicalvision.github.io/artisan/) · [播放原视频](https://physicalvision.github.io/artisan/assets/clips/collision.mp4)

### 3.5 产业实践：Agent 接入已有资产生产链

NVIDIA 的公开工作流将 Blender 场景检查、语义标签、传感器、碰撞和物理属性配置连接起来，再通过 SimReady 检查交付 OpenUSD 场景。这是一条面向工程生产的参考路线，价值在于让既有资产获得仿真所需的信息。[R83 · NVIDIA 官方技术文章](https://developer.nvidia.com/blog/how-to-use-ai-agents-to-prepare-3d-scenes-for-simulation/)

**综合判断：** 近期可落地的方向，是将检索、生成、程序化编辑和验证组合使用，并为每个资产保存来源、任务适用范围与通过的检查版本。

## 04 任务编排：把自然语言目标变成可重复实验

### 4.1 可执行任务需要完整规格

任务编排连接“要完成什么”与“如何训练、执行和验收”。其核心产物是一份包含环境、接口和评价约束的实验规格。

| 规格组成 | 必要内容 | 对实验的作用 |
|---|---|---|
| **任务与场景** | 对象关系、初始状态、重置分布、可达空间 | 明确任务条件 |
| **观测与动作** | 传感器、坐标系、单位、控制模式、频率 | 避免模块接入歧义 |
| **训练与数据** | 奖励、终止规则、课程、示范来源、预算 | 支持训练复现与成本比较 |
| **成功与失败** | 终态判据、中间阶段、超时、碰撞、恢复规则 | 区分局部完成与完整成功 |
| **记录与版本** | 资产版本、随机种子、轨迹、模型与代码版本 | 支持诊断、回归和审计 |

这是跨系统归纳的实验契约。成功判据应在试验前固定，并与用于搜索的奖励分开管理。

<figure class="document-video" id="video-task-experiment-loop">
<video controls playsinline preload="none" poster="/document-assets/agent-simulation-rsi/task-experiment-loop-poster.webp" width="1920" height="1080" aria-label="任务如何进入仿真实验闭环">
<source src="/document-assets/agent-simulation-rsi/task-experiment-loop.mp4" type="video/mp4" />
你的浏览器暂不支持视频播放。<a href="/document-assets/agent-simulation-rsi/task-experiment-loop.mp4">打开视频</a>
</video>
<figcaption>任务如何进入仿真实验闭环<span>36 秒 · 1080p · 原理示意</span></figcaption>
</figure>

**机制演示 A｜任务如何进入仿真实验闭环。** 以三维机械臂收球、关抽屉的连续动作为主线，通过残余缝隙定位失败，再展示动作终点修正、同初态复测与版本归档。独立检查逻辑保持不变，失败反馈用于任务级调试；画面为原理示意。[播放 MP4](/document-assets/agent-simulation-rsi/task-experiment-loop.mp4)

### 4.2 从生成任务，到检查并修复任务

GenSim、RoboGen 和 GenSim2 探索了语言模型生成任务、场景与学习方案的路径。后续系统进一步把接口检查、执行验证和定向修复纳入编排。[R22 · GenSim](https://gen-sim.github.io/) · [R21 · RoboGen](https://arxiv.org/abs/2311.01455) · [R23 · GenSim2](https://arxiv.org/abs/2410.03645)

| 系统 | 主要编排对象 | 闭环机制 | 研究意义 |
|---|---|---|---|
| **HARBOR** | 环境、奖励、算法与训练工程 | 阶段性工件经过接口和行为检查，失败后修复 | 将代码运行与行为正确分开验证 |
| **Isaac Lab-Arena** | 环境定义、空间关系与策略评测 | 类型化环境图、资产检索、约束求解、碰撞与可达性检查 | 支持受控的环境构造与评测 |
| **FATE** | 可行任务与课程 | 静态检查后进行仿真执行，再修场景或策略规格 | 用实际交互验证任务可行性 |
| **EmbodiedSmith** | 资产、场景和任务 | 场景预留操作条件，任务反向触发场景编辑 | 让环境和任务共同适配 |

来源：[R33 · HARBOR](https://arxiv.org/abs/2606.08610) · [R29 · Arena 已测试版本文档](https://isaac-sim.github.io/IsaacLab-Arena/release/0.3.0/index.html) · [R34 · FATE](https://arxiv.org/abs/2603.01505) · [R32 · EmbodiedSmith](https://arxiv.org/abs/2610.07969)。Arena 的开发分支与已测试发布版需分别对待；部分语义检查仍依赖 Agent 判断。

### 4.3 奖励、课程和数据是三类不同的优化变量

- **奖励设计决定学习信号。** Eureka 生成并迭代奖励代码，利用训练反馈筛选候选；改进对象主要是奖励函数。[R25](https://arxiv.org/abs/2310.12931)
- **环境与课程决定练习分布。** ACCEL 等工作按学习价值选择环境；DrEureka 将语言模型用于奖励与域随机化设计，探索真实迁移。[R06](https://proceedings.mlr.press/v162/parker-holder22a.html) · [R26](https://arxiv.org/abs/2406.01967)
- **数据采集决定补齐的能力。** EmbodiRSI 从策略失败出发补充纠正轨迹和薄弱区域数据，使后续训练针对当前能力缺口。[R39](https://arxiv.org/html/2609.38905v4)

这三类迭代可以共同提升策略。要进一步论证 RSI，还需验证生成奖励、选择课程或安排采集的机制本身是否产生可继承的改进。

## 05 机器人 Action：分层决策与闭环执行

### 5.1 从任务目标到低层控制

机器人动作驱动覆盖语义决策、空间规划、动作生成和物理控制。高层 Agent 可以调用技能或策略；动作模块则接受目标、观测与状态，生成可执行控制。

<a class="document-image-link" href="/document-assets/agent-simulation-rsi/05-action-stack.webp" target="_blank" rel="noopener" aria-label="查看原图：机器人动作驱动的分层架构">
<img src="/document-assets/agent-simulation-rsi/05-action-stack.webp" alt="机器人动作驱动的分层架构" width="1600" height="1050" loading="lazy" decoding="async" />
</a>

*图 6｜高层 Agent、技能 / 规划、VLA 与低层控制的接口关系；实际控制频率和模块边界由平台确定。*

| 能力层 | 主要输出 | 典型实现 |
|---|---|---|
| **任务决策** | 子目标、技能选择、执行顺序、恢复方案 | 语言 / 多模态 Agent、状态机、任务图 |
| **空间与动作规划** | 抓取位姿、路径、约束、接触序列 | TAMP、运动规划、视觉价值地图 |
| **动作策略** | 动作序列或动作块 | VLA、模仿学习、强化学习策略 |
| **运动执行** | 关节目标、速度或力矩 | 机器人控制器、全身控制器、跟踪策略 |

### 5.2 规划与代码：把语言约束落实到空间动作

Code as Policies 将语言任务转换为调用感知与控制 API 的程序；VoxPoser 将语言与视觉信息组合为空间价值地图，再由规划器生成运动。两者说明，**可调用接口与空间反馈是语言推理接入机器人的关键桥梁。** [R84 · Code as Policies](https://code-as-policies.github.io/) · [R82 · VoxPoser](https://voxposer.github.io/)

<figure class="document-video" id="video-voxposer-drawer">
<video controls playsinline preload="none" poster="/document-assets/agent-simulation-rsi/voxposer-drawer-poster.svg" width="1920" height="1080" aria-label="VoxPoser：扰动下的闭环操作">
<source src="https://voxposer.github.io/media/videos/close-top-drawer-dist.mp4" type="video/mp4" />
你的浏览器暂不支持视频播放。<a href="https://voxposer.github.io/media/videos/close-top-drawer-dist.mp4">打开视频</a>
</video>
<figcaption>VoxPoser：扰动下的闭环操作<span>作者 / 机构公开演示</span></figcaption>
</figure>

**视频 3｜VoxPoser 在扰动下关闭顶层抽屉。** 视觉反馈更新地图并触发重规划，展示执行过程中的闭环调整。[官方项目](https://voxposer.github.io/) · [播放原视频](https://voxposer.github.io/media/videos/close-top-drawer-dist.mp4)

该演示使用既有感知与动作接口。闭环恢复体现运行时适应，其持久收益需另行评估。

### 5.3 VLA：联合表达视觉、语言和动作

OpenVLA 代表从图像与语言条件生成机器人动作的路线；OpenVLA-OFT 研究高效适配，SimpleVLA-RL 与 VLA-RL 将强化学习用于后续优化。仿真在其中提供并行交互、可控扰动和可重复评价。[R85 · OpenVLA](https://openvla.github.io/) · [R48 · OpenVLA-OFT](https://arxiv.org/abs/2502.19645) · [R49 · SimpleVLA-RL](https://arxiv.org/abs/2509.09674) · [R50 · VLA-RL](https://arxiv.org/abs/2505.18719)

Physical Intelligence 的 π*0.6 / RECAP 则把人类示范、纠正和自主经验接入策略改进。这一产业案例表明，部署反馈能够进入训练链路，同时也需要明确人类数据在闭环中的作用。[R52 · 官方成果](https://www.pi.website/blog/pistar06)

### 5.4 全身运动：仿真负责练习，真实反馈负责对齐

| 成果 | 主要机制 | 与高层 Agent 的关系 |
|---|---|---|
| **ASAP** | 先在仿真中学习人类动作，再用真实数据学习动作残差并微调 | 提供可调用的敏捷运动能力 |
| **BeyondMimic** | 运动跟踪与动作组合，支持真实机器人技能 | 为任务层提供连续全身行为 |
| **SONIC** | 扩展运动跟踪与统一控制接口，连接不同上层输入 | 提供全身移动与操作的基础执行层 |

来源：[R54 · ASAP](https://arxiv.org/abs/2502.01143) · [R55 · BeyondMimic](https://arxiv.org/abs/2508.08241) · [R56 · SONIC](https://arxiv.org/abs/2511.07820)。运动能力成果与高层语言任务自主性应分别评价。

<figure class="document-video" id="video-asap-kick">
<video controls playsinline preload="none" poster="/document-assets/agent-simulation-rsi/asap-kick-poster.svg" width="1920" height="1080" aria-label="ASAP：动力学对齐后的全身运动">
<source src="https://agile.human2humanoid.com/static/videos/ASAP-Website-Kick-AfterASAP-1080P.mp4" type="video/mp4" />
你的浏览器暂不支持视频播放。<a href="https://agile.human2humanoid.com/static/videos/ASAP-Website-Kick-AfterASAP-1080P.mp4">打开视频</a>
</video>
<figcaption>ASAP：动力学对齐后的全身运动<span>作者 / 机构公开演示</span></figcaption>
</figure>

**视频 4｜ASAP 微调后的真机踢腿。** 展示仿真与真实动力学对齐后的全身运动；定量收益需结合论文及微调前对照。[官方项目](https://agile.human2humanoid.com/) · [播放原视频](https://agile.human2humanoid.com/static/videos/ASAP-Website-Kick-AfterASAP-1080P.mp4)

## 06 感知与触觉：从识别对象到估计可行动状态

### 6.1 感知同时服务执行与训练

执行阶段，Agent 需要知道对象在哪里、状态是否改变、观察是否可靠。训练阶段，仿真可提供精确标注和可控难例，支持感知模型迭代。

<a class="document-image-link" href="/document-assets/agent-simulation-rsi/06-perception-loops.webp" target="_blank" rel="noopener" aria-label="查看原图：感知的在线与离线闭环">
<img src="/document-assets/agent-simulation-rsi/06-perception-loops.webp" alt="感知的在线与离线闭环" width="1600" height="1000" loading="lazy" decoding="async" />
</a>

*图 7｜主动感知与数据迭代的两类闭环。仿真真值适合标注和诊断，部署能力需用对应传感器输入验证。*

- **几何状态估计。** FoundationPose 提供对象六自由度位姿估计与跟踪，可作为操作系统的感知组件。[R86](https://nvlabs.github.io/FoundationPose/)
- **关系与语义理解。** SG-Nav 将场景图和语言推理接入导航，并通过再感知更新目标判断。[R87](https://bagh2178.github.io/SG-Nav/)
- **主动获取信息。** 当遮挡或状态不确定时，移动相机、靠近目标和重新观察可以成为任务动作的一部分。

**综合判断：** 感知评测应从识别准确率延伸到任务相关状态，包括“门是否完全关闭”“目标是否位于上层”和“接触是否稳定”。这些状态直接决定后续行动。

### 6.2 触觉接口必须保留物理含义

接触密集任务依赖触觉、接触力和滑动信息。不同仿真接口输出的物理量并不相同，模型训练前需要统一单位、坐标系和标定方式。

| 接口 / 研究 | 输出或机制 | 使用时的关键边界 |
|---|---|---|
| **MuJoCo 3.17.0 tactile** | 每顶点穿透深度与两方向切向滑动速度；输出为 3N | 切向输出依赖网格法向配置；穿透深度需经传感器模型才能映射为压力等信号 |
| **Genesis v1.4.5 tactile** | 基于几何 / SDF 的 taxel 接触估计 | 官方文档标注未校准；与求解器冲量及真实传感器读数有区别 |
| **Newton SensorContact** | 按接触对象汇总力、摩擦等接触信息 | 适合接触分析；密集触觉阵列还需额外建模 |
| **Tactile Genesis** | 仿真中研究触觉布局并验证灵巧手任务 | 在所测三项任务中，覆盖位置比继续提高分辨率更关键 |

来源：[R66 · MuJoCo 固定版本文档](https://mujoco.readthedocs.io/en/3.17.0/XMLreference.html#sensor-tactile) · [R67 · Genesis 固定版本文档](https://genesis-world.readthedocs.io/en/v1.4.5/user_guide/sensing/tactile.html) · [R68 · Newton 官方接口](https://newton-physics.github.io/newton/stable/api/_generated/newton.sensors.SensorContact.html) · [R69 · Tactile Genesis](https://arxiv.org/abs/2606.22332)。论文结论的适用范围由所测任务和硬件限定。

## 07 世界模型：扩展经验来源与预测能力

世界模型可以参与视觉数据生成、未来预测、动作规划和环境交互。其价值取决于具体用途及误差如何影响最终任务。

| 用途 | 代表成果 | 对机器人系统的作用 |
|---|---|---|
| **生成训练经验** | DreamGen | 利用视频世界模型扩展机器人学习数据 |
| **预测与规划** | Cosmos Policy、DreamZero | 联合建模动作与未来视觉状态，支持控制与策略学习 |
| **在模型内练习** | DreamerV3、Dreamer 4 | 在学习到的动力学中训练策略，再验证环境表现 |
| **构造交互世界** | SIMA 2 / Genie、Interactive Cosmos | 扩展 Agent 可交互的虚拟经验空间 |
| **校正显式世界估计** | D-World | 用动作后的观测残差更新状态和物理参数 |

来源：[R58 · DreamGen](https://arxiv.org/abs/2505.12705) · [R59 · Cosmos Policy](https://arxiv.org/abs/2601.16163) · [R60 · DreamZero](https://arxiv.org/abs/2602.15922) · [R61 · DreamerV3](https://danijar.com/project/dreamerv3/) · [R62 · Dreamer 4](https://arxiv.org/abs/2509.24527) · [R38 · D-World](https://arxiv.org/abs/2610.17114)

<figure class="document-video" id="video-dreamer4-imagination">
<video controls playsinline preload="none" poster="/document-assets/agent-simulation-rsi/dreamer4-imagination-poster.svg" width="1920" height="1080" aria-label="Dreamer 4：在世界模型中练习">
<source src="https://danijar.com/asset/dreamer4/imag/treechop1.mp4" type="video/mp4" />
你的浏览器暂不支持视频播放。<a href="https://danijar.com/asset/dreamer4/imag/treechop1.mp4">打开视频</a>
</video>
<figcaption>Dreamer 4：在世界模型中练习<span>作者 / 机构公开演示</span></figcaption>
</figure>

**视频 5｜Dreamer 4 在世界模型中练习采木。** 画面是学习到的 Minecraft 世界模型产生的想象轨迹，用于说明模型内训练。[官方项目](https://danijar.com/project/dreamer4/) · [播放原视频](https://danijar.com/asset/dreamer4/imag/treechop1.mp4)

Google DeepMind 的 SIMA 2 探索由任务、执行经验和后续训练构成的自改进路径；Genie 4 展示新一代交互式世界生成。两者提供虚拟环境研究入口，真实机器人接触控制仍需单独验证。[R63 · SIMA 2](https://deepmind.google/blog/sima-2-an-agent-that-plays-reasons-and-learns-with-you-in-virtual-3d-worlds/) · [R64 · Genie 4](https://deepmind.google/blog/genie-4-a-new-generation-of-world-simulation/)

2026 年 11 月公开的 Interactive World Simulation with Cosmos 同时支持两类路径：由动作预测视觉变化，以及根据外部仿真器维护的物理状态生成观测。后一种路径为物理求解与生成式视觉的协同提供了明确接口。[R88 · NVIDIA 论文与项目](https://arxiv.org/abs/2611.06627)

**综合判断：** 世界模型扩大经验供给，物理仿真提供可控状态与交互约束。两者组合时，应分别检验视觉一致性、动作条件响应、长期状态保持和物理任务成功率。

## 08 具身 RSI：从失败反馈到可继承的改进

### 8.1 2026 年的主线是“改进对象具体化”

RPG 修改共享技能，EmbodiRSI 更新数据与策略，ENPIRE 组织真实机器人实验，PhysEvo 扩展诊断工具。它们共同将执行反馈连接到可保存的系统变化，但各自的实验目标与证据强度不同。

| 系统 | 持久改进对象 | 反馈闭环 | 公开证据与边界 |
|---|---|---|---|
| **RPG** | 技能代码、系统提示 | 重建环境 → 仿真练习 → 修订共享技能 → 验证 | 模型权重冻结；真机验证三项任务 |
| **EmbodiRSI** | 纠正数据、采样分布、动作策略 | 失败状态 → 续接纠正 / 定向采样 → 再训练 | 两次更新、三场景；高真机结果包含少量真人纠正 |
| **ENPIRE** | 策略、算法与研究代码 | 真实试验 → 自动重置 / 验证 → 修改训练方案 | 依赖已建好的物理接口；高成功率包含恢复重试 |
| **Kinex / Physical RSI** | Markdown 技能、Python 函数 | 执行轨迹 → 主 Agent 分析 → 技能库迭代 | RoboCasa 仿真实验；每任务使用固定场景 |
| **SenseNova-RoboRSI** | Harness；预览模型扩展到权重训练 | 保存经验 → 修改框架 → 复测 / 训练 | 运行框架与预览权重公开，技术报告待发布 |
| **PhysEvo** | 执行工具与诊断工具 | 执行失败 → 元 Agent 修改工具 → 后续复用 | 提供改进工具继承机制；因果贡献仍需专门对照 |

来源：[R37 · RPG](https://arxiv.org/abs/2610.02204) · [R39 · EmbodiRSI v4](https://arxiv.org/html/2609.38905v4) · [R42 · ENPIRE](https://research.nvidia.com/labs/gear/enpire/) · [R44 · Kinex](https://stacx-lab.github.io/kinex/) · [R43 · SenseNova](https://github.com/OpenSenseNova/SenseNova-RoboRSI) · [R45 · PhysEvo](https://arxiv.org/abs/2610.08995)

### 8.2 RPG：将仿真练习保存为共享技能

RPG 将环境重建、仿真练习、技能修订和真实部署连接起来。其重点是将多轮交互所得的经验保存为可调用技能，使后续任务执行能够受益。

<a class="document-image-link" href="/document-assets/agent-simulation-rsi/rpg-method.webp" target="_blank" rel="noopener" aria-label="查看原图：RPG 作者方法图">
<img src="/document-assets/agent-simulation-rsi/rpg-method.webp" alt="RPG 作者方法图" width="2000" height="1489" loading="lazy" decoding="async" />
</a>

*图 8｜RPG 作者方法图。来源：[RPG 官方项目](https://rpg-robot.github.io/)。原图包含作者实验结果，具体统计口径见下文。*

在 22 个操作任务的留出初始状态上，作者报告第 1 轮练习后至第 15 轮后的成功率由 **28.6% 提升至 95.0%**。真实机器人另外测试三任务、各十次，报告 30/30；任务预算内允许自主重试。[R37](https://rpg-robot.github.io/)

<figure class="document-video" id="video-rpg-drawer">
<video controls playsinline preload="none" poster="https://rpg-robot.github.io/static/videos/real/rpg_drawer.jpg" width="1920" height="1080" aria-label="RPG：仿真练习后转到真实机器人">
<source src="https://rpg-robot.github.io/static/videos/real/rpg_drawer.mp4" type="video/mp4" />
你的浏览器暂不支持视频播放。<a href="https://rpg-robot.github.io/static/videos/real/rpg_drawer.mp4">打开视频</a>
</video>
<figcaption>RPG：仿真练习后转到真实机器人<span>作者 / 机构公开演示</span></figcaption>
</figure>

**视频 6｜RPG 真机收球并关闭抽屉。** 原片为 15 倍速，项目页称展示该任务的十次试验。部署包含共同标定和硬件适配。[官方项目](https://rpg-robot.github.io/) · [播放原视频](https://rpg-robot.github.io/static/videos/real/rpg_drawer.mp4)

该结果支持共享技能经练习改善；留出初始状态的提升与未见任务泛化仍是不同问题。

### 8.3 EmbodiRSI：根据当前失败补充训练数据

EmbodiRSI 在目标部署场景对应的仿真中，从策略到达的失败状态生成纠正轨迹，并把示范采集集中到薄弱区域。训练数据随当前策略变化，是其闭环的关键。[R39](https://arxiv.org/html/2609.38905v4)

<a class="document-image-link" href="/document-assets/agent-simulation-rsi/embodirsi-scenes.webp" target="_blank" rel="noopener" aria-label="查看原图：EmbodiRSI 的真实与仿真场景">
<img src="/document-assets/agent-simulation-rsi/embodirsi-scenes.webp" alt="EmbodiRSI 的真实与仿真场景" width="2000" height="901" loading="lazy" decoding="async" />
</a>

*图 9｜EmbodiRSI 的三个真实与仿真桌面场景。来源：Lang 等，论文 v4，Fig. 3；原图按 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) 许可保留，未修改内容。[原论文](https://arxiv.org/html/2609.38905v4)*

最终 R2 策略的真实测试中，**未使用任务专用真实微调时为 62.8%**；每个子任务补充十条真人纠正后为 **83.1%**。统计覆盖三场景、十四子任务；每子任务、每设置进行十次自主测试，子任务分别评价，并采用场景均衡平均。

这项结果体现反馈驱动的仿真数据对真实适配的价值。实验范围仍是目标场景与有限轮次，长期持续改进需要继续验证。

### 8.4 相似百分比回答的是不同问题

| 案例 | 代表结果 | 正确解读 |
|---|---|---|
| **RPG** | 28.6% → 95.0% | 22 任务留出初态，多轮练习后共享技能改善 |
| **EmbodiRSI** | 62.8% / 83.1% | 以 R2 为起点，真实微调前后策略版本的真机结果 |
| **ENPIRE** | 99% pass@8 | 同一长程执行内，每子任务最多八次利用前次失败反馈的重试 |
| **Physical RSI** | 69.0% → 84.7% | V0 与 V7 在相同 365 固定场景各复跑一次，首个 episode 成功比例 |

ENPIRE 的恢复预算、Physical RSI 的同场景复测与 RPG 的留出初态不能直接构成跨系统排名。Physical RSI 搜索期间的累计 365/365 另表示任务覆盖，不代表冻结版本一次执行全部成功。[R42](https://research.nvidia.com/labs/gear/enpire/) · [R44](https://stacx-lab.github.io/physical-rsi/)

### 8.5 更严格 RSI 的三个研究入口

**改进诊断工具。** PhysEvo 中，先前建立的轨迹回看工具被后续轮次用于定位接触失败，并支持技能修改。机制上出现了“改进工具帮助产生后续改进”的继承关系。[R45](https://arxiv.org/html/2610.08995v1)

**学习实验与记忆管理。** EmbodiedRSI 维护竞争假设、按信息价值安排实验，并用后续收益训练记忆管理策略，决定保留、合并、抽象、压缩或遗忘经验。它与前述 **EmbodiRSI** 是两个不同项目。[R40](https://arxiv.org/html/2610.10498v1)

**判断何时值得训练。** AdaRSI 先修复调用流程，再从保存的仿真状态复测失败子步骤，针对仍不可靠的动作收集数据并训练。其消融支持按需归因的选择价值；选择算法多代自主修改则需额外证据。[R41](https://arxiv.org/html/2610.20474v1)

**综合判断：** 这些工作使“如何改进”成为可研究的机制。更强结论仍依赖相同学习起点、相同预算下的新旧改进器比较。

### 8.6 负结果揭示闭环的薄弱环节

一份 2026 年技术报告记录了 **123 轮技能发现**：系统能够发现缺失能力、安装外部模型并通过部分局部检查，最终仍未完成把调料放到冰箱上层的任务。[R04](https://arxiv.org/abs/2609.31760)

| 暴露的问题 | 对持续改进的影响 |
|---|---|
| 物体识别难以表达“上层”等空间关系 | 失败被错误归因到动作或技能 |
| 长任务反复卡在早期步骤 | 后续技能缺乏实际训练与测试 |
| 评判器或记忆保存错误结论 | 无效改动在后续轮次继续累积 |

这一单系统负结果说明，持续改动的数量不能代替能力提升证据。阶段覆盖、终态验收和记忆纠错，是闭环能否长期有效的关键条件。

## 09 评测体系：同时评价能力与改进过程

### 9.1 六类“成功率”分别报告

| 指标 | 统计对象 | 必须同时提供的信息 |
|---|---|---|
| **资产有效率** | 通过指定检查的资产 | 候选数量、检查版本、筛选阶段 |
| **任务可行率** | 被指定执行器完成的生成任务 | 执行器能力、尝试预算、修复次数 |
| **首个 episode 成功率** | 首个 episode 的完整任务 | 初始化分布、超时、完成判据及 episode 内是否允许恢复 |
| **恢复后成功率** | 允许重试的完整执行 | 每阶段重试次数、状态是否重置 |
| **累计任务覆盖率** | 多轮搜索中曾完成的任务 | 搜索轮次、总尝试数、累计成本 |
| **迁移 / 泛化成功率** | 留出场景、对象、任务或真实平台 | 留出维度、适配数据、校准过程 |

以上为综合评价框架。报告结果时，还应给出分母、重复次数、随机种子和不确定性；重要结论通过冻结版本与回归集验证。

### 9.2 证明改进器变强，需要控制学习起点

<a class="document-image-link" href="/document-assets/agent-simulation-rsi/04-evaluation.webp" target="_blank" rel="noopener" aria-label="查看原图：改进器的同起点同预算评价">
<img src="/document-assets/agent-simulation-rsi/04-evaluation.webp" alt="改进器的同起点同预算评价" width="1600" height="1220" loading="lazy" decoding="async" />
</a>

*图 10｜新旧改进器的受控比较框架。固定起点与预算后，测量独立留出任务上的后续收益。*

评价可以分为两层：

1. **能力评价：** 冻结新旧技能或策略，比较相同测试条件下的表现，验证改动是否留下持久收益。
2. **改进器评价：** 将新旧诊断、数据选择或训练流程放回相同起点，以匹配预算进行下一轮改进，再比较独立测试收益。

改进器比较还应区分两种设置：**共同数据**用于隔离更新机制的贡献；**自主采集**用于评价数据选择与学习的整体贡献。两种设置均应记录模型调用、训练算力、交互次数和真实试验成本。[R01](https://arxiv.org/abs/2610.38266)

<figure class="document-video" id="video-rsi-improver-evaluation">
<video controls playsinline preload="none" poster="/document-assets/agent-simulation-rsi/rsi-improver-evaluation-poster.webp" width="1920" height="1080" aria-label="怎样证明改进器变强">
<source src="/document-assets/agent-simulation-rsi/rsi-improver-evaluation.mp4" type="video/mp4" />
你的浏览器暂不支持视频播放。<a href="/document-assets/agent-simulation-rsi/rsi-improver-evaluation.mp4">打开视频</a>
</video>
<figcaption>怎样证明改进器变强<span>36 秒 · 1080p · 原理示意</span></figcaption>
</figure>

**机制演示 B｜怎样证明改进器变强。** 以立体实验台示意新旧改进器从同一执行系统出发，在匹配预算下并行更新、冻结候选、接受独立留出测试并完整复跑。实验台表达改进与评测的关系，不对应实物实验或实测结果；结论由实测决定。[播放 MP4](/document-assets/agent-simulation-rsi/rsi-improver-evaluation.mp4)

一项跨领域文献审计指出，完整闭环重跑及同起点、匹配预算的改进器对照仍较少。其统计针对特定文献样本，说明评价设计的重要性，不代表机器人领域的全面普查。[R03](https://arxiv.org/abs/2610.27610)

### 9.3 评价目标保持独立

开发过程可调整奖励、课程和诊断工具；验收标准与最终留出集应保持独立。反复用于搜索的测试集会逐渐成为开发集，应另设未反馈给改进器的最终评测。

实际部署还需要检查旧能力退化、异常接触、资源消耗与恢复成本。**更高的任务成功率只有在这些条件明确时，才具有可比较的工程意义。**

## 10 系统架构：把资产、能力和实验记录接成闭环

### 10.1 三类版本库与两个独立服务

以下为综合架构设计，可用于组织 MuJoCo、Isaac 等仿真后端上的 Agent 研究。

| 模块 | 保存或执行的内容 | 关键输出 |
|---|---|---|
| **资产库** | 几何、关节、物理、语义、传感器及来源 | 通过检查的资产版本 |
| **任务库** | 场景规格、初态分布、成功判据、课程 | 可重置的实验单元 |
| **能力库** | 感知模型、技能代码、动作策略、恢复方法 | 可调用且可回归的能力版本 |
| **实验执行服务** | 调度仿真、采样、训练、轨迹记录和失败复现 | 可追踪实验及候选改动 |
| **独立评价服务** | 留出测试、回归测试、成本统计、真实验证 | 版本晋升或回退依据 |

**Agent 的修改入口应对应明确对象。** 修改奖励、资产或技能后，执行服务生成新实验；评价服务检查收益；通过验收的版本再进入下一轮。失败轨迹与诊断工具同样需要版本记录。

### 10.2 MuJoCo 与 Isaac 的协作以任务契约为基础

一种可行分工是：用 MuJoCo 组织已有操作任务和可重置控制实验，用 Isaac 体系连接 USD 场景、传感器与批量学习流程。具体分配取决于现有资产、机器人与工作负载，不能仅凭平台名称判断优劣。

跨后端需要统一的内容包括：**单位、坐标系、关节定义、动作模式、传感器语义、重置分布和成功判据。** 相同场景文件在不同求解器中仍需行为级检查，尤其是摩擦、关节阻尼、接触与控制器响应。

### 10.3 两类验证实验覆盖主要链路

| 实验单元 | 覆盖能力 | 主要变化因素 | 验证目标 |
|---|---|---|---|
| **收纳并关闭抽屉** | 资产关节、视觉定位、抓取、接触、长任务编排 | 抽屉行程、把手位置、摩擦、遮挡、对象初态 | 区分资产、感知、调用流程与动作策略导致的失败 |
| **全身移动并完成操作** | 运动跟踪、身体姿态、可达性、操作衔接 | 地形、载荷、目标高度、动力学偏差 | 验证高层任务与连续控制的接口及真实迁移 |

这两项为研究设计示例，尚未实施。实验可采用相同预算比较固定流程、仅技能改进、数据 / 策略改进与改进工具更新，逐步识别各部分贡献。

### 10.4 阶段成果以可验证交付物定义

| 阶段 | 可验收交付物 |
|---|---|
| **建立基线** | 固定任务、版本、预算与留出集；完成失败分类 |
| **接通单一闭环** | 针对一个失败类别生成候选修改，自动复测并回归 |
| **扩展跨任务复用** | 证明技能、数据或工具收益能够迁移到留出条件 |
| **评价改进器** | 同起点同预算对照，多次完整闭环重跑，报告成本与退化 |

这一分阶段路线关注可验证增量；开放式自增强能力需要在更长周期与更广任务上积累证据。

## 11 综合结论与研究重点

**资产建设的重点，是将“生成能力”连接到“训练可用性”。** 物理验证、操作可达性和示范兼容性应共同决定资产验收。

**任务编排的重点，是形成可重复的实验单元。** 语言规划只有落到规格、接口、执行和检查，才能稳定进入训练与评价流程。

**机器人能力的重点，是多层系统的协同。** 感知提供任务状态，规划和策略生成动作，控制器完成物理执行；仿真同时支持练习、诊断和迁移验证。

**RSI 的重点，是验证后续改进效率。** 当前成果已展示技能、数据、策略与诊断工具的具体闭环。进一步突破取决于新改进机制能否在相同起点和成本下，稳定产生更大的后续收益。

值得持续跟踪的研究问题包括：**资产生成与策略训练的联合评价、失败驱动的数据选择、接触与触觉建模、物理仿真与世界模型的协同，以及改进器的受控评价。**

## 12 术语与研究口径

### 12.1 常用术语

| 术语 | 含义 |
|---|---|
| **Agent** | 围绕目标组织工具调用、行动与反馈的系统 |
| **Harness** | 模型外的提示、工具、记忆、接口和执行流程 |
| **VLA** | 视觉—语言—动作模型 |
| **TAMP** | 任务与运动联合规划 |
| **Sim-to-Real** | 从仿真学习或验证迁移到真实系统 |
| **Real-to-Sim-to-Real** | 从真实场景构建仿真，在仿真改进后返回真实系统 |
| **RSI** | 递归自我改进；本文按持久能力与改进机制证据分层讨论 |

### 12.2 资料口径

资料包括论文及预印本、官方项目、代码仓库和版本化文档。代码公开状态与实验结果可复现性分别评价。

Articraft 的原论文实现与后继仓库、Arena 的开发与测试版本，以及 SenseNova 的运行框架与预览模型，均按不同对象理解。

### 12.3 图示与证据

图 3、4、8、9 引用作者原图，出处与许可见图注。其余图示用于概括系统架构与研究机制。引用素材权利归原作者，图 9 的许可仅适用于该图。

官方视频用于观察过程与行为，量化结论以相应论文的实验协议为准。任务闭环与改进器对照动画均为原理示意，不代表真实系统实验或物理仿真实测结果。

## 附录 参考资料与媒体清单

资料截至 2026 年 11 月 11 日，分为正文引用与扩展阅读。扩展资料提供研究入口，其全部细节未逐项复核。

### 正文引用资料

- **R01 · Recursive Self-Improvement in Physical AI: Mechanisms, Evidence, and Evaluation**  
  2026-10-28 · 预印本综述  
  [一手入口 1](https://arxiv.org/abs/2610.38266) · [一手入口 2](https://github.com/nkd-lkz/physical-ai-rsi-survey)

- **R03 · Auditing the Product, Not the Recursion: The Evaluation Evidence Behind Recursive Self-Improvement Claims**  
  2026-10-20 · 预印本审计  
  [一手入口 1](https://arxiv.org/abs/2610.27610)

- **R04 · What Stops Recursive Self-Improvement in Robotics? Lessons from 123 Rounds of Agentic Skill Discovery**  
  2026-09-23 · 技术报告  
  [一手入口 1](https://arxiv.org/abs/2609.31760)

- **R05 · POET and Enhanced POET**  
  2019 / 2020 · 论文与官方代码  
  [一手入口 1](https://github.com/uber-research/poet) · [一手入口 2](https://proceedings.mlr.press/v119/wang20l.html)

- **R06 · ACCEL: Evolving Curricula with Regret-Based Environment Design**  
  ICML 2022 · 论文与作者项目  
  [一手入口 1](https://proceedings.mlr.press/v162/parker-holder22a.html) · [一手入口 2](https://accelagent.github.io/)

- **R07 · Holodeck: Language Guided Generation of 3D Embodied AI Environments**  
  2023-12 / CVPR 2024 · 论文与代码  
  [一手入口 1](https://arxiv.org/abs/2312.09067) · [一手入口 2](https://github.com/allenai/Holodeck)

- **R08 · SceneSmith: Agentic Generation of Simulation-Ready Indoor Scenes**  
  2026-02-09 / ICML 2026 · 论文、作者图与代码  
  [一手入口 1](https://scenesmith.github.io/) · [一手入口 2](https://arxiv.org/abs/2602.09153) · [一手入口 3](https://github.com/nepfaff/scenesmith)

- **R09 · SAGE and SAGE-10K**  
  2026 / CVPR 2026 · 论文与官方项目  
  [一手入口 1](https://research.nvidia.com/labs/cosmos-lab/sage/) · [一手入口 2](https://arxiv.org/abs/2602.10116) · [一手入口 3](https://github.com/NVlabs/sage)

- **R10 · Artisan: Towards Physically Grounded Articulated 3D Assets: A Multi-Agent Pipeline and Benchmark**  
  2026-10-09 / v3 2026-10-16 · 预印本、作者图与代码  
  [一手入口 1](https://arxiv.org/html/2610.13947v3) · [一手入口 2](https://physicalvision.github.io/artisan/) · [一手入口 3](https://github.com/physicalvision/Artisan)

- **R11 · Articraft: An Agentic System for Scalable Articulated 3D Asset Generation**  
  2026-05-14 / NeurIPS 2026 已接收 · 论文与后继代码  
  [一手入口 1](https://arxiv.org/abs/2605.15187) · [一手入口 2](https://github.com/articraftresearch/Articraft)

- **R15 · Articulate-Anything: Automatic Modeling of Articulated Objects via a Vision-Language Foundation Model**  
  2024-10 / ICLR 2025 · 论文与代码  
  [一手入口 1](https://arxiv.org/abs/2410.13882) · [一手入口 2](https://articulate-anything.github.io/) · [一手入口 3](https://github.com/vlongle/articulate-anything)

- **R16 · PartCrafter: Structured 3D Mesh Generation via Compositional Latent Diffusion Transformers**  
  2025-06-05 · 论文与代码  
  [一手入口 1](https://arxiv.org/abs/2506.05573) · [一手入口 2](https://github.com/wgsxm/PartCrafter)

- **R20 · AffordCraft**  
  2026-10 · 论文、项目与官方代码  
  [一手入口 1](https://arxiv.org/abs/2610.06643) · [一手入口 2](https://affordcraft.github.io/) · [一手入口 3](https://github.com/AffordCraft/AffordCraft)

- **R21 · RoboGen: Towards Unleashing Infinite Data for Automated Robot Learning via Generative Simulation**  
  2023-11-02 / ICML 2024 · 论文与代码  
  [一手入口 1](https://arxiv.org/abs/2311.01455) · [一手入口 2](https://github.com/Genesis-Embodied-AI/RoboGen)

- **R22 · GenSim: Generating Robotic Simulation Tasks via Large Language Models**  
  2023-10-02 / ICLR 2024 · 论文与作者项目  
  [一手入口 1](https://arxiv.org/abs/2310.01361) · [一手入口 2](https://gen-sim.github.io/)

- **R23 · GenSim2: Scaling Robot Data Generation with Multi-modal and Reasoning LLMs**  
  2024-10-04 / CoRL 2024 · 论文与代码  
  [一手入口 1](https://arxiv.org/abs/2410.03645) · [一手入口 2](https://github.com/GenSim2/GenSim2)

- **R25 · Eureka: Human-Level Reward Design via Coding Large Language Models**  
  2023-10-19 / ICLR 2024 · 论文与代码  
  [一手入口 1](https://arxiv.org/abs/2310.12931) · [一手入口 2](https://github.com/eureka-research/Eureka)

- **R26 · DrEureka: Language Model Guided Sim-To-Real Transfer**  
  2024-06-04 / RSS 2024 · 论文与代码  
  [一手入口 1](https://arxiv.org/abs/2406.01967) · [一手入口 2](https://github.com/eureka-research/DrEureka)

- **R29 · Isaac Lab-Arena: Environment Generation and Release Notes**  
  已测试基线 release/0.3.0；另列 main 开发文档 · 核验 2026-11-11  
  [一手入口 1](https://isaac-sim.github.io/IsaacLab-Arena/release/0.3.0/index.html) · [一手入口 2](https://isaac-sim.github.io/IsaacLab-Arena/main/index.html) · [一手入口 3](https://isaac-sim.github.io/IsaacLab-Arena/main/pages/references/release_notes.html) · [一手入口 4](https://isaac-sim.github.io/IsaacLab-Arena/main/pages/whats_new/agentic_authoring_workbench.html)

- **R32 · EmbodiedSmith: Scaling Embodied Data through Recursive Self-Improvement Flywheel in Simulation**  
  2026-10-06 · 预印本  
  [一手入口 1](https://arxiv.org/abs/2610.07969)

- **R33 · HARBOR: A Harness Framework for Agentic Robot Reinforcement Learning**  
  2026-06-07 · 论文、代码与文档  
  [一手入口 1](https://arxiv.org/abs/2606.08610) · [一手入口 2](https://github.com/supersglzc/harbor-rl) · [一手入口 3](https://supersglzc.github.io/harbor-rl/guide/gates)

- **R34 · FATE: Closed-Loop Feasibility-Aware Task Generation with Active Repair for Physically Grounded Robotic Curricula**  
  2026-03-02 · 预印本  
  [一手入口 1](https://arxiv.org/abs/2603.01505)

- **R37 · RPG: Reconstruct, Practice, Go Real: Guided Self-Improvement for Embodied Agents**  
  2026-10-01 · 预印本与作者图  
  [一手入口 1](https://arxiv.org/abs/2610.02204) · [一手入口 2](https://rpg-robot.github.io/)

- **R38 · D-World: An Explicit World-Language-Action Model with Recursive Self-Improvement under Dual Control**  
  2026-10-12 · 预印本  
  [一手入口 1](https://arxiv.org/abs/2610.17114) · [一手入口 2](https://arxiv.org/html/2610.17114v1)

- **R39 · EmbodiRSI: Recursive Self-Improvement for Data-Efficient Robot Adaptation**  
  2026-09-30 / v4 2026-10-29 · 预印本与作者图  
  [一手入口 1](https://arxiv.org/html/2609.38905v4)

- **R40 · EmbodiedRSI: Active Continual Robot Learning Through Hypothesis-Guided Co-Evolution**  
  2026-10-07 · 预印本  
  [一手入口 1](https://arxiv.org/abs/2610.10498)

- **R41 · AdaRSI: On-Demand Recursive Self-Improvement for Embodied Agents**  
  2026-10-14 · 预印本  
  [一手入口 1](https://arxiv.org/abs/2610.20474)

- **R42 · ENPIRE: Agentic Robot Policy Self-Improvement in the Real World**  
  2026-06-18 / CoRL 2026 · 论文、官方项目与代码  
  [一手入口 1](https://research.nvidia.com/labs/gear/enpire/) · [一手入口 2](https://arxiv.org/abs/2606.19980) · [一手入口 3](https://github.com/NVlabs/ENPIRE)

- **R43 · SenseNova-RoboRSI and RoboRSI-27B-Preview**  
  runtime 2026-10-16 / 权重 2026-10-22 · 官方仓库与模型卡  
  [一手入口 1](https://github.com/OpenSenseNova/SenseNova-RoboRSI) · [一手入口 2](https://huggingface.co/sensenova/sensenova-roborsi-27b-preview)

- **R44 · Kinex and Physical RSI on RoboCasa365**  
  Kinex 1.0 2026-10-15；实验页查阅 2026-11-05 · 作者实验页面与运行时代码  
  [一手入口 1](https://stacx-lab.github.io/physical-rsi/) · [一手入口 2](https://stacx-lab.github.io/kinex/) · [一手入口 3](https://github.com/stacx-lab/kinex)

- **R45 · PhysEvo: Astra Can Act, Let It**  
  2026-10-06 · 预印本  
  [一手入口 1](https://arxiv.org/abs/2610.08995)

- **R48 · OpenVLA-OFT: Fine-Tuning Vision-Language-Action Models: Optimizing Speed and Success**  
  2025-02-27 / RSS 2025 · 论文与项目  
  [一手入口 1](https://arxiv.org/abs/2502.19645) · [一手入口 2](https://openvla-oft.github.io/)

- **R49 · SimpleVLA-RL: Scaling VLA Training via Reinforcement Learning**  
  2025-09 / ICLR 2026 · 论文与代码  
  [一手入口 1](https://arxiv.org/abs/2509.09674) · [一手入口 2](https://github.com/PRIME-RL/SimpleVLA-RL)

- **R50 · VLA-RL: Towards Masterful and General Robotic Manipulation with Scalable Reinforcement Learning**  
  2025-05-24 · 论文  
  [一手入口 1](https://arxiv.org/abs/2505.18719)

- **R52 · π*0.6: A VLA That Learns From Experience and RECAP**  
  2025-11 · 作者论文与官方说明  
  [一手入口 1](https://www.pi.website/blog/pistar06) · [一手入口 2](https://arxiv.org/abs/2511.14759)

- **R54 · ASAP: Aligning Simulation and Real-World Physics for Learning Agile Humanoid Whole-Body Skills**  
  2025-02 / RSS 2025 · 论文与作者项目  
  [一手入口 1](https://arxiv.org/abs/2502.01143) · [一手入口 2](https://agile.human2humanoid.com/)

- **R55 · BeyondMimic and Whole Body Tracking**  
  2025-08 / 旧仓库已迁移 · 论文与代码状态  
  [一手入口 1](https://arxiv.org/abs/2508.08241) · [一手入口 2](https://github.com/HybridRobotics/whole_body_tracking)

- **R56 · SONIC: Supersizing Motion Tracking for Natural Humanoid Whole-Body Control**  
  2025-11 / v4 2026-08 · 论文  
  [一手入口 1](https://arxiv.org/abs/2511.07820)

- **R58 · DreamGen: Unlocking Generalization in Robot Learning through Video World Models**  
  2025-05 · 论文与代码  
  [一手入口 1](https://arxiv.org/abs/2505.12705) · [一手入口 2](https://github.com/NVIDIA/GR00T-Dreams)

- **R59 · Cosmos Policy: Fine-Tuning Video Models for Visuomotor Control and Planning**  
  2026-01-22 · 论文与代码  
  [一手入口 1](https://arxiv.org/abs/2601.16163) · [一手入口 2](https://github.com/NVlabs/cosmos-policy)

- **R60 · DreamZero: World Action Models are Zero-shot Policies**  
  2026-02-17 · 论文与作者项目  
  [一手入口 1](https://arxiv.org/abs/2602.15922) · [一手入口 2](https://dreamzero0.github.io/)

- **R61 · DreamerV3: Mastering Diverse Control Tasks through World Models**  
  2023 / Nature 2025 · 论文与代码  
  [一手入口 1](https://danijar.com/project/dreamerv3/) · [一手入口 2](https://github.com/danijar/dreamerv3)

- **R62 · Dreamer 4: Training Agents Inside of Scalable World Models**  
  2025-09-29 · 论文与作者项目  
  [一手入口 1](https://danijar.com/project/dreamer4/) · [一手入口 2](https://arxiv.org/abs/2509.24527)

- **R63 · SIMA 2: An Agent That Plays, Reasons, and Learns with You in Virtual 3D Worlds**  
  2025-11-13 · 官方研究公告  
  [一手入口 1](https://deepmind.google/blog/sima-2-an-agent-that-plays-reasons-and-learns-with-you-in-virtual-3d-worlds/)

- **R64 · Genie 4: A New Generation of World Simulation**  
  2026-10-27 · 官方研究预览  
  [一手入口 1](https://deepmind.google/blog/genie-4-a-new-generation-of-world-simulation/)

- **R66 · MuJoCo 3.17.0 XML Reference: sensor/tactile**  
  固定文档版本 3.17.0 · 官方接口文档  
  [一手入口 1](https://mujoco.readthedocs.io/en/3.17.0/XMLreference.html#sensor-tactile)

- **R67 · Genesis World v1.4.5 Tactile Sensors**  
  固定文档版本 v1.4.5 · 官方接口文档  
  [一手入口 1](https://genesis-world.readthedocs.io/en/v1.4.5/user_guide/sensing/tactile.html)

- **R68 · Newton SensorContact**  
  stable 文档查阅 2026-11-11 · 官方接口文档  
  [一手入口 1](https://newton-physics.github.io/newton/stable/api/_generated/newton.sensors.SensorContact.html)

- **R69 · Tactile Genesis: Exploring Tactile Sensors at Scale for Learning Dexterous Tasks**  
  2026-06-21 / v2 2026-07-09 · 论文与代码  
  [一手入口 1](https://arxiv.org/abs/2606.22332) · [一手入口 2](https://github.com/neuroagents-lab/tactile-genesis)

- **R76 · Voyager: An Open-Ended Embodied Agent with Large Language Models**  
  2023-05 · 论文与代码  
  [一手入口 1](https://voyager.minedojo.org/) · [一手入口 2](https://github.com/MineDojo/Voyager)

- **R82 · VoxPoser: Composable 3D Value Maps for Robotic Manipulation with Language Models**  
  2023 / CoRL · 论文与作者项目  
  [一手入口 1](https://voxposer.github.io/) · [一手入口 2](https://arxiv.org/abs/2307.05973)

- **R83 · How to Use AI Agents to Prepare 3D Scenes for Simulation**  
  2026-09-16 · NVIDIA 官方技术文章  
  [一手入口 1](https://developer.nvidia.com/blog/how-to-use-ai-agents-to-prepare-3d-scenes-for-simulation/)

- **R84 · Code as Policies: Language Model Programs for Embodied Control**  
  2022 / ICRA 2023 · 论文与项目  
  [一手入口 1](https://code-as-policies.github.io/) · [一手入口 2](https://arxiv.org/abs/2209.07753)

- **R85 · OpenVLA: An Open-Source Vision-Language-Action Model**  
  2024 · 论文与作者项目  
  [一手入口 1](https://openvla.github.io/) · [一手入口 2](https://arxiv.org/abs/2406.09246)

- **R86 · FoundationPose: Unified 6D Pose Estimation and Tracking of Novel Objects**  
  CVPR 2024 · 论文与项目  
  [一手入口 1](https://nvlabs.github.io/FoundationPose/)

- **R87 · SG-Nav: Online 3D Scene Graph Prompting for LLM-based Zero-shot Object Navigation**  
  NeurIPS 2024 · 论文与项目  
  [一手入口 1](https://bagh2178.github.io/SG-Nav/)

- **R88 · Interactive World Simulation with Cosmos for Physical AI**  
  2026-11-04 · NVIDIA 论文与官方项目  
  [一手入口 1](https://arxiv.org/abs/2611.06627) · [一手入口 2](https://research.nvidia.com/labs/cosmos-lab/cosmos-simulation/)

### 扩展阅读

- **R02 · Toward Recursive Self-Improvement in Physical AI**  
  2026-10-21 · 预印本综述  
  [一手入口 1](https://arxiv.org/abs/2610.29677) · [一手入口 2](https://physical2rsi.github.io/)

- **R12 · PhysX-Anything and PhysX-Omni**  
  2025-11 / 2026-05-20 · 研究论文与代码  
  [一手入口 1](https://arxiv.org/abs/2511.13648) · [一手入口 2](https://arxiv.org/abs/2605.21572) · [一手入口 3](https://github.com/physx-omni/PhysX-Omni)

- **R13 · NVIDIA SimReady Foundation 2026.08.0**  
  2026 版官方文档 · 版本化技术文档  
  [一手入口 1](https://nvidia.github.io/simready-foundation/2026.08.0/changelist.html)

- **R14 · URDFormer: A Pipeline for Constructing Articulated Simulation Environments from Real-World Images**  
  2024-05-19 / RSS 2024 · 论文与代码  
  [一手入口 1](https://arxiv.org/abs/2405.11656) · [一手入口 2](https://urdformer.github.io/) · [一手入口 3](https://github.com/WEIRDLabUW/urdformer)

- **R17 · RoboTwin 2.0: A Scalable Data Generator and Benchmark with Strong Domain Randomization**  
  2025-06-22 / 持续更新至 2026 · 论文、代码与数据  
  [一手入口 1](https://arxiv.org/abs/2506.18088) · [一手入口 2](https://robotwin-platform.github.io/) · [一手入口 3](https://github.com/robotwin-Platform/robotwin)

- **R18 · RoboCasa365: A Large-Scale Simulation Framework for Training and Benchmarking Generalist Robots**  
  2026-02 release / ICLR 2026 · 论文与官方文档  
  [一手入口 1](https://robocasa.ai/docs/build/html/introduction/overview.html) · [一手入口 2](https://github.com/robocasa/robocasa) · [一手入口 3](https://robocasa.ai/leaderboard)

- **R19 · NVIDIA Omniverse NuRec**  
  查阅 2026-11-05 · 官方文档  
  [一手入口 1](https://docs.nvidia.com/nurec/) · [一手入口 2](https://github.com/NVIDIA/NuRec)

- **R24 · Text2Reward: Reward Shaping with Language Models for Reinforcement Learning**  
  2023-09-20 · 论文  
  [一手入口 1](https://arxiv.org/abs/2309.11489)

- **R27 · CurricuLLM: Automatic Task Curricula Design for Learning Complex Robot Skills using Large Language Models**  
  2024-09-27 / ICRA 2025 · 论文与代码  
  [一手入口 1](https://arxiv.org/abs/2409.18382) · [一手入口 2](https://github.com/labicon/CurricuLLM)

- **R28 · Isaac Lab Mimic and MimicGen-based Demonstration Generation**  
  当前官方技术文档 · 官方文档  
  [一手入口 1](https://docs.nvidia.com/isaaclab/features/synthetic-data-generation-and-imitation-learning-with-isaac-lab-mimic)

- **R30 · NVIDIA Advances Isaac Platform for General-Purpose Robotics**  
  2026-10-21 · 官方发布公告  
  [一手入口 1](https://nvidianews.nvidia.com/news/nvidia-advances-isaac-platform-for-general-purpose-robotics-with-new-reference-humanoid-frameworks-simulation-pipelines-and-data/)

- **R31 · SimWorld Studio: Automatic Environment Generation with Evolving Coding Agent for Embodied Agent Learning**  
  2026-05-10 · 论文与官方项目  
  [一手入口 1](https://arxiv.org/abs/2605.09423) · [一手入口 2](https://simworld.org/simworld-studio/)

- **R35 · ASPIRE: Agentic /Skills Discovery for Robotics**  
  2026-06-30 · 论文与官方代码  
  [一手入口 1](https://arxiv.org/abs/2607.00272) · [一手入口 2](https://research.nvidia.com/labs/gear/aspire/) · [一手入口 3](https://github.com/NVlabs/ASPIRE)

- **R36 · ASENA: Self-evolving Agents for Embodied Navigation**  
  2026-09-30 / v2 2026-10-12 · 论文与官方项目  
  [一手入口 1](https://arxiv.org/abs/2609.39207) · [一手入口 2](https://research.nvidia.com/labs/gear/asena/)

- **R46 · EmbodiedEvo: Self-Evolving Coding Agent For Physical Intelligence**  
  2026-10-13 · 预印本与官方代码  
  [一手入口 1](https://arxiv.org/abs/2610.18867) · [一手入口 2](https://github.com/Einsia/EmbodiedEvo)

- **R47 · Embodied Turing Machines: Stateful Code for Robot Recursive Self-Improvement**  
  2026-10-08 · 预印本；方法名 COAP  
  [一手入口 1](https://arxiv.org/abs/2610.12369)

- **R51 · RLinf Reinforcement Learning Infrastructure for Embodied and Agentic AI**  
  持续更新，查阅 2026-11-05 · 官方代码与文档  
  [一手入口 1](https://github.com/RLinf/RLinf) · [一手入口 2](https://rlinf.org/en/)

- **R53 · Develop Humanoid Robot Policies End-to-End with NVIDIA Isaac GR00T**  
  2026-07 官方教程；GR00T 1.7 · 官方文档与代码  
  [一手入口 1](https://developer.nvidia.com/blog/develop-humanoid-robot-policies-end-to-end-with-nvidia-isaac-gr00t/) · [一手入口 2](https://github.com/NVIDIA/Isaac-GR00T)

- **R57 · RoboSpatial: Teaching Spatial Understanding to 2D and 3D Vision-Language Models for Robotics**  
  2024-11-25 · 论文  
  [一手入口 1](https://arxiv.org/abs/2411.16537)

- **R65 · NVIDIA Cosmos Platform**  
  Cosmos 3 / 2026 更新 · 官方仓库  
  [一手入口 1](https://github.com/NVIDIA/cosmos)

- **R70 · LIBERO-Plus: In-depth Robustness Analysis of Vision-Language-Action Models**  
  2025-10-15 · 论文  
  [一手入口 1](https://arxiv.org/abs/2510.13626)

- **R71 · LIBERO-PRO: Towards Robust and Fair Evaluation of Vision-Language-Action Models Beyond Memorization**  
  2025-10-04 · 论文  
  [一手入口 1](https://arxiv.org/abs/2510.03827)

- **R72 · ManiSkill3: GPU Parallelized Robotics Simulation and Rendering for Generalizable Embodied AI**  
  2024-10 / 持续更新 · 论文与官方代码  
  [一手入口 1](https://arxiv.org/abs/2410.00425) · [一手入口 2](https://github.com/mani-skill/ManiSkill)

- **R73 · BEHAVIOR-1K and OmniGibson**  
  官方基准与 2026 挑战文档 · 官方文档  
  [一手入口 1](https://behavior.stanford.edu/)

- **R74 · RoboLab: A High-Fidelity Simulation Benchmark for Analysis of Task Generalist Policies**  
  2026 / RSS 2026 · 论文与官方项目  
  [一手入口 1](https://arxiv.org/abs/2604.09860) · [一手入口 2](https://research.nvidia.com/labs/srl/projects/robolab/)

- **R75 · SimplerEnv: Evaluating Real-World Robot Manipulation Policies in Simulation**  
  2024 · 论文与作者项目  
  [一手入口 1](https://simpler-env.github.io/)

- **R77 · URDream**  
  截至 2026-11-11 仍为预告观察项 · 官方仓库  
  [一手入口 1](https://github.com/URDream-project/URDream)

- **R78 · 3D Generation for Embodied AI and Robotic Simulation: A Survey**  
  2026-04 / v4 2026-10-23 · 预印本综述  
  [一手入口 1](https://arxiv.org/abs/2604.26509) · [一手入口 2](https://3dgen4robot.github.io/)

- **R79 · BBSEA: An Exploration of Brain-Body Synchronization for Embodied Agents**  
  2024-02-13 · 论文与作者项目  
  [一手入口 1](https://arxiv.org/abs/2402.08212) · [一手入口 2](https://bbsea-embodied-ai.github.io/)

- **R80 · Video2Policy: Scaling up Manipulation Tasks in Simulation through Internet Videos**  
  2025-02-14 · 论文与作者项目  
  [一手入口 1](https://arxiv.org/abs/2502.09886) · [一手入口 2](https://yewr.github.io/video2policy/)

- **R81 · RoboVerse: Towards a Unified Platform, Dataset and Benchmark for Scalable and Generalizable Robot Learning**  
  2025-04 / RSS 2025 · 论文与官方代码  
  [一手入口 1](https://arxiv.org/abs/2504.18904) · [一手入口 2](https://github.com/RoboVerseOrg/RoboVerse) · [一手入口 3](https://roboverseorg.github.io/)

### 官方视频清单

- **SceneSmith：从提示逐步建设餐厅**  
  展示餐厅从布局到家具与餐具的逐步建设，直观说明场景生成流程。 场景生成过程演示；机器人操作能力与生成效率由相应实验另行评价。  
  [官方项目](https://scenesmith.github.io/) · [视频原地址](https://scenesmith.github.io/static/videos/scene_buildup/158.mp4)

- **Artisan：关节运动与碰撞验证**  
  通过碰撞检查展示关节运动是否有效，说明生成资产仍需物理验证。 定性物理检查示例；资产筛选结果与实验条件见正文。  
  [官方项目](https://physicalvision.github.io/artisan/) · [视频原地址](https://physicalvision.github.io/artisan/assets/clips/collision.mp4)

- **ASAP：动力学对齐后的全身运动**  
  展示经过仿真与真实动力学对齐后，人形机器人执行踢腿动作。 真实机器人运动策略演示。与微调前的比较及定量收益见原论文。  
  [官方项目](https://agile.human2humanoid.com/) · [视频原地址](https://agile.human2humanoid.com/static/videos/ASAP-Website-Kick-AfterASAP-1080P.mp4)

- **VoxPoser：扰动下的闭环操作**  
  机器人在外部扰动下重新规划关抽屉动作，展示视觉反馈的作用。 真实机器人闭环操作演示，采用既有感知与控制接口；参考资料 R82。  
  [官方项目](https://voxposer.github.io/) · [视频原地址](https://voxposer.github.io/media/videos/close-top-drawer-dist.mp4)

- **RPG：仿真练习后转到真实机器人**  
  展示仿真练习后迁移到真机的收球关抽屉任务，原视频为加速播放。 原视频为 15 倍速；部署经过共同标定和硬件适配，任务预算内允许自主重试。  
  [官方项目](https://rpg-robot.github.io/) · [视频原地址](https://rpg-robot.github.io/static/videos/real/rpg_drawer.mp4)

- **Dreamer 4：在世界模型中练习**  
  展示智能体在学习到的世界模型中练习采木，画面来自想象轨迹。 Minecraft 世界模型内的想象轨迹；用于展示模型内训练机制。  
  [官方项目](https://danijar.com/project/dreamer4/) · [视频原地址](https://danijar.com/asset/dreamer4/imag/treechop1.mp4)

### 机制演示

| 演示 | 对应章节 | 研究机制 |
|---|---|---|
| 任务如何进入仿真实验闭环 | 第 4.1 节 | 连续执行、失败定位、动作修正、同初态复测与版本归档 |
| 怎样证明改进器变强 | 第 9.2 节 | 同起点、匹配预算、并行更新、冻结候选、独立留出评测与完整复跑 |

两项演示均用于解释原理。RSI 实验台表达并行改进与评测关系，不对应实物实验或实测结果，不预设优胜结论。

### 机制演示音效来源

两段机制演示保留了原视频的轻量机械与反馈音效，无旁白及背景音乐。机械录音包括 D31V228 的 [Servo motor working](https://freesound.org/people/D31V228/sounds/723999)，以及 rubberduck9999 的 [drawer sliding 01](https://freesound.org/people/rubberduck9999/sounds/676350) 和 [drawer sliding 02](https://freesound.org/people/rubberduck9999/sounds/676351)，按 [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) 使用。短反馈音来自 HyperFrames 随包音效，原素材来自 Pixabay，按 [Pixabay Content License](https://pixabay.com/service/license-summary/) 使用。声音经裁切、变速、滤波与混音后编入视频。
