import {
  CELL_TYPE,
  createGrid,
  stepDirectional,
} from "../engine/lifegame.js";

const GRID_WIDTH = 100;
const GRID_HEIGHT = 100;
const RENDER_SCALE = 6;
const CELL_RENDER_PIXELS = 3;
const BASE_STEP_INTERVAL_MS = 100;
const MAX_STEPS_PER_FRAME = 500;

const COLOR_A = Object.freeze([255, 208, 0]);
const COLOR_B = Object.freeze([0, 200, 0]);
const COLOR_C = Object.freeze([0, 190, 255]);

const canvas = document.getElementById("grid");
const toggleButton = document.getElementById("toggle");
const resetButton = document.getElementById("reset");
const speedSelect = document.getElementById("speed");
const rulePanel = document.getElementById("rulePanel");
const rulePanelState = document.getElementById("rulePanelState");
const rulesetSelect = document.getElementById("rulesetSelect");
const seedInput = document.getElementById("seedInput");
const retryButton = document.getElementById("retry");
const birthRules = document.getElementById("birthRules");
const deathRules = document.getElementById("deathRules");
const metaExclusiveCell = document.getElementById("metaExclusiveCell");
const metaEndOnTop = document.getElementById("metaEndOnTop");
const gameStatus = document.getElementById("gameStatus");

if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("缺少 <canvas id=\"grid\">");
}
if (!(toggleButton instanceof HTMLButtonElement)) {
  throw new Error("缺少 <button id=\"toggle\">");
}
if (!(resetButton instanceof HTMLButtonElement)) {
  throw new Error("缺少 <button id=\"reset\">");
}
if (!(speedSelect instanceof HTMLSelectElement)) {
  throw new Error("缺少 <select id=\"speed\">");
}
if (!(rulePanel instanceof HTMLFieldSetElement)) {
  throw new Error("缺少 <fieldset id=\"rulePanel\">");
}
if (!(rulePanelState instanceof HTMLElement)) {
  throw new Error("缺少 <span id=\"rulePanelState\">");
}
if (!(rulesetSelect instanceof HTMLSelectElement)) {
  throw new Error("缺少 <select id=\"rulesetSelect\">");
}
if (!(seedInput instanceof HTMLInputElement)) {
  throw new Error("缺少 <input id=\"seedInput\">");
}
if (!(retryButton instanceof HTMLButtonElement)) {
  throw new Error("缺少 <button id=\"retry\">");
}
if (!(birthRules instanceof HTMLElement)) {
  throw new Error("缺少 <div id=\"birthRules\">");
}
if (!(deathRules instanceof HTMLElement)) {
  throw new Error("缺少 <div id=\"deathRules\">");
}
if (!(metaExclusiveCell instanceof HTMLInputElement)) {
  throw new Error("缺少 <input id=\"metaExclusiveCell\">");
}
if (!(metaEndOnTop instanceof HTMLInputElement)) {
  throw new Error("缺少 <input id=\"metaEndOnTop\">");
}
if (!(gameStatus instanceof HTMLElement)) {
  throw new Error("缺少 <div id=\"gameStatus\">");
}

canvas.width = GRID_WIDTH * CELL_RENDER_PIXELS;
canvas.height = GRID_HEIGHT * CELL_RENDER_PIXELS;
canvas.style.width = `${GRID_WIDTH * RENDER_SCALE}px`;
canvas.style.height = `${GRID_HEIGHT * RENDER_SCALE}px`;

const ctx = canvas.getContext("2d", { alpha: false });
if (!ctx) throw new Error("无法获取 Canvas 2D 上下文");
ctx.imageSmoothingEnabled = false;

const imageData = ctx.createImageData(canvas.width, canvas.height);
const pixelData = imageData.data;

let grid = createGrid(GRID_WIDTH, GRID_HEIGHT);
let currentSeed = 0;
let nextRandom = Math.random;

const metaRules = {
  exclusiveCell: false,
  endOnTop: false,
};

const engineMetaRules = {
  exclusiveCell: false,
};

let gameOver = false;
let gameOverTopMask = 0;

function createPrng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateRandomSeed() {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] >>> 0;
  }
  return (Math.random() * 4294967296) >>> 0;
}

function parseSeedText(text) {
  const raw = String(text ?? "").trim();
  if (raw === "") return null;
  if (!/^[0-9]+$/.test(raw)) return null;
  const num = Number(raw);
  if (!Number.isSafeInteger(num)) return null;
  if (num < 0 || num > 0xffffffff) return null;
  return num >>> 0;
}

