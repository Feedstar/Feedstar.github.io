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
    subtitle: '位置执行器 / POSITION ACTUATOR',
    description: '给出一个目标角度，观察执行器如何驱动连杆靠近它。',
    observation:
      '改变目标角度，观察响应。较高增益通常减小静态误差，也可能让运动更加急促；重力和输出限幅同样影响结果。',
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
