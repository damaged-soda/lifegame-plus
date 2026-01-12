# 默认存活语义（只命中死亡规则才会死）技术变更计划（Plan）

## 0. 背景与目标（简短即可）
- 背景：
  - 当前方向规则体系使用两组规则：`birthRules`（空→活）与 `surviveRules`（活→活）。
  - 在这种语义下，如果未启用任何存活规则（或未命中），活细胞会默认死亡，导致“放上去的点很快消失”，不符合当前预期的交互直觉。
- 目标：
  - 调整规则语义为“默认存活”：
    - 空格：仅当命中“出生规则（空→活）”时才变活，否则保持空。
    - 活格：默认继续存活；仅当命中“死亡规则（活→空）”时才死亡。
  - 保持既有约束不变：
    - 仍为纯前端 Web（无后端）
    - 100×100
    - 边界：左右环绕、上下不环绕
    - A/B/C 三类型：同格可叠加；各类型只看同类型邻居独立演化；三类型共用一套规则
- 非目标：
  - 暂不引入跨类型影响/转换（A/B/C 之间互相作用）
  - 暂不实现棋盘编辑/画笔（保持当前结论）
  - 暂不新增“按高度 y 分层应用不同规则”的机制

## 1. 影响范围（必须）
- 影响的 repo（来自 docmap，可多项）：lifegame-plus
- 影响的模块/目录/文件（按 repo 分组列出即可）：
  - repo: lifegame-plus
    - `src/lifegame-plus/engine/lifegame.js`（方向规则集语义从 survive 改为 death）
    - `src/lifegame-plus/web/index.html`（规则面板文案：存活→死亡）
    - `src/lifegame-plus/web/main.js`（规则集/规则卡片展示与对接字段调整）
    - `src/lifegame-plus/web/style.css`（如需：文案/样式微调）
- 外部可见变化（如适用：API/CLI/配置/数据格式）：
  - 规则面板第二组规则从“存活（活→活）”变为“死亡（活→空）”
  - 规则语义改变：未命中规则时，活细胞不再默认死亡

## 2. 方案与改动点（必须）
说明：实现将按批次推进；每批次写入前需先列出本批次改动文件/影响并征求确认。

### 批次 1：Engine 语义改造（survive → death）
- repo: lifegame-plus
  - 改动点：
    - 引擎 `stepDirectional(...)`：活细胞逻辑从“命中 survive 才活”改为“命中 death 才死”
    - 规则集结构调整：从 `{ birthRules, surviveRules }` 改为 `{ birthRules, deathRules }`
  - 新增/修改的接口或数据结构：
    - `ruleSet = { birthRules: DirectionalRule[], deathRules: DirectionalRule[] }`
    - `DirectionalRule` 仍保持 `{ mustAliveMask, mustDeadMask }`（UI 可额外带 `name/enabled`，引擎只读取 mask）
  - 关键逻辑说明：
    - 空格：命中任一 `birthRules` → 活；否则空
    - 活格：命中任一 `deathRules` → 空；否则活

### 批次 2：Web UI/规则集对接（存活面板改为死亡面板）
- repo: lifegame-plus
  - 改动点：
    - 规则面板第二组标题/提示：从“存活（活→活）”改为“死亡（活→空）”
    - `RULE_SETS` 内的第二组规则字段从 `surviveRules` 改为 `deathRules`
    - 规则卡片的“后态”表现：死亡规则应表现为“活 → 空”
    - 面板交互限制保持：播放中禁用，暂停可调整
  - 新增/修改的接口或数据结构：无（仅字段改名与语义调整）
  - 关键逻辑说明：
    - UI 勾选规则后，构造 `currentEngineRuleSet = { birthRules, deathRules }` 传入引擎

## 3. 自测与验收口径（必须，可执行）
- 本地自测步骤（命令/操作）：
  1) `python3 -m http.server 8000`
  2) 打开 `http://127.0.0.1:8000/src/lifegame-plus/web/`
  3) 暂停状态下，把所有“死亡规则”都取消勾选，然后点击 `播放`
  4) 观察：已有的活点不会自行消失（默认存活）；只有当启用并命中死亡规则时才会消失
- 关键用例清单：
  - 默认存活：死亡规则全关时，已有活点长期不消失
  - 可杀死：启用一条明显会命中的死亡规则时，对应活点会消失
  - 行为隔离：A/B/C 仍只看同类型邻居（不存在跨类型误杀/误生）
  - 暂停约束：播放中无法改规则；暂停后修改立即生效
- 通过标准：
  - 规则语义符合“默认存活”：活细胞未命中死亡规则时不会死
  - UI 文案与卡片表现与“死亡规则（活→空）”一致
  - 引擎/页面行为仍保持：左右环绕、上下不环绕；100×100；纯前端

- 自测记录（2026-01-12）：
  - `node --check src/lifegame-plus/engine/lifegame.js`（通过）
  - `node --check src/lifegame-plus/web/main.js`（通过）
  - 浏览器手工验收：死亡规则全关时，初始活点不自行消失（用户验收通过）

交付摘要口径（固定）：实现完成后，必须输出交付摘要，包含：
- 实际改动清单（按 repo 列出关键文件/模块）
- 自测步骤与结果
- 对照本节“通过标准”的逐条结论
- 已知风险/未决事项（如有必须列出）

约束：用户验收通过前，不更新 SOT，不归档 WIP。

## 4. SOT 更新清单（必须）
用户验收通过后，要把“最终事实”沉淀到 SOT：

- `docs/sot/overview.md`：更新规则语义（默认存活 + 死亡规则）；更新规则面板描述（存活→死亡）
- `docs/sot/architecture.md`：更新方向规则数据结构（`deathRules`）与 `stepDirectional` 语义

## 5. 完成后归档动作（固定）
实现完成并完成基本自测后：
1) 输出交付摘要并请求用户验收
2) 用户验收通过后，按第 4 节更新 SOT
3) 更新第 6 节检查单（必须全勾）
4) 将整个目录从 `docs/wip/20260112-default-survive/` 移动到 `docs/archive/20260112-default-survive/`

## 6. WIP 检查单（必须全勾才能归档）
- [x] plan.md 已确认（PLAN 闸门已通过）
- [x] 代码改动已完成（IMPLEMENT 完成）
- [x] 基本自测已完成（记录命令/步骤与结果）
- [x] 已输出交付摘要并且用户验收通过（VERIFY 闸门已通过）
- [x] SOT 已更新（按第 4 节执行；`docs/sot/overview.md`、`docs/sot/architecture.md`）
- [x] 已归档：wip → archive（目录将移动到 `docs/archive/20260112-default-survive/`）