function formatTypeMask(mask) {
  const out = [];
  if (mask & CELL_TYPE.A) out.push("A");
  if (mask & CELL_TYPE.B) out.push("B");
  if (mask & CELL_TYPE.C) out.push("C");
  return out.length === 0 ? "无" : out.join("/");
}

function topRowTypeMask(currentGrid) {
  const topY = currentGrid.height - 1;
  if (topY < 0) return 0;

  let mask = 0;
  const rowStart = topY * currentGrid.width;
  for (let x = 0; x < currentGrid.width; x++) {
    mask |= currentGrid.cells[rowStart + x];
  }
  return mask & (CELL_TYPE.A | CELL_TYPE.B | CELL_TYPE.C);
}

function setGameStatus(text) {
  const value = String(text ?? "").trim();
  if (value === "") {
    gameStatus.textContent = "";
    gameStatus.classList.remove("is-visible");
    return;
  }
  gameStatus.textContent = value;
  gameStatus.classList.add("is-visible");
}

function clearGameOver() {
  gameOver = false;
  gameOverTopMask = 0;
  toggleButton.disabled = false;
  setGameStatus("");
}

function triggerGameOver(typeMask) {
  if (gameOver) return;
  gameOver = true;
  gameOverTopMask = typeMask & (CELL_TYPE.A | CELL_TYPE.B | CELL_TYPE.C);
  setGameStatus(`游戏结束：${formatTypeMask(gameOverTopMask)} 到达顶端`);
  setPlaying(false);
}

function normalizeGridExclusive(currentGrid) {
  const bitA = CELL_TYPE.A;
  const bitB = CELL_TYPE.B;
  const bitC = CELL_TYPE.C;

  let needsNormalize = false;
  for (let i = 0; i < currentGrid.cells.length; i++) {
    const cell = currentGrid.cells[i];
    if (cell === 0 || cell === bitA || cell === bitB || cell === bitC) continue;
    needsNormalize = true;
    break;
  }

  if (!needsNormalize) return currentGrid;

  const nextCells = new Uint8Array(currentGrid.cells);
  for (let i = 0; i < nextCells.length; i++) {
    const cell = nextCells[i];
    if (cell === 0 || cell === bitA || cell === bitB || cell === bitC) continue;

    const hasA = (cell & bitA) !== 0;
    const hasB = (cell & bitB) !== 0;
    const hasC = (cell & bitC) !== 0;
    const count = (hasA ? 1 : 0) + (hasB ? 1 : 0) + (hasC ? 1 : 0);
    if (count <= 1) {
      nextCells[i] = cell & (bitA | bitB | bitC);
      continue;
    }

    let pick = Math.floor(nextRandom() * count);
    if (hasA) {
      if (pick === 0) {
        nextCells[i] = bitA;
        continue;
      }
      pick--;
    }
    if (hasB) {
      if (pick === 0) {
        nextCells[i] = bitB;
        continue;
      }
      pick--;
    }
    nextCells[i] = bitC;
  }

  return {
    width: currentGrid.width,
    height: currentGrid.height,
    cells: nextCells,
  };
}

function applySeed(seed, { rerollGrid } = {}) {
  currentSeed = seed >>> 0;
  nextRandom = createPrng(currentSeed);
  seedInput.value = String(currentSeed);
  if (rerollGrid) {
    clearGameOver();
    setPlaying(false);
    randomizeGrid();
  }
}

function initSeedControls() {
  applySeed(generateRandomSeed());

  const applyFromInput = () => {
    const parsed = parseSeedText(seedInput.value);
    if (parsed === null) {
      seedInput.value = String(currentSeed);
      return;
    }
    applySeed(parsed, { rerollGrid: true });
  };

  seedInput.addEventListener("change", () => {
    if (rulePanel.disabled) return;
    applyFromInput();
  });

  seedInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    if (rulePanel.disabled) return;
    event.preventDefault();
    applyFromInput();
    seedInput.blur();
  });

  retryButton.addEventListener("click", () => {
    if (rulePanel.disabled) return;
    applySeed(generateRandomSeed(), { rerollGrid: true });
  });
}

function resetGrid() {
  grid = createGrid(GRID_WIDTH, GRID_HEIGHT);
  render(grid);
}

