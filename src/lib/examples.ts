import pendulum from '../../public/examples/pendulum.xml?raw';
import actuator from '../../public/examples/actuator.xml?raw';
import contact from '../../public/examples/contact.xml?raw';
export const examples = {
  pendulum: {
    id: 'pendulum',
    number: '001',
    title: '一枚摆，和时间的形状。',
    subtitle: '关节阻尼 / DAMPED PENDULUM',
    description: '同样的起点，不同的阻尼。观察摆动幅度如何随时间衰减。',
    observation:
      '阻尼越大，摆动通常衰减得越快。将阻尼设为 0，比较理想状态下的持续运动。',
    xml: pendulum,
    article: 'pendulum',
    variable: '角度 θ / rad',
    unit: 'rad',
  },
  actuator: {
    id: 'actuator',
    number: '002',
    title: '向一个目标，慢慢靠近。',
    subtitle: 'PD 位置控制 / POSITION & VELOCITY FEEDBACK',
    description:
      '分别调整比例与微分增益，对照目标姿态、实际角度和实时误差，观察连杆如何抵达。',
    observation:
      'Kp 根据位置误差推动连杆，Kd 根据角速度制动。重力补偿默认开启，使固定目标可准确收敛；关闭后观察纯 PD 的静态误差。Kd = 0 时不会主动消除振荡。',
    xml: actuator,
    article: 'actuator',
    variable: '角度 q / rad',
    unit: 'rad',
  },
  contact: {
    id: 'contact',
    number: '003',
    title: '在接触的地方，发生什么。',
    subtitle: '接触摩擦 / SLIDING FRICTION',
    description: '让方块以相同的初速度出发，比较摩擦如何改变它的旅程。',
    observation:
      '调整摩擦后点击重置，比较滑行距离与速度曲线。摩擦接近 0 时，方块会滑得更远。',
    xml: contact,
    article: 'contact',
    variable: '速度 v / m·s⁻¹',
    unit: 'm/s',
  },
} as const;
export type ExampleId = keyof typeof examples;
