---
title: "强化学习配置新机器人"
description: "以 Openloong 为例，记录模型资源、初始姿态、奖励参数与训练任务的接入过程。"
category: "强化学习"
tags: ["Openloong", "Humanoid Gym", "配置记录"]
order: 3
cover: /document-covers/reinforcement-learning-new-robot.webp
---

现有的软件包允许添加新的机器人模型进行强化学习训练，本文做一个完整的流程演示，以上海人形机器人公司的开源模型**Openloong**为例（基于Humanoid Gym框架）。

> <https://atomgit.com/openloong/openloong-dyn-control>
>
>

## 添加模型资源

在`resources/robots/Openloong`目录下，放入`meshes`和`urdf`文件。

<a class="document-image-link" href="/document-assets/reinforcement-learning-new-robot/media-01.webp" target="_blank" rel="noopener"><img src="/document-assets/reinforcement-learning-new-robot/media-01.webp" alt="强化学习配置新机器人 · 图 1" width="560" height="126" loading="lazy" decoding="async" /></a>


## 配置urdf文件

\*通常模型初始姿态是立直的，这不利于训练初始加载时的稳定性，并且容易导致link碰撞从而出现不断reset的情况。

### 查看模型

> <https://gkjohnson.github.io/urdf-loaders/javascript/example/bundle/>
>
>

通过一个在线查看模型的小工具可以帮助我们更好地修改urdf文件。打开网页后将`Openloong`文件夹拖入并等待一段时间，模型即可被加载。

<a class="document-image-link" href="/document-assets/reinforcement-learning-new-robot/media-02.webp" target="_blank" rel="noopener"><img src="/document-assets/reinforcement-learning-new-robot/media-02.webp" alt="强化学习配置新机器人 · 图 2" width="2558" height="1439" loading="lazy" decoding="async" /></a>

\*出现以上网页空白的情况时，可以查看urdf文件中stl文件的引用路径是否正确。建议写为以下格式：

<a class="document-image-link" href="/document-assets/reinforcement-learning-new-robot/media-03.webp" target="_blank" rel="noopener"><img src="/document-assets/reinforcement-learning-new-robot/media-03.webp" alt="强化学习配置新机器人 · 图 3" width="421" height="78" loading="lazy" decoding="async" /></a>

修改正确后模型即可正常显示

<a class="document-image-link" href="/document-assets/reinforcement-learning-new-robot/media-04.webp" target="_blank" rel="noopener"><img src="/document-assets/reinforcement-learning-new-robot/media-04.webp" alt="强化学习配置新机器人 · 图 4" width="2560" height="1438" loading="lazy" decoding="async" /></a>

### 调整rpy角

我们尽量使机器人采取双手自然下垂，双腿呈下蹲的姿态来维持机器人的稳定性。由此我们确定了需要调整的关节有**肩关节的pitch和roll**，**髋关节的pitch**，**膝关节的pitch**，**踝关节的pitch。**

<a class="document-image-link" href="/document-assets/reinforcement-learning-new-robot/media-05.webp" target="_blank" rel="noopener"><img src="/document-assets/reinforcement-learning-new-robot/media-05.webp" alt="强化学习配置新机器人 · 图 5" width="314" height="343" loading="lazy" decoding="async" /></a>

例如上述代码中的rpy我们需要从原来的“0 0 0”修改为“0 \-0\.4 0”。当我们修改完下肢后，注意检查髋关节转动角度加上踝关节转动角度是否等于膝关节转动角度，只有一致时才能使机器人保持平衡。

<a class="document-image-link" href="/document-assets/reinforcement-learning-new-robot/media-06.webp" target="_blank" rel="noopener"><img src="/document-assets/reinforcement-learning-new-robot/media-06.webp" alt="强化学习配置新机器人 · 图 6" width="2557" height="1440" loading="lazy" decoding="async" /></a>

### 修改碰撞

上半身的碰撞属性我们可以设置为一个box。

<a class="document-image-link" href="/document-assets/reinforcement-learning-new-robot/media-07.webp" target="_blank" rel="noopener"><img src="/document-assets/reinforcement-learning-new-robot/media-07.webp" alt="强化学习配置新机器人 · 图 7" width="475" height="438" loading="lazy" decoding="async" /></a>

同时删除一些不必要的碰撞检测。

