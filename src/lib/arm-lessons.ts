import type { ArmLesson } from './arm-types';
export const armLessons: {
  id: ArmLesson;
  label: string;
  title: string;
  description: string;
  try: string;
  notice: string;
  code: string;
}[] = [
  {
    id: 'model',
    label: '拆解模型',
    title: '一个刚体，接着另一个。',
    description:
      '四个转动关节、两个滑动关节，组成一条可以看懂的运动链。选择一个刚体，在画面中找到它。',
    try: '选择前臂或腕部，观察高亮与坐标轴；再切换姿态，看子刚体怎样跟随父刚体。',
    notice:
      'body 描述相对父级的位置，joint 决定自由度，geom 给出形状与碰撞，site 标记观察点。这个模型只用基础几何体搭建。',
    code: `<!-- 每个子 body 的坐标都相对父 body -->
<body name="forearm" pos="0 0 0.4" gravcomp="1">
  <joint name="elbow" type="hinge"
         axis="0 1 0" range="-0.1 2.3"/>
  <geom type="capsule" size="0.032"
        fromto="0 0 0 0 0 0.36" mass="0.55"/>
  <body name="wrist" pos="0 0 0.36">
    <!-- 下一级关节与夹爪 -->
  </body>
</body>`,
  },
  {
    id: 'control',
    label: '控制运动',
    title: '目标之外，还有响应。',
    description:
      '改变目标角度，看执行器怎样用力矩把关节带到那里。目标、实际位置和误差都是实时计算的。',
    try: '改变肩部目标，降低 Kd 比较振荡；关闭重力补偿，观察静态误差。',
    notice:
      '位置执行器使用 τ = Kp × (目标 − 位置) − Kd × 速度。重力补偿单独作用于机械臂；接触、关节限位和力矩上限都可能留下位置误差。',
    code: `# 先查名称，再写入执行器目标；不是直接修改 qpos
actuator = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_ACTUATOR,
                           "shoulder_servo")
data.ctrl[actuator] = target_radians
model.actuator_gainprm[actuator, 0] = kp
model.actuator_biasprm[actuator, 1] = -kp
model.actuator_biasprm[actuator, 2] = -kd
mujoco.mj_step(model, data)`,
  },
  {
    id: 'sensors',
    label: '读取状态',
    title: '把运动，读成一组数。',
    description:
      '同一次仿真，既可以读取关节状态，也可以通过命名传感器获取位置、速度和末端位姿。',
    try: '切换姿态，比较肩部速度传感器与 qvel；选择不同刚体，观察世界坐标和四元数。',
    notice:
      'sensordata 是连续数组，必须使用 sensor_adr 与 sensor_dim 取值。姿态采用世界坐标，四元数按 w、x、y、z 排列。',
    code: `sensor = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_SENSOR,
                         "shoulder_velocity")
adr = model.sensor_adr[sensor]
dim = model.sensor_dim[sensor]
velocity = data.sensordata[adr:adr + dim]

body = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_BODY, "wrist")
world_position = data.xpos[body].copy()
world_quaternion_wxyz = data.xquat[body].copy()`,
  },
  {
    id: 'contact',
    label: '观察接触',
    title: '握住，才有了抬起。',
    description:
      '让夹爪对准方块、闭合，再慢慢抬起。抓取依赖碰撞与摩擦，没有把方块绑定到手上。',
    try: '按顺序对准、夹紧、抬起。重置后把摩擦降到 0，再比较方块能否被带起。',
    notice:
      'touch 传感器记录夹指上的法向接触力；摩擦负责抵抗滑动。接触数包含方块与台面的接触，不能单独用它判断抓取成功。',
    code: `# 两个滑动关节朝向相反，目标距离相同
data.ctrl[4:6] = 0.065 * closure  # closure ∈ [0, 1]
model.geom_friction[:, 0] = friction
mujoco.mj_step(model, data)

sensor = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_SENSOR,
                         "left_pressure")
normal_force = data.sensordata[model.sensor_adr[sensor]]
# 方块是 freejoint 刚体；抬起完全由接触求解器决定。`,
  },
];
export const bodyLabels: Record<string, string> = {
  world: '世界',
  turntable: '回转底座',
  upper_arm: '上臂',
  forearm: '前臂',
  wrist: '腕部',
  left_finger: '左夹指',
  right_finger: '右夹指',
  sample: '方块',
};
export const jointLabels = ['底座', '肩部', '肘部', '腕部'];
