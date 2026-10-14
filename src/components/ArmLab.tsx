import { ViewerControls, useViewerControls } from './ViewerControls';
import { useEffect, useRef, useState } from 'react';
import { createArmView } from '../lib/arm-view';
import { armDefaults, armPoses } from '../lib/arm-runtime.mjs';
import { armLessons, bodyLabels, jointLabels } from '../lib/arm-lessons';
import type {
  ArmLesson,
  ArmMessage,
  ArmReady,
  ArmState,
} from '../lib/arm-types';
import xml from '../../public/examples/arm.xml?raw';
import python from '../../public/examples/arm.py?raw';

type Sample = {
  t: number;
  target: number;
  angle: number;
  velocity: number;
  reference: number;
  pressure: number;
};
const deg = (value: number) => (value * 180) / Math.PI;
const fmt = (value: number | undefined, digits = 3) =>
  value === undefined ? '—' : value.toFixed(digits);

export default function ArmLab({
  lesson,
  number,
}: {
  lesson: ArmLesson;
  number: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const worker = useRef<Worker | null>(null),
    view = useRef<ReturnType<typeof createArmView> | null>(null);
  const history = useRef<Sample[]>([]),
    latest = useRef<ArmState | null>(null);
  const [model, setModel] = useState<ArmReady | null>(null),
    [state, setState] = useState<ArmState | null>(null);
  const [status, setStatus] = useState('准备实验环境…'),
    [error, setError] = useState(''),
    [attempt, setAttempt] = useState(0);
  const [playing, setPlaying] = useState(true),
    [speed, setSpeed] = useState(1);
  const [targets, setTargets] = useState<number[]>([...armPoses.home]),
    [grip, setGrip] = useState(0);
  const [settings, setSettings] = useState({ ...armDefaults });
  const [body, setBody] = useState('wrist'),
    [axes, setAxes] = useState(true);
  const viewer = useViewerControls(worker, playing);
  const [source, setSource] = useState<'lesson' | 'python' | 'xml'>('lesson'),
    [copied, setCopied] = useState(false);
  const currentLesson = armLessons.find((entry) => entry.id === lesson)!;
  const ready = !!model && !error;
  const send = (message: object) => worker.current?.postMessage(message);

  useEffect(() => {
    if (!canvas.current) return;
    let alive = true,
      lastUI = 0,
      lastSample = -1,
      visible = true,
      canvasVisible = true;
    let render: ReturnType<typeof createArmView>;
    const addresses: Record<string, number> = {};
    try {
      render = createArmView(canvas.current, {
        onForce: viewer.onForce,
        onStatus: viewer.onStatus,
        onCommand: viewer.onCommand,
        onStats: viewer.onStats,
        onSelection: (body) => {
          setBody(body?.name ?? '');
        },
      });
      viewer.attach(render);
      view.current = render;
    } catch {
      setError(
        '无法启动 3D 画布。请使用支持 WebGL 的浏览器，或下载代码在本地运行。',
      );
      return;
    }
    const engine = new Worker(
      new URL('../workers/arm.worker.ts', import.meta.url),
      { type: 'module' },
    );
    worker.current = engine;
    engine.onmessage = ({ data }: MessageEvent<ArmMessage>) => {
      if (!alive) return;
      if (data.type === 'progress') setStatus(data.message);
      if (data.type === 'error') {
        setError(data.message);
        setPlaying(false);
      }
      if (data.type === 'ready') {
        data.sensors.forEach((sensor) => {
          addresses[sensor.name] = sensor.address;
        });
        render.setModel(data);
        viewer.syncDisplay();
        setModel(data);
        setStatus('MuJoCo ' + data.version);
      }
      if (data.type === 'state') {
        latest.current = data;
        render.setState(data);
        if (data.time < lastSample) {
          history.current = [];
          lastSample = -1;
        }
        if (data.time - lastSample >= 0.045) {
          history.current.push({
            t: data.time,
            target: deg(data.ctrl[1]),
            angle: deg(data.qpos[1]),
            velocity: data.sensors[addresses.shoulder_velocity],
            reference: data.qvel[1],
            pressure:
              data.sensors[addresses.left_pressure] +
              data.sensors[addresses.right_pressure],
          });
          history.current = history.current.filter(
            (sample) => data.time - sample.t < 12,
          );
          lastSample = data.time;
        }
        if (data.forced || performance.now() - lastUI > 90 || data.time === 0) {
          setState(data);
          lastUI = performance.now();
        }
      }
    };
    engine.onerror = () => {
      if (alive) {
        setError('仿真线程未能启动，请重新加载实验。');
        setPlaying(false);
      }
    };
    const syncVisibility = () => {
      const active = visible && !document.hidden;
      engine.postMessage({ type: 'visible', value: active });
      render.setActive(canvasVisible && !document.hidden);
    };
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target === canvas.current)
            canvasVisible = entry.isIntersecting;
          else visible = entry.isIntersecting;
        }
        syncVisibility();
      },
      { rootMargin: '180px' },
    );
    observer.observe(canvas.current);
    const workspace = canvas.current.closest('.arm-workspace');
    if (workspace) observer.observe(workspace);
    document.addEventListener('visibilitychange', syncVisibility);
    syncVisibility();
    engine.postMessage({ type: 'load' });
    return () => {
      alive = false;
      observer.disconnect();
      document.removeEventListener('visibilitychange', syncVisibility);
      render.dispose();
      engine.terminate();
      viewer.api.current = null;
      worker.current = null;
      view.current = null;
    };
  }, [attempt]);
  useEffect(() => {
    if (ready) send({ type: 'controls', targets, grip, settings });
  }, [targets, grip, settings, ready]);
  useEffect(() => {
    view.current?.setBody(
      model?.bodies.find((entry) => entry.name === body)?.id ?? -1,
      axes,
    );
  }, [body, axes, model]);

  const reset = () => {
    view.current?.cancel();
    setTargets([...armPoses.home]);
    setGrip(0);
    history.current = [];
    send({ type: 'reset' });
  };
  viewer.commands.current = {
    ready,
    speed,
    reset,
    play() {
      setPlaying(!playing);
      send({ type: 'play', value: !playing });
    },
    setSpeed(value) {
      setSpeed(value);
      send({ type: 'speed', value });
    },
  };
  useEffect(() => {
    setCopied(false);
    if (lesson === 'contact') {
      setSettings({ ...armDefaults });
      reset();
    }
  }, [lesson]);
  const setPose = (pose: keyof typeof armPoses) =>
    setTargets([...armPoses[pose]]);
  const sensor = (name: string) => {
    const definition = model?.sensors.find((entry) => entry.name === name);
    return definition && state
      ? Array.from(
          state.sensors.slice(
            definition.address,
            definition.address + definition.dimension,
          ),
        )
      : [];
  };
  const selected = model?.bodies.find((entry) => entry.name === body);
  const xyz =
    selected && state
      ? Array.from(
          state.bodyPositions.slice(selected.id * 3, selected.id * 3 + 3),
        )
      : [];
  const quat =
    selected && state
      ? Array.from(
          state.bodyQuaternions.slice(selected.id * 4, selected.id * 4 + 4),
        )
      : [];
  const cube = model?.bodies.find((entry) => entry.name === 'sample');
  const height =
    cube && state ? state.bodyPositions[cube.id * 3 + 2] : undefined;
  const sensorDelta = state
    ? Math.abs((sensor('shoulder_velocity')[0] ?? 0) - state.qvel[1])
    : undefined;
  const maxError = state
    ? Math.max(...targets.map((value, i) => Math.abs(value - state.qpos[i])))
    : undefined;
  const sourceText =
    source === 'xml' ? xml : source === 'python' ? python : currentLesson.code;
  const samples = history.current;
  const field: keyof Sample =
    lesson === 'sensors'
      ? 'velocity'
      : lesson === 'contact'
        ? 'pressure'
        : 'angle';
  const reference: keyof Sample | null =
    lesson === 'sensors' ? 'reference' : lesson === 'contact' ? null : 'target';
  const values = samples.flatMap((s) =>
    reference ? [s[field], s[reference]] : [s[field]],
  );
  const low = Math.min(0, ...values),
    high = Math.max(lesson === 'contact' ? 1 : 0.5, ...values);
  const padding = (high - low) * 0.15,
    yMin = low - padding,
    yMax = high + padding;
  const end = Math.max(12, state?.time ?? 12),
    start = end - 12;
  const points = (key: keyof Sample) =>
    samples
      .map(
        (s) =>
          `${48 + ((s.t - start) / 12) * 592},${158 - ((s[key] - yMin) / (yMax - yMin)) * 134}`,
      )
      .join(' ');

  return (
    <div className="arm-lab">
      <div className="arm-workspace">
        <div className="arm-viewport">
          <canvas
            ref={canvas}
            tabIndex={0}
            aria-label="可拖动旋转、滚轮缩放的原创四轴机械臂仿真"
          />
          <div className="arm-view-top">
            <span>
              <i className={ready ? 'is-ready' : ''} />
              {ready ? 'LIVE PHYSICS' : 'INITIALIZING'}
            </span>
            <span>FS / ARM—01</span>
          </div>
          {!ready && (
            <div className="arm-loading" role="status">
              <span className="arm-loader-symbol" aria-hidden="true">
                ✳
              </span>
              <p>{error || status}</p>
              {error && (
                <button
                  onClick={() => {
                    setError('');
                    setModel(null);
                    setState(null);
                    setTargets([...armPoses.home]);
                    setGrip(0);
                    setSettings({ ...armDefaults });
                    setPlaying(true);
                    setSpeed(1);
                    history.current = [];
                    setAttempt((value) => value + 1);
                  }}
                >
                  重新加载
                </button>
              )}
            </div>
          )}
          <ViewerControls viewer={viewer} ready={ready} playing={playing} />
          <div className="arm-view-bottom">
            <span>左键旋转 · 右键平移 · 滚轮缩放</span>
            <span>红 X · 绿 Y · 蓝 Z</span>
          </div>
        </div>
        <aside className="arm-panel" aria-label="实验参数">
          <div className="arm-panel-heading">
            <span className="eyebrow">
              {lesson === 'model'
                ? 'BODY EXPLORER'
                : lesson === 'control'
                  ? 'JOINT CONTROL'
                  : lesson === 'sensors'
                    ? 'STATE OBSERVER'
                    : 'CONTACT STUDY'}
            </span>
            <span className="arm-panel-count">{number} / 11</span>
          </div>
          {(lesson === 'model' || lesson === 'sensors') && (
            <>
              <label className="arm-select">
                观察刚体
                <select
                  value={body}
                  disabled={!ready}
                  onChange={(e) => setBody(e.target.value)}
                >
                  <option value="" disabled>
                    选择刚体或双击模型
                  </option>
                  {(model?.bodies ?? [{ id: 0, name: 'wrist' }]).map(
                    (entry) => (
                      <option key={entry.id} value={entry.name}>
                        {bodyLabels[entry.name]} / {entry.name}
                      </option>
                    ),
                  )}
                </select>
              </label>
              {lesson === 'model' && (
                <div className="arm-body-tree" aria-label="刚体层级">
                  {[
                    'turntable',
                    'upper_arm',
                    'forearm',
                    'wrist',
                    'left_finger',
                    'right_finger',
                  ].map((name, i) => (
                    <button
                      key={name}
                      disabled={!ready}
                      aria-pressed={body === name}
                      onClick={() => setBody(name)}
                      style={{ paddingLeft: `${12 + Math.min(i, 4) * 12}px` }}
                    >
                      <span>
                        {i ? '↳' : '○'} {bodyLabels[name]}
                      </span>
                      <code>{name}</code>
                    </button>
                  ))}
                </div>
              )}
              <div className="arm-coordinate">
                <span>
                  世界位置 <small>m</small>
                </span>
                <div>
                  {['X', 'Y', 'Z'].map((label, i) => (
                    <p key={label}>
                      <small>{label}</small>
                      <output>{fmt(xyz[i])}</output>
                    </p>
                  ))}
                </div>
              </div>
              {lesson === 'sensors' ? (
                <div className="arm-quat">
                  <span>
                    四元数 <small>w · x · y · z</small>
                  </span>
                  <code>
                    {quat.length
                      ? quat.map((value) => fmt(value, 4)).join(' / ')
                      : '—'}
                  </code>
                </div>
              ) : (
                <p className="arm-panel-note">
                  父级：
                  {
                    bodyLabels[
                      model?.bodies.find(
                        (entry) => entry.id === selected?.parent,
                      )?.name ?? 'world'
                    ]
                  }
                  <br />
                  质量：{fmt(selected?.mass, 3)} kg
                </p>
              )}
              <label className="arm-checkbox">
                <input
                  type="checkbox"
                  checked={axes}
                  onChange={(e) => setAxes(e.target.checked)}
                />
                显示所选刚体坐标轴
              </label>
              <div className="arm-presets">
                <button disabled={!ready} onClick={() => setPose('home')}>
                  初始姿态
                </button>
                <button disabled={!ready} onClick={() => setPose('inspect')}>
                  侧向观察 ↗
                </button>
              </div>
            </>
          )}
          {lesson === 'control' && (
            <>
              {targets.map((target, i) => (
                <label className="arm-range" key={i}>
                  <span>
                    {jointLabels[i]} <output>{fmt(deg(target), 1)}°</output>
                  </span>
                  <input
                    aria-label={`${jointLabels[i]}目标角度`}
                    type="range"
                    min={model?.joints[i].min ?? -2.8}
                    max={model?.joints[i].max ?? 2.8}
                    step="0.005"
                    value={target}
                    disabled={!ready}
                    onChange={(e) =>
                      setTargets((values) =>
                        values.map((value, index) =>
                          i === index ? Number(e.target.value) : value,
                        ),
                      )
                    }
                  />
                  <small>
                    实际 {fmt(state ? deg(state.qpos[i]) : undefined, 1)}°
                    <span>
                      {model
                        ? `${fmt(deg(model.joints[i].min), 0)}° — ${fmt(deg(model.joints[i].max), 0)}°`
                        : '—'}
                    </span>
                  </small>
                </label>
              ))}
              <div className="arm-gains">
                {(['gain', 'damping'] as const).map((name) => (
                  <label className="arm-range" key={name}>
                    <span>
                      {name === 'gain' ? 'Kp' : 'Kd'}{' '}
                      <output>{settings[name]}</output>
                    </span>
                    <input
                      aria-label={
                        name === 'gain' ? '位置增益 Kp' : '速度阻尼 Kd'
                      }
                      type="range"
                      min={name === 'gain' ? 20 : 0}
                      max={name === 'gain' ? 240 : 30}
                      step="1"
                      value={settings[name]}
                      disabled={!ready}
                      onChange={(e) =>
                        setSettings((values) => ({
                          ...values,
                          [name]: Number(e.target.value),
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
              <label className="arm-checkbox">
                <input
                  type="checkbox"
                  checked={settings.gravity}
                  disabled={!ready}
                  onChange={(e) =>
                    setSettings((values) => ({
                      ...values,
                      gravity: e.target.checked,
                    }))
                  }
                />
                机械臂重力补偿
              </label>
              <div className="arm-presets">
                <button disabled={!ready} onClick={() => setPose('home')}>
                  初始姿态
                </button>
                <button disabled={!ready} onClick={() => setPose('inspect')}>
                  侧向姿态
                </button>
              </div>
            </>
          )}
          {lesson === 'contact' && (
            <>
              <p className="arm-panel-note">
                每一步稳定后再继续。进入本实验会重置方块，暂停时可用单步观察。
              </p>
              <div className="arm-grasp-actions">
                <button
                  disabled={!ready}
                  onClick={() => {
                    setPose('grasp');
                    setGrip(0);
                  }}
                >
                  <span>01</span>对准方块 ↘
                </button>
                <button disabled={!ready} onClick={() => setGrip(1)}>
                  <span>02</span>闭合夹爪 →←
                </button>
                <button disabled={!ready} onClick={() => setPose('home')}>
                  <span>03</span>抬起观察 ↑
                </button>
                <button disabled={!ready} onClick={() => setGrip(0)}>
                  松开夹爪
                </button>
              </div>
              <label className="arm-range">
                <span>
                  夹爪闭合度 <output>{Math.round(grip * 100)}%</output>
                </span>
                <input
                  aria-label="夹爪闭合度"
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={grip}
                  disabled={!ready}
                  onChange={(e) => setGrip(Number(e.target.value))}
                />
              </label>
              <label className="arm-range">
                <span>
                  接触摩擦系数 <output>{settings.friction.toFixed(2)}</output>
                </span>
                <input
                  aria-label="接触摩擦系数"
                  type="range"
                  min="0"
                  max="1.2"
                  step="0.05"
                  value={settings.friction}
                  disabled={!ready}
                  onChange={(e) =>
                    setSettings((values) => ({
                      ...values,
                      friction: Number(e.target.value),
                    }))
                  }
                />
              </label>
              <div className="arm-contact-readings">
                <p>
                  左夹指 <output>{fmt(sensor('left_pressure')[0], 2)} N</output>
                </p>
                <p>
                  右夹指{' '}
                  <output>{fmt(sensor('right_pressure')[0], 2)} N</output>
                </p>
                <p>
                  方块中心高度 <output>{fmt(height)} m</output>
                </p>
              </div>
            </>
          )}
        </aside>
      </div>
      <div className="arm-readout">
        <p>
          <span>仿真时间</span>
          <output>
            {fmt(state?.time, 3)} <small>s</small>
          </output>
        </p>
        <p>
          <span>
            {lesson === 'contact' ? '法向接触力合计' : '关节最大位置误差'}
          </span>
          <output>
            {lesson === 'contact'
              ? fmt(
                  (sensor('left_pressure')[0] ?? 0) +
                    (sensor('right_pressure')[0] ?? 0),
                  2,
                )
              : fmt(maxError === undefined ? undefined : deg(maxError), 2)}{' '}
            <small>{lesson === 'contact' ? 'N' : '°'}</small>
          </output>
        </p>
        <p>
          <span>
            {lesson === 'sensors'
              ? '传感器与 qvel 的差值'
              : '末端高度 · tool_tip'}
          </span>
          <output>
            {lesson === 'sensors'
              ? fmt(sensorDelta, 6)
              : fmt(sensor('tool_position')[2])}{' '}
            <small>{lesson === 'sensors' ? 'rad/s' : 'm'}</small>
          </output>
        </p>
        <p>
          <span>接触点 / 当前状态</span>
          <output>
            {state?.contacts ?? '—'}{' '}
            <small>{ready ? (playing ? '运行中' : '已暂停') : '加载中'}</small>
          </output>
        </p>
      </div>
      <div className="arm-observations">
        <section className="arm-chart">
          <div className="arm-chart-title">
            <h3>
              {lesson === 'contact'
                ? '夹持接触力'
                : lesson === 'sensors'
                  ? '肩部速度'
                  : '肩部目标与响应'}
            </h3>
            <span>
              {lesson === 'contact'
                ? 'N'
                : lesson === 'sensors'
                  ? 'rad/s'
                  : '°'}{' '}
              / 最近 12 s
            </span>
          </div>
          <svg
            viewBox="0 0 660 190"
            role="img"
            aria-label={
              lesson === 'contact'
                ? '左右夹指接触力合计时间曲线'
                : lesson === 'sensors'
                  ? '速度传感器与关节速度对照曲线'
                  : '肩部目标角度与实际角度时间曲线'
            }
          >
            {[0, 0.5, 1].map((part) => (
              <g key={part}>
                <line
                  x1="48"
                  y1={24 + part * 134}
                  x2="640"
                  y2={24 + part * 134}
                />
                <text x="0" y={28 + part * 134}>
                  {(yMax - part * (yMax - yMin)).toFixed(1)}
                </text>
              </g>
            ))}
            <polyline className="arm-plot" points={points(field)} />
            {reference && (
              <polyline className="arm-reference" points={points(reference)} />
            )}
            <text x="48" y="182">
              {start.toFixed(0)} s
            </text>
            <text x="612" y="182">
              {end.toFixed(0)} s
            </text>
          </svg>
          <div className="arm-chart-legend">
            <span>
              <i />
              {lesson === 'contact'
                ? '左右夹指法向力之和'
                : lesson === 'sensors'
                  ? 'jointvel 传感器'
                  : '实际角度'}
            </span>
            {reference && (
              <span>
                <i className="dashed" />
                {lesson === 'sensors' ? 'qvel（与传感器重合）' : '目标角度'}
              </span>
            )}
          </div>
        </section>
        <section className="arm-observation">
          <p className="eyebrow">TRY / OBSERVE / UNDERSTAND</p>
          <h3>这一次，试着这样看。</h3>
          <p>{currentLesson.try}</p>
          <p className="arm-explanation">{currentLesson.notice}</p>
          <a className="text-link" href={`/journal/arm-${lesson}/`}>
            阅读对应手记 <span>↗</span>
          </a>
        </section>
      </div>
      {lesson === 'sensors' && (
        <div className="arm-sensor-table">
          <h3>命名传感器 · 实时数据</h3>
          <div role="table" aria-label="传感器地址与实时读数">
            <div role="row" className="arm-sensor-head">
              <span>名称</span>
              <span>地址 / 维数</span>
              <span>值</span>
            </div>
            {model?.sensors.map((entry) => (
              <div role="row" key={entry.name}>
                <code>{entry.name}</code>
                <span>
                  {entry.address} / {entry.dimension}
                </span>
                <output>
                  {sensor(entry.name)
                    .map((value) => fmt(value, 4))
                    .join(' · ')}
                </output>
              </div>
            ))}
          </div>
          <p>
            位置单位 m，速度 rad/s，接触力 N；tool_orientation 为 wxyz 四元数。
          </p>
        </div>
      )}
      <section className="arm-source">
        <div className="arm-source-heading">
          <div>
            <p className="eyebrow">OPEN THE NOTEBOOK</p>
            <h2>从现象，走回代码。</h2>
          </div>
          <a className="text-link" href="/examples/arm-lab.zip" download>
            下载完整运行包 <span>↓</span>
          </a>
        </div>
        <div className="arm-source-tabs">
          <div>
            {(['lesson', 'python', 'xml'] as const).map((name) => (
              <button
                key={name}
                aria-pressed={source === name}
                onClick={() => {
                  setSource(name);
                  setCopied(false);
                }}
              >
                {name === 'lesson'
                  ? '本节关键代码'
                  : name === 'python'
                    ? 'Python 程序'
                    : 'MJCF 模型'}
              </button>
            ))}
          </div>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(sourceText);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? '已复制 ✓' : '复制代码'}
          </button>
        </div>
        <pre tabIndex={0}>
          <code>{sourceText}</code>
        </pre>
        <div className="arm-source-footer">
          <p>
            原创模型与程序 · 浏览器使用 MuJoCo WebAssembly，下载包提供同一模型的
            Python 实现。
            <br />
            解压后执行 <code>python -m pip install mujoco</code>，再执行{' '}
            <code>python arm.py --example {lesson}</code>。
          </p>
          <a
            href="https://github.com/Feedstar/Feedstar.github.io/tree/main/public/examples"
            target="_blank"
            rel="noreferrer"
          >
            在 GitHub 查看 ↗
          </a>
        </div>
      </section>
      <p className="arm-runtime-note">
        {status} · 物理步长 2 ms · 浏览器本地计算 · 实验台离开视口后自动休眠
        {state && state.realtime < 0.85 && playing
          ? ' · 当前设备计算速度低于实时，可切换到 0.5×'
          : ''}
      </p>
    </div>
  );
}