<a class="document-image-link" href="/document-assets/reinforcement-learning-new-robot/media-08.webp" target="_blank" rel="noopener"><img src="/document-assets/reinforcement-learning-new-robot/media-08.webp" alt="强化学习配置新机器人 · 图 8" width="473" height="177" loading="lazy" decoding="async" /></a>

这样做可以有效避免碰撞引起的干涉。

<a class="document-image-link" href="/document-assets/reinforcement-learning-new-robot/media-09.webp" target="_blank" rel="noopener"><img src="/document-assets/reinforcement-learning-new-robot/media-09.webp" alt="强化学习配置新机器人 · 图 9" width="2560" height="1438" loading="lazy" decoding="async" /></a>

### 修改关节类型

因为项目只保留了下肢进行训练，所以我们修改除下肢以外的关节旋转类型为**fixed。**

<a class="document-image-link" href="/document-assets/reinforcement-learning-new-robot/media-10.webp" target="_blank" rel="noopener"><img src="/document-assets/reinforcement-learning-new-robot/media-10.webp" alt="强化学习配置新机器人 · 图 10" width="299" height="341" loading="lazy" decoding="async" /></a>


## 配置config文件

### asset配置

修改urdf文件地址，更新机器人的各部分name。

<a class="document-image-link" href="/document-assets/reinforcement-learning-new-robot/media-11.webp" target="_blank" rel="noopener"><img src="/document-assets/reinforcement-learning-new-robot/media-11.webp" alt="强化学习配置新机器人 · 图 11" width="734" height="180" loading="lazy" decoding="async" /></a>

\*此处我的urdf中将部分link的名字做了修整，准确的link名需通过urdf\_to\_graphviz命令生成pdf查看。

<a class="document-image-link" href="/document-assets/reinforcement-learning-new-robot/media-12.webp" target="_blank" rel="noopener"><img src="/document-assets/reinforcement-learning-new-robot/media-12.webp" alt="强化学习配置新机器人 · 图 12" width="803" height="554" loading="lazy" decoding="async" /></a>

### 初始位置设定

在2\.2的内容中，我们已经在urdf修改过一些关节的默认角度，所以这里我们直接将所有关节角度设为0即可。

<a class="document-image-link" href="/document-assets/reinforcement-learning-new-robot/media-13.webp" target="_blank" rel="noopener"><img src="/document-assets/reinforcement-learning-new-robot/media-13.webp" alt="强化学习配置新机器人 · 图 13" width="683" height="342" loading="lazy" decoding="async" /></a>

### 修改刚性和阻尼

根据模型的重量（urdf中的mass值，单位kg）来相应地修改数值，具体酌情调整。

<a class="document-image-link" href="/document-assets/reinforcement-learning-new-robot/media-14.webp" target="_blank" rel="noopener"><img src="/document-assets/reinforcement-learning-new-robot/media-14.webp" alt="强化学习配置新机器人 · 图 14" width="712" height="229" loading="lazy" decoding="async" /></a>

### 修改目标高度

在`init_state`初始化中，我们设定z轴高度略高于base\_hight，使机器人在训练加载时有足够的缓冲距离。

<a class="document-image-link" href="/document-assets/reinforcement-learning-new-robot/media-15.webp" target="_blank" rel="noopener"><img src="/document-assets/reinforcement-learning-new-robot/media-15.webp" alt="强化学习配置新机器人 · 图 15" width="668" height="344" loading="lazy" decoding="async" /></a>

这里注意，在`rewards`中，base\_height\_target代表我们想要机器人维持的基础高度，过高或过低的数值都有可能导致负面的训练效果，极端情况下会出现矩阵数值异常无法开始训练。

<a class="document-image-link" href="/document-assets/reinforcement-learning-new-robot/media-16.webp" target="_blank" rel="noopener"><img src="/document-assets/reinforcement-learning-new-robot/media-16.webp" alt="强化学习配置新机器人 · 图 16" width="540" height="136" loading="lazy" decoding="async" /></a>

### 修改名称

为防止出现名称引起的错误，建议使用查找替换来修改，例如将XBotL替换为Openloong。

<a class="document-image-link" href="/document-assets/reinforcement-learning-new-robot/media-17.webp" target="_blank" rel="noopener"><img src="/document-assets/reinforcement-learning-new-robot/media-17.webp" alt="强化学习配置新机器人 · 图 17" width="2189" height="727" loading="lazy" decoding="async" /></a>

### \*调整奖励参数

总的来说调参是一个复杂且需要投入大量人力和硬件资源的工作，丰富的经验有助于快速找出一组良好的参数。以下对目前已经设置的参数做一个介绍，内容基本涵盖了所需的奖励函数。

