// Japanese / English UI strings.
// Static markup uses data-i18n="key" (textContent) and data-i18n-title="key" (title attribute);
// dynamic text calls t(key, vars). The chosen language is remembered per browser.

const DICT = {
  ja: {
    'doc.title': 'Arakawa Flood — 荒川第一調節池 3Dシミュレーター',
    'lang.toggle': 'EN',
    'lang.toggleTitle': 'Switch to English',
    'panel.open': 'パネル展開',
    'panel.openTitle': 'コントロールパネルを展開',
    'panel.collapseTitle': 'パネルを折り畳む (画面を広く使う)',
    'app.subtitle': '荒川第一調節池・荒川流域 広域パノラマ 3Dシミュレーター (32km × 14km)',

    'sec.river': '1. 荒川水深・水位パラメータ',
    'badge.inChannel': '河道内流下中',
    'badge.overflow': '★ 越流堤より流入中!',
    'river.level': '荒川本川 水位',
    'marker.normal': '平常 (2.5m)',
    'marker.warning': '氾濫注意 (6.5m)',
    'marker.weir': '★越流堤 (8.7m)',
    'marker.hagibis': '台風19号 (12.35m)',
    'marker.full': '満水 (11.925m)',

    'sec.scenario': '2. 洪水シナリオ',
    'scenario.select': 'シナリオ選択',
    'opt.manual': '手動パラメータ操作 (スライダー連動)',
    'opt.hagibis2019': '令和元年 台風19号 (2019年実測再現)',
    'opt.flood_l1': '計画規模洪水 (L1 洪水・約100年確率)',
    'opt.flood_l2': '想定最大規模洪水 (L2 洪水・3,900万m³満水)',
    'opt.step_test': 'ステップ増水テスト (+1m/10分)',
    'btn.play': '▶ 再生',
    'btn.pause': '⏸ 一時停止',
    'btn.reset': '↺ リセット',
    'btn.csv': '⬇ CSV出力',
    'btn.csvTitle': '選択中のシナリオを最初から最後まで計算し、10分ごとの結果をCSVで保存します',
    'btn.csvBusy': '計算中…',
    'speed.label': '再生速度:',

    'sec.metrics': '3. 遊水池・治水機能メーター',
    'm.inflow': '越流流入量 Q',
    'm.basinLvl': '調節池水位',
    'm.wet': '調節池内 浸水面積 (全体 約6.1km²)',
    'm.volume': '総貯水量 (容量3,900万m³)',
    'm.volumeValue': '{v} 万m³ ({p}%)',
    'm.downstream': '下流都心（荒川区・岩淵水門）水位低減効果',
    'm.gate': '出口関門 (排水門)',
    'gate.closed': '🔒 全閉 (流入水を完全貯留中)',
    'gate.open': '🔓 開放',
    'm.gateNote': '※ 洪水時は下流への流出を防ぐため出口関門（排水門）は全閉され、第一調節池内に最大3,900万m³の洪水を閉じ込めます。',

    'sec.display': '4. 3D表示 & 自由視点 (Free Camera)',
    'display.terrain': '地表モード',
    'display.aerial': '航空写真 (国土地理院)',
    'display.elevation': '標高段彩 (色分け)',
    'display.water': '水面モード',
    'display.waterReal': 'リアル水面',
    'display.waterHazard': '浸水深ハザード色',
    'display.basinLine': '★ 遊水池範囲ライン強調 (立体ネオン囲み)',
    'display.labels': '施設・土手ラベル (越流堤・彩湖・囲ぎょう堤)',
    'display.camera': 'カメラ視点',
    'view.overview': '🌐 広域全体俯瞰',
    'view.regional': '🗾 流域全体 (背景地形)',
    'view.basin': '🌊 遊水池全域',
    'view.weir': '★ 越流堤・流入部',
    'view.saiko': '🏞 彩湖・秋ヶ瀬',
    'view.gate': '🔒 出口水門 (全閉)',
    'view.eyeLevel': '🚶 堤防上アイレベル',
    'view.free': '🎮 自由視点リセット',
    'hint.label': '操作',
    'hint.text': ': 左ドラッグで回転 / 右ドラッグで平行移動 / ホイールでズーム / WASDで前後左右移動 / Space・Shiftで昇降',

    'tab.crossSection': '堤防・河道・遊水池 横断断面図 (リアルタイム)',
    'tab.chart': '時系列ハイドログラフ & 貯水曲線',
    'drawer.minimize': '▼ 最小化',
    'drawer.expand': '▲ 展開',
    'drawer.toggleTitle': '最小化/展開',

    'cs.leveeLine': '本堤天端 A.P.+{v}m (堤防外背後地防護)',
    'cs.leveeLineKu': '本堤天端 A.P.+8.8m (荒川区防護)',
    'cs.weirLine': '越流堤天端 A.P.+8.70m',
    'cs.river': '荒川本川 水位: A.P.+{v}m',
    'cs.riverKu': '荒川放水路 水位: A.P.+{v}m',
    'cs.basin': '第一調節池 水位: A.P.+{v}m',
    'cs.overflow': '▼ 越流中! (Q = {q} m³/s)',
    'cs.west': '◀ 西 (朝霞・志木)',
    'cs.east': '東 (さいたま・戸田) ▶',
    'cs.westKu': '◀ 足立・北区',
    'cs.eastKu': '都心 (南千住・隅田川) ▶',

    'chart.weir': '越流 8.7m',
    'chart.volUnit': '万m³',
    'chart.legendRiver': '― 荒川水位 (A.P. m)',
    'chart.legendVol': '--- 貯水量 (万m³)',

    'csv.headers': '経過時間(h),経過時刻,荒川水位 A.P.(m),荒川水位 T.P.(m),越流流入量 Q(m3/s),越流中,調節池水位 A.P.(m),総貯水量(万m3),容量比(%),調節池内浸水面積(km2),下流水位低減効果(cm)',
    'csv.yes': '越流',
    'csv.no': '-',
  },
  en: {
    'doc.title': 'Arakawa Flood — 1st Retarding Basin 3D Simulator',
    'lang.toggle': '日本語',
    'lang.toggleTitle': '日本語に切り替え',
    'panel.open': 'Open panel',
    'panel.openTitle': 'Open the control panel',
    'panel.collapseTitle': 'Collapse the panel (wider view)',
    'app.subtitle': 'Arakawa 1st Retarding Basin & river corridor — 3D simulator (32 km × 14 km)',

    'sec.river': '1. Arakawa river stage',
    'badge.inChannel': 'Flowing within the channel',
    'badge.overflow': '★ Overflowing into the basin!',
    'river.level': 'Arakawa river level',
    'marker.normal': 'Normal (2.5m)',
    'marker.warning': 'Flood warning (6.5m)',
    'marker.weir': '★Weir crest (8.7m)',
    'marker.hagibis': 'Hagibis 2019 (12.35m)',
    'marker.full': 'Basin full (11.925m)',

    'sec.scenario': '2. Flood scenarios',
    'scenario.select': 'Scenario',
    'opt.manual': 'Manual control (slider)',
    'opt.hagibis2019': 'Typhoon Hagibis 2019 (reconstruction)',
    'opt.flood_l1': 'Design-scale flood (L1, ~1/100 yr)',
    'opt.flood_l2': 'Max probable flood (L2, basin full)',
    'opt.step_test': 'Step rise test (+1m / 10 min)',
    'btn.play': '▶ Play',
    'btn.pause': '⏸ Pause',
    'btn.reset': '↺ Reset',
    'btn.csv': '⬇ Export CSV',
    'btn.csvTitle': 'Run the selected scenario from start to end and save 10-minute results as CSV',
    'btn.csvBusy': 'Computing…',
    'speed.label': 'Speed:',

    'sec.metrics': '3. Retarding basin metrics',
    'm.inflow': 'Weir inflow Q',
    'm.basinLvl': 'Basin water level',
    'm.wet': 'Flooded area in basin (total ≈6.1 km²)',
    'm.volume': 'Stored volume (capacity 39.0 million m³)',
    'm.volumeValue': '{vm} million m³ ({p}%)',
    'm.downstream': 'Stage reduction downstream (Iwabuchi / Arakawa-ku)',
    'm.gate': 'Outlet gate (drainage sluice)',
    'gate.closed': '🔒 Closed (storing all inflow)',
    'gate.open': '🔓 Open',
    'm.gateNote': '* During floods the outlet gate stays closed so nothing drains downstream; the basin can hold up to 39 million m³.',

    'sec.display': '4. 3D display & free camera',
    'display.terrain': 'Ground',
    'display.aerial': 'Aerial photo (GSI)',
    'display.elevation': 'Elevation tint',
    'display.water': 'Water',
    'display.waterReal': 'Realistic',
    'display.waterHazard': 'Depth hazard colors',
    'display.basinLine': '★ Highlight basin boundary',
    'display.labels': 'Facility & levee labels',
    'display.camera': 'Camera',
    'view.overview': '🌐 Corridor overview',
    'view.regional': '🗾 Whole basin (backdrop)',
    'view.basin': '🌊 Retarding basin',
    'view.weir': '★ Overflow weir',
    'view.saiko': '🏞 Saiko / Akigase',
    'view.gate': '🔒 Outlet gate (closed)',
    'view.eyeLevel': '🚶 Eye level on levee',
    'view.free': '🎮 Reset free camera',
    'hint.label': 'Controls',
    'hint.text': ': left-drag rotate / right-drag pan / wheel zoom / WASD move / Space·Shift up·down',

    'tab.crossSection': 'Cross-section: levees, channel, basin (live)',
    'tab.chart': 'Hydrograph & storage curve',
    'drawer.minimize': '▼ Minimize',
    'drawer.expand': '▲ Expand',
    'drawer.toggleTitle': 'Minimize / expand',

    'cs.leveeLine': 'Main levee crest A.P.+{v}m',
    'cs.leveeLineKu': 'Main levee crest A.P.+8.8m (Arakawa-ku)',
    'cs.weirLine': 'Weir crest A.P.+8.70m',
    'cs.river': 'Arakawa level: A.P.+{v}m',
    'cs.riverKu': 'Arakawa floodway level: A.P.+{v}m',
    'cs.basin': 'Basin level: A.P.+{v}m',
    'cs.overflow': '▼ Overflowing! (Q = {q} m³/s)',
    'cs.west': '◀ West (Asaka, Shiki)',
    'cs.east': 'East (Saitama, Toda) ▶',
    'cs.westKu': '◀ Adachi / Kita',
    'cs.eastKu': 'Central Tokyo (Minami-Senju, Sumida) ▶',

    'chart.weir': 'Weir 8.7m',
    'chart.volUnit': '×10⁴m³',
    'chart.legendRiver': '― River level (A.P. m)',
    'chart.legendVol': '--- Storage (×10⁴ m³)',

    'csv.headers': 'elapsed_h,elapsed_hhmm,river_level_AP_m,river_level_TP_m,weir_inflow_m3s,overflowing,basin_level_AP_m,stored_volume_million_m3,capacity_pct,basin_flooded_area_km2,downstream_reduction_cm',
    'csv.yes': 'yes',
    'csv.no': 'no',
  },
};

const STORAGE_KEY = 'arakawa-flood.lang';
let lang = 'ja';
try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'ja' || saved === 'en') lang = saved;
} catch {
  // storage unavailable: stay with the default
}
const listeners = [];

export const getLang = () => lang;

export function t(key, vars = {}) {
  const s = DICT[lang][key] ?? DICT.ja[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : `{${k}}`));
}

/** Pick the language-specific field of a data record, e.g. pick(item, 'name') -> name_en in English. */
export function pick(obj, field) {
  return (lang === 'en' && obj[`${field}_en`]) || obj[field];
}

export function applyI18n(root = document) {
  document.documentElement.lang = lang;
  document.title = t('doc.title');
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
}

export function setLang(next) {
  lang = next === 'en' ? 'en' : 'ja';
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // not persisted; still switches for this session
  }
  applyI18n();
  listeners.forEach((fn) => fn(lang));
}

export function onLangChange(fn) {
  listeners.push(fn);
}
