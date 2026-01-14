const DEFAULT_RULE = Object.freeze({
  birth: Object.freeze([3]),
  survive: Object.freeze([2, 3]),
});

export const CELL_TYPE = Object.freeze({
  A: 1,
  B: 2,
  C: 4,
});

const RULE_CACHE = new Map();
const DIRECTIONAL_RULE_SET_CACHE = new WeakMap();

function assertPositiveInt(value, name) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
}

function assertGrid(grid) {
  assertPositiveInt(grid?.width, "grid.width");
  assertPositiveInt(grid?.height, "grid.height");
  if (!(grid?.cells instanceof Uint8Array) || grid.cells.length !== grid.width * grid.height) {
    throw new Error("grid.cells must be a Uint8Array of length width*height");
  }
}

function assertCellTypeBit(typeBit) {
  if (typeBit === CELL_TYPE.A || typeBit === CELL_TYPE.B || typeBit === CELL_TYPE.C) return;
  throw new Error("typeBit must be one of CELL_TYPE.A/CELL_TYPE.B/CELL_TYPE.C");
}

function compileRule(rule) {
  const birth = Array.isArray(rule?.birth) ? rule.birth : DEFAULT_RULE.birth;
  const survive = Array.isArray(rule?.survive) ? rule.survive : DEFAULT_RULE.survive;

  let birthBits = 0;
  let surviveBits = 0;

  for (const n of birth) {
    if (Number.isInteger(n) && n >= 0 && n <= 8) birthBits |= 1 << n;
  }
  for (const n of survive) {
    if (Number.isInteger(n) && n >= 0 && n <= 8) surviveBits |= 1 << n;
  }

  const cacheKey = birthBits | (surviveBits << 9);
  const cached = RULE_CACHE.get(cacheKey);
  if (cached) return cached;

  const compiled = { birthBits, surviveBits };
  RULE_CACHE.set(cacheKey, compiled);
  return compiled;
}

function wrappedX(width, x) {
  const xx = ((x % width) + width) % width;
  return xx;
}

function wrappedXIndexIfInBounds(width, height, x, y) {
  if (y < 0 || y >= height) return null;
  const xx = wrappedX(width, x);
  return y * width + xx;
}

export function createGrid(width, height) {
  assertPositiveInt(width, "width");
  assertPositiveInt(height, "height");

  return {
    width,
    height,
    cells: new Uint8Array(width * height),
  };
}

function seedPoints(grid, originX, originY, points, typeBit) {
  assertGrid(grid);
  assertCellTypeBit(typeBit);
  if (!Number.isInteger(originX) || !Number.isInteger(originY)) {
    throw new Error("originX/originY must be integers");
  }

  const nextCells = new Uint8Array(grid.cells);

  for (const [dx, dy] of points) {
    const idx = wrappedXIndexIfInBounds(grid.width, grid.height, originX + dx, originY + dy);
    if (idx === null) continue;
    nextCells[idx] |= typeBit;
  }

  return {
    width: grid.width,
    height: grid.height,
    cells: nextCells,
  };
}

export function seedGlider(grid, originX, originY, typeBit = CELL_TYPE.A) {
  return seedPoints(
    grid,
    originX,
    originY,
    [
      [1, 0],
      [2, 1],
      [0, 2],
      [1, 2],
      [2, 2],
    ],
    typeBit,
  );
}

export function seedLineVertical5(grid, originX, originY, typeBit = CELL_TYPE.A) {
  return seedPoints(
    grid,
    originX,
    originY,
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
      [0, 4],
    ],
    typeBit,
  );
}

export function seedLineHorizontal5(grid, originX, originY, typeBit = CELL_TYPE.B) {
  return seedPoints(
    grid,
    originX,
    originY,
    [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
      [4, 0],
    ],
    typeBit,
  );
}