```python
class rewards:
        base_height_target = 1.02
        min_dist = 0.2
        max_dist = 0.5
        # put some settings here for LLM parameter tuning
        target_joint_pos_scale = 0.17    # rad
        target_feet_height = 0.06       # m
        cycle_time = 0.64                # sec
        # if true negative total rewards are clipped at zero (avoids early termination problems)
        only_positive_rewards = True
        # tracking reward = exp(error*sigma)
        tracking_sigma = 5
        max_contact_force = 1500  # Forces above this value are penalized

        class scales:
            # reference motion tracking
            joint_pos = 1.6
            feet_clearance = 1.
            feet_contact_number = 1.2
            # gait
            feet_air_time = 1.
            foot_slip = -0.05
            feet_distance = 0.22
            knee_distance = 0.22
            # contact
            feet_contact_forces = -0.005
            # vel tracking
            tracking_lin_vel = 1.2
            tracking_ang_vel = 1.1
            vel_mismatch_exp = 0.5  # lin_z; ang x,y
            low_speed = 0.2
            track_vel_hard = 0.5
            # base pos
            default_joint_pos = 0.5
            orientation = 1.
            base_height = 0.2
            base_acc = 0.2
            # energy
            action_smoothness = -0.002
            torques = -1e-5
            dof_vel = -5e-4
            dof_acc = -1e-7
            collision = -1.
```

这个类定义了一组用于机器人控制的奖励函数参数，具体设置了关节位置、足部接触、速度跟踪等多个方面的奖励和惩罚项。以下是主要参数的解读：

**主要参数：**

1. 目标高度 \(`base_height_target`\)：目标基座高度为 1\.02 米，机器人会根据这个高度进行调节。

2. 足部距离限制 \(`min_dist` 和 `max_dist`\)：足部的最小和最大目标距离分别为 0\.2 米和 0\.5 米。

3. 关节位置目标 \(`target_joint_pos_scale`\)：目标关节位置的调整范围为 0\.17 弧度。

4. 足部高度 \(`target_feet_height`\)：目标足部高度为 0\.06 米，可能用于控制步态。

5. 周期时间 \(`cycle_time`\)：一个步态周期为 0\.64 秒。

6. 奖励裁剪 \(`only_positive_rewards`\)：若为 `True`，负总奖励被裁剪为 0，防止早期任务终止问题。

7. 跟踪误差的缩放 \(`tracking_sigma`\)：用于计算跟踪误差的参数，值为 5。

8. 最大接触力 \(`max_contact_force`\)：大于 1500 N 的接触力会受到惩罚。

**子类 `scales` 的比例因子：**

- 关节位置跟踪 \(`joint_pos`\)：奖励关节位置跟踪的权重为 1\.6。

- 足部清除 \(`feet_clearance`\)：奖励足部抬高时的清除距离，权重为 1。

- 接触足数 \(`feet_contact_number`\)：奖励与地面接触的足数量，权重为 1\.2。

- 步态相关：

    - 足部腾空时间 \(`feet_air_time`\)：奖励足部腾空时间，权重为 1。

    - 足部滑动 \(`foot_slip`\)：足部滑动受到惩罚，权重为 \-0\.05。

    - 足部距离 \(`feet_distance`\) 和 膝盖距离 \(`knee_distance`\)：足部和膝盖的距离控制，权重为 0\.22。

- 接触力：

    - 足部接触力 \(`feet_contact_forces`\)：奖励足部与地面的接触力，权重为 \-0\.005。

- 速度跟踪：

    - 线速度 \(`tracking_lin_vel`\) 和 角速度 \(`tracking_ang_vel`\)：线性和角速度跟踪奖励，权重分别为 1\.2 和 1\.1。

    - 速度不匹配指数 \(`vel_mismatch_exp`\)：用于 z 方向的线速度和 x、y 方向的角速度，权重为 0\.5。

    - 低速 \(`low_speed`\)：低速情况下的奖励因子，权重为 0\.2。

    - 速度跟踪难度 \(`track_vel_hard`\)：更高难度的速度跟踪权重，值为 0\.5。

- 基座位置控制：

    - 默认关节位置 \(`default_joint_pos`\)：关节位置偏离默认值的惩罚，权重为 0\.5。

    - 姿态控制 \(`orientation`\) 和 基座高度 \(`base_height`\)：基座姿态和高度的控制，权重为 1 和 0\.2。

    - 基座加速度 \(`base_acc`\)：基座加速度的控制，权重为 0\.2。

