---
title: 一个刚体，接着另一个。
description: 从四轴机械臂的层级出发，区分 body、joint、geom 和 site，再把局部坐标与世界坐标对上。
category: 模型拆解
number: '004'
example: arm-model
---

一只机械臂看起来是一件完整的东西，模型里却是一串彼此嵌套的坐标系。先不急着让它抓东西：选中一个刚体，看看它属于谁、绕哪里转、会带着谁一起运动。

[打开实验 04 · 刚体与关节](/lab/?example=arm-model#experiment)。这只教学机械臂由基础几何体搭建，四个转动关节负责姿态，两个滑动关节负责夹爪。入口处的拆解动画用来展示层级；实验中的机械臂则保持真实连接。

## 先读懂这条链

```text
world
└─ turntable       回转底座 · base
   └─ upper_arm    上臂 · shoulder
      └─ forearm   前臂 · elbow
         └─ wrist  腕部 · wrist
            ├─ left_finger   左夹指 · left_grip
            └─ right_finger  右夹指 · right_grip
```

工作台是固定几何体，方块是带 `freejoint` 的独立刚体。它们都没有挂在腕部下面。这个区别会在实验 07 中变得重要：方块必须依靠接触被带起。

模型中的四类元素分工不同：`body` 组织坐标与刚体层级，`joint` 描述可运动的自由度，`geom` 提供几何形状及相应物理属性，`site` 标出观察或传感的位置。它们的定义可在 [MuJoCo 的 MJCF 参考](https://mujoco.readthedocs.io/en/stable/XMLreference.html#worldbody)中查阅。

## pos 不是屏幕上看到的位置

下面摘取了本站模型的一段；省略的外层包含底座、上臂与默认参数，因此它不是一份独立可运行的 XML。

```xml
<body name="forearm" pos="0 0 0.4" gravcomp="1">
  <joint name="elbow" type="hinge"
         axis="0 1 0" range="-0.1 2.3"/>
  <geom type="capsule" size="0.032"
        fromto="0 0 0 0 0 0.36" mass="0.55"/>
  <body name="wrist" pos="0 0 0.36" gravcomp="1">
    <!-- 腕部关节、掌部和夹指 -->
  </body>
</body>
```

`forearm` 的 `pos` 相对父级上臂，腕部的 `pos` 又相对前臂。上臂转动时，前臂及腕部会一起被带走。XML 中的 `pos` 并不会每帧重写；当前世界位置由模型层级和关节状态共同计算。

这份模型明确使用弧度：`compiler angle="radian"`。实验参数面板为方便阅读换算成度数，而源码中的关节范围和目标值仍然是弧度。

## 在画面里验证

1. 选择“上臂”，打开坐标轴，观察红 X、绿 Y、蓝 Z 的方向。
2. 切换侧向姿态，再选择“前臂”和“腕部”，观察位置与坐标轴怎样随父级转动。
3. 选中“方块”，切换机械臂姿态。方块不会跟着腕部走，因为它不属于这条父子链。
4. 去实验 06 读取对应的世界位置，把图中的运动与数值对照。

坐标轴标记的是所选刚体的坐标系，不一定落在可见外壳的几何中心。本模型还把部分外壳设为不参与碰撞，承担碰撞与质量的结构几何体另有定义；看起来接触，不总是碰撞模型已经接触。

## 从模型到状态

本地 Python 中可以通过名字读取腕部的位置，不必猜它在数组中的编号：

```python
import mujoco

model = mujoco.MjModel.from_xml_path("arm.xml")
data = mujoco.MjData(model)
mujoco.mj_resetDataKeyframe(model, data, 0)
mujoco.mj_forward(model, data)

wrist = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_BODY, "wrist")
print(data.xpos[wrist])  # 当前世界位置，而非 XML 中的局部 pos
```

下载[完整运行包](/examples/arm-lab.zip)，安装 `mujoco` 后执行 `python arm.py --example model`。先认识这条链，再进入[实验 05 的多关节控制](/journal/arm-control/)，理解目标怎样沿着它变成运动。
