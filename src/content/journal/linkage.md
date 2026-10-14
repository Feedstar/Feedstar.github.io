---
title: 首尾相接之后，运动有了约束。
description: 把一条树形运动链闭合成四连杆，观察同一个输入如何通过连接关系带动其余杆件。
category: 模型与约束
number: '009'
example: linkage
---

给一根连杆施加驱动，另一根连杆为什么会跟着运动？在串联机械臂中，答案常常藏在父子层级里。换成首尾相接的四连杆，连接关系就需要额外表达。

[打开实验 09 · 四连杆与闭环约束](/lab/?example=linkage#experiment)。青色输入杆、乳白色连杆、金色从动杆和固定底座组成一个平行四边形。这里的“四”包含固定底座。

## 刚体树先留一个开口

MuJoCo 的 body 层级是一棵树。这个模型先定义两条分支：输入杆带着中间连杆，从动杆则直接连接到固定世界。它们在右上角各放一个 site，分别命名为 `closure_a` 和 `closure_b`。

两点最初重合，但位置重合本身不构成连接。若没有约束，输入运动后，它们就可能分离。

模型的地杆和中间连杆都是 0.65 m，左右两根侧杆都是 0.32 m。三个转动关节都绕 Z 轴，机构在水平 XY 平面运动。

## 用一个约束把端点连接起来

XML 在树形结构之外加入：

```xml
<equality>
  <connect name="loop"
           site1="closure_a"
           site2="closure_b"
           solref="0.008 1"/>
</equality>
```

[connect 约束](https://mujoco.readthedocs.io/en/stable/XMLreference.html#equality-connect)让两个连接点保持重合。它本身相当于点连接，并不会把两个刚体的相对方向完全焊死；本实验的平面运动还依赖各关节轴的设置。

也因此，只照搬这一行 XML 到任意空间机构中，并不能自动得到同样的四连杆运动。

## 只有输入杆收到驱动

实验只有一个位置执行器，连接输入杆关节 `crank`。另外两个关节的运动由惯性、阻尼与闭环约束共同决定。

```python
# rate 的单位是 rad/s，0.7 是目标摆角幅值，单位 rad。
data.ctrl[0] = 0.7 * np.sin(data.time * rate)
mujoco.mj_step(model, data)
```

“驱动角频率”控制摆动周期，不是从动杆的瞬时角速度。图表同时画出输入杆的目标和实际角度，它们可能存在相位滞后。

我们没有分别给三根活动杆设置动画角度。闭环状态下从动杆能跟随，正是这个实验要观察的结果。

## 解除连接，再看一次

1. 选择“闭环对照”，观察两侧杆的角度与连接点距离。
2. 选择“解除闭环”。模型从相同初始构型重新出发，输入杆仍然运动，中间连杆与从动杆的端点逐渐分离。
3. 金色连线标出两点之间的距离，青色点迹记录中间连杆中心走过的位置。
4. 再开启闭环。实验会先重置构型，避免在两点已经分离时突然强迫它们连接。

原生程序中，可通过 `data.eq_active` 改变约束是否参与计算：

```python
loop_id = mujoco.mj_name2id(
    model, mujoco.mjtObj.mjOBJ_EQUALITY, "loop"
)
mujoco.mj_resetData(model, data)
data.eq_active[loop_id] = True
mujoco.mj_forward(model, data)
```

## 闭合误差也值得观察

连接点距离显示两个 site 世界坐标之间的欧氏距离，以 mm 为单位。闭环求解是数值计算，距离不必在所有时刻精确等于零。提高驱动速度后，可以同时观察执行器的跟踪误差与端点的闭合误差。

两种误差的含义不同：前者是关节没有立刻抵达命令角，后者是连接关系在当前数值求解下的偏差。单看机构“似乎没有散开”，会错过这种区别。

这个实验选择远离翻转位置的摆动范围，并关闭杆件之间的碰撞，以便单独观察闭环关系。

## 带回本地

下载[完整示例](/examples/studies/linkage.zip)，或[单独查看 XML](/examples/studies/linkage.xml)。

```bash
pip install mujoco==3.15.0 numpy
python study.py --example linkage
python study.py --example linkage --open-loop
python study.py --example linkage --rate 1.5 --headless --duration 5
```

终端模式输出连接点距离、输入杆角度和从动杆角度。下一篇[腱传动与弹性](/journal/tendon/)会保留“一个输入带动另一个物体”的问题，把中间的传动关系换成一条可以伸长的路径。