export function step(grid, rule = DEFAULT_RULE) {
  assertGrid(grid);

  const width = grid.width;
  const height = grid.height;
  const { birthBits, surviveBits } = compileRule(rule);

  const nextCells = new Uint8Array(grid.cells.length);

  const bitA = CELL_TYPE.A;
  const bitB = CELL_TYPE.B;
  const bitC = CELL_TYPE.C;

  for (let y = 0; y < height; y++) {
    const hasYm1 = y > 0;
    const hasYp1 = y + 1 < height;

    const rowYm1 = hasYm1 ? (y - 1) * width : -1;
    const rowY = y * width;
    const rowYp1 = hasYp1 ? (y + 1) * width : -1;

    for (let x = 0; x < width; x++) {
      const xm1 = x === 0 ? width - 1 : x - 1;
      const xp1 = x === width - 1 ? 0 : x + 1;

      const idx = rowY + x;

      const n1 = hasYm1 ? grid.cells[rowYm1 + xm1] : 0;
      const n2 = hasYm1 ? grid.cells[rowYm1 + x] : 0;
      const n3 = hasYm1 ? grid.cells[rowYm1 + xp1] : 0;
      const n4 = grid.cells[rowY + xm1];
      const n5 = grid.cells[rowY + xp1];
      const n6 = hasYp1 ? grid.cells[rowYp1 + xm1] : 0;
      const n7 = hasYp1 ? grid.cells[rowYp1 + x] : 0;
      const n8 = hasYp1 ? grid.cells[rowYp1 + xp1] : 0;

      const neighborsA =
        (n1 & bitA ? 1 : 0) +
        (n2 & bitA ? 1 : 0) +
        (n3 & bitA ? 1 : 0) +
        (n4 & bitA ? 1 : 0) +
        (n5 & bitA ? 1 : 0) +
        (n6 & bitA ? 1 : 0) +
        (n7 & bitA ? 1 : 0) +
        (n8 & bitA ? 1 : 0);

      const neighborsB =
        (n1 & bitB ? 1 : 0) +
        (n2 & bitB ? 1 : 0) +
        (n3 & bitB ? 1 : 0) +
        (n4 & bitB ? 1 : 0) +
        (n5 & bitB ? 1 : 0) +
        (n6 & bitB ? 1 : 0) +
        (n7 & bitB ? 1 : 0) +
        (n8 & bitB ? 1 : 0);

      const neighborsC =
        (n1 & bitC ? 1 : 0) +
        (n2 & bitC ? 1 : 0) +
        (n3 & bitC ? 1 : 0) +
        (n4 & bitC ? 1 : 0) +
        (n5 & bitC ? 1 : 0) +
        (n6 & bitC ? 1 : 0) +
        (n7 & bitC ? 1 : 0) +
        (n8 & bitC ? 1 : 0);

      const current = grid.cells[idx];
      let next = 0;

      if (current & bitA) {
        if ((surviveBits >> neighborsA) & 1) next |= bitA;
      } else if ((birthBits >> neighborsA) & 1) {
        next |= bitA;
      }

      if (current & bitB) {
        if ((surviveBits >> neighborsB) & 1) next |= bitB;
      } else if ((birthBits >> neighborsB) & 1) {
        next |= bitB;
      }

      if (current & bitC) {
        if ((surviveBits >> neighborsC) & 1) next |= bitC;
      } else if ((birthBits >> neighborsC) & 1) {
        next |= bitC;
      }

      nextCells[idx] = next;
    }
  }

  return { width, height, cells: nextCells };
}

function normalizeNeighborMask(value) {
  if (!Number.isInteger(value)) return null;
  if (value < 0 || value > 0xff) return null;
  return value;
}

