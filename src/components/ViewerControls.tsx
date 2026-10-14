import { useEffect, useRef, useState, type RefObject } from 'react';
import type {
  ViewerAPI,
  ViewerStatus,
  ViewerOptions,
  ViewerMode,
} from '../lib/viewer-interaction';
import {
  defaultViewerDisplay,
  type ViewerDisplay,
} from '../lib/viewer-display';
import '../styles/viewer.css';
type Commands = {
  ready: boolean;
  play(): void;
  reset(): void;
  speed: number;
  setSpeed(value: number): void;
};
const displayLabels: [keyof ViewerDisplay, string, string][] = [
  ['contacts', '接触点', 'C'],
  ['forces', '接触力', 'F'],
  ['joints', '关节轴', 'J'],
  ['com', '质心', 'M'],
  ['frames', '刚体坐标系', 'F6'],
  ['wireframe', '线框', 'W'],
  ['transparent', '透明', 'T'],
];
export function useViewerControls(
  worker: RefObject<Worker | null>,
  playing: boolean,
) {
  const api = useRef<ViewerAPI | null>(null),
    root = useRef<HTMLDivElement>(null);
  const commands = useRef<Commands | null>(null),
    currentDisplay = useRef({ ...defaultViewerDisplay });
  const [mode, setModeState] = useState<ViewerMode>('camera');
  const [display, setDisplay] = useState<ViewerDisplay>({
    ...defaultViewerDisplay,
  });
  const [help, setHelp] = useState(false),
    [showStats, setShowStats] = useState(false);
  const [fullscreen, setFullscreen] = useState(false),
    [notice, setNotice] = useState('');
  const [stats, setStats] = useState({ time: 0, contacts: 0, fps: 0 });
  const [status, setStatus] = useState<ViewerStatus>({
    name: '',
    movable: false,
    dragging: false,
    mocap: false,
    editable: false,
    following: false,
    mass: 0,
  });
  useEffect(() => {
    api.current?.setRunning(playing);
  }, [playing]);
  useEffect(() => {
    const changed = () =>
      setFullscreen(
        document.fullscreenElement ===
          root.current?.closest('.arm-viewport, .simulation-view'),
      );
    document.addEventListener('fullscreenchange', changed);
    return () => document.removeEventListener('fullscreenchange', changed);
  }, []);
  function toggleDisplay(key: keyof ViewerDisplay) {
    const next = {
      ...currentDisplay.current,
      [key]: !currentDisplay.current[key],
    };
    currentDisplay.current = next;
    setDisplay(next);
    api.current?.setDisplay(next);
    worker.current?.postMessage({ type: 'display', flags: next });
  }
  async function toggleFullscreen() {
    const viewport = root.current?.closest('.arm-viewport, .simulation-view');
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (viewport?.requestFullscreen) await viewport.requestFullscreen();
      else setNotice('当前浏览器不支持全屏');
    } catch {
      setNotice('无法进入全屏，可使用浏览器全屏模式');
    }
  }
  function command(action: string) {
    const c = commands.current;
    if (!c?.ready) return;
    if (Object.hasOwn(currentDisplay.current, action)) {
      toggleDisplay(action as keyof ViewerDisplay);
      return;
    }
    if (action === 'play') c.play();
    if (action === 'step') worker.current?.postMessage({ type: 'step' });
    if (action === 'reset') {
      api.current?.cancel();
      c.reset();
    }
    if (action === 'camera') api.current?.resetCamera();
    if (action === 'help') setHelp((v) => !v);
    if (action === 'stats') setShowStats((v) => !v);
    if (action === 'fullscreen') void toggleFullscreen();
    if (action === 'faster' || action === 'slower') {
      const speeds = [0.1, 0.25, 0.5, 1, 2];
      c.setSpeed(
        speeds[
          Math.max(
            0,
            Math.min(
              speeds.length - 1,
              speeds.indexOf(c.speed) + (action === 'faster' ? 1 : -1),
            ),
          )
        ],
      );
    }
  }
  return {
    api,
    root,
    commands,
    mode,
    status,
    stats,
    display,
    help,
    showStats,
    fullscreen,
    notice,
    command,
    toggleDisplay,
    attach(view: ViewerAPI) {
      api.current = view;
      view.setMode(mode);
      view.setRunning(playing);
      view.setDisplay(currentDisplay.current);
    },
    syncDisplay() {
      worker.current?.postMessage({
        type: 'display',
        flags: currentDisplay.current,
      });
    },
    onStatus: setStatus,
    onStats: setStats,
    onCommand: command,
    onForce: (request: Parameters<NonNullable<ViewerOptions['onForce']>>[0]) =>
      worker.current?.postMessage({ type: 'perturb', request }),
    setMode(value: ViewerMode) {
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
    <div className="viewer-tools" ref={viewer.root}>
      <div className="viewer-tool-row" role="group" aria-label="三维窗口交互">
        {(
          [
            ['camera', '视角'],
            ['force', '平移物体'],
            ['rotate', '旋转物体'],
          ] as [ViewerMode, string][]
        ).map(([mode, label]) => (
          <button
            key={mode}
            disabled={!ready}
            aria-pressed={viewer.mode === mode}
            onClick={() => viewer.setMode(mode)}
          >
            {label}
          </button>
        ))}
        <button
          disabled={!ready || !s.name}
          onClick={() => viewer.api.current?.focus()}
        >
          聚焦
        </button>
        <button
          disabled={!ready || !s.name || (!s.movable && !s.mocap)}
          aria-pressed={s.following}
          onClick={() => viewer.api.current?.follow()}
        >
          跟随
        </button>
        <button
          disabled={!ready}
          title="Ctrl + A"
          onClick={() => viewer.command('camera')}
        >
          视角复位
        </button>
        <details>
          <summary>显示选项</summary>
          <div className="viewer-help viewer-display-options">
            {displayLabels.map(([key, label, shortcut]) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={viewer.display[key]}
                  onChange={() => viewer.toggleDisplay(key)}
                  disabled={!ready}
                />
                {label}
                <kbd>{shortcut}</kbd>
              </label>
            ))}
            <p>金色箭头：接触力方向，长度用对数比例显示。青色点：刚体质心。</p>
          </div>
        </details>
        <button
          disabled={!ready}
          aria-pressed={viewer.help}
          title="F1"
          onClick={() => viewer.command('help')}
        >
          操作说明
        </button>
        <button
          disabled={!ready}
          title="F5"
          onClick={() => viewer.command('fullscreen')}
        >
          {viewer.fullscreen ? '退出全屏' : '全屏'}
        </button>
      </div>
      <div className="viewer-selection" role="status">
        {s.name ? (
          <>
            <b>{s.name}</b>
            <span>
              {s.dragging
                ? !playing || s.mocap
                  ? '正在编辑姿态'
                  : '原生扰动力 / 力矩'
                : s.mocap
                  ? 'Mocap · 可直接编辑姿态'
                  : !s.movable
                    ? '固定物体'
                    : !playing
                      ? s.editable
                        ? '已暂停 · 可编辑自由物体姿态'
                        : '已暂停 · 关节约束保留，运行后可施力'
                      : 'Ctrl + 左键旋转 · Ctrl + 右键平移'}
            </span>
            {s.following && <span>相机跟随中</span>}
          </>
        ) : (
          <span>双击选中 · Ctrl + 左键旋转 / 右键平移</span>
        )}
      </div>
      {viewer.help && (
        <div className="viewer-help viewer-help-panel">
          <strong>接近 MuJoCo simulate 的操作</strong>
          <p>
            左键旋转视角，右键竖直平移，Shift +
            右键水平平移；中键拖动或滚轮缩放。
          </p>
          <p>
            双击选中物体。Ctrl + 左键旋转选中物体；Ctrl + 右键竖直平移，叠加
            Shift 水平平移。也可先点「平移物体 / 旋转物体」再直接左键拖动。
          </p>
          <p>
            运行时施加力或力矩；暂停时可编辑自由关节物体与 Mocap
            姿态，铰接关节仍保留约束。松手撤力。
          </p>
          <p>
            右键双击聚焦；Ctrl + 右键双击跟随。Esc 回到自由视角，PageUp
            选择父级，Ctrl + A 复位视角。
          </p>
          <p>
            点击画布后：Space 暂停 / 运行，→ 单步，Backspace 重置，＋ / −
            调速，F1 帮助，F2 统计，F5 全屏。
          </p>
          {target && <p>「视角」模式下，可直接拖动金色目标球调整逆解目标。</p>}
        </div>
      )}
      <div
        className="viewer-transport viewer-tool-row"
        role="group"
        aria-label="窗口播放控制"
      >
        <button
          disabled={!ready}
          onClick={() => viewer.command('play')}
          title="Space"
        >
          {playing ? '暂停' : '运行'}
        </button>
        <button
          disabled={!ready || playing}
          onClick={() => viewer.command('step')}
          title="→"
        >
          单步
        </button>
        <button
          disabled={!ready}
          onClick={() => viewer.command('reset')}
          title="Backspace"
        >
          重置
        </button>
        <label>
          速度{' '}
          <select
            disabled={!ready}
            aria-label="窗口仿真速度"
            value={viewer.commands.current?.speed ?? 1}
            onChange={(e) =>
              viewer.commands.current?.setSpeed(Number(e.target.value))
            }
          >
            {[0.1, 0.25, 0.5, 1, 2].map((speed) => (
              <option key={speed} value={speed}>
                {speed}×
              </option>
            ))}
          </select>
        </label>
        <button
          disabled={!ready}
          aria-pressed={viewer.showStats}
          onClick={() => viewer.command('stats')}
          title="F2"
        >
          统计
        </button>
      </div>
      {viewer.showStats && (
        <output className="viewer-stats">
          <span>时间 {viewer.stats.time.toFixed(3)} s</span>
          <span>接触 {viewer.stats.contacts}</span>
          <span>渲染 {viewer.stats.fps} FPS</span>
        </output>
      )}
      {viewer.notice && (
        <p className="viewer-notice" role="status">
          {viewer.notice}
        </p>
      )}
    </div>
  );
}
