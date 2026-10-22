---
publishedDate: '2025-11-13'
title: "GVHMR · GMR 前置数据准备"
description: "记录视频人体运动重建的环境配置、数据准备、推理输出与 GMR 接入过程。"
category: "动作模仿"
tags: ["GVHMR", "SMPL", "GMR"]
order: 5
cover: /document-covers/gvhmr-motion-reconstruction.webp
---

## 项目简介

> 项目地址
>
> [https://github.com/zju3dv/GVHMR/tree/main](https://github.com/zju3dv/GVHMR/tree/main)
>
>

GVHMR（Generalizable Video\-based Human Motion Reconstruction）是一个从视频中估计人体三维姿态和运动序列的深度学习模型。它通过 ViTPose \+ Transformer 编码视频特征，并使用 SMPL/SMPLX 参数解码人体运动。本项目用于从单目视频中生成时序化的 3D 人体姿态文件（`.pt`），可进一步用于仿真驱动（如 IsaacGym / GMR）。

<figure class="document-video">
<video controls playsinline preload="none" poster="/document-assets/gvhmr-motion-reconstruction/media-01.webp" width="720" height="158" aria-label="GVHMR 项目效果展示"><source src="/document-assets/gvhmr-motion-reconstruction/media-01.mp4" type="video/mp4" />你的浏览器暂不支持视频播放。<a href="/document-assets/gvhmr-motion-reconstruction/media-01.mp4">下载视频</a></video>
<figcaption>GVHMR 项目效果展示<span>16 秒 · 1.1 MB</span></figcaption>
</figure>

**文件大体结构展示：**

```bash
GVHMR/
├── tools/                   # 运行脚本（demo, train, eval）
│   ├── demo/demo.py         # 单视频推理
│   └── train.py             # 训练入口
├── hmr4d/                   # 模型核心模块
│   ├── model/               # 网络定义
│   ├── utils/               # 工具集（body model, smplx_utils 等）
│   └── data/                # 数据加载逻辑
├── configs/                 # Hydra 配置文件
│   ├── exp/                 # 训练/测试实验配置
│   ├── model/               # 模型结构定义
│   └── network/             # Transformer 参数
├── inputs/
│   ├── checkpoints/         # 各类模型权重
│   │   ├── gvhmr/           # GVHMR 主模型权重
│   │   └── body_models/     # SMPL/SMPLX 模型文件
└── outputs/
    └── demo/                # 推理结果（视频+pt）

```

---

## 环境配置

### 系统环境

### 依赖安装步骤

```bash
git clone https://github.com/zju3dv/GVHMR
cd GVHMR

conda create -y -n gvhmr python=3.10
conda activate gvhmr
pip install -r requirements.txt
pip install -e .
```

#### SMPL/SMPLX 模型文件下载

新建两个文件夹来存放输入输出：

```bash
mkdir inputs
mkdir outputs
```

新建文件夹存放检查点：

```bash
mkdir -p inputs/checkpoints
```

由于资源版权限制，需要自行从官网下载SMPL（https://smpl\.is\.tue\.mpg\.de/）和SMPLX（https://smpl\-x\.is\.tue\.mpg\.de/）模型。并将文件设置为以下结构：

```bash
inputs/checkpoints/
├── body_models/smplx/
│   └── SMPLX_{GENDER}.npz
└── body_models/smpl/
    └── SMPL_{GENDER}.pkl
```

从官网 [https://smpl\.is\.tue\.mpg\.de](https://smpl.is.tue.mpg.de)下载的文件包：

```python
SMPL_python_v.1.1.0.zip
```

解压后包含：

```bash
smpl/
├── __init__.py
├── models/
│   ├── basicmodel_f_lbs_10_207_0_v1.1.0.pkl
│   ├── basicmodel_m_lbs_10_207_0_v1.1.0.pkl
│   └── basicmodel_neutral_lbs_10_207_0_v1.1.0.pkl
└── smpl_webuser/
    └── posemapper.py
```

这些 `.pkl` 文件是 **Python 2\.x pickle 格式的模型定义文件**，内部结构依赖于旧版 SMPL 的实现。而现代项目（如 GVHMR、VIBE、SMPLX、PyTorch SMPLX 库）都是 **Python 3 \+ torch 实现**，二者数据结构不兼容。

⚠️ 若使用官方 SMPL `.pkl` 文件，请用 `convert.py` \+ `fix_smpl_pickle.py` 转换为兼容格式。

<a href="/document-assets/gvhmr-motion-reconstruction/convert.py" download>下载 convert.py</a>

<a href="/document-assets/gvhmr-motion-reconstruction/fix_smpl_pickle.py" download>下载 fix_smpl_pickle.py</a>

> SMPL 模型文件请按上方说明从官方渠道获取。本站不提供模型压缩包下载。

#### 预训练模型下载

从谷歌网盘下载预训练的模型：[drive\.google\.com](https://drive.google.com/drive/folders/1eebJ13FUEXrKBawHpJroW0sNSxLjh9xD?usp=drive_link)

文件存放结构如下：

```bash
inputs/checkpoints/
├── dpvo/
│   └── dpvo.pth
├── gvhmr/
│   └── gvhmr_siga24_release.ckpt
├── hmr2/
│   └── epoch=10-step=25000.ckpt
├── vitpose/
│   └── vitpose-h-multi-coco.pth
└── yolo/
    └── yolov8x.pt
```

#### 特征支持数据下载

从[drive\.google\.com](https://drive.google.com/drive/folders/10sEef1V_tULzddFxzCmDUpsIqfv7eP-P)下载数据

```bash
cd inputs
# Train
tar -xzvf AMASS_hmr4d_support.tar.gz
tar -xzvf BEDLAM_hmr4d_support.tar.gz
tar -xzvf H36M_hmr4d_support.tar.gz
# Test
tar -xzvf 3DPW_hmr4d_support.tar.gz
tar -xzvf EMDB_hmr4d_support.tar.gz
tar -xzvf RICH_hmr4d_support.tar.gz

# The folder structure should be like this:
inputs/
├── AMASS/hmr4d_support/
├── BEDLAM/hmr4d_support/
├── H36M/hmr4d_support/
├── 3DPW/hmr4d_support/
├── EMDB/hmr4d_support/
└── RICH/hmr4d_support/
```

**🧠 GVHMR 数据结构与作用说明**

1. GVHMR（Generalizable Video\-based Human Mesh Recovery）是一个视频人体网格恢复系统。它的训练数据不是原始视频，而是已经预处理好的 **特征文件 \+ 标注信息**，这些“hmr4d\_support”文件夹正是支持 GVHMR 快速加载的预处理版本。

2. 这些文件夹中包含了经过 GVHMR 特征提取流程预处理后的数据，例如：

    1. 视频关键点检测（ViTPose、OpenPose）结果

    2. 特征提取（ViT 特征 embedding）

    3. 3D 姿态参数（SMPL θ, β, trans）

    4. 时间序列对齐与摄像机参数

    5. 训练 split（train/test/meta 信息）

🧩** 每个数据集的作用**

---

## 使用记录

### 项目demo试跑

```bash
# 如果知道相机是静态的，则使用 -s 跳过视觉里程计
python tools/demo/demo.py --video=docs/example_video/tennis.mp4 -s
```

运行命令后可以在`outputs`文件夹中得到

```bash
├── 0_input_video.mp4 # 用来生成动作的原始视频。
├── 1_incam.mp4 # 以镜头视口渲染的结果画面和原始视频叠加的新视频。
├── 2_global.mp4 # 以世界视角渲染的视频。
├── hmr4d_results.pt # 生成的角色数据，numpy 二进制格式。
├── preprocess
│   ├── bbx.pt
│   ├── vit_features.pt
│   └── vitpose.pt
└── tennis_3_incam_global_horiz.mp4 # incam和global拼合的视频
```

### 新视频替换

自行录制一段`.mp4`格式的视频放在`inputs`文件夹下，运行：

```bash
python tools/demo/demo.py --video=inputs/TaiChi.mp4 -s
```

同样得到：

<figure class="document-video">
<video controls playsinline preload="none" poster="/document-assets/gvhmr-motion-reconstruction/media-05.webp" width="1440" height="810" aria-label="太极动作 · 输入视频"><source src="/document-assets/gvhmr-motion-reconstruction/media-05.mp4" type="video/mp4" />你的浏览器暂不支持视频播放。<a href="/document-assets/gvhmr-motion-reconstruction/media-05.mp4">下载视频</a></video>
<figcaption>太极动作 · 输入视频<span>40 秒 · 0.9 MB</span></figcaption>
</figure>

<figure class="document-video">
<video controls playsinline preload="none" poster="/document-assets/gvhmr-motion-reconstruction/media-06.webp" width="1440" height="810" aria-label="摄像机视角重建"><source src="/document-assets/gvhmr-motion-reconstruction/media-06.mp4" type="video/mp4" />你的浏览器暂不支持视频播放。<a href="/document-assets/gvhmr-motion-reconstruction/media-06.mp4">下载视频</a></video>
<figcaption>摄像机视角重建<span>40 秒 · 1.2 MB</span></figcaption>
</figure>

<figure class="document-video">
<video controls playsinline preload="none" poster="/document-assets/gvhmr-motion-reconstruction/media-07.webp" width="1440" height="810" aria-label="世界视角重建"><source src="/document-assets/gvhmr-motion-reconstruction/media-07.mp4" type="video/mp4" />你的浏览器暂不支持视频播放。<a href="/document-assets/gvhmr-motion-reconstruction/media-07.mp4">下载视频</a></video>
<figcaption>世界视角重建<span>40 秒 · 0.8 MB</span></figcaption>
</figure>

<figure class="document-video">
<video controls playsinline preload="none" poster="/document-assets/gvhmr-motion-reconstruction/media-08.webp" width="1440" height="404" aria-label="输入与重建结果对照"><source src="/document-assets/gvhmr-motion-reconstruction/media-08.mp4" type="video/mp4" />你的浏览器暂不支持视频播放。<a href="/document-assets/gvhmr-motion-reconstruction/media-08.mp4">下载视频</a></video>
<figcaption>输入与重建结果对照<span>40 秒 · 0.7 MB</span></figcaption>
</figure>

### Reproduce

#### Test

```bash
# 要在一次运行中重现 3DPW、RICH 和 EMDB 结果，请使用以下命令
python tools/train.py global/task=gvhmr/test_3dpw_emdb_rich exp=gvhmr/mixed/mixed ckpt_path=inputs/checkpoints/gvhmr/gvhmr_siga24_release.ckpt
# 测试单一数据集请将 global/task 更改为 gvhmr/test_3dpw、gvhmr/test_rich 或 gvhmr/test_emdb
```

这条命令是用 **已经训练好的 GVHMR 模型权重 \(`gvhmr_siga24_release.ckpt`\)**在 **3DPW / EMDB / RICH 三个测试集上运行推理和评估**，并生成定量指标（如 MPJPE、PA\-MPJPE、PVE、Acceleration、Jitter、FS 等）。

**📊 指标解释：**

#### Train

要训练模型，请使用以下命令：

```bash
python tools/train.py exp=gvhmr/mixed/mixed
# -------------------------------------------------------
# 原配置使用了两张4090来训练，直接运行程序会报错，需要先在/hmr4d/
# configs/exp/gvhmr/mixed/mixed.yaml中将devices设为1
# -------------------------------------------------------
```

这条命令会使用配置文件中定义的模型结构、优化器参数、训练集（AMASS、BEDLAM、H36M等），来启动完整的 GVHMR 模型训练流程。

运行命令后得到以下文件：

```bash
└── mixed
    ├── checkpoints/
    ├── tb/
    │   ├── events.out.tfevents.1763004106.jsrfeedstars-ubuntu
    │   └── hparams.yaml
    └── train.log
```

1. **`checkpoints/` —— 模型权重保存目录**

    **说明：**

    每隔若干 epoch（取决于配置文件中的 `save_interval`）系统会自动保存一次。

    通常包括：

    - `epoch=xxx-step=xxxx.ckpt`：每次保存的快照

    - `last.ckpt`：最近一次训练结束或中断的模型

**用途：**

- 恢复训练：

```bash
python tools/train.py exp=gvhmr/mixed/mixed ckpt_path=outputs/mocap_mixed_v1/mixed/checkpoints/last.ckpt
```

- 评测 / 验证

```bash
python tools/train.py global/task=gvhmr/test_3dpw_emdb_rich \
exp=gvhmr/mixed/mixed \
ckpt_path=outputs/mocap_mixed_v1/mixed/checkpoints/last.ckpt
```

- 导出为 \.pt 文件（供推理或下游项目如 GMR 使用）

2. **`tb/` —— TensorBoard 日志目录**

这个目录是 PyTorch Lightning 自动生成的训练可视化日志。

包含：

- `events.out.tfevents.***`：TensorBoard 主文件

- `hparams.yaml`：记录训练时的超参数配置（learning rate、batch size、loss weight 等）

**查看方法：**

```bash
tensorboard --logdir outputs/mocap_mixed_v1/mixed/tb --port 6006
```

3. **`train.log` —— 文本日志（训练进度）**

    这个文件是标准输出日志的备份。

    内容包括：

    - 训练开始时间

    - GPU / 环境信息

    - 每个 epoch 的损失项

    - 评估指标

    - checkpoint 保存记录

---

## 项目输出与GMR接入

> GVHMR 的输出是：**带全局平移与朝向的 3D 人体骨架序列（SMPL 参数 \+ 世界坐标轨迹 \+ 摄像机坐标转换）**，
> 能够直接在世界坐标系中重建出人体的真实运动轨迹。
>
>

### 输出的主要组成部分

1. SMPL 模型参数（姿态 \+ 形状）

    在 demo 或训练后，你会得到一个 `.pt` 文件（例如：`outputs/demo/tennis/hmr4d_results.pt`），里面包含：

    💡这些参数可以直接喂入 `smplx` 或 `smpl` 模型生成 3D mesh（顶点坐标）。

2. 世界坐标系下的关键点序列（3D joints）

    项目会将 SMPL 输出的关节转换到 **世界坐标系 \(world frame\)** 下，而不是摄像机坐标系。

    - 这些 3D 关键点是经过 “Gravity\-View 坐标变换” 对齐地面的。

    - 因此即使摄像机移动或旋转，人物仍保持正确的世界轨迹（不会随镜头漂移）。

    输出文件中通常包含：

    ```python
    results["pred_joints_world"]  # (N, 24, 3)
    ```

3. 根位移轨迹（Root translation trajectory）

    GVHMR 的一大亮点是它能**恢复全局运动轨迹**。例如，人物从房间左边走到右边，输出的 `transl` 反映了这一位移。这与常规的 SMPL\-based 方法不同，常规方法输出的人体在摄像机中心附近“原地走”。

4. 可选的摄像机姿态 \(Camera poses\)

    如果使用 `SimpleVO` 或 `DPVO`（Visual Odometry），GVHMR 同时估计：

    > 用于将图像坐标下的人体轨迹反投影到世界坐标。用于将图像坐标下的人体轨迹反投影到世界坐标。
    >
    >

5. 用于将图像坐标下的人体轨迹反投影到世界坐标

    如果你选择 `--save_mesh` 或在渲染阶段执行：

    ```bash
    python tools/demo/demo.py --video=xxx.mp4 -s --save_mesh
    ```

    则会在输出文件夹中生成：

    ```text
    outputs/demo/tennis/meshes/frame_000001.obj
    outputs/demo/tennis/meshes/frame_000002.obj
    ...
    ```

    每一帧一个 `.obj` 文件，可以直接在 Blender、Meshlab、Isaac Sim 或 MuJoCo 中加载渲染。

6. 可视化视频结果

    在默认 demo 模式下，会生成以下视频：

### 接入GMR

安装GMR详细参考：[使用GMR和BeyondMimic进行模仿学习](https://ewov2igmcma.feishu.cn/wiki/DcCuweOKiiqVYWks1iuc4PMbnfb)

安装完成后请执行以下代码（以booster t1为例）：

```bash
# <PT_FILE> 为前面项目导出的pt文件
# <PKL_PATH> 为保存的路径
python scripts/gvhmr_to_robot.py \
--gvhmr_pred_file <PT_FILE>  \
--save_path <PKL_PATH> \
--robot booster_t1
```


<figure class="document-video">
<video controls playsinline preload="none" poster="/document-assets/gvhmr-motion-reconstruction/media-09.webp" width="812" height="720" aria-label="输入视频"><source src="/document-assets/gvhmr-motion-reconstruction/media-09.mp4" type="video/mp4" />你的浏览器暂不支持视频播放。<a href="/document-assets/gvhmr-motion-reconstruction/media-09.mp4">下载视频</a></video>
<figcaption>输入视频<span>10 秒 · 1.3 MB</span></figcaption>
</figure>

<figure class="document-video">
<video controls playsinline preload="none" poster="/document-assets/gvhmr-motion-reconstruction/media-10.webp" width="640" height="480" aria-label="Booster T1 动作重定向结果"><source src="/document-assets/gvhmr-motion-reconstruction/media-10.mp4" type="video/mp4" />你的浏览器暂不支持视频播放。<a href="/document-assets/gvhmr-motion-reconstruction/media-10.mp4">下载视频</a></video>
<figcaption>Booster T1 动作重定向结果<span>10 秒 · 0.5 MB</span></figcaption>
</figure>

<figure class="document-video">
<video controls playsinline preload="none" poster="/document-assets/gvhmr-motion-reconstruction/media-05.webp" width="1440" height="810" aria-label="太极动作 · 输入视频"><source src="/document-assets/gvhmr-motion-reconstruction/media-05.mp4" type="video/mp4" />你的浏览器暂不支持视频播放。<a href="/document-assets/gvhmr-motion-reconstruction/media-05.mp4">下载视频</a></video>
<figcaption>太极动作 · 输入视频<span>40 秒 · 0.9 MB</span></figcaption>
</figure>


<figure class="document-video">
<video controls playsinline preload="none" poster="/document-assets/gvhmr-motion-reconstruction/media-12.webp" width="640" height="480" aria-label="Booster T1 太极动作"><source src="/document-assets/gvhmr-motion-reconstruction/media-12.mp4" type="video/mp4" />你的浏览器暂不支持视频播放。<a href="/document-assets/gvhmr-motion-reconstruction/media-12.mp4">下载视频</a></video>
<figcaption>Booster T1 太极动作<span>40 秒 · 1.1 MB</span></figcaption>
</figure>
