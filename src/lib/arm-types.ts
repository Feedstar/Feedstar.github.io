export type ArmLesson = 'model' | 'control' | 'sensors' | 'contact';
export type ArmJoint = {
  name: string;
  id: number;
  actuator: number;
  qpos: number;
  dof: number;
  min: number;
  max: number;
};
export type ArmGeom = {
  id: number;
  type: number;
  body: number;
  size: number[];
  color: number[];
  name: string;
};
export type ArmReady = {
  type: 'ready';
  version: string;
  timestep: number;
  joints: ArmJoint[];
  bodies: {
    id: number;
    name: string;
    parent: number;
    mass: number;
    movable: boolean;
    mocap: boolean;
  }[];
  sensors: { name: string; address: number; dimension: number }[];
  geoms: ArmGeom[];
};
export type ArmState = {
  type: 'state';
  forced: boolean;
  time: number;
  contacts: number;
  realtime: number;
  qpos: Float64Array;
  qvel: Float64Array;
  ctrl: Float64Array;
  sensors: Float64Array;
  positions: Float32Array;
  matrices: Float32Array;
  bodyPositions: Float64Array;
  bodyQuaternions: Float64Array;
};
export type ArmMessage =
  | ArmReady
  | ArmState
  | { type: 'progress'; message: string }
  | { type: 'error'; message: string };
