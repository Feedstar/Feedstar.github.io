import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { examples, type ExampleId } from '../lib/examples';
import { simulationParams, type readPositionServo } from '../lib/control.mjs';
type ControlState = ReturnType<typeof readPositionServo>;
type Sample = { time: number; value: number; target?: number };
type SimState = {
  time: number;
  qpos: number[];
  qvel: number[];
  positions: number[];
  matrices: number[];
  ncon: number;
  control: ControlState | null;
};
const defaults = { ...simulationParams };
type NumericParam = Exclude<keyof typeof defaults, 'gravityComp'>;
export default function Simulation({ id }: { id: ExampleId }) {
  const [ready, setReady] = useState(false),
    [error, setError] = useState(''),
    [playing, setPlaying] = useState(true),
    [version, setVersion] = useState(''),
    [params, setParams] = useState(defaults),
    [readout, setReadout] = useState({
      time: 0,
      value: 0.85,
      velocity: 0,
      ncon: 0,
      control: null as ControlState | null,
    }),
    [retry, setRetry] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null),
    graph = useRef<HTMLCanvasElement>(null),
    worker = useRef<Worker | null>(null),
    latest = useRef<SimState | null>(null),
    history = useRef<Sample[]>([]),
    latestParams = useRef(params),
    playingRef = useRef(playing);
  const [xmlOpen, setXmlOpen] = useState(false);
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    setReady(false);
    setError('');
    latest.current = null;
    history.current = [];
    setReadout({
      time: 0,
      value: id === 'pendulum' ? latestParams.current.angle : 0,
      velocity: 0,
      ncon: 0,
      control: null,
    });
    let stopped = false,
      frame = 0,
      meshes: THREE.Mesh[] = [],
      lastUi = 0,
      lastSample = -1;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#191b27');
    scene.fog = new THREE.Fog('#191b27', 7, 16);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: el,
        antialias: true,
        alpha: false,
      });
    } catch {
      setError(
        '当前浏览器无法建立三维画布。你仍可下载模型与 Python 代码，在本地运行。',
      );
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 50);
    camera.up.set(0, 0, 1);
    camera.position.set(2.7, -4.4, 2.4);
    const controls = new OrbitControls(camera, el);
    controls.target.set(0, 0, 0.85);
    controls.enableDamping = true;
    controls.minDistance = 2;
    controls.maxDistance = 9;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.update();
    scene.add(new THREE.HemisphereLight('#eeeafa', '#44405a', 1));
    const light = new THREE.DirectionalLight('#f7ecfc', 2.3);
    light.position.set(-3, -2, 6);
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.camera.left = -4;
    light.shadow.camera.right = 4;
    light.shadow.camera.top = 4;
    light.shadow.camera.bottom = -4;
    light.shadow.normalBias = 0.02;
    scene.add(light);
    const grid = new THREE.GridHelper(12, 36, '#76708b', '#353247');
    grid.rotation.x = Math.PI / 2;
    grid.position.z = 0.002;
    scene.add(grid);
    const targetPose = new THREE.Group();
    const targetGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 0.9),
    ]);
    const targetMaterial = new THREE.LineDashedMaterial({
      color: 0xe1ccff,
      dashSize: 0.045,
      gapSize: 0.025,
      depthTest: false,
      transparent: true,
      opacity: 0.8,
    });
    const targetLine = new THREE.Line(targetGeometry, targetMaterial);
    targetLine.computeLineDistances();
    const targetTipGeometry = new THREE.BufferGeometry().setFromPoints(
      Array.from(
        { length: 64 },
        (_, i) =>
          new THREE.Vector3(
            Math.cos((i / 64) * Math.PI * 2) * 0.1,
            0,
            Math.sin((i / 64) * Math.PI * 2) * 0.1,
          ),
      ),
    );
    const targetTipMaterial = new THREE.LineBasicMaterial({
      color: 0xe1ccff,
      transparent: true,
      opacity: 0.85,
      depthTest: false,
    });
    const targetTip = new THREE.LineLoop(targetTipGeometry, targetTipMaterial);
    targetLine.renderOrder = 2;
    targetTip.renderOrder = 3;
    targetTip.position.z = 0.9;
    targetPose.add(targetLine, targetTip);
    targetPose.position.z = 0.3;
    targetPose.visible = id === 'actuator';
    scene.add(targetPose);
    const resize = () => {
      const rect = el.getBoundingClientRect();
      renderer.setSize(rect.width, rect.height, false);
      camera.aspect = rect.width / rect.height;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();
    const w = new Worker(
      new URL('../workers/simulation.worker.ts', import.meta.url),
      { type: 'module' },
    );
    worker.current = w;
    w.onmessage = (e) => {
      if (stopped) return;
      if (e.data.type === 'ready') {
        const { types, sizes, colors } = e.data;
        meshes = types.map((type: number, i: number) => {
          const s = sizes.slice(i * 3, i * 3 + 3);
          let geometry: THREE.BufferGeometry;
          if (type === 0) geometry = new THREE.PlaneGeometry(12, 12);
          else if (type === 2)
            geometry = new THREE.SphereGeometry(s[0], 32, 24);
          else if (type === 3) {
            geometry = new THREE.CapsuleGeometry(s[0], s[1] * 2, 8, 24);
            geometry.rotateX(Math.PI / 2);
          } else if (type === 5) {
            geometry = new THREE.CylinderGeometry(s[0], s[0], s[1] * 2, 40);
            geometry.rotateX(Math.PI / 2);
          } else geometry = new THREE.BoxGeometry(s[0] * 2, s[1] * 2, s[2] * 2);
          const material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(
              colors[i * 4],
              colors[i * 4 + 1],
              colors[i * 4 + 2],
            ).multiplyScalar(type === 0 ? 0.32 : 0.85),
            roughness: 0.68,
            metalness: type === 0 ? 0 : 0.22,
          });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.castShadow = type !== 0;
          mesh.receiveShadow = true;
          scene.add(mesh);
          return mesh;
        });
        setVersion(e.data.version);
        setReady(true);
        w.postMessage({ type: 'params', params: latestParams.current });
      }
      if (e.data.type === 'state') latest.current = e.data;
      if (e.data.type === 'error') {
        setError(e.data.message);
        setReady(false);
      }
    };
    w.onerror = () => {
      setError('实验引擎加载失败。请重试，或下载源码在本地运行。');
      setReady(false);
    };
    w.postMessage({ type: 'load', id });
    w.postMessage({ type: 'play', value: playing });
    const matrix = new THREE.Matrix4();
    const draw = () => {
      if (stopped) return;
      frame = requestAnimationFrame(draw);
      if (document.hidden) return;
      const state = latest.current;
      if (state) {
        for (let i = 0; i < meshes.length; i++) {
          const p = state.positions.slice(i * 3, i * 3 + 3),
            m = state.matrices.slice(i * 9, i * 9 + 9);
          meshes[i].position.set(p[0], p[1], p[2]);
          matrix.set(
            m[0],
            m[1],
            m[2],
            0,
            m[3],
            m[4],
            m[5],
            0,
            m[6],
            m[7],
            m[8],
            0,
            0,
            0,
            0,
            1,
          );
          meshes[i].quaternion.setFromRotationMatrix(matrix);
        }
        const value = id === 'contact' ? state.qvel[0] : state.qpos[0];
        if (state.time < lastSample) {
          history.current = [];
          lastSample = -1;
        }
        if (state.time - lastSample > 0.045) {
          history.current.push({
            time: state.time,
            value,
            target: state.control?.target,
          });
          if (history.current.length > 300) history.current.shift();
          lastSample = state.time;
        }
        if (performance.now() - lastUi > 110) {
          setReadout({
            time: state.time,
            value,
            velocity: state.qvel[0],
            ncon: state.ncon,
            control: state.control,
          });
          lastUi = performance.now();
        }
        if (state.control) targetPose.rotation.y = state.control.target;
        drawGraph(graph.current, history.current, id === 'contact' ? 2.2 : 1.6);
      }
      controls.update();
      renderer.render(scene, camera);
    };
    draw();
    const visible = () =>
      w.postMessage({
        type: 'play',
        value: document.hidden ? false : playingRef.current,
      });
    document.addEventListener('visibilitychange', visible);
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      ro.disconnect();
      document.removeEventListener('visibilitychange', visible);
      w.postMessage({ type: 'dispose' });
      w.terminate();
      worker.current = null;
      controls.dispose();
      meshes.forEach((m) => {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      });
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
      targetGeometry.dispose();
      targetMaterial.dispose();
      targetTipGeometry.dispose();
      targetTipMaterial.dispose();
      renderer.dispose();
    };
  }, [id, retry]);
  useEffect(() => {
    playingRef.current = playing;
    worker.current?.postMessage({ type: 'play', value: playing });
  }, [playing]);
  const change = (
    key: keyof typeof defaults,
    value: number | boolean,
    reset = false,
  ) => {
    const next = { ...params, [key]: value };
    latestParams.current = next;
    setParams(next);
    worker.current?.postMessage({ type: 'params', params: next });
    if (reset) {
      history.current = [];
      worker.current?.postMessage({ type: 'reset' });
    }
  };
  const reset = () => {
    history.current = [];
    worker.current?.postMessage({ type: 'reset' });
  };
  const example = examples[id];
  const sliderProps = { params, ready, change };
  return (
    <div className="simulation-app">
      <div className="experiment-workspace">
        <div className="simulation-view">
          <canvas
            ref={canvas}
            aria-label={`${example.title} 三维仿真场景，可拖动旋转视角`}
          />
          <div className="view-top">
            <span className="engine-status">
              <i className={ready ? 'live' : ''}></i>
              {error
                ? '加载未完成'
                : ready
                  ? `MuJoCo ${version}`
                  : '正在准备实验引擎…'}
            </span>
            <span>EXPERIMENT {example.number.slice(-2)} / 07</span>
          </div>
          <div className="view-bottom">
            <span>
              {id === 'actuator'
                ? '虚线：目标姿态 · 拖动旋转 / 滚轮缩放'
                : '拖动旋转 · 滚轮缩放'}
            </span>
            <span>t = {readout.time.toFixed(3)} s</span>
          </div>
          {!ready && (
            <div className="engine-overlay" role="status">
              {error ? (
                <>
                  <p>{error}</p>
                  <button onClick={() => setRetry((v) => v + 1)}>
                    重新加载 ↻
                  </button>
                </>
              ) : (
                <>
                  <span className="loading-orbit"></span>
                  <p>让一次小实验，慢慢就绪。</p>
                </>
              )}
            </div>
          )}
        </div>
        <aside className="parameter-panel">
          <p className="eyebrow">PARAMETERS / 参数</p>
          {id === 'pendulum' && (
            <>
              <Slider
                {...sliderProps}
                label="关节阻尼"
                name="damping"
                min={0}
                max={2}
                step={0.01}
              />
              <Slider
                {...sliderProps}
                label="初始角度 · 调整即重置"
                name="angle"
                min={0.1}
                max={1.5}
                step={0.01}
                unit="rad"
                resetOnChange
              />
            </>
          )}
          {id === 'actuator' && (
            <>
              <Slider
                {...sliderProps}
                label="目标角度"
                name="target"
                min={-1.3}
                max={1.3}
                step={0.01}
                unit="rad"
              />
              <Slider
                {...sliderProps}
                label="比例增益 Kp"
                name="gain"
                min={5}
                max={100}
                step={1}
              />
              <Slider
                {...sliderProps}
                label="微分增益 Kd"
                name="derivative"
                min={0}
                max={20}
                step={0.1}
              />
              <label className="compensation-toggle">
                <input
                  type="checkbox"
                  checked={params.gravityComp}
                  disabled={!ready}
                  onChange={(e) => change('gravityComp', e.target.checked)}
                />
                <span>
                  重力补偿<small>默认开启；关闭可观察稳态误差。</small>
                </span>
              </label>
            </>
          )}
          {id === 'contact' && (
            <>
              <Slider
                {...sliderProps}
                label="滑动摩擦系数"
                name="friction"
                min={0}
                max={1}
                step={0.01}
              />
              <p className="param-note">调整后重置，让方块从相同初速度出发。</p>
            </>
          )}
          <label className="speed-control">
            仿真速度
            <select
              aria-label="仿真速度"
              value={params.speed}
              disabled={!ready}
              onChange={(e) => change('speed', Number(e.target.value))}
            >
              <option value={0.25}>¼ 倍速</option>
              <option value={0.5}>½ 倍速</option>
              <option value={1}>正常速度</option>
            </select>
          </label>
          <div className="simulation-actions">
            <button
              disabled={!ready}
              onClick={() => setPlaying((v) => !v)}
              aria-label={playing ? '暂停仿真' : '继续仿真'}
            >
              {playing ? 'Ⅱ 暂停' : '▷ 继续'}
            </button>
            <button disabled={!ready} onClick={reset} aria-label="重置仿真">
              ↻ 重置
            </button>
            <button
              disabled={!ready || playing}
              onClick={() => worker.current?.postMessage({ type: 'step' })}
            >
              单步 →
            </button>
          </div>
        </aside>
        <div className="live-readout">
          <span>{id === 'contact' ? '速度' : '当前角度'}</span>
          <strong>
            {readout.value.toFixed(3)}
            <small>{example.unit}</small>
          </strong>
          {id === 'contact' && <span>接触点：{readout.ncon}</span>}
          {id === 'actuator' && (
            <dl className="tracking-readout">
              <div>
                <dt>目标 q*</dt>
                <dd>
                  {(readout.control?.target ?? params.target).toFixed(3)}{' '}
                  <small>rad</small>
                </dd>
              </div>
              <div>
                <dt>误差 e</dt>
                <dd>
                  {readout.control?.error.toFixed(6) ?? '—'} <small>rad</small>
                </dd>
              </div>
              <div>
                <dt>角速度 q̇</dt>
                <dd>
                  {readout.velocity.toFixed(3)} <small>rad/s</small>
                </dd>
              </div>
            </dl>
          )}
        </div>
      </div>
      <div className="chart-panel">
        <div>
          <span className="eyebrow">{example.variable}</span>
          <span>最近 15 秒 / 与仿真同步</span>
        </div>
        {id === 'actuator' && (
          <div className="chart-legend">
            <span>— 实际角度 q</span>
            <span>┄ 目标角度 q*</span>
          </div>
        )}
        <canvas
          ref={graph}
          aria-label={
            id === 'actuator'
              ? '实际角度与目标角度随时间变化的对比曲线'
              : `${example.variable} 随时间变化的曲线`
          }
        />
      </div>
      {id === 'actuator' && (
        <section className="pd-explanation" aria-label="PD 控制实时分解">
          <div className="pd-heading">
            <p className="eyebrow">INSIDE THE CONTROLLER / 看见 PD</p>
            <h3>靠 P 接近，由 D 收住。</h3>
            <p className="pd-formula">
              τ<sub>PD</sub> = Kp · (q* − q) − Kd · q̇
            </p>
          </div>
          <dl className="pd-terms">
            <div>
              <dt>P · 位置纠偏</dt>
              <dd>
                {readout.control?.pTorque.toFixed(3) ?? '—'} <small>N·m</small>
              </dd>
              <p>误差越大，朝目标施加的力矩越大。</p>
            </div>
            <div>
              <dt>D · 速度制动</dt>
              <dd>
                {readout.control?.dTorque.toFixed(3) ?? '—'} <small>N·m</small>
              </dd>
              <p>目标速度为 0；抵消运动，减少超调。</p>
            </div>
            <div>
              <dt>执行器 · PD 输出</dt>
              <dd>
                {readout.control?.torque.toFixed(3) ?? '—'} <small>N·m</small>
              </dd>
              <p>
                {readout.control?.saturated
                  ? '已达到 ±40 N·m 限幅。'
                  : 'P + D 的实际输出，上限 ±40 N·m。'}
              </p>
            </div>
            <div>
              <dt>重力补偿 · 独立作用</dt>
              <dd>
                {readout.control?.gravityTorque.toFixed(3) ?? '—'}{' '}
                <small>N·m</small>
              </dd>
              <p>
                {params.gravityComp
                  ? '已开启；抵消连杆自重，便于比较 PD。'
                  : '已关闭；纯 PD 需要非零误差抵抗重力。'}
              </p>
            </div>
          </dl>
          <p className="pd-guide">
            保持 Kp = 30，将 Kd 调到 0 并重置，观察持续摆动；再调到 6
            并重置，比较超调与收敛。重力补偿独立于 PD，关闭后即使增大
            Kp，静态误差也通常不会严格为零。
          </p>
        </section>
      )}
      <div className="experiment-notes">
        <div>
          <p className="eyebrow">WHAT TO OBSERVE</p>
          <h3>留意这些细节。</h3>
          <p>{example.observation}</p>
          <a className="text-link" href={`/journal/${example.article}/`}>
            阅读对应手记 <span>↗</span>
          </a>
        </div>
        <div>
          <p className="eyebrow">TAKE IT WITH YOU</p>
          <h3>把实验带回本地。</h3>
          <p>同一份 MJCF 模型，附带 Python 启动程序与依赖说明。</p>
          <div className="source-links">
            <a className="text-link" href={`/examples/${id}.xml`} download>
              下载模型 <span>↓</span>
            </a>
            <a className="text-link" href="/examples/run.py" download>
              Python 程序 <span>↓</span>
            </a>
            <a className="text-link" href="/examples/instructions.txt" download>
              运行说明 <span>↓</span>
            </a>
          </div>
        </div>
      </div>
      <details
        className="xml-source"
        open={xmlOpen}
        onToggle={(e) => setXmlOpen(e.currentTarget.open)}
      >
        <summary>
          查看这个实验的 MJCF 模型 <span>＋</span>
        </summary>
        <pre>
          <code>{example.xml}</code>
        </pre>
      </details>
    </div>
  );
}
function Slider({
  label,
  name,
  min,
  max,
  step,
  unit = '',
  resetOnChange = false,
  params,
  ready,
  change,
}: {
  label: string;
  name: NumericParam;
  min: number;
  max: number;
  step: number;
  unit?: string;
  resetOnChange?: boolean;
  params: typeof defaults;
  ready: boolean;
  change: (name: NumericParam, value: number, reset?: boolean) => void;
}) {
  return (
    <label className="param">
      <span>
        {label}
        <output>
          {params[name].toFixed(step < 0.1 ? 2 : 1)} {unit}
        </output>
      </span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={params[name]}
        disabled={!ready}
        onChange={(e) => change(name, Number(e.target.value), resetOnChange)}
      />
      <small>
        {min} <span>{max}</span>
      </small>
    </label>
  );
}
function drawGraph(
  canvas: HTMLCanvasElement | null,
  history: Sample[],
  minimumRange: number,
) {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect(),
    dpr = Math.min(devicePixelRatio, 2);
  if (
    canvas.width !== Math.floor(rect.width * dpr) ||
    canvas.height !== Math.floor(rect.height * dpr)
  ) {
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
  }
  const c = canvas.getContext('2d');
  if (!c || rect.width <= 60) return;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const w = rect.width,
    h = rect.height,
    left = 44,
    top = 10,
    plotW = w - left - 12,
    plotH = h - top - 23;
  c.clearRect(0, 0, w, h);
  const end = Math.max(15, history.at(-1)?.time ?? 0),
    start = end - 15;
  const visible = history.filter((p) => p.time >= start);
  const range = Math.max(
    minimumRange,
    ...visible.map(
      (p) => Math.max(Math.abs(p.value), Math.abs(p.target ?? 0)) * 1.1,
    ),
  );
  const x = (time: number) => left + ((time - start) / 15) * plotW;
  const y = (value: number) => top + plotH / 2 - ((value / range) * plotH) / 2;
  c.font = '10px monospace';
  c.fillStyle = '#938b9e';
  c.strokeStyle = 'rgba(157,148,177,.2)';
  c.lineWidth = 1;
  for (const value of [-range, 0, range]) {
    c.beginPath();
    c.moveTo(left, y(value));
    c.lineTo(w - 12, y(value));
    c.stroke();
    c.textAlign = 'right';
    c.fillText(value.toFixed(1), left - 8, y(value) + 3);
  }
  for (let i = 0; i <= 3; i++) {
    const time = start + i * 5;
    c.beginPath();
    c.moveTo(x(time), top);
    c.lineTo(x(time), top + plotH);
    c.stroke();
    c.textAlign = i === 3 ? 'right' : 'left';
    c.fillText(`${time.toFixed(0)}s`, x(time), h - 3);
  }
  if (!visible.length) return;
  c.save();
  c.beginPath();
  c.rect(left, top - 1, plotW, plotH + 2);
  c.clip();
  if (visible.some((p) => p.target !== undefined)) {
    c.strokeStyle = '#9381ac';
    c.lineWidth = 1.5;
    c.setLineDash([6, 5]);
    c.beginPath();
    visible.forEach((p, i) => {
      if (i === 0) c.moveTo(x(p.time), y(p.target ?? 0));
      else {
        c.lineTo(x(p.time), y(visible[i - 1].target ?? 0));
        c.lineTo(x(p.time), y(p.target ?? 0));
      }
    });
    c.stroke();
    c.setLineDash([]);
  }
  c.strokeStyle = '#c8b1e9';
  c.lineWidth = 2;
  c.beginPath();
  visible.forEach((p, i) =>
    i === 0 ? c.moveTo(x(p.time), y(p.value)) : c.lineTo(x(p.time), y(p.value)),
  );
  c.stroke();
  c.restore();
}
