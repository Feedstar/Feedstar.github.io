import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { examples, type ExampleId } from '../lib/examples';
type SimState = {
  time: number;
  qpos: number[];
  qvel: number[];
  positions: number[];
  matrices: number[];
  ncon: number;
};
const defaults = {
  damping: 0.12,
  angle: 0.85,
  target: 0.6,
  gain: 30,
  friction: 0.25,
  speed: 1,
};
export default function Simulation() {
  const [id, setId] = useState<ExampleId>('pendulum'),
    [ready, setReady] = useState(false),
    [error, setError] = useState(''),
    [playing, setPlaying] = useState(true),
    [version, setVersion] = useState(''),
    [params, setParams] = useState(defaults),
    [readout, setReadout] = useState({ time: 0, value: 0.85, ncon: 0 }),
    [retry, setRetry] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null),
    graph = useRef<HTMLCanvasElement>(null),
    worker = useRef<Worker | null>(null),
    latest = useRef<SimState | null>(null),
    history = useRef<{ time: number; value: number }[]>([]),
    latestParams = useRef(params),
    playingRef = useRef(playing);
  const [xmlOpen, setXmlOpen] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(location.search).get('example');
    if (q && q in examples) setId(q as ExampleId);
  }, []);
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    setReady(false);
    setError('');
    latest.current = null;
    history.current = [];
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
          history.current.push({ time: state.time, value });
          if (history.current.length > 300) history.current.shift();
          lastSample = state.time;
        }
        if (performance.now() - lastUi > 110) {
          setReadout({ time: state.time, value, ncon: state.ncon });
          lastUi = performance.now();
        }
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
      renderer.dispose();
    };
  }, [id, retry]);
  useEffect(() => {
    playingRef.current = playing;
    worker.current?.postMessage({ type: 'play', value: playing });
  }, [playing]);
  const change = (key: keyof typeof defaults, value: number, reset = false) => {
    const next = { ...params, [key]: value };
    latestParams.current = next;
    setParams(next);
    worker.current?.postMessage({ type: 'params', params: next });
    if (reset) {
      history.current = [];
      worker.current?.postMessage({ type: 'reset' });
    }
  };
  const select = (next: ExampleId) => {
    latestParams.current = defaults;
    setParams(defaults);
    setPlaying(true);
    setId(next);
    const url = new URL(location.href);
    url.searchParams.set('example', next);
    window.history.replaceState(null, '', url);
  };
  const reset = () => {
    history.current = [];
    worker.current?.postMessage({ type: 'reset' });
  };
  const example = examples[id];
  const sliderProps = { params, ready, change };
  return (
    <div className="simulation-app">
      <div className="experiment-tabs" role="group" aria-label="选择实验">
        {Object.values(examples).map((e) => (
          <button
            key={e.id}
            aria-pressed={id === e.id}
            onClick={() => select(e.id)}
          >
            <span>{e.number}</span>
            {e.id === 'pendulum'
              ? '关节与阻尼'
              : e.id === 'actuator'
                ? '位置执行器'
                : '接触与摩擦'}
          </button>
        ))}
      </div>
      <div className="experiment-intro">
        <p className="eyebrow">{example.subtitle}</p>
        <h2>{example.title}</h2>
        <p>{example.description}</p>
      </div>
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
            <span>STUDY {example.number}</span>
          </div>
          <div className="view-bottom">
            <span>拖动旋转 · 滚轮缩放</span>
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
                label="位置增益"
                name="gain"
                min={5}
                max={100}
                step={1}
              />
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
          <div className="live-readout">
            <span>{id === 'contact' ? '速度' : '当前角度'}</span>
            <strong>
              {readout.value.toFixed(3)}
              <small>{example.unit}</small>
            </strong>
            {id === 'contact' && <span>接触点：{readout.ncon}</span>}
          </div>
        </aside>
      </div>
      <div className="chart-panel">
        <div>
          <span className="eyebrow">{example.variable}</span>
          <span>最近 15 秒 / 与仿真同步</span>
        </div>
        <canvas
          ref={graph}
          aria-label={`${example.variable} 随时间变化的曲线`}
        />
      </div>
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
  name: keyof typeof defaults;
  min: number;
  max: number;
  step: number;
  unit?: string;
  resetOnChange?: boolean;
  params: typeof defaults;
  ready: boolean;
  change: (name: keyof typeof defaults, value: number, reset?: boolean) => void;
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
  history: { time: number; value: number }[],
  range: number,
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
  if (!c) return;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const w = rect.width,
    h = rect.height;
  c.clearRect(0, 0, w, h);
  c.strokeStyle = 'rgba(159,178,142,.12)';
  c.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    c.beginPath();
    c.moveTo(0, (h * i) / 4);
    c.lineTo(w, (h * i) / 4);
    c.stroke();
  }
  for (let i = 1; i < 12; i++) {
    c.beginPath();
    c.moveTo((w * i) / 12, 0);
    c.lineTo((w * i) / 12, h);
    c.stroke();
  }
  if (!history.length) return;
  const end = Math.max(15, history[history.length - 1].time),
    start = end - 15;
  c.strokeStyle = '#c8b1e9';
  c.lineWidth = 1.6;
  c.beginPath();
  history.forEach((p, i) => {
    const x = ((p.time - start) / 15) * w,
      y = h * 0.5 - (p.value / range) * h * 0.4;
    i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
  });
  c.stroke();
}
