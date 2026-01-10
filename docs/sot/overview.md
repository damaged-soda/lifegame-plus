# 项目概览（SOT）

Last Updated: 2026-01-10

## 项目是什么
`lifegame-plus` 是一个纯前端 Web 版“生命游戏”（Conway's Game of Life）MVP：固定 100×100 网格、默认环绕边界（toroidal）、初始状态为 glider，提供单一 `Play/Pause` 按钮控制演进。

## Repo 列表与职责（与 docmap 对齐）
- lifegame-plus（入口：`src/lifegame-plus/`）
  - `engine/`：生命游戏核心引擎（纯函数演进、默认规则 B3/S23，可注入 rule 配置为后续扩展预留）
  - `web/`：浏览器 UI（Canvas 渲染 + 单一 `Play/Pause` 按钮）

## 本地开发最小路径（只到开发自测）
- 启动静态服务：在项目根目录执行 `python3 -m http.server 8000`
- 打开页面：浏览器访问 `http://127.0.0.1:8000/src/lifegame-plus/web/`
- 自测要点：
  - 点击 `Play` 开始演进，再次点击暂停；glider 跨越边界后会从另一侧继续出现（环绕边界）
  - 通过 `Speed` 下拉选择 x0.5/x1/x2/x5/x10/x20/x50/x100，播放中切换后立即生效
