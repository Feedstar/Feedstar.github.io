import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type MouseEvent,
} from 'react';
import {
  experimentCatalog,
  experimentHref,
  findExperiment,
  type ExperimentId,
} from '../lib/experiment-catalog';
const Simulation = lazy(() => import('./Simulation'));
const ArmLab = lazy(() => import('./ArmLab'));
const FeatureLab = lazy(() => import('./FeatureLab'));

class ExperimentBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="lab-loading" role="alert">
        <p>实验未能加载，请刷新页面重试。</p>
        <button onClick={() => location.reload()}>重新加载</button>
      </div>
    ) : (
      this.props.children
    );
  }
}

export default function LabWorkspace() {
  const [selection, setSelection] = useState<ExperimentId | null>(null);
  const workspace = useRef<HTMLElement>(null);
  const current = findExperiment(selection),
    index = experimentCatalog.indexOf(current);
  useEffect(() => {
    const readURL = () =>
      setSelection(
        findExperiment(new URLSearchParams(location.search).get('example')).id,
      );
    readURL();
    window.addEventListener('popstate', readURL);
    return () => window.removeEventListener('popstate', readURL);
  }, []);
  const navigate = (
    event: MouseEvent<HTMLAnchorElement>,
    id: ExperimentId,
    scroll = false,
  ) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    if (id !== selection) {
      window.history.pushState(null, '', experimentHref(id));
      setSelection(id);
    }
    if (scroll)
      workspace.current?.scrollIntoView({
        block: 'start',
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
      });
  };
  return (
    <section
      className="lab-course"
      id="experiment"
      ref={workspace}
      aria-label="MuJoCo 实验集"
    >
      <div className="lab-course-roadmap">
        <span>01—03 / 看清基础现象</span>
        <i aria-hidden="true">→</i>
        <span>04—07 / 在机械臂上综合观察</span>
        <i aria-hidden="true">→</i>
        <span>08—11 / 约束、传动与感知</span>
      </div>
      <nav className="lab-course-nav" aria-label="选择实验">
        {experimentCatalog.map((entry) => (
          <a
            key={entry.id}
            href={experimentHref(entry.id)}
            aria-current={current.id === entry.id ? 'true' : undefined}
            onClick={(event) => navigate(event, entry.id)}
          >
            <span>
              {entry.number}{' '}
              <small>
                {entry.kind === 'basic'
                  ? '基础'
                  : entry.kind === 'arm'
                    ? '机械臂'
                    : '进阶观察'}
              </small>
            </span>
            <strong>{entry.title}</strong>
          </a>
        ))}
      </nav>
      <header className="lab-current-heading">
        <div>
          <p className="eyebrow">
            EXPERIMENT {current.number} / {experimentCatalog.length} ·{' '}
            {current.subject}
          </p>
          <h2>{current.title}</h2>
        </div>
        <div>
          <p>{current.description}</p>
          <p>{current.connection}</p>
        </div>
      </header>
      <ExperimentBoundary key={current.id}>
        <Suspense
          fallback={
            <div className="lab-loading" role="status">
              正在准备实验…
            </div>
          }
        >
          {selection ? (
            current.kind === 'basic' ? (
              <Simulation key={current.example} id={current.example} />
            ) : current.kind === 'arm' ? (
              <ArmLab lesson={current.lesson} number={current.number} />
            ) : (
              <FeatureLab key={current.study} kind={current.study} />
            )
          ) : (
            <div className="lab-loading" role="status">
              正在准备实验…
            </div>
          )}
        </Suspense>
      </ExperimentBoundary>
      <nav className="lab-course-next" aria-label="继续实验">
        {index > 0 ? (
          <a
            href={experimentHref(experimentCatalog[index - 1].id)}
            onClick={(event) =>
              navigate(event, experimentCatalog[index - 1].id, true)
            }
          >
            <small>← 上一项</small>
            <span>
              {experimentCatalog[index - 1].number} /{' '}
              {experimentCatalog[index - 1].title}
            </span>
          </a>
        ) : (
          <p>从一个参数，开始观察。</p>
        )}
        {index < experimentCatalog.length - 1 ? (
          <a
            href={experimentHref(experimentCatalog[index + 1].id)}
            onClick={(event) =>
              navigate(event, experimentCatalog[index + 1].id, true)
            }
          >
            <small>下一项 →</small>
            <span>
              {experimentCatalog[index + 1].number} /{' '}
              {experimentCatalog[index + 1].title}
            </span>
          </a>
        ) : (
          <a href="/lab/#catalog">
            <small>回到目录 ↗</small>
            <span>全部 {experimentCatalog.length} 项实验</span>
          </a>
        )}
      </nav>
    </section>
  );
}
