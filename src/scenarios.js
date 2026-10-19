// Flood scenarios and hydrographs for Arakawa River
// All water levels are defined in A.P. (Arakawa Peil) meters.
// Note: Overflow weir (越流堤) crest is A.P. +8.70m (T.P. +7.57m).
// Total flood capacity of 1st Retarding Basin is 39,000,000 m³ (3,900万m³).

export const WEIR_ELEV_AP = 8.70;
export const SAIKO_NORMAL_ELEV_AP = 1.65; // 彩湖 洪水期満水位 (MLIT; 非洪水期は A.P.+3.90m). Matches the DEM5A lake surface
export const MAX_CAPACITY_M3 = 39000000; // 3,900万m³
export const FULL_LEVEL_AP = 11.925; // 洪水時満水位 (MLIT). GSI DEM5A storage at this level ≈ 3,930万m³
export const LEVEE_MAIN_ELEV_AP = 15.20; // Left-bank main levee crest: median of GSI DEM5A crest trace
export const IGYO_ELEV_AP = 15.10; // 囲繞堤 crest: median of GSI DEM5A crest trace (A.P.+14.9〜15.4m)

export const SCENARIOS = {
  manual: {
    id: 'manual',
    name: '手動パラメータ操作',
    name_en: 'Manual Parameter Control',
    desc: '荒川の水深・水位スライダーを自由に動かして、越流堤の越流と遊水池の貯水状況をリアルタイムに観察します。',
    desc_en: 'Move the Arakawa river-level slider freely and watch, in real time, how water overflows the weir and fills the retarding basin.',
    durationHours: 24,
    defaultLevelAP: 7.50,
    hasTimeline: false,
  },
  hagibis2019: {
    id: 'hagibis2019',
    name: '令和元年 台風19号 (2019年実測再現)',
    name_en: 'Typhoon Hagibis 2019 (Actual Record)',
    desc: '2019年10月12日〜13日、荒川本川の水位が過去最高A.P.+12.35mに達し、越流堤から約3,500万m³の洪水を調節池へ貯留して東京都心の氾濫を防いだ歴史的事例の再現です。',
    desc_en: 'Reconstruction of Typhoon Hagibis (12–13 Oct 2019): the Arakawa reached a record level and about 35 million m³ was stored in the basin via the overflow weir, preventing flooding in central Tokyo.',
    durationHours: 36,
    defaultLevelAP: 2.50,
    hasTimeline: true,
    // [hour, level_AP]
    hydrograph: [
      [0, 2.50],
      [4, 2.80],
      [8, 4.20],
      [11, 6.50],  // 氾濫注意水位
      [13, 8.20],
      [14, 8.70],  // ★越流開始
      [16, 10.30],
      [18, 11.60],
      [20, 12.35], // ★過去最高ピーク (台風通過直後)
      [22, 11.70],
      [24, 9.90],
      [26, 8.70],  // 越流終了
      [30, 5.80],
      [36, 3.20],
    ],
  },
  flood_l1: {
    id: 'flood_l1',
    name: '計画規模洪水 (L1 洪水・約100年確率)',
    name_en: 'Design Scale Flood (L1)',
    desc: '河川整備計画の目標規模の洪水。越流堤から約3,200万m³の洪水を調節池に導き、下流都区部の水害を防ぎます。',
    desc_en: 'Design-scale flood of the river improvement plan. About 32 million m³ is diverted into the basin over the weir, protecting the downstream wards.',
    durationHours: 28,
    defaultLevelAP: 2.50,
    hasTimeline: true,
    hydrograph: [
      [0, 2.50],
      [4, 3.50],
      [8, 6.00],
      [11, 8.70],  // 越流開始
      [14, 10.80],
      [16, 11.80], // L1 ピーク
      [19, 10.50],
      [22, 8.70],  // 越流終了
      [25, 5.00],
      [28, 3.00],
    ],
  },
  flood_l2: {
    id: 'flood_l2',
    name: '想定最大規模洪水 (L2 洪水・約1000年確率)',
    name_en: 'Max Probable Flood (L2)',
    desc: '荒川流域で2日間の総雨量632mmという想定最大規模の豪雨。第一調節池が満水容量3,900万m³（洪水時満水位A.P.+11.925m）までフル稼働します。',
    desc_en: 'Maximum probable rainfall (632 mm over 2 days in the Arakawa basin). The 1st Retarding Basin works at full capacity: 39 million m³ at the flood full level A.P.+11.925m.',
    durationHours: 32,
    defaultLevelAP: 2.50,
    hasTimeline: true,
    hydrograph: [
      [0, 2.50],
      [4, 4.00],
      [8, 7.50],
      [10, 8.70],  // 越流開始
      [13, 11.50],
      [16, 13.80], // L2 最大ピーク
      [19, 12.60],
      [23, 10.00],
      [26, 8.70],  // 越流終了
      [32, 4.00],
    ],
  },
  step_test: {
    id: 'step_test',
    name: 'ステップ増水観察モード (+1m/10分)',
    name_en: 'Step-by-Step Level Rise',
    desc: '荒川の水位が平常時から1mずつ段階的に上昇。越流堤（8.7m）を超えた瞬間の流入挙動をじっくり観察できます。',
    desc_en: 'The Arakawa rises step by step, 1 m at a time, from normal level. Observe closely how inflow starts once the weir crest (8.7m) is exceeded.',
    durationHours: 12,
    defaultLevelAP: 3.00,
    hasTimeline: true,
    hydrograph: [
      [0, 3.00],
      [1, 5.00],
      [2, 7.00],
      [3, 8.50],
      [4, 9.50],   // 越流中
      [5, 10.50],
      [6, 11.50],
      [7, 12.50],
      [8, 10.50],
      [9, 8.70],
      [10, 6.00],
      [12, 3.00],
    ],
  },
};

/** Get river water level at time `tSec` in the scenario (linear interpolation) */
export function getScenarioRiverLevel(scenarioId, tSec) {
  const sc = SCENARIOS[scenarioId] || SCENARIOS.manual;
  if (!sc.hydrograph || !sc.hydrograph.length) return sc.defaultLevelAP;
  const tHours = tSec / 3600;
  const hg = sc.hydrograph;
  if (tHours <= hg[0][0]) return hg[0][1];
  if (tHours >= hg[hg.length - 1][0]) return hg[hg.length - 1][1];

  for (let i = 0; i < hg.length - 1; i++) {
    const [t0, h0] = hg[i];
    const [t1, h1] = hg[i + 1];
    if (tHours >= t0 && tHours <= t1) {
      const frac = (tHours - t0) / (t1 - t0);
      return h0 + (h1 - h0) * frac;
    }
  }
  return hg[hg.length - 1][1];
}
