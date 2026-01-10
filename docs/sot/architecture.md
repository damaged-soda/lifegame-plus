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
- 规则可配置（为后续扩展预留）：`rule = { birth: number[], survive: number[] }`，默认 Conway 规则 B3/S23
- 播放循环：`web/main.js` 采用 `requestAnimationFrame + 时间累积步进` 来支持高倍率（x0.5 ~ x100），并避免极小 `setInterval` 带来的不稳定

## 跨 repo 交互（如适用）
- `web/main.js` 通过 ES Module 相对路径导入引擎：`import { ... } from "../engine/lifegame.js"`
- 运行时需要静态服务器（例如 `python3 -m http.server`），避免 `file://` 下 ES Module 受限