const DIRECTION_LABELS = Object.freeze(["上", "右上", "右", "右下", "下", "左下", "左", "左上"]);
const DIRECTION_MASK = Object.freeze({
  N: 1 << 0,
  NE: 1 << 1,
  E: 1 << 2,
  SE: 1 << 3,
  S: 1 << 4,
  SW: 1 << 5,
  W: 1 << 6,
  NW: 1 << 7,
});

function formatDirectionMask(mask) {
  const out = [];
  for (let bit = 0; bit < 8; bit++) {
    if ((mask & (1 << bit)) !== 0) out.push(DIRECTION_LABELS[bit]);
  }
  return out.length === 0 ? "无" : out.join(" ");
}

function normalizeProbability(value) {
  if (!Number.isFinite(value)) return 1;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function clampInt(value, min, max) {
  const num = Number(value);
  if (!Number.isFinite(num)) return min;
  return Math.min(max, Math.max(min, Math.trunc(num)));
}

function createRuleDef(name, mustAliveMasks, mustDeadMask = 0, enabledByDefault = false, p = 1) {
  const masks = Array.isArray(mustAliveMasks) ? mustAliveMasks.slice() : [mustAliveMasks];
  return Object.freeze({
    name,
    mustAliveMasks: Object.freeze(masks),
    mustDeadMask,
    enabledByDefault,
    p: normalizeProbability(p),
  });
}

const RULE_SETS = Object.freeze([
  {
    id: "expand",
    name: "扩展",
    birthRules: Object.freeze([
      createRuleDef("横向扩展", [DIRECTION_MASK.W, DIRECTION_MASK.E], 0, true),
      createRuleDef("纵向扩展（向上）", DIRECTION_MASK.S, 0, true),
      createRuleDef(
        "支撑生长（需要下/左下/右下）",
        DIRECTION_MASK.S | DIRECTION_MASK.SW | DIRECTION_MASK.SE,
        0,
        false,
      ),
    ]),
    deathRules: Object.freeze([]),
  },
]);

function createRuleState(def, kind) {
  return {
    name: def.name,
    mustAliveMasks: def.mustAliveMasks.slice(),
    mustDeadMask: def.mustDeadMask,
    enabled: Boolean(def.enabledByDefault),
    p: kind === "birth" ? normalizeProbability(def.p) : 1,
  };
}

function buildEngineRuleSet(state) {
  const birthRulesOut = [];
  const deathRulesOut = [];

  for (const rule of state.birthRules) {
    if (!rule.enabled) continue;
    for (const mustAliveMask of rule.mustAliveMasks) {
      birthRulesOut.push(Object.freeze({ mustAliveMask, mustDeadMask: rule.mustDeadMask, p: rule.p }));
    }
  }
  for (const rule of state.deathRules) {
    if (!rule.enabled) continue;
    for (const mustAliveMask of rule.mustAliveMasks) {
      deathRulesOut.push(Object.freeze({ mustAliveMask, mustDeadMask: rule.mustDeadMask }));
    }
  }

  return Object.freeze({
    birthRules: Object.freeze(birthRulesOut),
    deathRules: Object.freeze(deathRulesOut),
  });
}

const MINI_DIR_BITS = Object.freeze([
  [7, 0, 1],
  [6, null, 2],
  [5, 4, 3],
]);

function createMiniGrid(masks, { centerAlive, variant }) {
  const mustAliveMask = masks?.mustAliveMask ?? 0;
  const mustDeadMask = masks?.mustDeadMask ?? 0;
  const el = document.createElement("div");
  el.className = `mini-grid ${variant}`;

  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      const cell = document.createElement("div");
      cell.className = "mini-cell";

      const isCenter = x === 1 && y === 1;
      if (isCenter) {
        cell.classList.add("is-center");
        if (centerAlive) cell.classList.add("is-alive");
        el.append(cell);
        continue;
      }

      const bit = MINI_DIR_BITS[y][x];
      if (bit !== null) {
        const mask = 1 << bit;
        if ((mustAliveMask & mask) !== 0) cell.classList.add("is-alive");
        if ((mustDeadMask & mask) !== 0) cell.classList.add("is-required-dead");
      }

      el.append(cell);
    }
  }

  return el;
}

function formatDirectionVariants(masks) {
  if (!Array.isArray(masks) || masks.length === 0) return "无";
  if (masks.length === 1) return formatDirectionMask(masks[0]);
  return masks.map((m) => formatDirectionMask(m)).join(" 或 ");
}

