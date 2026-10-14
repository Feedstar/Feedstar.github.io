---
title: 让距离，勾勒出世界。
description: 从一束射线的最近命中点出发，理解传感器朝向、遮挡、未命中与扫描点图之间的关系。
category: 感知观察
number: '011'
example: scanner
---

传感器不需要一次看到完整世界。一束射线先得到一个距离，换一个方向再读一次，许多个离散结果就开始显露出环境的轮廓。

[打开实验 11 · 射线测距与扫描](/lab/?example=scanner#experiment)。一个带转动关节的测距头，在方块、圆柱和墙面之间往复扫描。金色线表示当前射线，青色点记录最近 12 s 内的真实命中位置。

## 朝向藏在传感器坐标系里

MuJoCo 的 site 型 `rangefinder` 沿传感器局部 **+Z** 方向发射射线。模型把 site 转向水平方向，所以扫描关节角为零时，射线朝世界 +X 方向。

```xml
<site name="beam" pos="0.12 0 0"
      quat="0.70710678 0 0.70710678 0" size="0.007"/>
```

```xml
<sensor>
  <rangefinder name="range" site="beam"/>
</sensor>
```

距离从 site 所在位置开始，而不是从扫描器底座中心开始。本模型中两者相差 0.12 m，这会直接影响你用画面估计距离时的判断。

## 最近表面会挡住更远的表面

保持“固定朝向 +X”，前景方块中心位于 x = 0.8 m，沿 X 的半尺寸为 0.12 m。最近表面是 x = 0.68 m，因此读数为：

```text
0.80 − 0.12 − 0.12 = 0.56 m
中心位置 − 方块半尺寸 − 传感器原点偏移
```

点击“移开前景”，方块移动到 y = 0.5 m。射线这时命中后方墙面，读数变成 1.34 m。这个变化来自最近可见表面的替换，并不是传感器主动选择了“更重要”的物体。

## 未命中是一种有效结果

射线没有遇到任何几何表面时，MuJoCo 返回 −1。网页把它显示为“未命中”，让距离曲线断开，也不向点图添加点。

画面中未命中的射线仍保留一段 2 m 长的方向指示线。这一长度只是为了看清朝向，**不是测量结果，也不是模型的最大量程**。

该模型使用理想几何测距，没有添加测量噪声或反射率模型。更完整的命中与排除规则见[rangefinder 文档](https://mujoco.readthedocs.io/en/stable/XMLreference.html#sensor-rangefinder)。

## 把距离还原成世界坐标点

要形成点图，仅有一个距离还不够。还需要同一时刻的射线原点和朝向：

```python
sensor_id = model.site("beam").id
origin = data.site_xpos[sensor_id].copy()
rotation = data.site_xmat[sensor_id].reshape(3, 3)
direction = rotation[:, 2]  # 局部 +Z 在世界坐标系中的方向
ray_range = data.sensor("range").data[0]
if ray_range >= 0:
    hit_point = origin + ray_range * direction
```

网页中的“射线方位”来自扫描关节的实际角度。测距头由位置执行器驱动，速度提高后，实际扫描运动可能落后于命令；因此不能直接用命令角代替采样时刻的真实朝向。

俯视点图保留世界 X、Y 坐标。圆柱在点图中显露出弧面，方块与墙面则形成线段。

## 让扫描慢下来观察

1. 使用“遮挡对照”与“移开前景”，先验证 0.56 m 和 1.34 m 两个可核算的读数。
2. 选择“扫描轮廓”，观察射线扫过不同表面的过程。扫描范围表示目标角度的峰峰值，例如 150° 对应约 −75° 到 +75°。
3. 扩大扫描范围，观察曲线中的空白段与“未命中”状态是否同步。
4. 改变扫描角频率，再比较同一段表面上的点密度。网页约每 50 ms 留下一次显示样本，物理仿真仍以 2 ms 步长运行。
5. 暂停后使用单步按钮。测距读数与实际姿态一起更新，点图按显示采样节奏增加。

改变参数时会清空旧点，避免将障碍物移动前后的结果拼成一个错误轮廓。这个点图记录直接测量，没有执行定位或建图算法。

## 带回本地

下载[完整示例](/examples/studies/scanner.zip)，或[单独查看 XML](/examples/studies/scanner.xml)。

```bash
pip install mujoco==3.15.0 numpy
python study.py --example scanner
python study.py --example scanner --mode fixed --headless --duration 1
python study.py --example scanner --mode fixed --y 0.5 --headless --duration 1
```

终端输出包含距离、实际方位和命中标记。把这些数与模型尺寸对照，往往比先画一张漂亮的点图更能发现坐标系、原点或采样时刻的问题。
