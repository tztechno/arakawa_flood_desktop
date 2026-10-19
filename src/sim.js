// Topographic Hydrodynamic Simulator for Arakawa River & 1st Retarding Basin
//
// River:  cells connected to the 荒川 centerline (OSM) through ground lower than the river stage,
//         confined to the corridor between the main levees and never entering the retarding basin.
// Basin:  water enters only at the 越流堤 and is routed over the DEM by fill-and-spill:
//         it fills the depression it reaches first, spills over the lowest internal dike into the
//         next compartment (区画), and pools merge once they reach the same level.
//         The exit gate is closed, so stored water stays until resetStorage().
//         - dtSec > 0: inflow over dtSec is poured at the weir (scenario playback and manual mode).
//         - dtSec = 0: only the river stage changes; no time passes, the basin keeps its state.

import { toTP, toAP } from './proj.js';
import { WEIR_ELEV_AP, SAIKO_NORMAL_ELEV_AP, MAX_CAPACITY_M3 } from './scenarios.js';
import { BASIN_POLYGON_2D, BASIN_PERIMETER_SURVEYED } from './basinGeometry.js';
import { ARAKAWA_CENTERLINE } from './riverLine.js';

const RIVER_BAND_M = 1800;      // max search distance for the main levee on each bank
const STATION_M = 50;           // cross-section spacing along the centerline
const LEVEE_MIN_TP = 6.0;       // a main levee crest is at least this high (T.P.)
const LEVEE_PROMINENCE_M = 3.0; // and stands this far above ground on both sides
const WEIR_WIDTH_M = 500;  // overflow weir crest length used in the discharge formula
const WEIR_C = 1.85;       // broad-crested weir discharge coefficient
const EPS = 1e-6;

class MinHeap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    const k = this.k, v = this.v;
    let i = k.length;
    k.push(key); v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= key) break;
      k[i] = k[p]; v[i] = v[p]; i = p;
    }
    k[i] = key; v[i] = val;
  }
  peekKey() { return this.k[0]; }
  peekVal() { return this.v[0]; }
  pop() {
    const k = this.k, v = this.v;
    const lk = k.pop(), lv = v.pop();
    if (!k.length) return;
    let i = 0;
    const n = k.length;
    for (;;) {
      let c = 2 * i + 1;
      if (c >= n) break;
      if (c + 1 < n && k[c + 1] < k[c]) c++;
      if (k[c] >= lk) break;
      k[i] = k[c]; v[i] = v[c]; i = c;
    }
    k[i] = lk; v[i] = lv;
  }
}

export class ArakawaSimulator {
  constructor(region) {
    this.region = region;
    this.riverLevelAP = 7.50; // default River Level in A.P.
    this.basinLevelAP = SAIKO_NORMAL_ELEV_AP;
    this.storedVolumeM3 = 0; // Flood water stored in the retarding basin (m³)
    this.inflowM3s = 0; // Overflow weir inflow rate (m³/s)
    this.isOverflowing = false;
    this.downstreamReductCm = 0;
    this.basinWetAreaM2 = 0;

    // During flood events, exit sluice gate (排水門) is CLOSED (全閉): stored water never drains.
    this.exitGateClosed = true;

    const { nx, ny, res } = region;
    this.nx = nx;
    this.ny = ny;
    this.ground = region.ground;
    this.cellArea = res * res;
    this.weirWidthM = WEIR_WIDTH_M;

    this.depth = new Float32Array(nx * ny);
    this.waterLevel = new Float32Array(nx * ny);

    this._buildBasinMask();
    this._buildRiverBand();

    // Basin water surface (T.P.) per basin cell; equals ground where dry
    this.eta = new Float64Array(nx * ny);
    this.stamp = new Int32Array(nx * ny);
    this.stampGen = 0;
    this._resetBasinWater();

    this.setRiverLevel(this.riverLevelAP, 0);
  }

  // ---------- setup ----------

  _cellOf(e, n) {
    const { res, originE, originN } = this.region;
    return [Math.floor((e - originE) / res), Math.floor((originN - n) / res)];
  }