function formatRuleMeta(rule) {
  const alive = formatDirectionVariants(rule.mustAliveMasks);
  const dead = formatDirectionMask(rule.mustDeadMask);
  return `活：${alive} 空：${dead}`;
}

let ruleCardId = 0;

function createDirectionalRuleCard(kind, rule) {
  const container = document.createElement("div");
  container.className = "rule-card";

  const toggle = document.createElement("input");
  toggle.className = "rule-card-toggle";
  toggle.type = "checkbox";
  toggle.checked = rule.enabled;
  toggle.id = `rule-${kind}-${ruleCardId++}`;

  const body = document.createElement("div");
  body.className = "rule-card-body";

  const toggleArea = document.createElement("label");
  toggleArea.className = "rule-card-toggle-area";
  toggleArea.htmlFor = toggle.id;

  const title = document.createElement("div");
  title.className = "rule-card-title";

  const nameEl = document.createElement("div");
  nameEl.className = "rule-card-kind";
  nameEl.textContent = rule.name;

  const metaEl = document.createElement("div");
  metaEl.className = "rule-card-n";
  metaEl.textContent = formatRuleMeta(rule);

  title.append(nameEl, metaEl);

  const variantMasks = Array.isArray(rule.mustAliveMasks) ? rule.mustAliveMasks : [0];
  const visualRows = [];
  for (const mustAliveMask of variantMasks) {
    const visual = document.createElement("div");
    visual.className = "rule-visual";

    const masks = { mustAliveMask, mustDeadMask: rule.mustDeadMask };

    const beforeGrid = createMiniGrid(masks, {
      centerAlive: kind === "death",
      variant: "mini-before",
    });

    const arrow = document.createElement("div");
    arrow.className = "rule-arrow";
    arrow.textContent = "→";

    const afterGrid = createMiniGrid(masks, {
      centerAlive: kind === "birth",
      variant: "mini-after",
    });

    visual.append(beforeGrid, arrow, afterGrid);
    visualRows.push(visual);
  }

  let visualEl = visualRows[0];
  if (visualRows.length > 1) {
    const variants = document.createElement("div");
    variants.className = "rule-visual-variants";
    variants.append(...visualRows);
    visualEl = variants;
  }

  toggleArea.append(title, visualEl);
  body.append(toggleArea);

  let probInput = null;
  if (kind === "birth") {
    const probRow = document.createElement("div");
    probRow.className = "rule-card-prob";

    const probLabel = document.createElement("label");
    probLabel.className = "rule-prob";

    const probText = document.createElement("span");
    probText.className = "rule-prob-label";
    probText.textContent = "概率";

    probInput = document.createElement("input");
    probInput.className = "rule-prob-input";
    probInput.type = "number";
    probInput.min = "0";
    probInput.max = "100";
    probInput.step = "1";
    probInput.value = String(Math.round(rule.p * 100));

    const probSuffix = document.createElement("span");
    probSuffix.className = "rule-prob-suffix";
    probSuffix.textContent = "%";

    probLabel.append(probText, probInput, probSuffix);
    probRow.append(probLabel);
    body.append(probRow);
  }

  container.append(toggle, body);
  return { card: container, toggle, probInput };
}

let currentRuleState = null;
let currentEngineRuleSet = buildEngineRuleSet({ birthRules: [], deathRules: [] });

function setRulePanelEnabled(enabled) {
  rulePanel.disabled = !enabled;
  if (!enabled) {
    rulePanelState.textContent = "播放中（先暂停再调整规则）";
    return;
  }
  rulePanelState.textContent = gameOver ? "已结束" : "已暂停";
}

function renderRuleCards() {
  if (!currentRuleState) return;

  birthRules.replaceChildren();
  deathRules.replaceChildren();

  for (const rule of currentRuleState.birthRules) {
    const card = createDirectionalRuleCard("birth", rule);
    card.toggle.addEventListener("change", () => {
      if (rulePanel.disabled) return;
      rule.enabled = card.toggle.checked;
      currentEngineRuleSet = buildEngineRuleSet(currentRuleState);
    });
    if (card.probInput) {
      const onProbChange = () => {
        if (rulePanel.disabled) return;
        const percent = clampInt(card.probInput.value, 0, 100);
        card.probInput.value = String(percent);
        rule.p = percent / 100;
        currentEngineRuleSet = buildEngineRuleSet(currentRuleState);
      };
      card.probInput.addEventListener("change", onProbChange);
      card.probInput.addEventListener("input", onProbChange);
    }
    birthRules.append(card.card);
  }

  for (const rule of currentRuleState.deathRules) {
    const card = createDirectionalRuleCard("death", rule);
    card.toggle.addEventListener("change", () => {
      if (rulePanel.disabled) return;
      rule.enabled = card.toggle.checked;
      currentEngineRuleSet = buildEngineRuleSet(currentRuleState);
    });
    deathRules.append(card.card);
  }
}

