// Interactive Cross-Section Profile Diagram (横断断面図)
// Displays a realistic topographic cross-section across levees, river channels, retarding basin, and city areas.

import { toTP, toAP } from './proj.js';
import { WEIR_ELEV_AP, LEVEE_MAIN_ELEV_AP, IGYO_ELEV_AP } from './scenarios.js';
import { t, getLang } from './i18n.js';

export class CrossSectionDrawer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.wavePhase = 0;
    this.regionName = 'saiko';

    // Profiles for different regions
    this.profiles = {
      toda_basin: [
        { x: 0, z: 12.0, name: '右岸背後地', en: 'Right-bank hinterland' },
        { x: 300, z: 12.5, name: '' },
        { x: 450, z: 15.2, kind: 'levee', name: '荒川右岸本堤', en: 'Right-bank main levee' },
        { x: 550, z: 5.5, name: '右岸高水敷', en: 'Right floodplain' },
        { x: 750, z: 1.8, name: '荒川本川 (低水路)', en: 'Main channel' },
        { x: 950, z: 2.2, name: '' },
        { x: 1100, z: 5.8, name: '左岸高水敷', en: 'Left floodplain' },
        { x: 1250, z: 8.70, kind: 'weir', name: '★越流堤 (8.70m)', en: '★Overflow weir (8.70m)' },
        { x: 1380, z: IGYO_ELEV_AP, name: `囲ぎょう堤 (${IGYO_ELEV_AP.toFixed(1)}m)`, en: `Igyo-tei levee (${IGYO_ELEV_AP.toFixed(1)}m)` },
        { x: 1500, z: 4.8, name: '調節池 (秋ヶ瀬)', en: 'Basin (Akigase)' },
        { x: 1800, z: -1.5, name: '彩湖 (貯水池底)', en: 'Saiko (reservoir bed)' },
        { x: 2200, z: 3.5, name: '道満グリーンパーク', en: 'Doman Green Park' },
        { x: 2500, z: 7.2, name: '' },
        { x: 2650, z: LEVEE_MAIN_ELEV_AP, kind: 'levee', name: '荒川左岸本堤', en: 'Left-bank main levee' },
        { x: 2800, z: 5.2, name: '左岸背後地 (堤防外)', en: 'Left-bank hinterland' },
        { x: 3200, z: 4.8, name: '' },
      ],
      arakawa_ku: [
        { x: 0, z: 8.5, name: '左岸側高台 (足立区)', en: 'Left bank upland (Adachi)' },
        { x: 400, z: 8.8, name: '荒川左岸堤防', en: 'Left-bank levee' },
        { x: 600, z: 2.5, name: '左岸高水敷', en: 'Left floodplain' },
        { x: 900, z: 0.5, name: '荒川放水路 (河道)', en: 'Arakawa floodway' },
        { x: 1300, z: 2.8, name: '右岸高水敷', en: 'Right floodplain' },
        { x: 1500, z: 8.8, kind: 'levee', name: '荒川右岸本堤 (8.8m)', en: 'Right-bank main levee (8.8m)' },
        { x: 1800, z: 1.2, name: '町屋・尾久 (荒川区)', en: 'Machiya / Ogu (Arakawa-ku)' },
        { x: 2300, z: 0.8, name: '南千住 (ゼロメートル地帯)', en: 'Minami-Senju (zero-meter zone)' },
        { x: 2700, z: 5.5, name: '隅田川防潮堤', en: 'Sumida River seawall' },
        { x: 2900, z: 1.5, name: '隅田川', en: 'Sumida River' },
        { x: 3200, z: 2.0, name: '台東区方面', en: 'Toward Taito-ku' },
      ],
    };
  }

  setRegion(name) {
    this.regionName = name;
  }

  draw(metrics) {
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

    this.wavePhase += 0.05;
    const isArakawaKu = this.regionName === 'arakawa_ku';
    const profile = isArakawaKu ? this.profiles.arakawa_ku : this.profiles.toda_basin;

    // View margins
    const ML = 48, MR = 24, MT = 28, MB = 32;
    const pw = w - ML - MR;
    const ph = h - MT - MB;

    const xMin = 0, xMax = 3200;
    const zMin = -3.0, zMax = 17.0;

    const toX = (x) => ML + ((x - xMin) / (xMax - xMin)) * pw;
    const toY = (z) => MT + (1.0 - (z - zMin) / (zMax - zMin)) * ph;

    // 1. Grid & elevation ticks
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#6e8296';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';

    for (let z = 0; z <= 16; z += 4) {
      const y = toY(z);
      ctx.beginPath();
      ctx.moveTo(ML, y);
      ctx.lineTo(w - MR, y);
      ctx.stroke();
      ctx.fillText(`+${z}m`, ML - 6, y + 3);
    }
    ctx.fillText('A.P.', ML - 6, MT - 8);

    // 2. Reference datum lines
    const mainLeveeAP = isArakawaKu ? 8.80 : LEVEE_MAIN_ELEV_AP;
    const yLevee = toY(mainLeveeAP);
    ctx.strokeStyle = 'rgba(255, 180, 0, 0.35)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(ML, yLevee);
    ctx.lineTo(w - MR, yLevee);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffb400';
    ctx.textAlign = 'left';
    ctx.fillText(
      isArakawaKu ? t('cs.leveeLineKu') : t('cs.leveeLine', { v: LEVEE_MAIN_ELEV_AP.toFixed(1) }),
      w - MR - 220,
      yLevee - 4
    );

    if (!isArakawaKu) {
      const yWeir = toY(WEIR_ELEV_AP);
      ctx.strokeStyle = 'rgba(0, 220, 255, 0.4)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(ML, yWeir);
      ctx.lineTo(w - MR, yWeir);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#00dcff';
      ctx.fillText(t('cs.weirLine'), ML + 6, yWeir - 4);
    }

    // 3. Water Bodies
    const riverAP = metrics.riverLevelAP;
    const basinAP = metrics.basinLevelAP;
    const isOver = metrics.isOverflowing;

    if (isArakawaKu) {
      // Lower Arakawa River Channel Water
      const xR0 = toX(550), xR1 = toX(1500);
      const yRiver = toY(riverAP);
      if (riverAP > 0.5) {
        const gradR = ctx.createLinearGradient(0, yRiver, 0, toY(0.5));
        gradR.addColorStop(0, 'rgba(30, 144, 255, 0.75)');
        gradR.addColorStop(1, 'rgba(10, 60, 130, 0.88)');
        ctx.fillStyle = gradR;
        ctx.beginPath();
        ctx.moveTo(xR0, yRiver);
        for (let x = xR0; x <= xR1; x += 10) {
          ctx.lineTo(x, yRiver + Math.sin(this.wavePhase * 2 + x * 0.05) * 1.5);
        }
        ctx.lineTo(xR1, toY(2.8));
        ctx.lineTo(toX(900), toY(0.5));
        ctx.lineTo(xR0, toY(2.5));
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#64b5f6';
        ctx.font = 'bold 11px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(t('cs.riverKu', { v: riverAP.toFixed(2) }), (xR0 + xR1) / 2, yRiver - 8);
      }
    } else {
      // River channel water
      const xR0 = toX(500), xR1 = toX(1250);
      const yRiver = toY(riverAP);
      if (riverAP > 1.8) {
        const gradR = ctx.createLinearGradient(0, yRiver, 0, toY(1.8));
        gradR.addColorStop(0, 'rgba(30, 144, 255, 0.7)');
        gradR.addColorStop(1, 'rgba(10, 60, 130, 0.85)');
        ctx.fillStyle = gradR;
        ctx.beginPath();
        ctx.moveTo(xR0, yRiver);
        for (let x = xR0; x <= xR1; x += 10) {
          ctx.lineTo(x, yRiver + Math.sin(this.wavePhase * 2 + x * 0.05) * 1.5);
        }
        ctx.lineTo(xR1, toY(5.8));
        ctx.lineTo(toX(950), toY(2.2));
        ctx.lineTo(toX(750), toY(1.8));
        ctx.lineTo(xR0, toY(5.5));
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#64b5f6';
        ctx.font = 'bold 11px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(t('cs.river', { v: riverAP.toFixed(2) }), (xR0 + xR1) / 2, yRiver - 8);
      }

      // Retarding Basin Water
      const xB0 = toX(1380), xB1 = toX(2600);
      const yBasin = toY(basinAP);
      if (basinAP > -1.5) {
        const gradB = ctx.createLinearGradient(0, yBasin, 0, toY(-1.5));
        gradB.addColorStop(0, 'rgba(0, 200, 220, 0.65)');
        gradB.addColorStop(1, 'rgba(0, 70, 100, 0.85)');
        ctx.fillStyle = gradB;
        ctx.beginPath();
        ctx.moveTo(xB0, yBasin);
        for (let x = xB0; x <= xB1; x += 10) {
          ctx.lineTo(x, yBasin + Math.sin(this.wavePhase * 1.5 + x * 0.04) * 1.2);
        }
        ctx.lineTo(xB1, toY(7.2));
        ctx.lineTo(toX(2200), toY(3.5));
        ctx.lineTo(toX(1800), toY(-1.5));
        ctx.lineTo(toX(1500), toY(4.8));
        ctx.lineTo(xB0, toY(Math.min(basinAP, IGYO_ELEV_AP)));
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#4dd0e1';
        ctx.font = 'bold 11px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(t('cs.basin', { v: basinAP.toFixed(2) }), (xB0 + xB1) / 2, yBasin - 8);
      }

      // Weir overflow cascade
      if (isOver) {
        const xW0 = toX(1200), xW1 = toX(1420);
        const yWeir = toY(WEIR_ELEV_AP);
        const gradW = ctx.createLinearGradient(xW0, yRiver, xW1, yBasin);
        gradW.addColorStop(0, 'rgba(0, 240, 255, 0.85)');
        gradW.addColorStop(1, 'rgba(0, 180, 220, 0.4)');
        ctx.fillStyle = gradW;
        ctx.beginPath();
        ctx.moveTo(xW0, yRiver);
        ctx.lineTo(toX(1250), yWeir - 3);
        ctx.lineTo(toX(1380), yWeir - 1);
        ctx.lineTo(xW1, yBasin);
        ctx.lineTo(xW1, yBasin + 8);
        ctx.lineTo(toX(1250), toY(8.70));
        ctx.lineTo(xW0, toY(6.5));
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#00e5ff';
        ctx.font = 'bold 12px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(t('cs.overflow', { q: metrics.inflowM3s }), toX(1315), yWeir - 18);
      }
    }

    // 4. Ground Profile Line & Fill
    ctx.beginPath();
    profile.forEach((pt, i) => {
      const px = toX(pt.x);
      const py = toY(pt.z);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.lineTo(w - MR, h - MB);
    ctx.lineTo(ML, h - MB);
    ctx.closePath();

    const groundGrad = ctx.createLinearGradient(0, toY(16), 0, h - MB);
    groundGrad.addColorStop(0, '#2d3e2f');
    groundGrad.addColorStop(1, '#1b241d');
    ctx.fillStyle = groundGrad;
    ctx.fill();

    // Ground stroke
    ctx.strokeStyle = '#66bb6a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    profile.forEach((pt, i) => {
      const px = toX(pt.x);
      const py = toY(pt.z);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();

    // 5. Landmark & Levee Labels
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'center';

    profile.forEach((pt) => {
      if (pt.name) {
        const px = toX(pt.x);
        const py = toY(pt.z);
        ctx.fillStyle = pt.kind === 'weir' ? '#00e5ff' : pt.kind === 'levee' ? '#ffca28' : '#a5d6a7';
        ctx.beginPath();
        ctx.arc(px, py, 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#e0e6ed';
        ctx.fillText(getLang() === 'en' && pt.en ? pt.en : pt.name, px, py + 16);
        ctx.fillStyle = '#8fa3b7';
        ctx.font = '9px "JetBrains Mono"';
        ctx.fillText(`${pt.z.toFixed(1)}m`, px, py + 26);
        ctx.font = '10px system-ui, sans-serif';
      }
    });

    // 6. Direction labels
    ctx.fillStyle = '#8fa3b7';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText(isArakawaKu ? t('cs.westKu') : t('cs.west'), ML + 4, h - 8);
    ctx.textAlign = 'right';
    ctx.fillText(isArakawaKu ? t('cs.eastKu') : t('cs.east'), w - MR - 4, h - 8);
  }
}