  _buildBasinMask() {
    const { nx, ny } = this;
    const { res, originE, originN } = this.region;
    const poly = BASIN_POLYGON_2D;
    this.basinMask = new Uint8Array(nx * ny);
    const es = poly.map(p => p[0]), ns = poly.map(p => p[1]);
    const [i0, j0] = this._cellOf(Math.min(...es), Math.max(...ns));
    const [i1, j1] = this._cellOf(Math.max(...es), Math.min(...ns));
    const cells = [];
    for (let j = Math.max(0, j0); j <= Math.min(ny - 1, j1); j++) {
      for (let i = Math.max(0, i0); i <= Math.min(nx - 1, i1); i++) {
        const e = originE + (i + 0.5) * res, n = originN - (j + 0.5) * res;
        if (this._pointInPolygon(e, n, poly)) {
          const k = j * nx + i;
          this.basinMask[k] = 1;
          cells.push(k);
        }
      }
    }
    this.basinCells = Int32Array.from(cells);

    // Inflow point: lowest basin cell within 60 m of the overflow weir crest line
    const weir = BASIN_PERIMETER_SURVEYED.filter(p => p.type === 'weir');
    let best = -1, bestZ = Infinity;
    for (const k of cells) {
      const e = originE + ((k % nx) + 0.5) * res, n = originN - (Math.floor(k / nx) + 0.5) * res;
      let d = Infinity;
      for (let w = 0; w < weir.length - 1; w++) d = Math.min(d, this._distToSegment(e, n, weir[w].e, weir[w].n, weir[w + 1].e, weir[w + 1].n));
      if (d <= 60 && this.ground[k] < bestZ) { bestZ = this.ground[k]; best = k; }
    }
    this.weirCell = best;
  }

