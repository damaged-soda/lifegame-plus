# 架构说明（SOT）

Last Updated: 2026-01-10

## 模块边界（按 repo 或关键模块描述）
- `src/lifegame-plus/engine/lifegame.js`：生命游戏核心数据结构与演进（无 DOM/Canvas 依赖）
- `src/lifegame-plus/web/`：静态页面与交互（按速率定时调用 `step` 并渲染到 Canvas）

## 关键约束 / 不变量
- 纯前端运行：无后端 API；除首次加载静态资源外无持续网络交互
- 固定网格大小：100×100
- 边界策略：环绕（toroidal）
- 数据结构：`grid = { width, height, cells: Uint8Array }`
- 演进纯函数：`step(grid, rule?) -> newGrid`（不原地修改 `cells`）
- 规则可配置：`rule = { birth: number[], survive: number[] }`，默认 Conway 规则 B3/S23
- 播放循环：`web/main.js` 采用 `requestAnimationFrame + 时间累积步进` 来支持高倍率（x0.5 ~ x100），并避免极小 `setInterval` 带来的不稳定
- 规则面板交互约束：播放中禁用规则面板；仅暂停时允许切换规则（选择规则集或勾选原子规则），切换后从当前棋盘继续演进（不重置）
- 原子规则（可视化）与 `B.../S...` 的映射：
  - Birth：9 张（n=0..8），勾选表示 `n ∈ rule.birth`；A 图中心为“死”，B 图中心表示下一步是否为“活”
  - Survive：9 张（n=0..8），勾选表示 `n ∈ rule.survive`；A 图中心为“活”，B 图中心表示下一步是否为“活”
  - 说明：Life-like 规则只依赖邻居数量 `n`，不依赖邻居几何位置；卡片 A 图邻居摆放仅用于示意，按从 N 起顺时针填充（N→NE→E→SE→S→SW→W→NW）
- 棋盘编辑（初始化白板）：
  - `Reset`：清空棋盘为全死白板，并强制进入暂停态（不重置 speed/rule）
  - 编辑约束：仅暂停时响应；播放时忽略输入
  - 交互：单击 toggle 单格；按住拖动连续画黑/擦白（以按下时所在格决定本次拖动目标状态）

## 跨 repo 交互（如适用）
- `web/main.js` 通过 ES Module 相对路径导入引擎：`import { ... } from "../engine/lifegame.js"`
- 运行时需要静态服务器（例如 `python3 -m http.server`），避免 `file://` 下 ES Module 受限
