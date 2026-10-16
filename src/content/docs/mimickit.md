---
title: "MimicKit 使用与整理"
description: "整理运动模仿框架的试跑记录、配置入口、数据资产，以及不同模仿算法的理解。"
category: "动作模仿"
tags: ["MimicKit", "AMP", "模仿学习"]
order: 6
cover: "/document-assets/mimickit/media-01.webp"
---

> [https://github.com/xbpeng/MimicKit](https://github.com/xbpeng/MimicKit)
>
>

## 功能定位

- MimicKit 是用于运动模仿 \+ 控制器训练的 RL 框架。

- 它提供了一套常见的模仿技术 \+ RL 算法。

- 支持多种运动数据 \(motion data\) 和环境，可以把动作片段 \(motion clips\) 用作参考目标，让 agent 模仿物理角色去复制这些动作。

<figure class="document-video">
<video controls playsinline preload="none" poster="/document-assets/mimickit/media-01.webp" width="500" height="280" aria-label="G1 动作模仿展示"><source src="/document-assets/mimickit/media-01.mp4" type="video/mp4" />你的浏览器暂不支持视频播放。<a href="/document-assets/mimickit/media-01.mp4">下载视频</a></video>
<figcaption>G1 动作模仿展示<span>10 秒 · 0.3 MB</span></figcaption>
</figure>

<figure class="document-video">
<video controls playsinline preload="none" poster="/document-assets/mimickit/media-02.webp" width="500" height="280" aria-label="Go2 动作模仿展示"><source src="/document-assets/mimickit/media-02.mp4" type="video/mp4" />你的浏览器暂不支持视频播放。<a href="/document-assets/mimickit/media-02.mp4">下载视频</a></video>
<figcaption>Go2 动作模仿展示<span>5 秒 · 0.1 MB</span></figcaption>
</figure>

<figure class="document-video">
<video controls playsinline preload="none" poster="/document-assets/mimickit/media-03.webp" width="500" height="280" aria-label="Humanoid 动作模仿展示"><source src="/document-assets/mimickit/media-03.mp4" type="video/mp4" />你的浏览器暂不支持视频播放。<a href="/document-assets/mimickit/media-03.mp4">下载视频</a></video>
<figcaption>Humanoid 动作模仿展示<span>15 秒 · 0.4 MB</span></figcaption>
</figure>

---

## MimicKit 和 BeyondMimic区别

MimicKit 是一个用于训练模仿特定动作控制器的通用 RL 框架；而 BeyondMimic 是一个更高级的系统，通过扩散模型把多种技能压缩成一个策略，从而实现零样本 \(zero\-shot\) 的多任务控制。但目前作者已声明：开源版本将仅限于运动追踪部分，关于引导扩散的代码不会公开。

---

## 快速开始

- 内置算法：DeepMimic、AMP、ASE、ADD，及 PPO、AWR 等 RL 基础算法。

- 主要入口：`mimickit/run.py`，通过环境配置（YAML）、算法配置（YAML）、参数文件（args/\*\.txt）驱动训练/测试。

### 仓库结构

```bash
mimickit/
├── envs/                 # 环境实现（DeepMimic / AMP / ASE / 任务环境等）
├── engines/              # 引擎抽象层 + Isaac Gym / Isaac Lab 适配
├── learning/             # 算法（PPO/AWR/AMP/ASE/ADD）、网络、buffer
├── anim/                 # 动作文件、角色模型、Skeleton/Retarget
├── util/                 # 工具函数
└── run.py                # 主入口脚本

args/
└── *.txt                 # 命令行参数模板（--key value 格式）

data/
├── assets/               # MJCF / URDF / 角色模型资源
├── motions/              # 参考动作（BVH/npz/json）
├── datasets/             # 数据集（AMP/ASE 等）
├── envs/                 # 环境配置 YAML
├── agents/               # 算法配置 YAML
├── models/               # 预训练模型
└── logs/                 # 日志输出（tb / wandb）

MimicKit_Data/
└── ...                   # 与 data/ 同结构，可软链到 data/

output/
└── ...                   # 训练结果、policy、实验目录

tools/
└── ...                   # 工具脚本（绘图、GMR转换、可视化等）

isaacgym/
└── ...                   # 引擎相关资源，按需使用

images/
└── ...                   # 示例动图、README 图示

requirements.txt
README.md

```

### 环境与安装

1. 安装模拟器：Isaac Gym 或 Isaac Lab（根据 `engine.engine_name` 选择）。

2. Python 依赖：`pip install -r requirements.txt`。

3. 下载资产与动作数据：从 [MimicKit 数据资产](https://1sfu-my.sharepoint.com/personal/xbpeng_sfu_ca/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fxbpeng%5Fsfu%5Fca%2FDocuments%2FMimicKit%2FMimicKit%5FData%2Ezip&parent=%2Fpersonal%2Fxbpeng%5Fsfu%5Fca%2FDocuments%2FMimicKit&ga=1) 获取，解压到 `data/`（或保持在外部路径并软链）。目录结构需包含 `assets/`、`motions/`、`models/`、`logs/`。

### 用例测试

- 直接指定配置：

```bash
python mimickit/run.py \
  --mode train \
  --num_envs 4096 \
  --env_config data/envs/deepmimic_humanoid_env.yaml \
  --agent_config data/agents/deepmimic_humanoid_ppo_agent.yaml \
  --visualize false \
  --log_file output/deepmimic/log.txt \
  --out_model_file output/deepmimic/model.pt
```

<figure class="document-video">
<video controls playsinline preload="none" poster="/document-assets/mimickit/media-04.webp" width="1440" height="810" aria-label="AMP 训练结果与参考动作对照"><source src="/document-assets/mimickit/media-04.mp4" type="video/mp4" />你的浏览器暂不支持视频播放。<a href="/document-assets/mimickit/media-04.mp4">下载视频</a></video>
<figcaption>AMP 训练结果与参考动作对照<span>9 秒 · 1.1 MB</span></figcaption>
</figure>

以上视频基于g1\_walk\.pkl进行了大概三千轮次训练（绿色为动作数据集，蓝色为训练结果），使用的算法为AMP。

- 使用参数文件：

```bash
python mimickit/run.py --arg_file args/deepmimic_humanoid_ppo_args.txt --visualize false
```

- 测试模型：

```bash
python mimickit/run.py \
  --arg_file args/deepmimic_humanoid_ppo_args.txt \
  --mode test \
  --num_envs 4 --visualize true \
  --model_file data/models/deepmimic_humanoid_spinkick_model.pt
```

<figure class="document-video">
<video controls playsinline preload="none" poster="/document-assets/mimickit/media-05.webp" width="1440" height="810" aria-label="模型测试回放"><source src="/document-assets/mimickit/media-05.mp4" type="video/mp4" />你的浏览器暂不支持视频播放。<a href="/document-assets/mimickit/media-05.mp4">下载视频</a></video>
<figcaption>模型测试回放<span>4 秒 · 0.7 MB</span></figcaption>
</figure>

---

## 配置文件说明

### `args/*.txt` — 命令行参数

- 📌 格式规则

```css
每行写：--key value
```

- 🧩 常用参数表

### `data/envs/*.yaml` — 环境配置

- **顶层字段**

- **`env:` 环境段（核心）**

🦾 角色 \& 动作文件

👀 观测 \& 时序

🚀 初始姿态

🎯 奖励函数因子

- **`engine:` 段（仿真引擎）**

### `data/agents/*.yaml` — 算法配置

- **顶层字段**

- **`model:` 网络结构**

📌 如需自定义网络 → 在 `mimickit/learning/nets/` 文件夹添加新网络并在 YAML 中引用名称即可。

- **`optimizer`**

- **通用算法超参**

- **对抗/扩展（AMP/ASE/ADD）**

- **ASE 特有字段**

---

## 数据资产

- 角色资产：`data/assets/<character>/*.xml`；动作：`data/motions/<character>/*.pkl` 或多动作数据集 `data/datasets/*.pkl`。

- 预训练模型与日志：`data/models/`、`data/logs/`；运行输出默认写入 `output/`。

- 动作格式：\[root position \(3\), root rotation \(3\), joint rotations\.\.\.\]，3D 关节为指数映射，1D 关节为角度，顺序遵循对应 XML 的深度优先遍历。

- 可视化动作：使用 view\_motion 环境与对应 `args/view_motion_*.txt` 运行 run\.py \-\-mode test \-\-visualize true。

---

## 输出与日志

- 文本日志：\-\-log\_file。模型：\-\-out\_model\_file。可选中间产物目录：\-\-int\_output\_dir。

- 记录方式：\-\-logger tb\|wandb。TensorBoard 读取示例：tensorboard \-\-logdir output/ \-\-port 6006 \-\-samples\_per\_plugin scalars=999999。

---

## 工具

- 日志绘图：

```bash
python tools/plot_log/plot_log.py --log_file output/log.txt --out_file plot.png。
```

- GMR 转换：

```bash
python tools/gmr_to_mimickit/gmr_to_mimickit.py --src <gmr_file> --dst <out.pkl>。
```

---

## 扩展

### 新角色/动作（TODO）

添加 XML 到 `data/assets`，制作动作 pkl 到 `data/motions` 或 `data/datasets`，并在新的环境 YAML 里设置 char\_file、motion\_file。

### 新环境类型

在 `mimickit/envs` 添加环境类并在 `envs/env_builder.py` 注册，同时补充 `data/envs/*.yaml` 与 `args/*.txt`。

### 算法（IL）

#### DeepMimic

> [DeepMimic: Example\-Guided Deep Reinforcement Learning of Physics\-Based Character Skills](https://xbpeng.github.io/projects/DeepMimic/index.html)
>
>

<a class="document-image-link" href="/document-assets/mimickit/media-06.webp" target="_blank" rel="noopener"><img src="/document-assets/mimickit/media-06.webp" alt="MimicKit 使用与整理 · 图 6" width="2998" height="361" loading="lazy" decoding="async" /></a>

这是一种基于强化学习的简单动作跟踪方法，通过训练一个跟踪控制器来模仿目标参考动作。该方法具有高度通用性和可靠性，已经成功用于训练多种复杂行为的控制器。因此，在尝试更复杂的技术之前，DeepMimic 往往是一个良好的起点；对于需要精确复现参考动作的应用来说，它同样非常有效。

然而，DeepMimic 的一个关键局限在于：其训练过程中使用的动作跟踪目标会导致策略缺乏灵活性，必须紧密跟随给定的参考动作。这会限制智能体在面对新任务时对数据集中已有行为进行调整或适应的能力。

运行 DeepMimic 的示例参数见 `args/deepmimic_humanoid_ppo_args.txt`。用于训练的参考运动数据可以通过环境配置文件中的 `motion_file data/envs/deepmimic_humanoid_env.yaml` 来指定。

#### 对抗运动先验（AMP）

> [AMP: Adversarial Motion Priors for Stylized Physics\-Based Character Control](https://xbpeng.github.io/projects/AMP/index.html)
>
>

<a class="document-image-link" href="/document-assets/mimickit/media-07.webp" target="_blank" rel="noopener"><img src="/document-assets/mimickit/media-07.webp" alt="MimicKit 使用与整理 · 图 7" width="3700" height="448" loading="lazy" decoding="async" /></a>

与 DeepMimic 依赖严格跟踪特定参考动作不同，AMP 是一种对抗式的分布匹配方法，它通过模仿一组动作片段数据中所展现的整体行为分布（即风格），而不是显式地跟踪某一个具体的动作片段。相比基于跟踪的方法，AMP 更加灵活，它允许智能体在执行新任务时，自由组合和调整数据集中的各种行为模式。

然而，这类分布匹配方法也存在一个主要缺点：它们更容易收敛到局部最优，尤其是在具有挑战性、高动态的动作上。因此，与 DeepMimic 这类跟踪式方法相比，AMP 在精确复现复杂动作时可能会更困难。

使用 AMP 模拟单个动作片段（不含辅助任务）的示例见 `args/amp_humanoid_args.txt`。`args/amp_location_humanoid_args.txt` 中提供了一个带辅助任务训练 AMP 模型的示例。

#### 对抗技能嵌入（ASE）

> [ASE: Large\-Scale Reusable Adversarial Skill Embeddings for Physically Simulated Characters](https://xbpeng.github.io/projects/ASE/index.html)
>
>

<a class="document-image-link" href="/document-assets/mimickit/media-08.webp" target="_blank" rel="noopener"><img src="/document-assets/mimickit/media-08.webp" alt="MimicKit 使用与整理 · 图 8" width="1918" height="441" loading="lazy" decoding="async" /></a>

ASE 是一种对抗式方法，用于训练可复用的生成控制器。该方法将对抗模仿学习与基于互信息的技能发现目标结合起来，从而学习出潜在技能空间（latent skill embeddings）。在训练完成后，潜在空间中的不同点可由 ASE 控制器映射为多样化的行为。由于 ASE 控制器已具备生成丰富技能的能力，因此在执行新任务时，只需训练任务相关的高层控制器，根据需要从潜在空间选择合适的技能即可。

训练 ASE 模型的示例可参考 `args/ase_humanoid_args.txt`。

#### 对抗差分判别器（ADD）

> [Physics\-Based Motion Imitation with Adversarial Differential Discriminators](https://xbpeng.github.io/projects/ADD/index.html)
>
>

<a class="document-image-link" href="/document-assets/mimickit/media-09.webp" target="_blank" rel="noopener"><img src="/document-assets/mimickit/media-09.webp" alt="MimicKit 使用与整理 · 图 9" width="3840" height="609" loading="lazy" decoding="async" /></a>

ADD 是一种对抗式动作跟踪方法，它通过差分判别器（differential discriminator）来自动学习可自适应的动作跟踪目标。这种方式能够显著减少为不同角色和动作手工设计、调节跟踪奖励函数的工作量。训练 ADD 模型的示例参数可参考 `args/add_humanoid_args.txt`。

#### 新算法添加

在 `mimickit/learning` 添加 Agent/Model 并在 `agent_builder.py` 注册；如需新网络结构，放入 `mimickit/learning/nets`。

### 实验脚本化（TODO）

为每个实验新增 `args/<exp>_args.txt`，并将输出路径纳入该实验专属的 `output/<exp>/`。
