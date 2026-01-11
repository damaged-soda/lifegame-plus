# 架构说明（SOT）

Last Updated: 2026-01-11

## 模块边界（按 repo 或关键模块描述）
- `src/lifegame-plus/engine/lifegame.js`：元胞自动机核心数据结构与演进（无 DOM/Canvas 依赖）
- `src/lifegame-plus/web/`：静态页面与交互（按速率定时调用 `stepDirectional` 并渲染到 Canvas）

## 关键约束 / 不变量
- 纯前端运行：无后端 API；除首次加载静态资源外无持续网络交互
- 固定网格大小：100×100
- 边界策略：左右环绕、上下不环绕（X wrap，Y 越界视为空）
- 数据结构：`grid = { width, height, cells: Uint8Array }`
  - `cells[i]` 为 bitmask（单格可叠加多种类型）：A=1、B=2、C=4，取值范围 `0..7`
- 演进纯函数：
  - `stepDirectional(grid, ruleSet) -> newGrid`（不原地修改 `cells`）
  - `step(grid, rule?) -> newGrid` 为历史遗留的 Life-like 实现（Web 不再使用）
- 多类型演进语义：
  - A/B/C 共用同一份 `ruleSet`（方向规则集）
  - 每个类型只看同类型邻居独立演化：A 只统计 A 邻居；B 只统计 B 邻居；C 只统计 C 邻居
  - 同一格可同时出现多个类型（满足条件者按位叠加）
- 方向规则数据结构：
  - `ruleSet = { birthRules: DirectionalRule[], surviveRules: DirectionalRule[] }`
  - `DirectionalRule = { name, mustAliveMask, mustDeadMask, enabledByDefault? }`
  - 8 邻居位序固定（方向不等价）：N=0, NE=1, E=2, SE=3, S=4, SW=5, W=6, NW=7
  - 匹配判定：`(neighborsMask & mustAliveMask) === mustAliveMask && (neighborsMask & mustDeadMask) === 0`
  - 语义：中心为空时命中任一 `birthRules` 则下一步为活；中心为活时命中任一 `surviveRules` 则下一步保持活；否则默认死
- 播放循环：`web/main.js` 采用 `requestAnimationFrame + 时间累积步进` 来支持高倍率（x0.5 ~ x100），并避免极小 `setInterval` 带来的不稳定
- 规则面板交互约束：播放中禁用规则面板；仅暂停时允许切换规则集/启用规则，切换后从当前棋盘继续演进（不重置）
- 渲染约束（多类型可视化）：
  - 单类型：居中显示该类型颜色
  - 多类型叠加：在格子内均匀分布显示（固定位置：A 上中、B 右下、C 左下）
- 初始化（随机种子）：
  - 页面加载时：A 放置竖向 5 连；B 放置横向 5 连；C 放置 glider；三者位置随机
  - 种子放置遵循边界：X 超界环绕；Y 超界忽略
- 本阶段不支持棋盘编辑：`重置` 会清空为白板并进入暂停态，但不提供鼠标绘制

## 跨 repo 交互（如适用）
- `web/main.js` 通过 ES Module 相对路径导入引擎：`import { ... } from "../engine/lifegame.js"`
- 运行时需要静态服务器（例如 `python3 -m http.server`），避免 `file://` 下 ES Module 受限
