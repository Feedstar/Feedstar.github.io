import type { ExampleId } from './examples';
import type { ArmLesson } from './arm-types';
import type { StudyId } from './study-assets';
import { studies } from './studies';

export type ExperimentId = ExampleId | `arm-${ArmLesson}` | StudyId;
type Entry = {
  id: ExperimentId;
  number: string;
  title: string;
  subject: string;
  description: string;
  connection: string;
  english: string;
} & (
  | { kind: 'basic'; example: ExampleId }
  | { kind: 'arm'; lesson: ArmLesson }
  | { kind: 'feature'; study: StudyId }
);

// One directory drives the gallery, the lab navigation, and shareable URLs.
export const experimentCatalog: Entry[] = [
  {
    id: 'pendulum',
    number: '01',
    title: '单摆与阻尼',
    subject: '单摆',
    english: 'Motion & damping',
    kind: 'basic',
    example: 'pendulum',
    description: '改变阻尼，观察摆幅如何随时间衰减。',
    connection: '先从一个自由转动的关节，认识运动与耗散。',
  },
  {
    id: 'actuator',
    number: '02',
    title: '单关节 PD',
    subject: '单连杆',
    english: 'Target & response',
    kind: 'basic',
    example: 'actuator',
    description: '调节 Kp 与 Kd，对照目标、响应和稳态误差。',
    connection: '给关节加上执行器，理解目标怎样变成运动。',
  },
  {
    id: 'contact',
    number: '03',
    title: '滑动与摩擦',
    subject: '滑块',
    english: 'Contact & friction',
    kind: 'basic',
    example: 'contact',
    description: '让方块以相同速度出发，比较摩擦与滑行距离。',
    connection: '先单独看清摩擦，再在实验 07 中用它完成夹持。',
  },
  {
    id: 'arm-model',
    number: '04',
    title: '刚体与关节',
    subject: '四轴机械臂',
    english: 'A chain of bodies',
    kind: 'arm',
    lesson: 'model',
    description: '查看刚体层级、关节和坐标轴，读懂运动链。',
    connection: '把单个关节连接起来，建立完整机械臂的结构。',
  },
  {
    id: 'arm-control',
    number: '05',
    title: '多关节控制',
    subject: '四轴机械臂',
    english: 'Control in concert',
    kind: 'arm',
    lesson: 'control',
    description: '将实验 02 的 PD 控制用到多个关节，观察姿态变化。',
    connection: '从单关节响应，走向多个关节共同决定的末端姿态。',
  },
  {
    id: 'arm-sensors',
    number: '06',
    title: '位姿与传感器',
    subject: '四轴机械臂',
    english: 'Read the motion',
    kind: 'arm',
    lesson: 'sensors',
    description: '读取世界坐标、四元数和速度，对照命名传感器。',
    connection: '让运动变成可读取的数据，检验模型与控制的结果。',
  },
  {
    id: 'arm-contact',
    number: '07',
    title: '夹持与接触力',
    subject: '四轴机械臂',
    english: 'Hold & lift',
    kind: 'arm',
    lesson: 'contact',
    description: '结合关节控制与摩擦，观察夹紧、抬升和滑落。',
    connection: '将前面的结构、控制、传感器和摩擦放进同一次实验。',
  },
  ...Object.entries(studies).map(([id, spec]): Entry => ({
    id: id as StudyId,
    kind: 'feature',
    study: id as StudyId,
    number: spec.number,
    title: spec.title,
    subject: spec.subject,
    english: spec.english,
    description: spec.description,
    connection: spec.connection,
  })),
];
export const experimentHref = (id: ExperimentId) =>
  `/lab/?example=${id}#experiment`;
export const findExperiment = (id: string | null) =>
  experimentCatalog.find((entry) => entry.id === id) ?? experimentCatalog[0];
