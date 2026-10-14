import { ViewerControls, useViewerControls } from './ViewerControls';
import { useEffect, useRef, useState } from 'react';
import { createArmView } from '../lib/arm-view';
import { studies } from '../lib/studies';
import { studyXML, type StudyId } from '../lib/study-assets';
import type {
  StudySettings,
  StudyState,
  StudyMessage,
} from '../lib/study-types';
import type { ArmReady } from '../lib/arm-types';
import python from '../../public/examples/studies/study.py?raw';
import '../styles/feature-lab.css';
type Sample = { t: number; values: (number | null)[]; actual?: number[] };
const fmt = (v: number | undefined, digits = 3) =>
  v === undefined ? '—' : v.toFixed(digits);
export default function FeatureLab({ kind }: { kind: StudyId }) {
  const spec = studies[kind],
    canvas = useRef<HTMLCanvasElement>(null),
    worker = useRef<Worker | null>(null);
  const view = useRef<ReturnType<typeof createArmView> | null>(null),
    history = useRef<Sample[]>([]);
  const changeRef = useRef<(patch: StudySettings) => void>(() => {});
  const [settings, setSettings] = useState<StudySettings>({ ...spec.defaults });
  const [state, setState] = useState<StudyState | null>(null),
    [model, setModel] = useState<ArmReady | null>(null);
  const [status, setStatus] = useState('正在准备实验…'),
    [error, setError] = useState(''),
    [attempt, setAttempt] = useState(0);
  const [playing, setPlaying] = useState(true),
    [speed, setSpeed] = useState(1);
  const viewer = useViewerControls(worker, playing);
  const [source, setSource] = useState<'xml' | 'python'>('xml'),
    [copyState, setCopyState] = useState('复制代码');
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const ready = !!model && !error,
    send = (message: object) => worker.current?.postMessage(message);
  const update = (patch: StudySettings, restart = false) => {
    setSettings((previous) => ({ ...previous, ...patch }));
    send({ type: 'controls', patch, restart });
  };
  changeRef.current = (patch) => update(patch);
  useEffect(() => {
    if (!canvas.current) return;
    let alive = true,
      lastUI = 0,
      lastSample = -1,
      epoch = -1,
      visible = true;
    let render: ReturnType<typeof createArmView>;
    try {
      const camera: [number, number, number] =
        kind === 'scanner'
          ? [1.6, -2, 2.2]
          : kind === 'tendon'
            ? [1.2, -2.4, 1.5]
            : [1.5, -1.85, 1.2];
      render = createArmView(canvas.current, {
        camera,
        onForce: viewer.onForce,
        onStatus: viewer.onStatus,
        onMocapDrag:
          kind === 'scanner'
            ? (_body, point) =>
                changeRef.current({
                  x: Math.max(0.45, Math.min(1.1, point[0])),
                  y: Math.max(-0.65, Math.min(0.65, point[1])),
                })
            : undefined,
        center:
          kind === 'scanner'
            ? [0.65, 0, 0.12]
            : kind === 'tendon'
              ? [0, 0, 0.26]
              : [0.3, 0.05, 0.4],
        onTargetDrag:
          kind === 'inverse-kinematics'
            ? (point) =>
                changeRef.current({
                  x: Math.max(0.15, Math.min(1.1, point[0])),
                  y: Math.max(-0.5, Math.min(0.5, point[1])),
                  mode: 'point',
                })
            : undefined,
      });
      viewer.attach(render);
      view.current = render;
    } catch {
      setError('3D 画布无法启动，请重试或下载代码在本地运行。');
      return;
    }
    const engine = new Worker(
      new URL('../workers/study.worker.ts', import.meta.url),
      { type: 'module' },
    );
    worker.current = engine;
    engine.onmessage = ({ data }: MessageEvent<StudyMessage>) => {
      if (!alive) return;
      if (data.type === 'progress') setStatus(data.message);
      if (data.type === 'error') {
        setError(data.message);
        setPlaying(false);
      }
      if (data.type === 'ready') {
        render.setModel(data);
        setModel(data);
        setStatus(`MuJoCo ${data.version}`);
      }
      if (data.type === 'state') {
        if (data.epoch !== epoch || data.time < lastSample) {
          history.current = [];
          epoch = data.epoch;
          lastSample = -1;
        }
        if (data.time - lastSample >= 0.045 || lastSample < 0) {
          history.current.push({
            t: data.time,
            values: data.observation.plot,
            actual: data.observation.actual,
          });
          history.current = history.current
            .filter((s) => data.time - s.t <= 12)
            .slice(-320);
          lastSample = data.time;
        }
        render.setState(data);
        render.setOverlay(
          data.observation.segments,
          data.observation.target,
          history.current.flatMap((s) => s.actual ?? []),
        );
        if (data.forced || performance.now() - lastUI >= 90) {
          setState(data);
          lastUI = performance.now();
        }
      }
    };
    engine.onerror = () => {
      if (alive) {
        setError('仿真线程加载失败，请重新加载实验。');
        setPlaying(false);
      }
    };
    const sync = () => {
      const active = visible && !document.hidden;
      engine.postMessage({ type: 'visible', value: active });
      render.setActive(active);
    };
    const observer = new IntersectionObserver(
      (entries) => {
        visible = entries[0].isIntersecting;
        sync();
      },
      { rootMargin: '220px' },
    );
    observer.observe(canvas.current.closest('.arm-workspace')!);
    document.addEventListener('visibilitychange', sync);
    sync();
    engine.postMessage({ type: 'load', kind });
    return () => {
      alive = false;
      observer.disconnect();
      document.removeEventListener('visibilitychange', sync);
      render.dispose();
      engine.terminate();
      viewer.api.current = null;
      view.current = null;
      worker.current = null;
      clearTimeout(copyTimer.current);
    };
  }, [kind, attempt]);
  const sourceText = source === 'xml' ? studyXML[kind] : python;
  const samples = history.current,
    values = samples.flatMap((s) =>
      s.values.filter((v): v is number => v !== null),
    );
  const lo = Math.min(0, ...values),
    hi = Math.max(0.1, ...values),
    pad = (hi - lo) * 0.1;
  const yMin = lo - pad,
    yMax = hi + pad,
    end = Math.max(12, state?.time ?? 12),
    start = end - 12;
  const path = (index: number) => {
    let pen = false;
    return samples
      .map((s) => {
        const v = s.values[index];
        if (v == null) {
          pen = false;
          return '';
        }
        const item = `${pen ? 'L' : 'M'}${(48 + ((s.t - start) / 12) * 592).toFixed(1)},${(155 - ((v - yMin) / (yMax - yMin)) * 128).toFixed(1)}`;
        pen = true;
        return item;
      })
      .join(' ');
  };
  const reset = () => {
    view.current?.cancel();
    history.current = [];
    send({ type: 'reset' });
  };
  const xmlPath =
    kind === 'inverse-kinematics'
      ? '/examples/arm.xml'
      : `/examples/studies/${kind}.xml`;
  return (
    <div className="arm-lab feature-lab">
      <div className="arm-workspace">
        <div className="arm-viewport">
          <canvas
            ref={canvas}
            tabIndex={0}
            aria-label={`${spec.title}三维实时仿真，可拖动旋转与滚轮缩放`}
          />
          <div className="arm-view-top">
            <span>
              <i className={ready ? 'is-ready' : ''} />
              {ready ? 'LIVE PHYSICS' : 'INITIALIZING'}
            </span>
            <span>FS / STUDY—{spec.number}</span>
          </div>
          {!ready && (
            <div className="arm-loading" role={error ? 'alert' : 'status'}>
              <p>{error || status}</p>
              {error && (
                <button
                  onClick={() => {
                    setError('');
                    setModel(null);
                    setState(null);
                    setPlaying(true);
                    setSpeed(1);
                    setSettings({ ...spec.defaults });
                    history.current = [];
                    setAttempt((v) => v + 1);
                  }}
                >
                  重新加载
                </button>
              )}
            </div>
          )}
          <ViewerControls
            viewer={viewer}
            ready={ready}
            playing={playing}
            target={kind === 'inverse-kinematics'}
          />
          <div className="arm-view-bottom">
            <span>左键旋转 · 右键平移 · 滚轮缩放</span>
            <span>
              {kind === 'inverse-kinematics'
                ? '金色目标 · 青色轨迹'
                : kind === 'scanner'
                  ? '金色射线 · 青色命中点'
                  : kind === 'tendon'
                    ? '青色驱动端 · 金色负载'
                    : '青色输入杆 · 金色从动杆'}
            </span>
          </div>
        </div>
        <aside className="arm-panel" aria-label="实验参数">
          <div className="arm-panel-heading">
            <span className="eyebrow">CHANGE / OBSERVE</span>
            <span className="arm-panel-count">{spec.number} / 11</span>
          </div>
          {spec.modes.length > 0 && (
            <label className="arm-select">
              观察方式
              <select
                aria-label="观察方式"
                disabled={!ready}
                value={String(settings.mode)}
                onChange={(e) => update({ mode: e.target.value }, true)}
              >
                {spec.modes.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {kind === 'linkage' && (
            <label className="arm-checkbox">
              <input
                type="checkbox"
                checked={!!settings.closed}
                disabled={!ready}
                onChange={(e) => update({ closed: e.target.checked }, true)}
              />
              开启闭环约束
            </label>
          )}
          {spec.ranges.map(([key, label, min, max, step, unit]) => (
            <label className="arm-range" key={key}>
              <span>
                {label}
                <output>
                  {Number(settings[key]).toFixed(
                    step < 0.01 ? 3 : step < 1 ? 2 : 0,
                  )}{' '}
                  <small>{unit}</small>
                </output>
              </span>
              <input
                aria-label={label}
                type="range"
                min={min}
                max={max}
                step={step}
                value={Number(settings[key])}
                disabled={!ready}
                onChange={(e) => update({ [key]: Number(e.target.value) })}
              />
            </label>
          ))}
          <p className="feature-preset-label">从相同起点比较</p>
          <div className="arm-presets feature-presets">
            {spec.presets.map(([label, patch]) => (
              <button
                key={label}
                disabled={!ready}
                onClick={() => update({ ...spec.defaults, ...patch }, true)}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="arm-panel-note">
            {kind === 'inverse-kinematics'
              ? '可直接拖动金色目标，Z 滑块调整高度。'
              : kind === 'tendon'
                ? '修改参数后，点击重置可从同一静止状态比较。'
                : '预设会重置时间、曲线和轨迹。'}
          </p>
        </aside>
      </div>
      <div className="arm-toolbar">
        <div>
          <button
            className="arm-play"
            disabled={!ready}
            onClick={() => {
              setPlaying(!playing);
              send({ type: 'play', value: !playing });
            }}
          >
            {playing ? 'Ⅱ 暂停' : '▷ 运行'}
          </button>
          <button disabled={!ready} onClick={reset}>
            重置实验 ↺
          </button>
          <button
            disabled={!ready || playing}
            onClick={() => send({ type: 'step' })}
          >
            单步 +2 ms
          </button>
        </div>
        <label>
          仿真速度
          <select
            disabled={!ready}
            value={speed}
            onChange={(e) => {
              setSpeed(Number(e.target.value));
              send({ type: 'speed', value: Number(e.target.value) });
            }}
          >
            <option value="1">1×</option>
            <option value="0.5">0.5×</option>
            <option value="0.25">0.25×</option>
          </select>
        </label>
      </div>
      <div className="feature-status">
        <span>{ready ? state?.observation.status : status}</span>
        <span>t = {fmt(state?.time)} s</span>
      </div>
      <div className="arm-readout feature-readout">
        {spec.metrics.map(([label, unit], i) => (
          <p key={label}>
            <span>{label}</span>
            <output>
              {kind === 'scanner' && i === 2
                ? state?.observation.values[2] === 1
                  ? '命中'
                  : state
                    ? '未命中'
                    : '—'
                : kind === 'scanner' &&
                    i === 0 &&
                    state?.observation.values[0] === -1
                  ? '—'
                  : fmt(
                      state?.observation.values[i],
                      unit === 'mm' ? 2 : 3,
                    )}{' '}
              <small>{unit}</small>
            </output>
          </p>
        ))}
      </div>
      <div className="arm-observations">
        <section className="arm-chart">
          <div className="arm-chart-title">
            <h3>{spec.plot}</h3>
            <span>{spec.unit} / 最近 12 s</span>
          </div>
          <svg
            viewBox="0 0 660 190"
            role="img"
            aria-label={`${spec.plot}时间曲线`}
          >
            {[0, 0.5, 1].map((p) => (
              <g key={p}>
                <line x1="48" y1={27 + p * 128} x2="640" y2={27 + p * 128} />
                <text x="0" y={31 + p * 128}>
                  {(yMax - p * (yMax - yMin)).toFixed(2)}
                </text>
              </g>
            ))}
            {spec.legends.map((label, i) => (
              <path
                key={label}
                className={i ? 'feature-reference' : 'feature-plot'}
                d={path(i)}
              />
            ))}
            <text x="48" y="182">
              {start.toFixed(0)} s
            </text>
            <text x="610" y="182">
              {end.toFixed(0)} s
            </text>
          </svg>
          <div className="arm-chart-legend">
            {spec.legends.map((label, i) => (
              <span key={label}>
                <i className={i ? 'dashed' : ''} />
                {label}
              </span>
            ))}
          </div>
        </section>
        <section className="arm-observation">
          <p className="eyebrow">TRY / OBSERVE / UNDERSTAND</p>
          <h3>这一次，试着这样看。</h3>
          <p>{spec.try}</p>
          <p className="arm-explanation">{spec.notice}</p>
          <a className="text-link" href={`/journal/${kind}/`}>
            阅读对应手记 ↗
          </a>
        </section>
      </div>
      {kind === 'scanner' && (
        <section className="arm-chart feature-map">
          <div className="arm-chart-title">
            <h3>扫描点图 · 俯视 XY</h3>
            <span>m / 最近 12 s · 仅保留命中点</span>
          </div>
          <svg
            viewBox="0 0 660 440"
            role="img"
            aria-label="扫描命中点的世界坐标俯视图"
          >
            <line x1="70" y1="220" x2="620" y2="220" />
            <line x1="95" y1="20" x2="95" y2="420" />
            <text x="600" y="237">
              X / m
            </text>
            <text x="100" y="20">
              Y / m
            </text>
            {[0, 0.5, 1, 1.5, 2].map((x) => (
              <text key={x} x={95 + x * 200} y="237">
                {x}
              </text>
            ))}
            <text x="58" y="24">
              1
            </text>
            <text x="52" y="424">
              −1
            </text>
            <circle cx="95" cy="220" r="4" fill="var(--fg)" />
            {samples
              .filter((s) => s.actual)
              .map((s, i) => (
                <circle
                  key={i}
                  cx={95 + s.actual![0] * 200}
                  cy={220 - s.actual![1] * 200}
                  r="2"
                  fill="var(--lab-accent)"
                  opacity={0.35 + (0.65 * i) / Math.max(1, samples.length)}
                />
              ))}
          </svg>
        </section>
      )}
      {kind === 'inverse-kinematics' && state?.observation.solved && (
        <div className="feature-joints">
          <span>关节目标 / 实际 · °</span>
          {state.observation.solved.map((q, i) => (
            <p key={i}>
              {['底座', '肩部', '肘部', '腕部'][i]}
              <code>
                {fmt((q * 180) / Math.PI, 1)} /{' '}
                {fmt((state.qpos[i] * 180) / Math.PI, 1)}
              </code>
            </p>
          ))}
        </div>
      )}
      <section className="arm-source">
        <div className="arm-source-heading">
          <div>
            <p className="eyebrow">TAKE THE EXPERIMENT WITH YOU</p>
            <h2>把这次观察，带回本地。</h2>
          </div>
          <a
            className="text-link"
            href={`/examples/studies/${kind}.zip`}
            download
          >
            下载完整示例 .zip ↗
          </a>
        </div>
        <div className="arm-source-tabs">
          <div>
            {(['xml', 'python'] as const).map((value) => (
              <button
                key={value}
                aria-pressed={source === value}
                onClick={() => {
                  setSource(value);
                  setCopyState('复制代码');
                }}
              >
                {value === 'xml' ? 'MJCF / XML' : 'Python'}
              </button>
            ))}
          </div>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(sourceText);
                setCopyState('已复制');
              } catch {
                setCopyState('复制失败，请选择代码复制');
              }
              clearTimeout(copyTimer.current);
              copyTimer.current = setTimeout(
                () => setCopyState('复制代码'),
                2400,
              );
            }}
          >
            {copyState}
          </button>
        </div>
        <pre tabIndex={0}>
          <code>{sourceText}</code>
        </pre>
        <div className="arm-source-footer">
          <p>
            pip install mujoco==3.15.0 numpy
            <br />
            python study.py --example {kind}
            <br />
            无图形桌面：追加 --headless --duration 12
          </p>
          <a href={xmlPath} download>
            单独下载 XML ↗
          </a>
        </div>
      </section>
      <p className="arm-runtime-note">
        {status} · 2 ms 物理步长 · 浏览器本地运行 · 离屏自动暂停
      </p>
    </div>
  );
}
