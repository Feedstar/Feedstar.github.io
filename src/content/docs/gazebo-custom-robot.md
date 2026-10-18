---
title: "自建模型在 Gazebo 中的仿真"
description: "将自建机器人从 SolidWorks 导入 ROS 2 与 Gazebo，整理模型迁移、控制器配置和运动调试过程。"
category: "建模与仿真"
tags: ["ROS 2", "Gazebo", "Xacro"]
order: 2
cover: /document-covers/gazebo-custom-robot.webp
---

本文记录在环境搭建完毕，可以正常运行demo后，尝试将自建模型从solidworks中导出，并在gazebo中进行运动控制仿真。

---

## Solidworks中urdf expoter插件的下载使用

> 插件下载地址[sw\_urdf\_exporter \- ROS Wiki](https://wiki.ros.org/sw_urdf_exporter)
>
>

### solidworks版本兼容性

\*Solidworks2018存在已知的STL输出错误，导致插件不可用，**应使用solidworks2019及更高的版本。**

### 下载安装

1. 下载安装包后将文件解压到solidworks插件目录下，一般为`C:\Program Files\SolidWorks Corp\SolidWorks\lang\english\PlugIns。`

2. 打开SolidWorks软件，在菜单栏中选择`Tools -> Add-Ins`，弹出`Add-Ins`窗口。

3. 在`Add-Ins`窗口中，点击“Browse”按钮，选择sw\_urdf\_exporter插件文件所在的目录，然后点击“OK”按钮。

4. 在`Add-Ins`窗口中，勾选sw\_urdf\_exporter插件，然后点击“OK”按钮。

5. 安装完成后，可以在SolidWorks的菜单栏中看到sw\_urdf\_exporter插件的选项，可以使用该插件将SolidWorks模型转换为URDF格式。

<a class="document-image-link" href="/document-assets/gazebo-custom-robot/media-01.webp" target="_blank" rel="noopener"><img src="/document-assets/gazebo-custom-robot/media-01.webp" alt="自建模型在 Gazebo 中的仿真 · 图 1" width="1920" height="1080" loading="lazy" decoding="async" /></a>

---

## urdf\_expoter使用方法

> 参考视频[solidworks转URDF，并且在rviz中仿真\_哔哩哔哩\_bilibili](https://www.bilibili.com/video/BV1LV4y17734/?spm_id_from=333.337.search-card.all.click&vd_source=4e9a0afc5e2cdfbdba5e466572718007)
>
>

### 为每个link和joint设置参考几何体

- 选择装配体 \-\-\> 参考集合体，需要设置包括点，坐标系，基准轴。

<a class="document-image-link" href="/document-assets/gazebo-custom-robot/media-02.webp" target="_blank" rel="noopener"><img src="/document-assets/gazebo-custom-robot/media-02.webp" alt="自建模型在 Gazebo 中的仿真 · 图 2" width="1920" height="1080" loading="lazy" decoding="async" /></a>

- 在定义关节的坐标系时，通常我们选择IMU的位置作为原点并默认机器人的前进方向作为x轴，向上为z轴，定义如图：

<a class="document-image-link" href="/document-assets/gazebo-custom-robot/media-03.webp" target="_blank" rel="noopener"><img src="/document-assets/gazebo-custom-robot/media-03.webp" alt="自建模型在 Gazebo 中的仿真 · 图 3" width="562" height="1006" loading="lazy" decoding="async" /></a>

- 转动轴统一朝向y轴正方向，即URDF中axis的元素为正。但存在特殊情况如转动轴斜向时，不必遵循元素为正的原则，朝向依旧靠近y轴正方向。如图（髋关节pitch轴）：

<a class="document-image-link" href="/document-assets/gazebo-custom-robot/media-04.webp" target="_blank" rel="noopener"><img src="/document-assets/gazebo-custom-robot/media-04.webp" alt="自建模型在 Gazebo 中的仿真 · 图 4" width="593" height="996" loading="lazy" decoding="async" /></a>

**特别说明：axis是一个三维向量，例如当转动轴朝向在y轴正方向和z轴负方向正中间时可以将axis定义为\<0 1 \-1\>。**

\*此处注意，**选择点的位置时，尽量使其落在转动轴（基准轴）上。**由于基准轴只作为转动轴的方向参考，关节并不会绕基准轴旋转，所以当坐标系原点不落在基准轴上时，会出现零件转动样式不符合预期的情况。

<a class="document-image-link" href="/document-assets/gazebo-custom-robot/media-05.webp" target="_blank" rel="noopener"><img src="/document-assets/gazebo-custom-robot/media-05.webp" alt="自建模型在 Gazebo 中的仿真 · 图 5" width="1719" height="879" loading="lazy" decoding="async" /></a>


### 导出包的必要设置

- 选择link与装配体对应；

- 设置link间连接数量；

- 点击`preview and expoter`进入下一级设置；

<a class="document-image-link" href="/document-assets/gazebo-custom-robot/media-06.webp" target="_blank" rel="noopener"><img src="/document-assets/gazebo-custom-robot/media-06.webp" alt="自建模型在 Gazebo 中的仿真 · 图 6" width="1920" height="1080" loading="lazy" decoding="async" /></a>

- 关于惯性张量，这里做一些修改方法。由于urdf\_exporter插件本身的bug，当选用的link是一个单独的零件时，质量和惯量等信息能被正确填充，而当单个link是由多个零件组成或是一个包含多个零件的装配体时，导出的质量和惯量属性是错误的。在solidworks的质量评估工具中执行以下步骤：

    - 选择每个lnk对应的坐标系；

    - 检查重心位置填充是否正确；

    - urdf中的ixx等参数就是质量评估工具中的Lxx等，这里注意如果使用正张量计数法的话，每个非对角线元素都需要乘以\-1，或者可以在选项中设置显示为负张量计数法即可不作修改直接填入。

<a class="document-image-link" href="/document-assets/gazebo-custom-robot/media-07.webp" target="_blank" rel="noopener"><img src="/document-assets/gazebo-custom-robot/media-07.webp" alt="自建模型在 Gazebo 中的仿真 · 图 7" width="2056" height="976" loading="lazy" decoding="async" /></a>

- 最终导出的包应该包含以下结构。

<a class="document-image-link" href="/document-assets/gazebo-custom-robot/media-08.webp" target="_blank" rel="noopener"><img src="/document-assets/gazebo-custom-robot/media-08.webp" alt="自建模型在 Gazebo 中的仿真 · 图 8" width="836" height="409" loading="lazy" decoding="async" /></a>

---

## 对于导出包的检查

### meshes文件检查

按照设定，每一个Link都会生成一个stl格式的文件，需要检查零件数量和名字是否正确。

<a class="document-image-link" href="/document-assets/gazebo-custom-robot/media-09.webp" target="_blank" rel="noopener"><img src="/document-assets/gazebo-custom-robot/media-09.webp" alt="自建模型在 Gazebo 中的仿真 · 图 9" width="696" height="460" loading="lazy" decoding="async" /></a>


### urdf文件检查

要使用工具之前，首先需要安装，安装命令:

```bash
sudo apt install liburdfdom-tools
```


#### check\_urdf 语法检查

在ROS中，你可以使用`.check_urdf`命令行工具来对URDF（Unified Robot Description Format）文件进行语法检查和验证。这工具通常用于确保你的URDF文件符合规范，没有语法错误或不一致，以便顺利地用于ROS中的机器人仿真和控制。


以下是`.check_urdf`工具的基本语法：

```bash
check_urdf <urdf_file>
```

\*其中，`<urdf_file>`是你要检查的URDF文件的路径。你可以在终端中运行这个命令，并将实际的URDF文件路径替换为`<urdf_file>`。


例如，现在有一个名为`jarvis_whole26.urdf`的URDF文件，你可以运行以下命令进行语法检查：

```bash
check_urdf jarvis_whole26.urdf
```

\*`.check_urdf`工具将会分析指定的URDF文件，并在终端中输出关于文件的语法和结构的信息。如果文件有错误或不一致之处，它会报告相关问题，以帮助你进行修复。

<a class="document-image-link" href="/document-assets/gazebo-custom-robot/media-10.webp" target="_blank" rel="noopener"><img src="/document-assets/gazebo-custom-robot/media-10.webp" alt="自建模型在 Gazebo 中的仿真 · 图 10" width="1045" height="560" loading="lazy" decoding="async" /></a>


#### urdf\_to\_graphiz 结构查看

`urdf_to_graphiz`是一个用于可视化URDF（Unified Robot Description Format）文件结构的工具，它将URDF文件转换为Graphviz格式，然后使用Graphviz工具生成图形表示。这对于查看和理解机器人模型的结构非常有用。


进入urdf文件所属目录，调用:

```bash
urdf_to_graphiz jarvis_whole26.urdf
```

\*如果出现用法已经弃用警告，请使用**`urdf_to_graphviz`**命令来替代`urdf_to_graphiz`。


当前目录下会生成 pdf 文件

<a class="document-image-link" href="/document-assets/gazebo-custom-robot/media-11.webp" target="_blank" rel="noopener"><img src="/document-assets/gazebo-custom-robot/media-11.webp" alt="自建模型在 Gazebo 中的仿真 · 图 11" width="490" height="152" loading="lazy" decoding="async" /></a>


<a class="document-image-link" href="/document-assets/gazebo-custom-robot/media-12.webp" target="_blank" rel="noopener"><img src="/document-assets/gazebo-custom-robot/media-12.webp" alt="自建模型在 Gazebo 中的仿真 · 图 12" width="1012" height="987" loading="lazy" decoding="async" /></a>

---

## 对导出的urdf包进行ROS2迁移

### 对导出包的修改

由于导出的包用于ROS1，所以需要对以下两个文件进行修改来迁移至符合ROS2的格式。

以下是Cmakelist\.txt进行迁移的一个示例：

```cmake
cmake_minimum_required(VERSION 3.5)

project(jarvis_lower_v1.2)

find_package(ament_cmake REQUIRED)

ament_package()

foreach(dir config launch meshes urdf)
    install(DIRECTORY ${dir}/
        DESTINATION share/${PROJECT_NAME}/${dir})
endforeach(dir)

ament_package()
```


<a class="document-image-link" href="/document-assets/gazebo-custom-robot/media-13.webp" target="_blank" rel="noopener"><img src="/document-assets/gazebo-custom-robot/media-13.webp" alt="自建模型在 Gazebo 中的仿真 · 图 13" width="1719" height="879" loading="lazy" decoding="async" /></a>

launch文件夹中包含了display\.launch和gazebo\.launch两个启动文件，display\.launch用于启动rivz可视化以及robot\_state\_publisher和joint\_state\_publisher\_gui，用于对关节进行调节，同时对关节转动角度的具体数值进行可视化。

由于launch文件适用于ROS1，而ROS2使用了python风格的启动文件，我们同样需要对其进行迁移，以下是一个迁移的示例。

原launch文件：

```xml
<launch>
  <arg
    name="model" />
  <param
    name="robot_description"
    textfile="$(find jarvis_lower)/urdf/jarvis_lower.urdf" />
  <node
    name="joint_state_publisher_gui"
    pkg="joint_state_publisher_gui"
    type="joint_state_publisher_gui" />
  <node
    name="robot_state_publisher"
    pkg="robot_state_publisher"
    type="robot_state_publisher" />
  <node
    name="rviz"
    pkg="rviz"
    type="rviz"
    args="-d $(find jarvis_lower/urdf.rviz" />
</launch>
```

迁移后的py文件：

```python
import os
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node
from launch_ros.parameter_descriptions import ParameterValue

def generate_launch_description():
    # 获取包路径
    pkg_share = os.path.join(os.getenv('AMENT_PREFIX_PATH').split(os.pathsep)[0], 'share/jarvis_lower')

    # 定义URDF文件路径
    urdf_file = os.path.join(pkg_share, 'urdf', 'jarvis_lower.urdf')
    rviz_config_file = os.path.join(pkg_share, 'urdf.rviz')

    # 读取URDF文件内容
    with open(urdf_file, 'r') as file:
        robot_description = file.read()

    # Launch描述
    return LaunchDescription([
        DeclareLaunchArgument(
            name='model',
            default_value=urdf_file,
            #description='URDF file path'
        ),

        Node(
            package='robot_state_publisher',
            executable='robot_state_publisher',
            output='screen',
            parameters=[{
                'robot_description': ParameterValue(robot_description, value_type=str),
                'use_sim_time': False
            }],
            arguments=[LaunchConfiguration('model')]
        ),

        Node(
            package='joint_state_publisher_gui',
            executable='joint_state_publisher_gui',
            name='joint_state_publisher_gui',
            output='screen'
        ),

        Node(
            package='rviz2',
            executable='rviz2',
            name='rviz2',
            output='screen',
            arguments=['-d', rviz_config_file]
        ),
    ])
```

---

## 工作空间的创建与编译

### 编译运行迁移后的包

ROS2使用colcon编译工具，除编译命令外，其他步骤与ROS1大致相同。

```bash
#### 创建工作空间文件夹
mkdir -p ~/jarvis_ws/src
cd ~/jarvis_ws/src
#### 创建一个包
ros2 pkg create --build-type ament_cmake <package_name> # 这里我们已经有自己的包了，所以只需要将迁移完成的包放在src下
#### 编译
cd ~/jarvis_ws
colcon build # 编译时可能报错缺少某些依赖，根据实际情况安装即可。
#### 更新环境变量
. install/setup.bash
#### 运行
ros2 launch jarvis_lower display.launch.py # 此处是我的包名和启动文件，实际需要自己修改。
```

---

## Rviz可视化调试

### Rviz中的一些设置

1. 执行以下命令：

```bash
cd ~/jarvis_ws
. install/setup.bash
ros2 launch jarvis_lower display.launch.py
```

2. 当我们成功启动rviz后应该出现如下的界面。

<a class="document-image-link" href="/document-assets/gazebo-custom-robot/media-14.webp" target="_blank" rel="noopener"><img src="/document-assets/gazebo-custom-robot/media-14.webp" alt="自建模型在 Gazebo 中的仿真 · 图 14" width="1719" height="879" loading="lazy" decoding="async" /></a>

3. 此时的界面没有加载机器人模型，需要我们点击左下方`Add`按钮，选择`RobotModel`。

<a class="document-image-link" href="/document-assets/gazebo-custom-robot/media-15.webp" target="_blank" rel="noopener"><img src="/document-assets/gazebo-custom-robot/media-15.webp" alt="自建模型在 Gazebo 中的仿真 · 图 15" width="560" height="649" loading="lazy" decoding="async" /></a>

4. 在`Description Topic`中选择`/robot_description`。

\*模型文件过大将会导致加载缓慢，甚至出现报错，选择等待即可。

<a class="document-image-link" href="/document-assets/gazebo-custom-robot/media-16.webp" target="_blank" rel="noopener"><img src="/document-assets/gazebo-custom-robot/media-16.webp" alt="自建模型在 Gazebo 中的仿真 · 图 16" width="426" height="394" loading="lazy" decoding="async" /></a>

5. 在`Fixed Frame`中将`map`改为`base_link`，此时可以看到机器人模型被正确加载出来。

<a class="document-image-link" href="/document-assets/gazebo-custom-robot/media-17.webp" target="_blank" rel="noopener"><img src="/document-assets/gazebo-custom-robot/media-17.webp" alt="自建模型在 Gazebo 中的仿真 · 图 17" width="992" height="646" loading="lazy" decoding="async" /></a>

6. 通过调节`Joint State Publisher`中的滑钮，可以看到模型的关节可以自由调整。

<a class="document-image-link" href="/document-assets/gazebo-custom-robot/media-18.webp" target="_blank" rel="noopener"><img src="/document-assets/gazebo-custom-robot/media-18.webp" alt="自建模型在 Gazebo 中的仿真 · 图 18" width="1719" height="879" loading="lazy" decoding="async" /></a>

---

## Gazebo运动仿真准备

### 配置控制器

新建一个controllers文件夹，用来存放控制器描述文件，完整代码：

<a href="/document-assets/gazebo-custom-robot/controllers.yaml" download>下载 controllers.yaml</a>

其中包含了关节轨迹控制器、关节状态广播器和 IMU 传感器广播器的参数。

<a class="document-image-link" href="/document-assets/gazebo-custom-robot/media-20.webp" target="_blank" rel="noopener"><img src="/document-assets/gazebo-custom-robot/media-20.webp" alt="自建模型在 Gazebo 中的仿真 · 图 20" width="569" height="773" loading="lazy" decoding="async" /></a>


### 机器人描述文件改写

我们需要将原本的urdf文件改写为xacro文件，以下介绍了该文件格式的一些优势：

在运动控制中，将 URDF 文件改写为 Xacro 文件有以下几个主要原因：

1. 模块化与重用性

Xacro 文件支持宏定义，可以将重复的结构和参数提取出来，并通过调用宏来生成相应的部分。这使得机器人模型的设计更加模块化，便于重用和维护。

**示例**：如果机器人有多个相似的关节或连杆，使用 Xacro 可以定义一个宏来生成这些相似的部分，而不是在 URDF 中重复定义。

```xml
<!-- Xacro 宏定义 -->
<xacro:macro name="leg" params="name length">
  <link name="${name}_link">
    <visual>
      <geometry>
        <box size="${length} ${length} ${length}" />
      </geometry>
    </visual>
  </link>
  <joint name="${name}_joint" type="revolute">
    <!-- Joint parameters here -->
  </joint>
</xacro:macro>

<!-- 调用宏 -->
<xacro:leg name="left_leg" length="0.5" />
<xacro:leg name="right_leg" length="0.5" />
```

2. 参数化

Xacro 支持参数化，可以根据需要调整机器人模型的尺寸、质量、关节参数等。这使得模型更加灵活，适应不同的需求和场景。

**示例**：通过参数化定义机器人部件的尺寸，可以方便地在不同的配置之间切换。

```xml
<robot name="robot">
  <!-- 定义参数 -->
  <xacro:property name="leg_length" value="0.5" />
  <xacro:property name="leg_radius" value="0.1" />

  <!-- 使用参数 -->
  <link name="leg">
    <visual>
      <geometry>
        <cylinder radius="${leg_radius}" length="${leg_length}" />
      </geometry>
    </visual>
  </link>
</robot>
```

3. 简化复杂模型的生成

对于复杂的机器人模型，Xacro 可以简化生成过程。可以将复杂的模型分解为多个子部分，通过 Xacro 文件组合起来，从而减少模型定义的复杂性。

**示例**：将机器人分解为多个部分，如头部、躯干、四肢等，通过 Xacro 文件组合成完整的模型。

```xml
<!-- 头部文件 head.xacro -->
<xacro:macro name="head" params="name">
  <link name="${name}_head">
    <!-- Head parameters here -->
  </link>
</xacro:macro>

<!-- 躯干文件 body.xacro -->
<xacro:macro name="body" params="name">
  <link name="${name}_body">
    <!-- Body parameters here -->
  </link>
</xacro:macro>

<!-- 主文件 robot.xacro -->
<robot name="robot">
  <xacro:include filename="head.xacro" />
  <xacro:include filename="body.xacro" />

  <xacro:head name="robot" />
  <xacro:body name="robot" />
</robot>
```

4. 易于维护和扩展

由于 Xacro 文件支持宏和参数，机器人模型的维护和扩展变得更加容易。当需要修改或添加新的部件时，只需更新相应的宏定义或参数即可，无需修改整个模型文件。

5. 生成动态模型

在一些应用中，可能需要根据传感器数据或其他输入生成动态模型。Xacro 可以通过参数和宏生成动态的 URDF 文件，适应实时变化的需求。

综上所述，将 URDF 文件改写为 Xacro 文件，可以提高模型定义的灵活性、可维护性和重用性，对于复杂的机器人模型和运动控制系统尤其有帮助。


### 描述文件模块化

我们将Xacro文件按关节为最小单位制作存放，以下是结构目录示例：

<a class="document-image-link" href="/document-assets/gazebo-custom-robot/media-21.webp" target="_blank" rel="noopener"><img src="/document-assets/gazebo-custom-robot/media-21.webp" alt="自建模型在 Gazebo 中的仿真 · 图 21" width="676" height="440" loading="lazy" decoding="async" /></a>

这样做有以下方面的好处：

1. 提高模型重用性

按关节为最小单位进行模块化设计，意味着每个关节都被定义为一个独立的模块，可以在不同的机器人模型中复用这些模块。

示例：

```xml
<!-- joint.xacro -->
<xacro:macro name="revolute_joint" params="name parent child">
  <joint name="${name}" type="revolute">
    <parent link="${parent}" />
    <child link="${child}" />
    <!-- 其他关节参数 -->
  </joint>
</xacro:macro>
```

不同机器人可以使用相同的关节模块：

```xml
<robot name="robot1">
  <xacro:include filename="joint.xacro" />
  <xacro:revolute_joint name="joint1" parent="link1" child="link2" />
</robot>

<robot name="robot2">
  <xacro:include filename="joint.xacro" />
  <xacro:revolute_joint name="joint2" parent="link3" child="link4" />
</robot>
```

2. 增强模型的灵活性

模块化的关节设计允许在不同的机器人配置之间进行灵活组合，适应多种应用场景。例如，使用相同的关节模块可以组装不同类型的机器人，如机械臂、移动机器人等。


3. 简化维护和更新

如果需要修改某个关节的参数或特性，只需更新相应的 Xacro 模块，而不需要修改整个机器人模型。这简化了维护过程，提高了效率。

示例：

```xml
<!-- 更新 joint.xacro 中的某个参数，所有引用该模块的机器人都会自动更新 -->
<xacro:macro name="revolute_joint" params="name parent child damping">
  <joint name="${name}" type="revolute">
    <parent link="${parent}" />
    <child link="${child}" />
    <dynamics damping="${damping}" />
    <!-- 其他关节参数 -->
  </joint>
</xacro:macro>
```

4. 提升仿真精度

模块化设计允许更精细地调整和优化每个关节的参数，提高仿真精度。例如，可以为不同的关节设置不同的物理属性（如摩擦、阻尼），从而获得更精确的仿真结果。

5. 易于扩展和定制

通过模块化设计，可以方便地扩展和定制机器人模型。例如，可以为特定任务添加新的关节模块或修改现有模块，以满足不同的需求。

示例：

```xml
<!-- 添加新的关节模块 -->
<xacro:macro name="prismatic_joint" params="name parent child">
  <joint name="${name}" type="prismatic">
    <parent link="${parent}" />
    <child link="${child}" />
    <!-- 其他关节参数 -->
  </joint>
</xacro:macro>
```

6. 改善协同开发

在团队合作中，不同的开发者可以独立开发和测试各自负责的关节模块，最终将这些模块组合成完整的机器人模型。这提高了开发效率和协作能力。

7. 便于版本控制

将关节模块化后，每个模块都是一个独立的文件，便于使用版本控制系统（如 Git）进行管理。可以跟踪每个关节模块的历史变化，方便进行回溯和比较。

### Gazebo启动文件改写

与display\.launch的改写类似，以下做一个示例：

```python
import os

from ament_index_python.packages import get_package_share_directory


from launch import LaunchDescription
from launch.actions import ExecuteProcess, IncludeLaunchDescription, RegisterEventHandler
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from launch.event_handlers import OnProcessExit
from launch.launch_description_sources import PythonLaunchDescriptionSource

from launch_ros.parameter_descriptions import ParameterValue
from launch_ros.actions import Node

import xacro

def generate_launch_description():
    world_file_name = 'stairs.world'
    world = os.path.join(get_package_share_directory('jarvis_lower'),
                         'worlds', world_file_name)
    gazebo = IncludeLaunchDescription(
                PythonLaunchDescriptionSource([os.path.join(
                    get_package_share_directory('gazebo_ros'), 'launch'), '/gazebo.launch.py']),
                launch_arguments={'pause': 'true', 'world': world}.items()
             )

    package_name = os.path.join(
        get_package_share_directory('jarvis_lower'))

    xacro_file = os.path.join(package_name,
                              'description',
                              'robot.urdf.xacro')
    doc = xacro.parse(open(xacro_file))
    xacro.process_doc(doc, mappings={'use_gazebo_link_physics_coefficients': 'false', 'use_gazebo_joint_physics_coefficients': 'true', 'use_URDF_joint_dynamics_coefficients': 'true', 'use_gazebo': 'true'})
    params = {'robot_description': doc.toxml(), 'use_sim_time': True}

    node_robot_state_publisher = Node(
        package='robot_state_publisher',
        executable='robot_state_publisher',
        output='screen',
        parameters=[params]
    )

    spawn_entity = Node(package='gazebo_ros', executable='spawn_entity.py',
                        arguments=['-topic', 'robot_description',
                                   '-entity', 'jarvis_lower'],
                        output='screen')

    load_joint_state_broadcaster = ExecuteProcess(
        cmd=['ros2', 'control', 'load_controller', '--set-state', 'active',
             'joint_state_broadcaster'],
        output='screen'
    )

    load_joint_trajectory_controller = ExecuteProcess(
        cmd=['ros2', 'control', 'load_controller', '--set-state', 'active', 'joint_trajectory_controller'],
        output='screen'
    )

    load_imu_sensor_broadcaster = ExecuteProcess(
        cmd=['ros2', 'control', 'load_controller', 'imu_sensor_broadcaster'],
        output='screen'
    )

    return LaunchDescription([
        RegisterEventHandler(
            event_handler=OnProcessExit(
                target_action=spawn_entity,
                on_exit=[load_joint_trajectory_controller],
            )
        ),
        RegisterEventHandler(
            event_handler=OnProcessExit(
                target_action=load_joint_trajectory_controller,
                on_exit=[load_joint_state_broadcaster],
            )
        ),

        RegisterEventHandler(
            event_handler=OnProcessExit(
                target_action=load_joint_state_broadcaster,
                on_exit=[load_imu_sensor_broadcaster],
            )
        ),

        gazebo,
        node_robot_state_publisher,
        spawn_entity,
    ])
```

---

## Gazebo仿真流程

1. 在所有准备工作完成后，运行命令:

```bash
ros2 launch jarvis_lower gazebo.launch.py
```

<a class="document-image-link" href="/document-assets/gazebo-custom-robot/media-22.webp" target="_blank" rel="noopener"><img src="/document-assets/gazebo-custom-robot/media-22.webp" alt="自建模型在 Gazebo 中的仿真 · 图 22" width="1718" height="918" loading="lazy" decoding="async" /></a>

可以看到模型能够正常被加载出来。

\*由于模型文件过大，可能遇到加载缓慢或gazebo崩溃的情况，选择等待即可。

2. 此时需要再开启一个终端，输入json格式的指令：

```json
ros2 action send_goal /joint_trajectory_controller/follow_joint_trajectory control_msgs/action/FollowJointTrajectory -f "{
    trajectory: {
      joint_names: ['left_calf_joint', 'left_foot_joint', 'left_leg_joint', 'left_previous_leg_joint', 'right_calf_joint', 'right_foot_joint', 'right_leg_joint', 'right_previous_leg_joint'],
      points: [
        { positions: [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0], time_from_start: { sec: 3 } },
        { positions: [-0.6, 0.3, 0.3, 0.0, 0.6, -0.3, -0.3, 0.0], time_from_start: { sec: 5 } } ]
    }
  }"
```

这个命令使用 ROS2 的 ros2 action send\_goal 发送一个 FollowJointTrajectory 动作给 /joint\_trajectory\_controller/follow\_joint\_trajectory。具体来说，这个命令定义了一个轨迹，其中包含关节名称和时间点，指定了每个关节在给定时间点的目标位置。

<a class="document-image-link" href="/document-assets/gazebo-custom-robot/media-23.webp" target="_blank" rel="noopener"><img src="/document-assets/gazebo-custom-robot/media-23.webp" alt="自建模型在 Gazebo 中的仿真 · 图 23" width="1718" height="918" loading="lazy" decoding="async" /></a>