- 能量消耗：

    - 动作平滑度 \(`action_smoothness`\)：动作过于剧烈会受到惩罚，权重为 \-0\.002。

    - 力矩 \(`torques`\)：消耗的关节力矩受到惩罚，权重为 \-1e\-5。

    - 关节速度 \(`dof_vel`\) 和 关节加速度 \(`dof_acc`\)：关节速度和加速度的惩罚，权重分别为 \-5e\-4 和 \-1e\-7。

    - 碰撞 \(`collision`\)：碰撞行为的惩罚，权重为 \-1。


## 配置env文件

### 修改理想步态

> <https://www.bilibili.com/video/BV1mi421h7Qv/?spm_id_from=333.788&vd_source=4e9a0afc5e2cdfbdba5e466572718007>
>
>

这里我们运用到一个步态可视化工具，详细教程查看链接。配置好docker后修改代码中的文件路径，foot\_name等内容即可使用。

<figure class="document-video">
<video controls playsinline preload="none" poster="/document-assets/reinforcement-learning-new-robot/media-18.webp" width="1440" height="792" aria-label="调整前的步态"><source src="/document-assets/reinforcement-learning-new-robot/media-18.mp4" type="video/mp4" />你的浏览器暂不支持视频播放。<a href="/document-assets/reinforcement-learning-new-robot/media-18.mp4">下载视频</a></video>
<figcaption>调整前的步态<span>20 秒 · 0.5 MB</span></figcaption>
</figure>

可以看到，直接使用原来的代码出现了关节旋转方向不符合预期的情况。观察发现这里使用正弦波来实现步态中的抬落脚动作，因此修改sin前的正负号即可实现关节旋转方向的改变。

<figure class="document-video">
<video controls playsinline preload="none" poster="/document-assets/reinforcement-learning-new-robot/media-19.webp" width="1440" height="792" aria-label="调整后的步态"><source src="/document-assets/reinforcement-learning-new-robot/media-19.mp4" type="video/mp4" />你的浏览器暂不支持视频播放。<a href="/document-assets/reinforcement-learning-new-robot/media-19.mp4">下载视频</a></video>
<figcaption>调整后的步态<span>14 秒 · 0.4 MB</span></figcaption>
</figure>

值得注意的是，由于我们的关节顺序保持和原来的开源模型一致，所以可以对代码不做变动，实际关节顺序要视情况调整（即不一定是2,3,4,8,9,10关节），根据3\.2部分。

### 修改默认关节位置奖励函数

<a class="document-image-link" href="/document-assets/reinforcement-learning-new-robot/media-20.webp" target="_blank" rel="noopener"><img src="/document-assets/reinforcement-learning-new-robot/media-20.webp" alt="强化学习配置新机器人 · 图 20" width="946" height="232" loading="lazy" decoding="async" /></a>

同4\.1中我们的关节顺序的一致性，这里也不用做修改。当遇到关节顺序不一致时要对参数做一定调整。

**解读索引：**

1. **`joint_diff[:, :2]`**：

    - `:` 表示选取所有行。

    - `:2` 表示选取前两个关节（第 0 和第 1 列）。

    - 因此，这里提取的是与**左侧**相关的关节位置差异，是与左腿或左臂有关的两个关节。具体来说，这两个关节是左侧的 `yaw` 和 `roll` 方向。

2. **`joint_diff[:, 6:8]`**：

    - `:` 同样表示选取所有行。

    - `6:8` 表示选取第 6 和第 7 个关节（从第 6 列到第 7 列，不包括第 8 列）。

    - 这里提取的是**右侧**相关的两个关节位置差异，是右腿或右臂的 `yaw` 和 `roll` 方向。

这两个部分的提取通过切片操作聚焦在特定的关节，用于计算这两个方向的偏差，并单独处理它们的惩罚。

## 注册新任务

`在/humaniod/envs`路径下的`__init__.py`文件中，我们需要导入对应任务的配置文件。

```python
from .custom.Openloong_config import OpenloongCfg, OpenloongCfgPPO
from .custom.Openloong_env import OpenloongFreeEnv
task_registry.register( "Openloong_ppo", OpenloongFreeEnv, OpenloongCfg(), OpenloongCfgPPO() )
```

至此，训练新机器人前的配置工作全部完成！