function normalizeProbability(value) {
  if (!Number.isFinite(value)) return 1;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function compileDirectionalRules(rules) {
  const aliveMasks = [];
  const deadMasks = [];

  for (const rule of rules ?? []) {
    const mustAliveMask = normalizeNeighborMask(rule?.mustAliveMask);
    const mustDeadMask = normalizeNeighborMask(rule?.mustDeadMask);
    if (mustAliveMask === null || mustDeadMask === null) continue;
    if ((mustAliveMask & mustDeadMask) !== 0) continue;
    aliveMasks.push(mustAliveMask);
    deadMasks.push(mustDeadMask);
  }

  return { aliveMasks, deadMasks };
}

function compileDirectionalBirthRules(rules) {
  const aliveMasks = [];
  const deadMasks = [];
  const probabilities = [];

  for (const rule of rules ?? []) {
    const mustAliveMask = normalizeNeighborMask(rule?.mustAliveMask);
    const mustDeadMask = normalizeNeighborMask(rule?.mustDeadMask);
    if (mustAliveMask === null || mustDeadMask === null) continue;
    if ((mustAliveMask & mustDeadMask) !== 0) continue;

    const p = normalizeProbability(rule?.p);
    aliveMasks.push(mustAliveMask);
    deadMasks.push(mustDeadMask);
    probabilities.push(p);
  }

  return { aliveMasks, deadMasks, probabilities };
}

function compileDirectionalRuleSet(ruleSet) {
  if (ruleSet && typeof ruleSet === "object") {
    const cached = DIRECTIONAL_RULE_SET_CACHE.get(ruleSet);
    if (cached) return cached;
  }

  const birthRules = Array.isArray(ruleSet?.birthRules) ? ruleSet.birthRules : [];
  const surviveRules = Array.isArray(ruleSet?.surviveRules) ? ruleSet.surviveRules : [];
  const deathRules = Array.isArray(ruleSet?.deathRules) ? ruleSet.deathRules : null;

  const mode = deathRules ? "death" : "survive";
  const aliveRules = deathRules ?? surviveRules;

  const compiled = Object.freeze({
    birth: compileDirectionalBirthRules(birthRules),
    alive: compileDirectionalRules(aliveRules),
    mode,
  });

  if (ruleSet && typeof ruleSet === "object") {
    DIRECTIONAL_RULE_SET_CACHE.set(ruleSet, compiled);
  }
  return compiled;
}

function matchesDirectionalRuleList(compiledRules, neighborMask) {
  const aliveMasks = compiledRules.aliveMasks;
  const deadMasks = compiledRules.deadMasks;

  for (let i = 0; i < aliveMasks.length; i++) {
    const mustAliveMask = aliveMasks[i];
    const mustDeadMask = deadMasks[i];
    if ((neighborMask & mustAliveMask) !== mustAliveMask) continue;
    if ((neighborMask & mustDeadMask) !== 0) continue;
    return true;
  }

  return false;
}

function matchesDirectionalBirthRuleList(compiledRules, neighborMask, nextRandom) {
  const aliveMasks = compiledRules.aliveMasks;
  const deadMasks = compiledRules.deadMasks;
  const probabilities = compiledRules.probabilities;

  let triggered = false;
  for (let i = 0; i < aliveMasks.length; i++) {
    const mustAliveMask = aliveMasks[i];
    const mustDeadMask = deadMasks[i];
    if ((neighborMask & mustAliveMask) !== mustAliveMask) continue;
    if ((neighborMask & mustDeadMask) !== 0) continue;

    const p = probabilities[i];
    const r = nextRandom();
    if (r < p) triggered = true;
  }

  return triggered;
}

function neighborMaskForType(typeBit, nN, nNE, nE, nSE, nS, nSW, nW, nNW) {
  let mask = 0;
  if (nN & typeBit) mask |= 1 << 0;
  if (nNE & typeBit) mask |= 1 << 1;
  if (nE & typeBit) mask |= 1 << 2;
  if (nSE & typeBit) mask |= 1 << 3;
  if (nS & typeBit) mask |= 1 << 4;
  if (nSW & typeBit) mask |= 1 << 5;
  if (nW & typeBit) mask |= 1 << 6;
  if (nNW & typeBit) mask |= 1 << 7;
  return mask;
}

function pickExclusiveTypeBitFromMask(mask, bitA, bitB, bitC, nextRandom) {
  const hasA = (mask & bitA) !== 0;
  const hasB = (mask & bitB) !== 0;
  const hasC = (mask & bitC) !== 0;
  const count = (hasA ? 1 : 0) + (hasB ? 1 : 0) + (hasC ? 1 : 0);
  if (count <= 1) return mask & (bitA | bitB | bitC);

  let pick = Math.floor(nextRandom() * count);
  if (hasA) {
    if (pick === 0) return bitA;
    pick--;
  }
  if (hasB) {
    if (pick === 0) return bitB;
    pick--;
  }
  return bitC;
}

function sanitizeCellsForExclusive(cells, bitA, bitB, bitC, nextRandom) {
  let needsSanitize = false;
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    if (cell === 0 || cell === bitA || cell === bitB || cell === bitC) continue;
    needsSanitize = true;
    break;
  }

  if (!needsSanitize) return cells;

  const out = new Uint8Array(cells.length);
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    if (cell === 0 || cell === bitA || cell === bitB || cell === bitC) {
      out[i] = cell;
      continue;
    }
    out[i] = pickExclusiveTypeBitFromMask(cell, bitA, bitB, bitC, nextRandom);
  }
  return out;
}

function survivesDirectional(mode, compiledAliveRules, neighborMask) {
  const matched = matchesDirectionalRuleList(compiledAliveRules, neighborMask);
  if (mode === "death") return !matched;
  return matched;
}

