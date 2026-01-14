# 架构说明（SOT）

Last Updated: 2026-01-12

## 模块边界（按 repo 或关键模块描述）
- `src/lifegame-plus/engine/lifegame.js`：元胞自动机核心数据结构与演进（无 DOM/Canvas 依赖）
- `src/lifegame-plus/web/`：静态页面与交互（按速率定时调用 `stepDirectional` 并渲染到 Canvas）

## 关键约束 / 不变量
- 纯前端运行：无后端 API；除首次加载静态资源外无持续网络交互
- 固定网格大小：100×100
- 边界策略：左右环绕、上下不环绕（X wrap，Y 越界视为空）
- 坐标系约定：左下为原点（`x=0,y=0` 在左下），`y` 向上增加
- 数据结构：`grid = { width, height, cells: Uint8Array }`
  - `cells[i]` 为 bitmask（单格可叠加多种类型）：A=1、B=2、C=4，取值范围 `0..7`
  - 索引：`i = y * width + x`（`y=0` 为底行）
- 演进纯函数：
  - `stepDirectional(grid, ruleSet, rng?, metaRules?) -> newGrid`（不原地修改 `cells`）
    - `rng`：可选函数 `() => number`，返回 `[0, 1)`（用于概率出生与可复现）
    - `metaRules`：可选元规则参数（决定“游戏规则”的规则，不改变方向规则语义）
      - `exclusiveCell: boolean`：单格互斥（默认 `false`）
  - `step(grid, rule?) -> newGrid` 为历史遗留的 Life-like 实现（Web 不再使用）
- 多类型演进语义：
  - A/B/C 共用同一份 `ruleSet`（方向规则集）
  - 每个类型只看同类型邻居独立演化：A 只统计 A 邻居；B 只统计 B 邻居；C 只统计 C 邻居
  - 默认同一格可同时出现多个类型（满足条件者按位叠加）；当启用元规则 `exclusiveCell` 时，演进结果会被裁决为单类型
    - 冲突裁决：同一步可能出现多种类型时使用 `rng` 随机选择 1 种，保证可复现
    - “死亡后可填入”：若 t 时刻该格类型在 t+1 死亡，则该格可在同一步按“空格出生”逻辑让其他类型进入（若多种同时满足则随机选 1）
    - 防御性处理：当 `exclusiveCell=true` 且输入盘面存在同格多类型时，引擎会先用 `rng` 将其随机规整为单类型再演进
- 方向规则数据结构：
  - `ruleSet = { birthRules: DirectionalBirthRule[], deathRules: DirectionalRule[] }`
  - `DirectionalRule = { mustAliveMask, mustDeadMask }`（UI 可额外带 `name/enabled`，引擎只读取 mask）
  - `DirectionalBirthRule = { mustAliveMask, mustDeadMask, p? }`
    - `p`：`0..1` 概率（缺省视为 `1`；非法值会被归一/夹断到 `0..1`）
  - 8 邻居位序固定（方向不等价）：N=0, NE=1, E=2, SE=3, S=4, SW=5, W=6, NW=7
    - 在坐标系中：N 表示 `(x, y+1)`，S 表示 `(x, y-1)`（其余方向类推）
  - 匹配判定：`(neighborsMask & mustAliveMask) === mustAliveMask && (neighborsMask & mustDeadMask) === 0`
  - 语义（默认存活）：
    - 中心为空：对每条命中的 `birthRules` 逐条抽样；任意 `rand < p` → 下一步为活；否则为空
      - 约束：为满足“每条都抽”并保证可复现，即使已确定出生，也会继续对其余命中规则抽样（仅消耗 RNG，不再改变结果）
    - 中心为活：命中任一 `deathRules` → 下一步为空；否则保持为活
  - 兼容：若传入旧字段 `surviveRules`（且未提供 `deathRules`），仍按历史语义运行（活细胞需命中 survive 才存活）
- 播放循环：`web/main.js` 采用 `requestAnimationFrame + 时间累积步进` 来支持高倍率（x0.5 ~ x100），并避免极小 `setInterval` 带来的不稳定
- 规则面板交互约束：播放中禁用规则面板；仅暂停时允许切换规则集/启用规则/调整出生概率，切换后从当前棋盘继续演进（不重置）
- 元规则交互约束：作为规则面板的一部分，播放中同样禁用；到顶结束触发后进入结束态（播放按钮禁用），需重新初始化后才能重新开始
- 渲染约束（多类型可视化）：
  - 单类型：居中显示该类型颜色
  - 多类型叠加：在格子内均匀分布显示（固定位置：A 上中、B 右下、C 左下）
- 渲染坐标映射：Canvas 原点在左上；渲染时使用 `screenY = (height - 1 - y)`，使内部 `y=0` 显示在画面底部
- 初始化（随机种子）：
  - 页面加载时：生成随机 seed，并用其初始化确定性 PRNG；seed 显示在右侧“随机种子”输入框
  - 使用该 PRNG 在最底层（`y=0`）为 A/B/C 各随机生成一个 `x`，并放置单点
    - 默认允许同格叠加
    - 若启用元规则 `exclusiveCell`，则会为 A/B/C 选择互不相同的 `x`（避免初始同格冲突）
  - 修改 seed（回车/失焦）或点击 `重试`：会切换 seed，并用新 seed 重新随机初始化盘面（自动暂停）
- 本阶段不支持棋盘编辑：`重置` 会按当前 seed 重新初始化盘面并进入暂停态，但不提供鼠标绘制

## 跨 repo 交互（如适用）
- `web/main.js` 通过 ES Module 相对路径导入引擎：`import { ... } from "../engine/lifegame.js"`
- 运行时需要静态服务器（例如 `python3 -m http.server`），避免 `file://` 下 ES Module 受限
