---
title: "Mini-Pi-Plus · BeyondMimic 使用记录"
description: "从 BVH 重定向、动作裁剪到训练与 sim2sim，记录 Mini-Pi-Plus 的动作模仿流程。"
category: "动作模仿"
tags: ["BeyondMimic", "GMR", "sim2sim"]
order: 4
cover: /document-covers/mini-pi-plus-beyondmimic.webp
---

> 关于mimic的探索，通过3D重映射，我们可以将人体运动捕捉数据映射到自己的机器人上，同时对这些数据进行转化成为利于模仿学习的格式。以下是我们试跑的高擎机器人的demo。
>
>

## BVH数据重映射

BVH（**Biovision Hierarchy**）是一种常见的 **人体运动捕捉数据格式**，最早由 Biovision 公司提出，后来被广泛用于动画、游戏、机器人仿真等领域中。它主要描述一个**关节层级骨架以及该骨架在一段时间内的运动**。但BVH 是一种**层级文本格式**，虽然人能读懂，但机器学习不方便直接使用。模仿学习一般希望输入的是：

- 每帧的**关节角度**

- 或者**末端位姿**

- 以及可能的**根节点位姿**

这些数值型数据必须是结构化的矩阵形式，比如：

```text
frame_id, hip_x, hip_y, hip_z, spine_xrot, spine_yrot, spine_zrot, ...
```

因此，BVH → CSV（结构化数值） → NPZ（高效加载）

这时就需要将这些数据通过3D映射做一个重定向来转为csv格式。

```bash
# 重定向
python scripts/bvh_to_robot.py \
--bvh_file /home/jsr-feedstars/humanoid_robot/Mini-Pi-Plus_BeyondMimic/GMR/MotionData/lafan1/dance1_subject1.bvh \
--robot pi_football \
--save_path RetargetData/lafan1/csv/pi_plus/dance1_subject1.csv \
--rate_limit
```

<figure class="document-video">
<video controls playsinline preload="none" poster="/document-assets/mini-pi-plus-beyondmimic/media-01.webp" width="1440" height="810" aria-label="BVH 动作重定向"><source src="/document-assets/mini-pi-plus-beyondmimic/media-01.mp4" type="video/mp4" />你的浏览器暂不支持视频播放。<a href="/document-assets/mini-pi-plus-beyondmimic/media-01.mp4">下载视频</a></video>
<figcaption>BVH 动作重定向<span>100 秒 · 13.0 MB</span></figcaption>
</figure>

## 裁剪动作长度

由于数据集本身在前期包含了一些无用的或错误的动作数据，需要对csv做裁剪操作。

```bash
# 裁剪
python scripts/csv_cut_pi_plus.py \
--input_csv /home/jsr-feedstars/humanoid_robot/Mini-Pi-Plus_BeyondMimic/RetargetData/lafan1/csv/pi_plus/dance1_subject1.csv \
--output_csv /home/jsr-feedstars/humanoid_robot/Mini-Pi-Plus_BeyondMimic/RetargetData/lafan1/csv/pi_plus/dance1_subject1.csv \
--start_frame 1150 \
--end_frame 3944 \
--remove_frame_column \
--z_offset 0.00
--decimal_places 6
```

## csv转npz

为什么：

- `.csv` 读取慢、占空间大；

- `.npz`（Numpy 压缩格式）读取快、可直接 `np.load()` 用于训练。

前述内容都在GMR项目的环境中完成，这一步开始需要转到安装了Isaac Lab的环境。

```bash
# csv转npz
python scripts/csv_to_npz.py \
--robot pi_plus \
--input_file /home/jsr-feedstars/humanoid_robot/Mini-Pi-Plus_BeyondMimic/RetargetData/lafan1/csv/pi_plus/dance1_subject1.csv \
--input_fps 30 \
--output_name source/motion/hightorque/pi_plus/npz/dance1_subject1.npz
```

转化动捕数据后在Isaac Sim中进行replay，这时需要观察我们将进行训练的动作是否合理，是否存在危险性不适合真实机器人进行部署。

```bash
# 数据播放
python scripts/replay_npz.py \
--robot pi_plus \
--motion_file source/motion/hightorque/pi_plus/npz/dance1_subject1.npz.npz
```

<figure class="document-video">
<video controls playsinline preload="none" poster="/document-assets/mini-pi-plus-beyondmimic/media-02.webp" width="1440" height="810" aria-label="转换后的动作回放"><source src="/document-assets/mini-pi-plus-beyondmimic/media-02.mp4" type="video/mp4" />你的浏览器暂不支持视频播放。<a href="/document-assets/mini-pi-plus-beyondmimic/media-02.mp4">下载视频</a></video>
<figcaption>转换后的动作回放<span>54 秒 · 4.8 MB</span></figcaption>
</figure>

## 训练及播放

```bash
# 训练命令
python scripts/rsl_rl/train.py \
--task=Tracking-Flat-PI-Plus-Wo-v0 \
--motion_file source/motion/hightorque/pi_plus/npz/dance1_subject1.npz.npz \
--headless \
--log_project_name pi_plus_beyondmimic
# resume参数需要加上上一次训练后的pt文件路径
```

```bash
# 播放及导出onnx
python scripts/rsl_rl/play.py \
--task=Tracking-Flat-PI-Plus-Wo-v0 \
--checkpoint '/home/jsr-feedstars/humanoid_robot/Mini-Pi-Plus_BeyondMimic/logs/rsl_rl/pi_plus_flat/2025-10-31_09-30-57/model_10000.pt' \
--num_envs=1 \
--motion_file source/motion/hightorque/pi_plus/npz/dance1_subject1.npz.npz
```

链接Isaac Lab进行数千轮次的训练后得到的效果。

<figure class="document-video">
<video controls playsinline preload="none" poster="/document-assets/mini-pi-plus-beyondmimic/media-03.webp" width="1440" height="810" aria-label="训练结果回放"><source src="/document-assets/mini-pi-plus-beyondmimic/media-03.mp4" type="video/mp4" />你的浏览器暂不支持视频播放。<a href="/document-assets/mini-pi-plus-beyondmimic/media-03.mp4">下载视频</a></video>
<figcaption>训练结果回放<span>52 秒 · 1.8 MB</span></figcaption>
</figure>

## sim2sim验证

最后将策略sim2sim到Mujoco进行泛化性验证。

```bash
python scripts/sim2sim.py \
--robot pi_plus \
--motion_file source/motion/hightorque/pi_plus/npz/dance1_subject1.npz.npz  \
--xml_path source/whole_body_tracking/whole_body_tracking/assets/hightorque/pi_plus/mjcf/pi_20dof.xml \
--policy_path '/home/jsr-feedstars/humanoid_robot/Mini-Pi-Plus_BeyondMimic/logs/rsl_rl/pi_plus_flat/2025-10-31_09-30-57/exported/model_10000.onnx' \
--save_json \
--loop
```

<figure class="document-video">
<video controls playsinline preload="none" poster="/document-assets/mini-pi-plus-beyondmimic/media-04.webp" width="1440" height="810" aria-label="MuJoCo 中的 sim2sim 验证"><source src="/document-assets/mini-pi-plus-beyondmimic/media-04.mp4" type="video/mp4" />你的浏览器暂不支持视频播放。<a href="/document-assets/mini-pi-plus-beyondmimic/media-04.mp4">下载视频</a></video>
<figcaption>MuJoCo 中的 sim2sim 验证<span>51 秒 · 5.8 MB</span></figcaption>
</figure>
