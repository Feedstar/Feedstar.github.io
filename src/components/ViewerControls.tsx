import { useEffect, useRef, useState, type RefObject } from 'react';
import type {
  ViewerAPI,
  ViewerStatus,
  ViewerOptions,
} from '../lib/viewer-interaction';
import '../styles/viewer.css';
export function useViewerControls(
  worker: RefObject<Worker | null>,
  playing: boolean,
) {
  const api = useRef<ViewerAPI | null>(null);
  const [mode, setModeState] = useState<'camera' | 'force'>('camera');
  const [status, setStatus] = useState<ViewerStatus>({
    name: '',
    movable: false,
    dragging: false,
    mocap: false,
  });
  useEffect(() => {
    api.current?.setRunning(playing);
  }, [playing]);
  return {
    api,
    mode,
    status,
    attach(view: ViewerAPI) {
      api.current = view;
      view.setMode(mode);
      view.setRunning(playing);
    },
    onStatus: setStatus,
    onForce: (
      request: Parameters<
        NonNullable<
          import('../lib/viewer-interaction').ViewerOptions['onForce']
        >
      >[0],
    ) => worker.current?.postMessage({ type: 'perturb', request }),
    setMode(value: 'camera' | 'force') {
      setModeState(value);
      api.current?.setMode(value);
    },
  };
}
export function ViewerControls({
  viewer,
  ready,
  playing,
  target = false,
}: {
  viewer: ReturnType<typeof useViewerControls>;
  ready: boolean;
  playing: boolean;
  target?: boolean;
}) {
  const s = viewer.status;
  return (
    <div className="viewer-tools">
      <div className="viewer-tool-row" role="group" aria-label="三维窗口交互">
        <button
          disabled={!ready}
          aria-pressed={viewer.mode === 'camera'}
          onClick={() => viewer.setMode('camera')}
        >
          视角
        </button>
        <button
          disabled={!ready}
          aria-pressed={viewer.mode === 'force'}
          onClick={() => viewer.setMode('force')}
        >
          拖拽物体
        </button>
        <button
          disabled={!ready || !s.name}
          onClick={() => viewer.api.current?.focus()}
        >
          聚焦选中
        </button>
        <button
          disabled={!ready}
          onClick={() => viewer.api.current?.resetCamera()}
        >
          视角复位
        </button>
        <details>
          <summary>操作说明</summary>
          <div className="viewer-help">
            <p>
              左键旋转 · 右键 / Shift + 左键平移 ·
              滚轮缩放。触屏可双指平移、缩放。
            </p>
            <p>
              双击选中物体；按住 Ctrl
              拖动物体，或切换「拖拽物体」后直接拖动。金色连线表示拖拽方向，松手立即撤力。
            </p>
            <p>
              外力遵守模型的关节和碰撞约束。暂停时可选中、观察；继续运行后可施力。Esc
              取消选择。
            </p>
            {target && (
              <p>
                「视角」模式可单独拖动金色目标球；「拖拽物体」作用于机械臂本身。
              </p>
            )}
          </div>
        </details>
      </div>
      <div className="viewer-selection" role="status">
        {s.name ? (
          <>
            <b>{s.name}</b>
            <span>
              {s.dragging
                ? s.mocap
                  ? '拖动位置中'
                  : '正在施加外力'
                : s.mocap
                  ? '可拖动位置'
                  : !s.movable
                    ? '固定物体 · 可聚焦观察'
                    : !playing
                      ? '已暂停 · 继续运行后可施力'
                      : '已选中 · 可拖拽施力'}
            </span>
          </>
        ) : (
          <span>
            {viewer.mode === 'force'
              ? '拖动物体，与仿真直接交互'
              : '双击选中 · Ctrl + 拖动施力'}
          </span>
        )}
      </div>
    </div>
  );
}
