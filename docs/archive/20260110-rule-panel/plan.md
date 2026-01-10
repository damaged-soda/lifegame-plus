# 可视化规则面板（规则集下拉 + 原子规则 A→B）技术变更计划（Plan）

## 0. 背景与目标（简短即可）
- 背景：当前 Web 版界面较空，且演变规则固定为 Conway（B3/S23）。希望把演变规则做成可插拔并以可视化方式呈现。
- 目标：
  - 右侧新增“规则面板”，并对齐术语：
    - **规则集（Rule Set）**：多个原子规则的组合（等价 `B.../S...`），由下拉 `<select>` 选择经典预设
    - **原子规则（Atomic Rule）**：最基本变换法则，以卡片形式可视化展示：`A(3×3) → B(3×3)`，分别覆盖 `Birth@0..8` 与 `Survive@0..8`
  - 行为约束：仅在 **暂停** 状态下允许切换规则（选择规则集或勾选原子规则）；切换后从当前棋盘继续演进（不重置网格）。
  - 运行形态：纯前端运行；`web/` 维护 `currentRule`，每次 `step(grid, currentRule)` 使用当前规则演进。
- 非目标：
  - 暂不支持非 Life-like 的规则体系（例如 generations、HROT 等）
  - 暂不做规则持久化（localStorage/导入导出）
  - 暂不做播放中切换规则（必须先 Pause）
  - 不引入第三方依赖与打包链路

## 1. 影响范围（必须）
- 影响的 repo（来自 docmap，可多项）：lifegame-plus
- 影响的模块/目录/文件（按 repo 分组列出即可）：
  - `src/lifegame-plus/web/index.html`：右侧规则面板 DOM（规则集下拉 + 原子规则卡片 + 当前规则显示）
  - `src/lifegame-plus/web/main.js`：维护 `currentRule` 状态；暂停时允许更新；演进时将 `currentRule` 传入 `step(grid, currentRule)`
  - `src/lifegame-plus/web/style.css`：整体布局改为“左侧画布 + 右侧面板”，并对规则面板做滚动与可视化样式
  - （预期不改）`src/lifegame-plus/engine/lifegame.js`：当前已支持 `step(grid, rule?)`，优先复用
- 外部可见变化：
  - 页面右侧出现规则面板
  - 规则可在暂停时切换；播放中规则面板被禁用

## 2. 方案与改动点（必须）
说明：实现将按批次推进；每批次写入前需先列出本批次改动文件/影响并征求确认。

- repo: lifegame-plus
  - 改动点：
    - UI：右侧规则面板分三块：
      - **规则集（下拉）**：`<select>` 展示经典规则集（名称 + `B.../S...`），选择后应用并同步下方原子规则卡片的勾选状态
      - **原子规则（可视化卡片）**：
        - Birth：9 张卡片（n=0..8），每张卡表示“中心死 + n 个邻居 → 下一步中心活/死”
        - Survive：9 张卡片（n=0..8），每张卡表示“中心活 + n 个邻居 → 下一步中心活/死”
        - 每张卡片使用 3×3 ASCII/像素风格小图：`A → B`（B 图也为 3×3，只改变中心格）
      - **当前规则**：显示为 `B.../S...`，并与 UI 状态实时同步
    - 逻辑：
      - `currentRule = { birth: number[], survive: number[] }`
      - 仅在 `paused` 时允许更改 `currentRule`（播放中 disable 整个面板）
      - 每次演进使用 `step(grid, currentRule)`
      - 面板显示当前规则字符串（例如 `B3/S23`），并与下拉/卡片勾选状态保持一致
  - 新增/修改的接口或数据结构：
    - web 内新增：`formatRule(rule) -> "B.../S..."`、`applyPreset(preset) -> rule`、`ruleFromCheckboxes() -> rule`
  - 可视化口径（重要，避免误导）：
    - Life-like 规则只依赖“邻居数量 n”，不依赖邻居几何位置；A 图的邻居摆放仅用于示意。
    - A 图邻居示意摆放采用固定顺序：从 **N 开始顺时针** 填充（N → NE → E → SE → S → SW → W → NW）。
    - 每张卡必须标注 `n=...`（例如 `Birth n=3`），避免用户把示意摆放当成几何条件。
  - 经典规则集（初始内置，后续可扩充）：
    - Conway's Life：B3/S23
    - HighLife：B36/S23
    - Seeds：B2/S
    - Day & Night：B3678/S34678
    - Life without Death：B3/S012345678
    - 2x2：B36/S125
    - Diamoeba：B35678/S5678
    - Replicator：B1357/S1357
    - Morley：B368/S245