  /**
   * River corridor = land between the main levees on both banks.
   * Every STATION_M along the centerline a perpendicular ray is cast to each side and the first
   * major levee crest (crest >= LEVEE_MIN_TP and >= LEVEE_PROMINENCE_M above both sides) marks the
   * corridor edge. Stations with no crest (gaps at tributary gates, bridges) take the median of
   * their neighbours, so river water cannot run up tributaries into the city behind the levees.
   */
  _buildRiverBand() {
    const { nx, ny, ground } = this;
    const { res, originE, originN } = this.region;
    const groundAt = (e, n) => {
      const i = Math.floor((e - originE) / res), j = Math.floor((originN - n) / res);
      return i < 0 || j < 0 || i >= nx || j >= ny ? NaN : ground[j * nx + i];
    };

    // 1. Stations along the centerline with unit normals (left = +1 side of flow)
    const line = ARAKAWA_CENTERLINE;
    const cum = [0];
    for (let p = 1; p < line.length; p++) cum.push(cum[p - 1] + Math.hypot(line[p][0] - line[p - 1][0], line[p][1] - line[p - 1][1]));
    const at = (s) => {
      s = Math.max(0, Math.min(cum[cum.length - 1], s));
      let p = 1;
      while (p < cum.length - 1 && cum[p] < s) p++;
      const t = (s - cum[p - 1]) / (cum[p] - cum[p - 1] || 1);
      return [line[p - 1][0] + (line[p][0] - line[p - 1][0]) * t, line[p - 1][1] + (line[p][1] - line[p - 1][1]) * t];
    };
    const stations = [];
    for (let s = 0; s <= cum[cum.length - 1]; s += STATION_M) {
      const c = at(s), a = at(s - 150), b = at(s + 150);
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const tx = (b[0] - a[0]) / len, ty = (b[1] - a[1]) / len;
      stations.push({ e: c[0], n: c[1], tx, ty, nxL: -ty, nyL: tx });
    }

    // 2. Levee crest distance on each side
    const steps = Math.round(RIVER_BAND_M / 10);
    const win = 10; // ±100 m prominence window
    const findLevee = (st, side) => {
      const prof = new Float32Array(steps + 1);
      for (let d = 0; d <= steps; d++) prof[d] = groundAt(st.e + st.nxL * side * d * 10, st.n + st.nyL * side * d * 10);
      for (let d = 3; d <= steps - 3; d++) {
        const h = prof[d];
        if (!(h >= LEVEE_MIN_TP)) continue;
        let isMax = true;
        for (let q = -3; q <= 3; q++) if (prof[d + q] > h) { isMax = false; break; }
        if (!isMax) continue;
        let lo1 = Infinity, lo2 = Infinity;
        for (let q = Math.max(0, d - win); q < d; q++) lo1 = Math.min(lo1, prof[q]);
        for (let q = d + 1; q <= Math.min(steps, d + win); q++) lo2 = Math.min(lo2, prof[q]);
        if (h - lo1 >= LEVEE_PROMINENCE_M && h - lo2 >= LEVEE_PROMINENCE_M) return d * 10;
      }
      return NaN;
    };
    const fillGaps = (arr) => {
      const out = Float32Array.from(arr);
      for (let i = 0; i < arr.length; i++) {
        const nb = [];
        for (let q = i - 4; q <= i + 4; q++) if (q >= 0 && q < arr.length && !Number.isNaN(arr[q])) nb.push(arr[q]);
        nb.sort((x, y) => x - y);
        out[i] = nb.length ? nb[nb.length >> 1] : NaN;
      }
      // Stations still without a levee (e.g. at the map edge) take the nearest detected levee
      for (let i = 0; i < out.length; i++) {
        if (!Number.isNaN(out[i])) continue;
        for (let r = 1; r < out.length; r++) {
          const a = i - r >= 0 && !Number.isNaN(out[i - r]) ? out[i - r] : NaN;
          const b = i + r < out.length && !Number.isNaN(out[i + r]) ? out[i + r] : NaN;
          if (!Number.isNaN(a) || !Number.isNaN(b)) { out[i] = Number.isNaN(a) ? b : a; break; }
        }
      }
      return out;
    };
    const dL = fillGaps(stations.map((st) => findLevee(st, 1)));
    const dR = fillGaps(stations.map((st) => findLevee(st, -1)));
    this.riverStations = stations.map((st, i) => ({ ...st, dL: dL[i], dR: dR[i] }));

    // 3. Assign each cell to its nearest station (multi-source BFS from the rasterized centerline)
    const owner = new Int32Array(nx * ny).fill(-1);
    let frontier = [];
    const seeds = new Set();
    stations.forEach((st, idx) => {
      for (let s = -STATION_M / 2; s <= STATION_M / 2; s += res / 2) {
        const e = st.e + st.tx * s, n = st.n + st.ty * s;
        const i = Math.floor((e - originE) / res), j = Math.floor((originN - n) / res);
        if (i < 0 || j < 0 || i >= nx || j >= ny) continue;
        const k = j * nx + i;
        if (owner[k] === -1) { owner[k] = idx; frontier.push(k); seeds.add(k); }
      }
    });
    this.riverSeeds = Int32Array.from(seeds);
    const maxSteps = Math.ceil(RIVER_BAND_M / res);
    for (let s = 1; s <= maxSteps && frontier.length; s++) {
      const next = [];
      for (const k of frontier) {
        const i = k % nx, j = (k - i) / nx;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          const ii = i + di, jj = j + dj;
          if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
          const q = jj * nx + ii;
          if (owner[q] !== -1) continue;
          owner[q] = owner[k];
          next.push(q);
        }
      }
      frontier = next;
    }

