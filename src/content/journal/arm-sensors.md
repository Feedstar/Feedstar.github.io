---
title: 把运动，读成一组数。
description: 用命名传感器读取世界位置、四元数与关节速度，区分编号、数组地址和参考坐标系。
category: 状态读取
number: '006'
example: arm-sensors
---

画面告诉我们机械臂在动，数据帮助我们说清它怎样动。位置、姿态和速度描述的是不同的量，把它们放在同一时刻对照，才能让可视化成为可靠的观察工具。

[打开实验 06 · 位姿与传感器](/lab/?example=arm-sensors#experiment)。选择一个刚体，观察高亮坐标轴、世界位置与四元数；下方还有命名传感器表和肩部速度曲线。

## 先问：读的是谁，相对哪里

本实验同时展示两类观察对象。右侧选择框读取所选 **body 坐标系** 的世界位姿；`tool_position` 传感器读取的是腕部下面名为 **tool_tip 的 site**。

本站模型把 `tool_tip` 放在腕部局部坐标 `(0, 0, 0.11)`。因此，选择腕部时，它的世界位置通常与工具点位置不同。这不是传感器误差，而是两个坐标原点之间本来就有偏移。

```xml
<site name="tool_tip" pos="0 0 0.11" size="0.007"/>

<!-- 位于模型的 sensor 区域 -->
<framepos name="tool_position" objtype="site" objname="tool_tip"/>
<framequat name="tool_orientation" objtype="site" objname="tool_tip"/>
```

这里没有指定其他参考坐标系，读数采用世界坐标。位置单位是米，关节速度单位是 rad/s。四元数按 `w, x, y, z` 排列，不能把后面三个分量当成三个欧拉角。

## 名字、编号、地址不是同一件事

传感器的编号只标识“第几个传感器”。`sensordata` 把所有传感器的输出连续存储：一个关节速度占 1 个数，位置占 3 个数，四元数占 4 个数。

因此不能直接把传感器编号当作数据下标。需要先找到编号，再取 `sensor_adr` 和 `sensor_dim` 指定的范围。这些数组的定义见 [MuJoCo 数据结构](https://mujoco.readthedocs.io/en/stable/APIreference/APItypes.html#mjmodel)。

```python
def read_sensor(model, data, name):
    sensor_id = mujoco.mj_name2id(
        model, mujoco.mjtObj.mjOBJ_SENSOR, name
    )
    if sensor_id < 0:
        raise ValueError(f"Unknown sensor: {name}")
    start = model.sensor_adr[sensor_id]
    size = model.sensor_dim[sensor_id]
    return data.sensordata[start:start + size].copy()

tool_xyz = read_sensor(model, data, "tool_position")
```

这个函数在已加载模型的 Python 程序中使用。返回 `.copy()` 是为了留下当前时刻的快照；否则后续仿真更新底层数组时，你保留的视图也会改变。

## 用一个可以核对的量开始

1. 点击“侧向观察”，看肩部速度先偏离零，再随着姿态稳定回到零附近。
2. 比较速度传感器曲线与 `qvel` 曲线。在这份无噪声模型中，同一时刻的两条曲线应重合，界面的差值应接近零。
3. 在“上臂”“腕部”之间切换，位置与四元数对应的对象随之改变。
4. 对照腕部世界位置与 `tool_position` 的三个数，回看工具点的局部偏移。

读取关节速度也应通过地址定位：

```python
joint_id = mujoco.mj_name2id(
    model, mujoco.mjtObj.mjOBJ_JOINT, "shoulder"
)
dof = model.jnt_dofadr[joint_id]
shoulder_velocity = data.qvel[dof]
```

不要把 `qpos` 与 `qvel` 的下标普遍视为相同。本模型还包含一个自由方块：它的位置表示包含四元数，与速度表示的维数不同。

## 对齐采样时刻

本站在步进后调用 `mj_forward`，刷新当前状态下的坐标变换和传感器，再一起发送到画面。如果在不同更新阶段取值，即使变量名正确，也可能比较到不同时刻的数据。关于状态与计算流水线，可以继续阅读 [MuJoCo 的仿真说明](https://mujoco.readthedocs.io/en/stable/programming/simulation.html)。

下载[完整运行包](/examples/arm-lab.zip)，执行 `python arm.py --example sensors`。终端会输出工具点位置和肩部速度对照。接下来在[夹持实验](/journal/arm-contact/)中，我们会增加一种新的观察量：接触力。