## 3. 自测与验收口径（必须，可执行）
- 本地自测步骤：
  1. 根目录：`python3 -m http.server 8000`
  2. 打开：`http://127.0.0.1:8000/src/lifegame-plus/web/`
  3. 播放中确认规则面板为禁用状态；点击 `Pause` 后面板可操作
  4. 暂停状态下切换规则集下拉，确认“当前规则字符串”与原子规则卡片同步变化；再次 `Play` 后从当前状态继续演进
  5. 暂停状态下勾选/取消若干原子规则卡片，确认“当前规则字符串”即时更新；再次 `Play` 后按新规则演进
- 关键用例清单：
  - 播放中无法修改规则（控件禁用/不生效）
  - 暂停中可修改规则集/原子规则，修改立即反映到“当前规则字符串”
  - 修改规则不会重置棋盘状态（继续演进）
  - 现有 `Play/Pause` 与 `Speed` 下拉不回归
- 通过标准：
  - 页面右侧出现规则面板，并包含“规则集下拉 + 原子规则 A→B 卡片”
  - “暂停才能切换规则”的约束可验证
  - 规则切换后继续演进且无报错

- 自测记录（实现方）：
  - 引擎 smoke：
    ```sh
    node --input-type=module - <<'NODE'
    import { createGrid, seedGlider, step } from './src/lifegame-plus/engine/lifegame.js';

    const presets = [
      { birth: [3], survive: [2, 3] },
      { birth: [3, 6], survive: [2, 3] },
      { birth: [2], survive: [] },
      { birth: [3, 6, 7, 8], survive: [3, 4, 6, 7, 8] },
    ];

    let g = seedGlider(createGrid(10, 10), 1, 1);
    for (const rule of presets) {
      g = step(g, rule);
    }
    console.log('ok', g.width, g.height, g.cells.length);
    NODE
    ```
    输出：`ok 10 10 100`
  - UI 手动：用户验收通过（播放中禁用面板、暂停可切换、切换后继续演进）

## 4. SOT 更新清单（必须）
用户验收通过后更新：
- `docs/sot/overview.md`：补充“可视化规则面板”能力与暂停切换约束
- `docs/sot/architecture.md`：补充规则数据结构与 `step(grid, rule)` 的使用方式；说明规则面板仅暂停可编辑；说明“原子规则卡片”与 `B.../S...` 的映射

## 5. 完成后归档动作（固定）
1) 输出交付摘要并请求用户验收
2) 用户验收通过后，按第 4 节更新 SOT
3) 更新第 6 节检查单（必须全勾）
4) 将整个目录从 `docs/wip/20260110-rule-panel/` 移动到 `docs/archive/20260110-rule-panel/`

## 6. WIP 检查单（必须全勾才能归档）
- [x] plan.md 已确认（PLAN 闸门已通过）
- [x] 代码改动已完成（IMPLEMENT 完成）
- [x] 基本自测已完成（记录命令/步骤与结果）
- [x] 已输出交付摘要并且用户验收通过（VERIFY 闸门已通过）
- [x] SOT 已更新（按第 4 节执行）：`docs/sot/overview.md`、`docs/sot/architecture.md`
- [x] 已归档：wip → archive（目录已移动）