function loadRuleSetById(id) {
  const def = RULE_SETS.find((set) => set.id === id);
  if (!def) return;

  currentRuleState = {
    id: def.id,
    birthRules: def.birthRules.map((r) => createRuleState(r, "birth")),
    deathRules: def.deathRules.map((r) => createRuleState(r, "death")),
  };

  currentEngineRuleSet = buildEngineRuleSet(currentRuleState);
  rulesetSelect.value = def.id;
  renderRuleCards();
}

function initRulePanel() {
  for (const set of RULE_SETS) {
    const option = document.createElement("option");
    option.value = set.id;
    option.textContent = set.name;
    rulesetSelect.append(option);
  }

  rulesetSelect.addEventListener("change", () => {
    if (rulePanel.disabled) return;
    loadRuleSetById(rulesetSelect.value);
  });

  loadRuleSetById(RULE_SETS[0]?.id ?? "");
  setRulePanelEnabled(true);
}

function initMetaRules() {
  metaExclusiveCell.checked = metaRules.exclusiveCell;
  metaEndOnTop.checked = metaRules.endOnTop;

  metaExclusiveCell.addEventListener("change", () => {
    if (rulePanel.disabled) return;
    metaRules.exclusiveCell = metaExclusiveCell.checked;
    engineMetaRules.exclusiveCell = metaRules.exclusiveCell;

    if (metaRules.exclusiveCell) {
      grid = normalizeGridExclusive(grid);
      render(grid);
      if (metaRules.endOnTop && !gameOver) {
        const topMask = topRowTypeMask(grid);
        if (topMask) triggerGameOver(topMask);
      }
    }
  });

  metaEndOnTop.addEventListener("change", () => {
    if (rulePanel.disabled) return;
    metaRules.endOnTop = metaEndOnTop.checked;
    if (metaRules.endOnTop && !gameOver) {
      const topMask = topRowTypeMask(grid);
      if (topMask) triggerGameOver(topMask);
    }
  });
}

