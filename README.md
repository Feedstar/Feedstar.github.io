# Feedstar · 微光与秩序

个人技术主页、文章与 MuJoCo 基础功能示例库。页面为静态生成，交互与仿真在浏览器运行。

## 本地开发

需要 Node.js 24 与 npm。

```bash
npm ci
npm run dev
```

默认地址为 `http://localhost:4321`。构建与验证：

```bash
npm run check
npm test
npm run build
npm run preview
```

在受限环境中如 Astro 无法创建系统配置目录，可设置 `ASTRO_TELEMETRY_DISABLED=1` 再执行命令。

## 内容结构

- `/`：月体风化序章、项目展示、文章入口与个人介绍。
- `/projects/`：三个已实现的 MuJoCo 示例。
- `/lab/?example=pendulum`：关节阻尼；`actuator`：位置执行器；`contact`：滑动摩擦。
- `/journal/`：文章列表，以及对应示例的三篇入门说明。
- `/about/`：空间介绍与素材来源。

### 添加文章

在 `src/content/journal/` 新建 Markdown 文件，文件名对应 URL。头部格式：

```yaml
---
title: 文章标题
description: 简短说明
category: 仿真札记
number: '004'
example: pendulum
---
```

文章列表自动读取内容集合；首页精选入口在 `src/pages/index.astro` 中单独编排。

### 添加实验

1. 在 `public/examples/` 添加 MJCF。
2. 在 `src/lib/examples.ts` 注册说明与原始模型。
3. 在 `src/workers/simulation.worker.ts` 添加初始状态和可调参数映射。
4. 在 `src/components/Simulation.tsx` 添加对应参数控件。
5. 扩展 `scripts/check-simulations.mjs` 验证物理行为。

现有渲染器支持示例使用的 plane、sphere、capsule、cylinder、box 几何体。新增 mesh、柔性体或其他渲染类型时，需要扩展渲染器；不能仅注册 XML 后假定完整支持。

## 月体风化转场

- `src/scripts/moon.ts`：Three.js 月体表面与 17 万粒子（手机 7 万）。
- `src/lib/erosion.mjs`：确定性的局部消散场，与 GPU 使用相同的区域规则。
- 滚动位置直接驱动进度；没有自动播放时间线，也没有滚动惯性代理。
- 表面按局部阈值逐渐切除，粒子从对应位置轻柔漂移并消隐。完整主体到内容出现共用同一段滚动进度。
- `prefers-reduced-motion` 使用温和的静态主体与淡化替代；WebGL 不可用时展示静态主视觉。
- 静止滚动状态不持续重绘月体；离开屏幕或隐藏标签页时暂停相关工作。

人工验收：慢滚至不同阶段，观察轮廓、位置与密度变化；停止后应保持当前状态；向上滚动应自然恢复。到后半程，下一段文字与颗粒消隐共同完成转场。

## MuJoCo 示例

使用官方 `@mujoco/mujoco` 3.15.0 单线程 WASM 引擎，放在独立 Web Worker 中。三个示例均提供暂停、单步、重置、倍速、参数调整与实时曲线。隐藏标签页暂停物理推进，回到页面后保持原先的运行/暂停状态。

`public/examples/` 的模型与网页一致，`run.py` 提供 Python 本地运行入口。Python 程序已做语法检查；本地桌面查看器需要安装相应依赖并在支持图形界面的环境运行。

WASM 约 10 MB，只在进入实验室时加载。首页只加载主视觉所需代码。字体使用 Google Fonts，并设有系统衬线字体回退；无法访问字体服务时仍可阅读。

## GitHub Pages

仓库：`Feedstar/Feedstar.github.io`。`astro.config.mjs` 已设置用户站点地址。

首次使用需在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。之后推送到 `main`，`.github/workflows/deploy.yml` 会构建并发布 `dist/`。首次启用后，可在 Actions 中重新运行 Publish Feedstar。

工作流遵循最小权限：读取内容、发布 Pages 与获取部署身份。站点没有后端、账户、分析追踪或远程训练任务。

## 设计与来源

构图、留白与浏览节奏参考 [ungetsu](https://ungetsu.net/)；Feedstar 的标志、页面文字、栏目、插图与交互代码单独制作。

月面纹理来自 [NASA's Scientific Visualization Studio — CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/)，基于 LRO / LROC 数据，页面亦保留署名。字体为 Cormorant Garamond 与 Noto Serif SC。第三方依赖各自遵循其许可证。
