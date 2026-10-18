---
title: "URDF 导出检查完整指南"
description: "从资源完整性到关节、碰撞与惯量，记录 CAD 模型导出后的逐项检查方法。"
category: "建模与仿真"
tags: ["URDF", "SolidWorks", "模型检查"]
order: 1
cover: /document-covers/urdf-export-checklist.webp
---

> 本指南用于在从 SolidWorks 或其他 CAD 软件导出 URDF 文件后，系统性检查模型的正确性与仿真性能，确保其在 ROS2、Gazebo、Isaac Gym、MuJoCo 等环境中可正确运行。
>
>

## 资源完整性检查

**目的：**
 确保所有 STL / DAE 等资源文件完整可用。

**操作步骤：**

- 打开 ROS 包中的 `meshes/` 文件夹；

- 检查每个零件文件大小（应为几十 KB 到数 MB 不等）；

- 若出现部分或全部文件大小为 **1KB（或84 bytes）**：

    - 问题原因：导出时选择的 link 包含了子装配体；

    - 解决方案：返回 SolidWorks 插件，重新选择每个旋转关节的单独 link，**不要勾选子装配体**；

**常见问题与建议：**

- 文件路径过长或包含中文名可能导致 Gazebo 无法加载；

- 建议统一使用小写英文命名；

- 备份原始 mesh 文件，避免重复导出时覆盖出错。

## 文件结构与命名检查

### URDF 结构验证

执行命令，确认URDF能被正确加载：

```bash
# 执行以下命令
check_urdf your_robot.urdf
```

若成功，会输出如下结构树（示例）：

```bash
robot name is: tiny_robot
---------- Successfully Parsed XML ---------------
root Link: world has 1 child(ren)
    child(1): base_link
        ...
```

**若出错，常见报错：**

- `No such file or directory` → mesh 路径不正确；

- `XML parse error` → 标签缺失或语法错误；

- `Link name not unique` → 名称重复。

### 路径与命名规范

- mesh 路径推荐：

```xml
# ros环境使用
<mesh filename="package://your_robot_description/meshes/part_name.stl"/>

# gym或mujoco等环境
<mesh filename="../meshes/part_name.stl"/>
```

- 不要使用绝对路径（如 `C:\Users\...` 或 `/home/user/Desktop/...`）；

- 名称规则：

    - 小写字母 \+ 下划线；

    - 不含空格、特殊字符；

    - 例如：`left_hip_joint`, `right_knee_link`。

## 零件独立性检查

使用来自fan\-ziqi的web版robot viewer来检查urdf模型，目前支持串联的urdf/mjcf，可将整个文件夹直接拖入进行导入。应用可以查看机器人结构树、源代码，支持代码热更新，允许对模型或滑块拖动来控制关节。

> [http://viewer.robotsfan.com/](http://viewer.robotsfan.com/)
>
>

这里需要检查每一个link是否独立（可能会出现某些link多带了一些零件），见下图：

<a class="document-image-link" href="/document-assets/urdf-export-checklist/media-01.webp" target="_blank" rel="noopener"><img src="/document-assets/urdf-export-checklist/media-01.webp" alt="URDF 导出检查完整指南 · 图 1" width="1132" height="973" loading="lazy" decoding="async" /></a>

出现以上情况请在**export urdf and meshes**时先将solidworks的**质量评估工具关闭**。

## 关节配置检查

### 功能性测试

- 在 robot viewer 或 rivz 中拖动所有关节；

- 检查所有应可旋转的关节能否自由转动；

- 确认锁死的关节确实不可动。

### 参数正确性

确保每个关节的属性：

```xml
<limit effort="10.0" velocity="5.0" lower="-1.57" upper="1.57"/>
```

- **upper \> lower**

- **effort** 合理（如 10\~100 Nm）

- **velocity** 合理（如 1\~10 rad/s）

## 物理属性检查

<a class="document-image-link" href="/document-assets/urdf-export-checklist/media-02.webp" target="_blank" rel="noopener"><img src="/document-assets/urdf-export-checklist/media-02.webp" alt="URDF 导出检查完整指南 · 图 2" width="2560" height="1257" loading="lazy" decoding="async" /></a>

依次检查页面上方的视觉、碰撞等属性。

### 视觉 \(visual\)

- 若仅用于仿真，可删除多余装饰面；

- 复杂 CAD 模型面数超过 200k 时，应进行 mesh 简化，否则无法在mujoco中加载；

- 可用 `meshlab` 或 `blender` 降面。

### 碰撞 \(collision\)

- SolidWorks 导出时默认与 visual 相同；

- 高面数 STL 会导致仿真卡顿或穿模；

- 建议使用：

    - box / cylinder / sphere；

    - 或低分辨率 STL。

- 在 Isaac Gym 中可在 `asset` 参数中设置：

```python
self.collision = 1  # 关闭碰撞
```

### 惯量 \(inertial\)

- 检查 `<origin>` 与 `<inertial>` 偏移；

- 正确设置后应贴合link，呈现规则的形状。

<a class="document-image-link" href="/document-assets/urdf-export-checklist/media-03.webp" target="_blank" rel="noopener"><img src="/document-assets/urdf-export-checklist/media-03.webp" alt="URDF 导出检查完整指南 · 图 3" width="818" height="1002" loading="lazy" decoding="async" /></a>

- 保证质心接近该 link 的几何中心；

- 若惯量矩阵出现负值或全零，需手动修正；

- 规则形状建议人工填写惯量参数（box、cylinder 可用标准公式）。

### 坐标轴与关节轴方向

- 一致使用右手坐标系，x轴正向机器人前进方向；

<a class="document-image-link" href="/document-assets/urdf-export-checklist/media-04.webp" target="_blank" rel="noopener"><img src="/document-assets/urdf-export-checklist/media-04.webp" alt="URDF 导出检查完整指南 · 图 4" width="818" height="1002" loading="lazy" decoding="async" /></a>

- 关节旋转轴统一指向坐标轴正方向。

<a class="document-image-link" href="/document-assets/urdf-export-checklist/media-05.webp" target="_blank" rel="noopener"><img src="/document-assets/urdf-export-checklist/media-05.webp" alt="URDF 导出检查完整指南 · 图 5" width="818" height="1002" loading="lazy" decoding="async" /></a>