export function stepDirectional(grid, ruleSet, rng, metaRules) {
  assertGrid(grid);

  const width = grid.width;
  const height = grid.height;
  const compiled = compileDirectionalRuleSet(ruleSet);
  const mode = compiled.mode;
  const nextRandom = typeof rng === "function" ? rng : Math.random;
  const exclusiveCell = Boolean(metaRules?.exclusiveCell);

  const nextCells = new Uint8Array(grid.cells.length);

  const bitA = CELL_TYPE.A;
  const bitB = CELL_TYPE.B;
  const bitC = CELL_TYPE.C;
  const cells = exclusiveCell
    ? sanitizeCellsForExclusive(grid.cells, bitA, bitB, bitC, nextRandom)
    : grid.cells;

  for (let y = 0; y < height; y++) {
    const hasN = y + 1 < height;
    const hasS = y > 0;

    const rowN = hasN ? (y + 1) * width : -1;
    const row = y * width;
    const rowS = hasS ? (y - 1) * width : -1;

    for (let x = 0; x < width; x++) {
      const xm1 = x === 0 ? width - 1 : x - 1;
      const xp1 = x === width - 1 ? 0 : x + 1;

      const idx = row + x;

      const nNW = hasN ? cells[rowN + xm1] : 0;
      const nN = hasN ? cells[rowN + x] : 0;
      const nNE = hasN ? cells[rowN + xp1] : 0;
      const nW = cells[row + xm1];
      const nE = cells[row + xp1];
      const nSW = hasS ? cells[rowS + xm1] : 0;
      const nS = hasS ? cells[rowS + x] : 0;
      const nSE = hasS ? cells[rowS + xp1] : 0;

      const current = cells[idx];
      let next = 0;

      const maskA = neighborMaskForType(bitA, nN, nNE, nE, nSE, nS, nSW, nW, nNW);
      const maskB = neighborMaskForType(bitB, nN, nNE, nE, nSE, nS, nSW, nW, nNW);
      const maskC = neighborMaskForType(bitC, nN, nNE, nE, nSE, nS, nSW, nW, nNW);

      if (!exclusiveCell) {
        if (current & bitA) {
          const matched = matchesDirectionalRuleList(compiled.alive, maskA);
          if (mode === "death") {
            if (!matched) next |= bitA;
          } else if (matched) {
            next |= bitA;
          }
        } else if (matchesDirectionalBirthRuleList(compiled.birth, maskA, nextRandom)) {
          next |= bitA;
        }

        if (current & bitB) {
          const matched = matchesDirectionalRuleList(compiled.alive, maskB);
          if (mode === "death") {
            if (!matched) next |= bitB;
          } else if (matched) {
            next |= bitB;
          }
        } else if (matchesDirectionalBirthRuleList(compiled.birth, maskB, nextRandom)) {
          next |= bitB;
        }

        if (current & bitC) {
          const matched = matchesDirectionalRuleList(compiled.alive, maskC);
          if (mode === "death") {
            if (!matched) next |= bitC;
          } else if (matched) {
            next |= bitC;
          }
        } else if (matchesDirectionalBirthRuleList(compiled.birth, maskC, nextRandom)) {
          next |= bitC;
        }
      } else if (current === bitA) {
        if (survivesDirectional(mode, compiled.alive, maskA)) {
          next = bitA;
        } else {
          const bornB = matchesDirectionalBirthRuleList(compiled.birth, maskB, nextRandom);
          const bornC = matchesDirectionalBirthRuleList(compiled.birth, maskC, nextRandom);
          const bornMask = (bornB ? bitB : 0) | (bornC ? bitC : 0);
          next = pickExclusiveTypeBitFromMask(bornMask, bitA, bitB, bitC, nextRandom);
        }
      } else if (current === bitB) {
        if (survivesDirectional(mode, compiled.alive, maskB)) {
          next = bitB;
        } else {
          const bornA = matchesDirectionalBirthRuleList(compiled.birth, maskA, nextRandom);
          const bornC = matchesDirectionalBirthRuleList(compiled.birth, maskC, nextRandom);
          const bornMask = (bornA ? bitA : 0) | (bornC ? bitC : 0);
          next = pickExclusiveTypeBitFromMask(bornMask, bitA, bitB, bitC, nextRandom);
        }
      } else if (current === bitC) {
        if (survivesDirectional(mode, compiled.alive, maskC)) {
          next = bitC;
        } else {
          const bornA = matchesDirectionalBirthRuleList(compiled.birth, maskA, nextRandom);
          const bornB = matchesDirectionalBirthRuleList(compiled.birth, maskB, nextRandom);
          const bornMask = (bornA ? bitA : 0) | (bornB ? bitB : 0);
          next = pickExclusiveTypeBitFromMask(bornMask, bitA, bitB, bitC, nextRandom);
        }
      } else {
        const bornA = matchesDirectionalBirthRuleList(compiled.birth, maskA, nextRandom);
        const bornB = matchesDirectionalBirthRuleList(compiled.birth, maskB, nextRandom);
        const bornC = matchesDirectionalBirthRuleList(compiled.birth, maskC, nextRandom);
        const bornMask = (bornA ? bitA : 0) | (bornB ? bitB : 0) | (bornC ? bitC : 0);
        next = pickExclusiveTypeBitFromMask(bornMask, bitA, bitB, bitC, nextRandom);
      }

      nextCells[idx] = next;
    }
  }

  return { width, height, cells: nextCells };
}
