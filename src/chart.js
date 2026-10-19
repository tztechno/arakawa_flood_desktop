import { t } from './i18n.js';

// Hydrograph and Stored Volume time-series chart
export class TimeSeriesChart {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  /**
   * Draw scenario hydrograph and storage curve
   * @param {Object} options
   * @param {Array<[number, number]>} options.hydrograph - [[hour, levelAP], ...]
   * @param {number} options.currentHour - current simulation time in hours
   * @param {Array<{t: number, volMan: number}>} options.volumeHistory
   * @param {number} options.totalHours
   */
  draw({ hydrograph, currentHour, volumeHistory = [], totalHours = 36 }) {
    const canvas = this.canvas;
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const ML = 38, MR = 42, MT = 18, MB = 22;
    const pw = w - ML - MR;
    const ph = h - MT - MB;

    const toX = (t) => ML + (t / totalHours) * pw;
    const yMin = 0, yMax = 15; // A.P. level
    const toY = (v) => MT + ph - ((v - yMin) / (yMax - yMin)) * ph;

    // Grid lines
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#64748b';
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';

    for (let l = 0; l <= 15; l += 3) {
      const y = toY(l);
      ctx.beginPath();
      ctx.moveTo(ML, y);
      ctx.lineTo(w - MR, y);
      ctx.stroke();
      ctx.fillText(`${l}m`, ML - 4, y + 3);
    }

    // Weir threshold line (8.70m)
    const yWeir = toY(8.70);
    ctx.strokeStyle = 'rgba(0, 220, 255, 0.4)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(ML, yWeir);
    ctx.lineTo(w - MR, yWeir);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#00dcff';
    ctx.textAlign = 'left';
    ctx.fillText(t('chart.weir'), ML + 4, yWeir - 3);

    // Time axis
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'center';
    const dt = totalHours <= 12 ? 2 : totalHours <= 24 ? 4 : 6;
    for (let t = 0; t <= totalHours; t += dt) {
      const x = toX(t);
      ctx.fillText(`${t}h`, x, h - 6);
    }

    // Plot Hydrograph (River level)
    if (hydrograph && hydrograph.length) {
      ctx.beginPath();
      hydrograph.forEach(([t, lvl], i) => {
        const x = toX(t);
        const y = toY(lvl);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Current time marker
      const cx = toX(currentHour);
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, MT);
      ctx.lineTo(cx, h - MB);
      ctx.stroke();

      // Dot on hydrograph
      let curLvl = hydrograph[0][1];
      for (let i = 0; i < hydrograph.length - 1; i++) {
        if (currentHour >= hydrograph[i][0] && currentHour <= hydrograph[i + 1][0]) {
          const frac = (currentHour - hydrograph[i][0]) / (hydrograph[i + 1][0] - hydrograph[i][0]);
          curLvl = hydrograph[i][1] + (hydrograph[i + 1][1] - hydrograph[i][1]) * frac;
          break;
        }
      }
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(cx, toY(curLvl), 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Secondary axis for stored volume (0 - 4000万m³)
    ctx.fillStyle = '#22c55e';
    ctx.textAlign = 'left';
    ctx.fillText(t('chart.volUnit'), w - MR + 4, MT - 4);
    for (let v = 0; v <= 4000; v += 1000) {
      const y = MT + ph - (v / 4000) * ph;
      ctx.fillText(`${v}`, w - MR + 4, y + 3);
    }

    // Plot Stored Volume curve
    if (volumeHistory && volumeHistory.length > 1) {
      ctx.beginPath();
      volumeHistory.forEach((pt, i) => {
        const x = toX(pt.t / 3600);
        const y = MT + ph - Math.min(1.0, pt.volMan / 4000) * ph;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([2, 2]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Legend
    ctx.textAlign = 'left';
    ctx.font = '10px system-ui';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(t('chart.legendRiver'), ML + 80, MT - 4);
    ctx.fillStyle = '#22c55e';
    ctx.fillText(t('chart.legendVol'), ML + 200, MT - 4);
  }
}
