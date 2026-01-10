# lifegame-plus Web MVP 初始化（Plan）

## 0. 背景与目标（简短即可）
- 背景：当前仓库为初始占位状态（docs/sot 仍为 TODO，src 仅有 .gitkeep），需要先落地一个可运行的“生命游戏”最小形态，作为后续扩展（plus）的基座。
- 目标：在不依赖网络安装第三方包的前提下，初始化单一 repo：`lifegame-plus`（`src/lifegame-plus/`），实现纯前端运行的 Web 演示版：
  - 固定网格：100×100
  - 边界：环绕（toroidal）
  - 初始状态：固定 glider
  - 交互：单一按钮 `Play/Pause`（开始播放/再次点击暂停）
  - 运行形态：无后端、无持续网络交互（除首次加载静态文件外）
- 非目标：不做编辑/拖拽绘制、单步/清空/随机、速度滑条、缩放平移、存档回放、部署/上线、CI/CD；不引入大型框架与打包链路；不做性能极致优化。

## 1. 影响范围（必须）
- 影响的 repo（来自 docmap，可多项）：lifegame-plus
- 影响的模块/目录/文件（按 repo 分组列出即可）：
  - lifegame-plus：`src/lifegame-plus/`
    - `engine/`：核心引擎（纯函数演进 + 环绕边界）
    - `web/`：静态站点（Canvas 渲染 + 单一 Play/Pause 按钮）
- 外部可见变化（如适用：API/CLI/配置/数据格式）：
  - 新增本地打开方式：在项目根目录运行 `python3 -m http.server 8000` 后，浏览器打开 `http://localhost:8000/src/lifegame-plus/web/`
  - 新增 JS 模块 API：`src/lifegame-plus/engine/` 导出 `step` 等函数供 `web/` 调用（ES Module）

## 2. 方案与改动点（必须）
说明：实现将按批次推进；每批次写入前需先列出本批次改动文件/影响并征求确认。

- repo: lifegame-plus
  - 改动点：
    - `engine/`：实现生命游戏核心逻辑（B3/S23）：网格表示、邻居计数、规则演进；边界为环绕（toroidal）。
    - `engine/`：提供纯函数 API（输入当前状态，输出下一状态）；并支持注入规则配置（为后续“自定义规则”预留扩展点）。
    - `web/`：提供最小可运行 UI：Canvas 绘制 100×100；单一按钮 `Play/Pause`；初始固定 glider；播放时定时 step 并渲染。
    - `web/`：通过 ES Module 直接引用 `engine/`（不引入打包器；所有逻辑在浏览器内运行）。
  - 新增/修改的接口或数据结构：
    - `createGrid(width, height)` / `seedGlider(grid, x, y)` / `step(grid, rule?)`
    - `rule`（可选，预留扩展）：`birth`（默认 `[3]`）、`survive`（默认 `[2,3]`）
  - 关键逻辑说明：
    - 所有演进在浏览器内存中完成；播放循环不产生网络请求（除首次加载静态文件）。
    - 默认使用扁平数组存储；`step` 生成下一帧，避免原地更新污染邻居统计。
    - 邻居统计采用环绕取模坐标（toroidal）。

## 3. 自测与验收口径（必须，可执行）
- 本地自测步骤（命令/操作）：
  1. 在项目根目录运行：`python3 -m http.server 8000`
  2. 浏览器打开：`http://localhost:8000/src/lifegame-plus/web/`
  3. 点击 `Play`，确认开始演进；再次点击按钮，确认暂停；重复切换多次无异常
- 关键用例清单：
  - 规则正确性：glider 形态与移动方向正确；在环绕边界下跨越边缘后继续出现并保持演进。
  - 交互正确性：`Play/Pause` 切换稳定，不会卡死或出现明显异常闪烁。
- 通过标准：
  - 打开页面可看到 100×100 网格与一个 `Play/Pause` 按钮，按钮行为符合预期
  - glider 在播放时持续演进，且能在边缘环绕后继续出现并保持正确演进

交付摘要口径（固定）：实现完成后，必须输出交付摘要，包含：
- 实际改动清单（按 repo 列出关键文件/模块）
- 自测步骤与结果
- 对照本节“通过标准”的逐条结论
- 已知风险/未决事项（如有必须列出）

约束：用户验收通过前，不更新 SOT，不归档 WIP。

## 4. SOT 更新清单（必须）
用户验收通过后，要把“最终事实”沉淀到 SOT（至少文件级，V1 不要求精确到小节）：

- docs/sot/overview.md：补齐“项目是什么”、repo 职责（`engine/`/`web/`）、最小本地运行方式（含 `python3 -m http.server` 与入口页面路径）
- docs/sot/architecture.md：补齐模块边界（`engine/` 核心引擎、`web/` UI）、关键约束（纯前端运行、默认 100×100、toroidal 边界、rule 可配置）、模块交互方式（ESM 导入）

## 5. 完成后归档动作（固定）
实现完成并完成基本自测后：
1) 输出交付摘要并请求用户验收
2) 用户验收通过后，按第 4 节更新 SOT
3) 更新第 6 节检查单（必须全勾）
4) 将整个目录从 docs/wip/20260110-lifegame-plus-init/ 移动到 docs/archive/20260110-lifegame-plus-init/

## 6. WIP 检查单（必须全勾才能归档）
- [x] plan.md 已确认（PLAN 闸门已通过）
- [x] 代码改动已完成（IMPLEMENT 完成）
- [x] 基本自测已完成（记录命令/步骤与结果）
- [x] 已输出交付摘要并且用户验收通过（VERIFY 闸门已通过）
- [x] SOT 已更新（按第 4 节执行；列出更新的文件）
- [x] 已归档：wip → archive（目录已移动）