function render(currentGrid) {
  const cells = currentGrid.cells;
  pixelData.fill(255);

  const canvasWidth = canvas.width;

  function setPixel(px, py, color) {
    const offset = (py * canvasWidth + px) * 4;
    pixelData[offset] = color[0];
    pixelData[offset + 1] = color[1];
    pixelData[offset + 2] = color[2];
    pixelData[offset + 3] = 255;
  }

  function drawCentered(color, baseX, baseY) {
    const cx = baseX + 1;
    const cy = baseY + 1;
    setPixel(cx, cy, color);
    setPixel(cx, cy - 1, color);
    setPixel(cx, cy + 1, color);
    setPixel(cx - 1, cy, color);
    setPixel(cx + 1, cy, color);
  }

  function drawMulti(cell, baseX, baseY) {
    if (cell & CELL_TYPE.A) setPixel(baseX + 1, baseY + 0, COLOR_A);
    if (cell & CELL_TYPE.B) setPixel(baseX + 2, baseY + 2, COLOR_B);
    if (cell & CELL_TYPE.C) setPixel(baseX + 0, baseY + 2, COLOR_C);
  }

  for (let y = 0; y < GRID_HEIGHT; y++) {
    const row = y * GRID_WIDTH;
    const baseY = (GRID_HEIGHT - 1 - y) * CELL_RENDER_PIXELS;

    for (let x = 0; x < GRID_WIDTH; x++) {
      const cell = cells[row + x];
      if (cell === 0) continue;

      const hasA = (cell & CELL_TYPE.A) !== 0;
      const hasB = (cell & CELL_TYPE.B) !== 0;
      const hasC = (cell & CELL_TYPE.C) !== 0;
      const typeCount = (hasA ? 1 : 0) + (hasB ? 1 : 0) + (hasC ? 1 : 0);

      const baseX = x * CELL_RENDER_PIXELS;

      if (typeCount === 1) {
        const color = hasA ? COLOR_A : hasB ? COLOR_B : COLOR_C;
        drawCentered(color, baseX, baseY);
      } else {
        drawMulti(cell, baseX, baseY);
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

initRulePanel();
initSeedControls();
initMetaRules();
randomizeGrid();

let rafId = null;
let lastTimestamp = null;
let accumulatorMs = 0;

function readSpeedFactor() {
  const value = Number(speedSelect.value);
  if (!Number.isFinite(value) || value <= 0) return 1;
  return value;
}

let speedFactor = readSpeedFactor();
speedSelect.addEventListener("change", () => {
  speedFactor = readSpeedFactor();
});

function randomizeGrid() {
  const nextGrid = createGrid(GRID_WIDTH, GRID_HEIGHT);
  const y = 0;
  const rowStart = y * GRID_WIDTH;

  if (metaRules.exclusiveCell) {
    const used = new Set();
    const pickUniqueX = () => {
      for (let tries = 0; tries < GRID_WIDTH * 3; tries++) {
        const x = Math.floor(nextRandom() * GRID_WIDTH);
        if (used.has(x)) continue;
        used.add(x);
        return x;
      }
      for (let x = 0; x < GRID_WIDTH; x++) {
        if (used.has(x)) continue;
        used.add(x);
        return x;
      }
      return 0;
    };

    nextGrid.cells[rowStart + pickUniqueX()] = CELL_TYPE.A;
    nextGrid.cells[rowStart + pickUniqueX()] = CELL_TYPE.B;
    nextGrid.cells[rowStart + pickUniqueX()] = CELL_TYPE.C;
  } else {
    nextGrid.cells[rowStart + Math.floor(nextRandom() * GRID_WIDTH)] |= CELL_TYPE.A;
    nextGrid.cells[rowStart + Math.floor(nextRandom() * GRID_WIDTH)] |= CELL_TYPE.B;
    nextGrid.cells[rowStart + Math.floor(nextRandom() * GRID_WIDTH)] |= CELL_TYPE.C;
  }

  grid = nextGrid;
  render(grid);

  if (metaRules.endOnTop && !gameOver) {
    const topMask = topRowTypeMask(grid);
    if (topMask) triggerGameOver(topMask);
  }
}

function loop(timestamp) {
  if (rafId === null) return;

  if (lastTimestamp === null) {
    lastTimestamp = timestamp;
    rafId = window.requestAnimationFrame(loop);
    return;
  }

  const deltaMsRaw = timestamp - lastTimestamp;
  const deltaMs = Math.max(0, Math.min(250, deltaMsRaw));
  lastTimestamp = timestamp;
  accumulatorMs += deltaMs;

  const stepMs = BASE_STEP_INTERVAL_MS / speedFactor;

  let stepsThisFrame = 0;
  while (accumulatorMs >= stepMs && stepsThisFrame < MAX_STEPS_PER_FRAME) {
    grid = stepDirectional(grid, currentEngineRuleSet, nextRandom, engineMetaRules);
    accumulatorMs -= stepMs;
    stepsThisFrame++;

    if (metaRules.endOnTop && !gameOver) {
      const topMask = topRowTypeMask(grid);
      if (topMask) {
        triggerGameOver(topMask);
        break;
      }
    }

    if (rafId === null) break;
  }

  if (stepsThisFrame > 0) render(grid);

  if (rafId === null) return;
  rafId = window.requestAnimationFrame(loop);
}

function setPlaying(nextPlaying) {
  if (nextPlaying) {
    if (gameOver) return;
    if (metaRules.endOnTop) {
      const topMask = topRowTypeMask(grid);
      if (topMask) {
        triggerGameOver(topMask);
        return;
      }
    }
    if (rafId !== null) return;
    toggleButton.disabled = false;
    toggleButton.textContent = "暂停";
    setRulePanelEnabled(false);
    canvas.classList.add("is-playing");
    lastTimestamp = null;
    accumulatorMs = 0;
    rafId = window.requestAnimationFrame(loop);
    return;
  }

  if (rafId !== null) {
    window.cancelAnimationFrame(rafId);
    rafId = null;
  }
  toggleButton.disabled = gameOver;
  toggleButton.textContent = gameOver ? "已结束" : "播放";
  setRulePanelEnabled(true);
  canvas.classList.remove("is-playing");
  lastTimestamp = null;
  accumulatorMs = 0;
}

toggleButton.addEventListener("click", () => {
  setPlaying(rafId === null);
});

resetButton.addEventListener("click", () => {
  applySeed(currentSeed, { rerollGrid: true });
});
