---
title: 力，沿着一条线传递。
description: 让一根绕过导向轮的空间腱牵动滑块，对照刚度、阻尼与负载，观察力传递中的伸长、迟滞和振荡。
category: 传动观察
number: '010'
example: tendon
---

刚性连杆容易让人产生一种直觉：一端动了，另一端也应该立刻按比例移动。加入弹性后，传动过程本身就成为值得观察的对象。

[打开实验 10 · 腱传动与弹性](/lab/?example=tendon#experiment)。青色滑块是驱动端，金色滑块是负载，中间的浅色路径绕过圆柱形导向件。只有青色滑块安装执行器。

## 腱首先是一条路径

MuJoCo 的空间腱用 site 确定端点，用 geom 描述绕行障碍。它的长度会随着端点位置和绕行路径改变。

```xml
<tendon>
  <spatial name="elastic" stiffness="120" damping="2" width="0.004">
    <site site="anchor"/>
    <geom geom="guide" sidesite="wrap_side"/>
    <site site="load_end"/>
  </spatial>
</tendon>
```

这里的 `wrap_side` 让路径从圆柱的指定一侧绕过，减少对称路径之间的歧义。网页浅色曲线根据仿真得到的切点和圆柱表面弧段绘制，读数使用 MuJoCo 计算的实际腱长度。具体路径规则可查阅[空间腱说明](https://mujoco.readthedocs.io/en/stable/XMLreference.html#tendon-spatial)。

本实验中的导向件固定不动，没有额外模拟转轮轴承的惯量或摩擦。

## 伸长产生恢复力

XML 没有另设弹簧参考长度，编译时使用初始路径长度。我们从无伸长的静止状态开始，随后让驱动端向左移动。

```text
extension = length − reference_length
passive_force = −stiffness × extension − damping × length_rate
```

负号表示力倾向于缩短被拉长的路径。面板中的“腱被动力”使用这个带符号的约定，负值表示拉伸时的恢复作用，单位 N；它没有混入执行器驱动力或关节限位反力。

该空间腱同时允许拉伸与压缩。它是路径长度上的弹簧和阻尼模型，没有把路径离散成柔性绳段，也没有模拟绳子下垂、打结或自碰撞。

## 为什么负载没有走同样远

金色滑块的滑动关节上还有一个 18 N/m 的回位弹簧。它把负载拉回初始位置，与腱产生的作用共同决定平衡。

因此，腱刚度较低时，驱动端的一部分位移变成腱的伸长，负载最终位移可能更小。提高腱刚度通常能让更多位移传递到负载，但也会改变振荡频率。

驱动端本身由有限增益、有限推力的位置执行器控制。图表虚线画的是驱动端的**实际位移**，实线画负载实际位移，便于直接比较传动结果。

## 用相同起点比较参数

1. 选择“柔软 / 低阻尼”。前 0.5 s 保持静止，然后让驱动端向左牵引 0.10 m。观察负载的滞后与反复运动。
2. 选择“较硬 / 有阻尼”。初始状态和驱动行程相同，比较稳定时间与最终位移。
3. 改变负载质量，再点击“重置实验”，比较同一套驱动下的响应。模型同步调整质量和惯量，滑块几何尺寸保持相同。
4. 选择“周期牵引”，从缓慢运动开始，逐渐提高往复角频率，观察两条曲线之间的幅值差和相位差。

两组预设同时改变刚度与阻尼，适合先建立整体感受。要判断某一个参数的独立影响，应固定其余参数，修改一个量后重置再比较。

## 从传感器读取长度和速度

```xml
<sensor>
  <tendonpos name="length" tendon="elastic"/>
  <tendonvel name="rate" tendon="elastic"/>
</sensor>
```

在 Python 中可以按名字读取，避免把传感器编号误当成数组起始位置：

```python
length = data.sensor("length").data[0]
length_rate = data.sensor("rate").data[0]
reference = model.tendon_lengthspring[0, 0]
extension = length - reference
```

网页展示的伸长使用 mm，长度使用 m。对照代码时先确认单位，0.01 m 与 10 mm 是同一段距离。

## 带回本地

下载[完整示例](/examples/studies/tendon.zip)，或[单独查看 XML](/examples/studies/tendon.xml)。

```bash
pip install mujoco==3.15.0 numpy
python study.py --example tendon --stiffness 50 --damping 0.2
python study.py --example tendon --stiffness 240 --damping 5
python study.py --example tendon --mode wave --mass 2 --rate 1.5
```

无图形桌面时追加 `--headless --duration 12`。输出依次包含腱长度、伸长与带符号的腱被动力。下一篇[射线测距与扫描](/journal/scanner/)会把视线移到模型之外，用距离测量观察环境。
