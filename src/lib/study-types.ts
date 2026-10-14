import type { ArmReady, ArmState } from './arm-types';
export type StudySettings = Record<string, number | string | boolean>;
export type StudyObservation = {
  values: number[];
  plot: (number | null)[];
  status: string;
  actual?: number[];
  target?: number[];
  origin?: number[];
  segments: number[];
  solved?: number[];
};
export type StudyState = ArmState & {
  observation: StudyObservation;
  epoch: number;
};
export type StudyMessage =
  ArmReady | StudyState | { type: 'error' | 'progress'; message: string };