    // 4. Corridor mask: within the levee crest distance on the cell's side, excluding the basin
    this.riverBand = new Uint8Array(nx * ny);
    for (let k = 0; k < nx * ny; k++) {
      const o = owner[k];
      if (o < 0 || this.basinMask[k]) continue;
      const st = this.riverStations[o];
      const e = originE + ((k % nx) + 0.5) * res, n = originN - (Math.floor(k / nx) + 0.5) * res;
      const off = (e - st.e) * st.nxL + (n - st.n) * st.nyL; // + = left bank
      if (off >= 0 ? off <= st.dL : -off <= st.dR) this.riverBand[k] = 1;
    }
    this.riverQueue = new Int32Array(nx * ny);
    this.riverWet = new Uint8Array(nx * ny);
  }

  _distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  _pointInPolygon(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1];
      const xj = poly[j][0], yj = poly[j][1];
      const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  // 4-neighbours inside the basin
  _basinNeighbors(k, out) {
    const { nx, ny, basinMask } = this;
    const i = k % nx, j = (k - i) / nx;
    let c = 0;
    if (i > 0 && basinMask[k - 1]) out[c++] = k - 1;
    if (i < nx - 1 && basinMask[k + 1]) out[c++] = k + 1;
    if (j > 0 && basinMask[k - nx]) out[c++] = k - nx;
    if (j < ny - 1 && basinMask[k + nx]) out[c++] = k + nx;
    return c;
  }

  // ---------- basin water routing ----------

  _resetBasinWater() {
    for (const k of this.basinCells) this.eta[k] = this.ground[k];
    this.storedVolumeM3 = 0;
  }

  /** Pour `vol` m³ at the weir and route it by fill-and-spill over the current water surface. */
  _pour(vol) {
    const { eta, stamp, cellArea } = this;
    const nb = new Int32Array(4);
    let cell = this.weirCell;
    for (let guard = 0; vol > 1e-3 && guard < 20000; guard++) {
      // 1. Flow downhill over the water surface to a local minimum
      for (;;) {
        let best = -1, bh = eta[cell] - EPS;
        const c = this._basinNeighbors(cell, nb);
        for (let t = 0; t < c; t++) if (eta[nb[t]] < bh) { bh = eta[nb[t]]; best = nb[t]; }
        if (best < 0) break;
        cell = best;
      }

      // 2. Collect the flat pool at that level (a lower edge cell means it drains further)
      const gen = ++this.stampGen;
      const L0 = eta[cell];
      const pool = [cell];
      stamp[cell] = gen;
      let spill = -1;
      for (let p = 0; p < pool.length && spill < 0; p++) {
        const c = this._basinNeighbors(pool[p], nb);
        for (let t = 0; t < c; t++) {
          const q = nb[t];
          if (stamp[q] === gen) continue;
          if (eta[q] < L0 - EPS) { spill = q; break; }
          if (eta[q] <= L0 + EPS) { stamp[q] = gen; pool.push(q); }
        }
      }
      if (spill >= 0) { cell = spill; continue; }

      // 3. Raise the pool, absorbing rim cells in order of height, until the volume is used up
      //    or the rising surface reaches a rim cell that drops away (spill into next compartment)
      const queued = gen; // cells in pool or heap carry stamp === gen
      const heap = new MinHeap();
      for (const p of pool) {
        const c = this._basinNeighbors(p, nb);
        for (let t = 0; t < c; t++) if (stamp[nb[t]] !== queued) { stamp[nb[t]] = queued; heap.push(eta[nb[t]], nb[t]); }
      }
      let L = L0, area = pool.length * cellArea;
      spill = -1;
      for (;;) {
        if (!heap.size) { L += vol / area; vol = 0; break; }
        const h = heap.peekKey(), c0 = heap.peekVal();
        if (h < L - EPS) { spill = c0; break; }
        const need = (h - L) * area;
        if (need >= vol) { L += vol / area; vol = 0; break; }
        vol -= need;
        L = h;
        heap.pop();
        pool.push(c0);
        area += cellArea;
        const c = this._basinNeighbors(c0, nb);
        for (let t = 0; t < c; t++) if (stamp[nb[t]] !== queued) { stamp[nb[t]] = queued; heap.push(eta[nb[t]], nb[t]); }
      }
      for (const p of pool) eta[p] = L;
      if (spill < 0) break;
      cell = spill;
    }
  }

  // ---------- public API ----------

  /**
   * Set river water level (in A.P. meters).
   * @param {number} levelAP - River water level in A.P.
   * @param {number} dtSec - Elapsed seconds for dynamic integration (0 for instant scrub)
   * @param {boolean} compose - Rebuild the full-grid depth / waterLevel buffers (skip for batch runs)
   */
  setRiverLevel(levelAP, dtSec = 0, compose = true) {
    this.riverLevelAP = Math.max(1.5, levelAP);
    const riverTP = toTP(this.riverLevelAP);
    const weirAP = WEIR_ELEV_AP;

    // Overflow weir discharge (Villemonte submergence once the basin side rises above the crest)
    const h1 = this.riverLevelAP - weirAP;
    const basinAtWeirAP = toAP(this.eta[this.weirCell]);
    const h2 = Math.max(0, basinAtWeirAP - weirAP);
    if (h1 > 0) {
      this.isOverflowing = true;
      const qFree = WEIR_C * this.weirWidthM * Math.pow(h1, 1.5);
      this.inflowM3s = h2 >= h1 ? 0 : qFree * Math.pow(1 - Math.pow(h2 / h1, 1.5), 0.385);
      this.isOverflowing = this.inflowM3s > 0;
    } else {
      this.isOverflowing = false;
      this.inflowM3s = 0;
    }

    // Accumulate inflow and route it through the compartments
    if (dtSec > 0 && this.inflowM3s > 0) this._pour(this.inflowM3s * dtSec);

    // Basin totals
    let vol = 0, wet = 0;
    for (const k of this.basinCells) {
      const d = this.eta[k] - this.ground[k];
      if (d > 0.01) { vol += d; wet++; }
    }
    this.storedVolumeM3 = vol * this.cellArea;
    this.basinWetAreaM2 = wet * this.cellArea;
    this.basinLevelAP = this.storedVolumeM3 > 0 ? toAP(this.eta[this.weirCell]) : SAIKO_NORMAL_ELEV_AP;

    // Downstream flood reduction effect at Tokyo / Arakawa-ku / Iwabuchi
    this.downstreamReductCm = this.inflowM3s > 0 ? (this.inflowM3s / (400 * 2.5)) * 100 : 0;

    if (compose) this._composeWater(riverTP);
  }

  /** Fill depth / waterLevel buffers from the river flood and the basin surface. */
  _composeWater(riverTP) {
    const { nx, ny, ground, depth, waterLevel, riverBand, riverWet, riverQueue, riverSeeds } = this;
    depth.fill(0);
    waterLevel.set(ground);

    // River: flood fill from the centerline through band cells lower than the river stage
    riverWet.fill(0);
    let head = 0, tail = 0;
    for (const k of riverSeeds) {
      if (riverBand[k] && ground[k] < riverTP && !riverWet[k]) { riverWet[k] = 1; riverQueue[tail++] = k; }
    }
    while (head < tail) {
      const k = riverQueue[head++];
      depth[k] = riverTP - ground[k];
      waterLevel[k] = riverTP;
      const i = k % nx, j = (k - i) / nx;
      if (i > 0) { const q = k - 1; if (!riverWet[q] && riverBand[q] && ground[q] < riverTP) { riverWet[q] = 1; riverQueue[tail++] = q; } }
      if (i < nx - 1) { const q = k + 1; if (!riverWet[q] && riverBand[q] && ground[q] < riverTP) { riverWet[q] = 1; riverQueue[tail++] = q; } }
      if (j > 0) { const q = k - nx; if (!riverWet[q] && riverBand[q] && ground[q] < riverTP) { riverWet[q] = 1; riverQueue[tail++] = q; } }
      if (j < ny - 1) { const q = k + nx; if (!riverWet[q] && riverBand[q] && ground[q] < riverTP) { riverWet[q] = 1; riverQueue[tail++] = q; } }
    }

    // Basin
    for (const k of this.basinCells) {
      const d = this.eta[k] - ground[k];
      if (d > 0.01) { depth[k] = d; waterLevel[k] = this.eta[k]; }
    }
  }

  resetStorage() {
    this._resetBasinWater();
    this.inflowM3s = 0;
    this.isOverflowing = false;
    this.exitGateClosed = true;
    this.setRiverLevel(this.riverLevelAP, 0);
  }

  getMetrics() {
    const volMan = (this.storedVolumeM3 / 10000).toFixed(1);
    const volPct = Math.min(100, (this.storedVolumeM3 / MAX_CAPACITY_M3) * 100).toFixed(1);
    return {
      riverLevelAP: this.riverLevelAP,
      riverLevelTP: toTP(this.riverLevelAP),
      basinLevelAP: this.basinLevelAP,
      basinLevelTP: toTP(this.basinLevelAP),
      inflowM3s: Math.round(this.inflowM3s),
      volManM3: volMan,
      volCapPct: volPct,
      basinWetAreaKm2: (this.basinWetAreaM2 / 1e6).toFixed(2),
      downstreamReductCm: this.downstreamReductCm.toFixed(1),
      isOverflowing: this.isOverflowing,
      exitGateStatus: this.exitGateClosed ? 'CLOSED' : 'OPEN',
    };
  }
}
