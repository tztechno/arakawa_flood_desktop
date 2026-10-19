import { toTP, toAP } from './proj.js';
import { SCENARIOS, getScenarioRiverLevel, WEIR_ELEV_AP } from './scenarios.js';
import { ArakawaSimulator } from './sim.js';
import { ArakawaScene } from './scene.js';
import { CrossSectionDrawer } from './crossSection.js';
import { TimeSeriesChart } from './chart.js';
import { SceneLabels } from './labels.js';
import { t, pick, applyI18n, setLang, getLang, onLangChange } from './i18n.js';

class App {
  constructor() {
    this.regionName = 'wide';
    this.currentScenario = SCENARIOS.manual;
    this.isPlaying = false;
    this.simTimeSec = 0;
    this.simSpeed = 300; // x times real time
    this.volumeHistory = [];

    this.activeDrawerTab = 'crossSection';
    this.isDrawerMinimized = false;

    this.init();
  }

  async init() {
    applyI18n();

    // 1. Fetch Wide Region metadata and ground binary
    await this.loadRegion('wide');
    this.loadBackdrop();

    // 2. Setup Drawers & Charts
    this.crossSectionCanvas = document.getElementById('crossSectionCanvas');
    this.chartCanvas = document.getElementById('chartCanvas');
    this.crossSectionDrawer = new CrossSectionDrawer(this.crossSectionCanvas);
    this.timeSeriesChart = new TimeSeriesChart(this.chartCanvas);

    // 3. Setup Labels
    this.labelOverlay = document.getElementById('labelOverlay');
    this.labels = new SceneLabels(this.labelOverlay, this.scene.camera, this.currentRegion);
    this.labelsData = await fetch('/data/labels.json').then((r) => r.json()).catch(() => []);
    this.labels.load(this.labelsData);

    // 4. Wire UI Listeners
    this.setupUI();
    this.updatePlaybackUI();
    this.refreshLanguage();
    onLangChange(() => this.refreshLanguage());

    // 5. Start Render Loop
    this.lastFrameTime = performance.now();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);

    window.addEventListener('resize', () => {
      this.scene?.onResize();
    });
  }

  /** Wide-area backdrop terrain (arakawa.tif + aerial photo), always shown around the detailed region */
  async loadBackdrop() {
    try {
      const meta = await fetch('/data/regions/outer/meta.json').then((r) => r.json());
      const ground = new Float32Array(await fetch('/data/regions/outer/ground.f32').then((r) => r.arrayBuffer()));
      this.scene.addBackdrop({ meta, ground });
    } catch (err) {
      console.warn('Backdrop terrain not available:', err);
    }
  }

  /** Re-render every language-dependent text that is not covered by data-i18n markup */
  refreshLanguage() {
    const descEl = document.getElementById('scenarioDesc');
    if (descEl) descEl.textContent = pick(this.currentScenario, 'desc');
    if (this.playBtn) this.playBtn.textContent = this.isPlaying ? t('btn.pause') : t('btn.play');
    const drawerToggleBtn = document.getElementById('drawerToggleBtn');
    if (drawerToggleBtn) drawerToggleBtn.textContent = this.isDrawerMinimized ? t('drawer.expand') : t('drawer.minimize');
    if (this.labels && this.labelsData) this.labels.load(this.labelsData);
  }

  /** Run the selected timeline scenario on a separate simulator and download 10-minute results as CSV */
  async exportScenarioCsv() {
    const sc = this.currentScenario;
    if (!sc.hasTimeline || this.csvBusy) return;
    const btn = document.getElementById('csvBtn');
    this.csvBusy = true;
    if (btn) { btn.disabled = true; btn.textContent = t('btn.csvBusy'); }
    await new Promise((r) => setTimeout(r, 30)); // let the button repaint before the batch run

    try {
      const DT = 30, OUT_EVERY = 600; // 30 s integration step, one row every 10 minutes
      const dur = sc.durationHours * 3600;
      const sim = new ArakawaSimulator(this.currentRegion);
      sim.setRiverLevel(getScenarioRiverLevel(sc.id, 0), 0, false);
      const en = getLang() === 'en';
      const rows = [t('csv.headers')];
      const record = (tSec) => {
        const m = sim.getMetrics();
        const hh = String(Math.floor(tSec / 3600)).padStart(2, '0'), mm = String(Math.floor((tSec % 3600) / 60)).padStart(2, '0');
        rows.push([
          (tSec / 3600).toFixed(3), `${hh}:${mm}`,
          m.riverLevelAP.toFixed(3), m.riverLevelTP.toFixed(3),
          m.inflowM3s, m.isOverflowing ? t('csv.yes') : t('csv.no'),
          m.basinLevelAP.toFixed(3),
          en ? (sim.storedVolumeM3 / 1e6).toFixed(3) : (sim.storedVolumeM3 / 1e4).toFixed(1),
          m.volCapPct, m.basinWetAreaKm2, m.downstreamReductCm,
        ].join(','));
      };
      record(0);
      for (let tSec = DT; tSec <= dur; tSec += DT) {
        sim.setRiverLevel(getScenarioRiverLevel(sc.id, tSec), DT, false);
        if (tSec % OUT_EVERY === 0) record(tSec);
      }

      const meta = en
        ? `# ${sc.name_en || sc.name}, ${sc.durationHours} h, step ${DT} s, output every ${OUT_EVERY / 60} min`
        : `# ${sc.name}、${sc.durationHours}時間、計算刻み${DT}秒、${OUT_EVERY / 60}分ごと出力`;
      const blob = new Blob(['\ufeff' + [meta, ...rows].join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `arakawa_${sc.id}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } finally {
      this.csvBusy = false;
      if (btn) { btn.disabled = false; btn.textContent = t('btn.csv'); }
    }
  }

  async loadRegion(name) {
    this.regionName = name;
    const meta = await fetch(`/data/regions/${name}/meta.json`).then((r) => r.json());
    const groundBuf = await fetch(`/data/regions/${name}/ground.f32`).then((r) => r.arrayBuffer());
    const ground = new Float32Array(groundBuf);

    this.currentRegion = {
      meta,
      ...meta,
      ground,
    };

    // Dispose previous scene if exists
    if (this.scene) {
      this.scene.renderer.dispose();
      document.getElementById('canvas3d').replaceWith(document.getElementById('canvas3d').cloneNode());
    }

    const canvas = document.getElementById('canvas3d');
    this.scene = new ArakawaScene(canvas, this.currentRegion);
    this.sim = new ArakawaSimulator(this.currentRegion);
    this.crossSectionDrawer?.setRegion(name);

    if (this.labels) {
      this.labels.region = this.currentRegion;
      this.labels.camera = this.scene.camera;
    }

    if (this.slider) {
      this.slider.min = '1.50';
      this.slider.max = '16.00';
      this.slider.value = '7.50';
      this.setRiverLevelDirect(7.50);
    }

    if (this.crossSectionDrawer && this.sim) {
      this.crossSectionDrawer.draw(this.sim.getMetrics());
    }
  }

  setupUI() {
    // 1. Sidebar Toggle / Collapse
    const sidebar = document.getElementById('sidebar');
    const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
    const sidebarOpenBtn = document.getElementById('sidebarOpenBtn');

    if (sidebarToggleBtn && sidebar) {
      sidebarToggleBtn.addEventListener('click', () => {
        sidebar.classList.add('collapsed');
        if (sidebarOpenBtn) sidebarOpenBtn.style.display = 'flex';
      });
    }

    if (sidebarOpenBtn && sidebar) {
      sidebarOpenBtn.addEventListener('click', () => {
        sidebar.classList.remove('collapsed');
        sidebarOpenBtn.style.display = 'none';
      });
    }

    // 2. River Level Slider & Quick Markers
    this.slider = document.getElementById('riverLevelSlider');
    this.levelVal = document.getElementById('levelVal');
    this.tpVal = document.getElementById('tpVal');

    if (this.slider) {
      this.slider.addEventListener('input', (e) => {
        const lvl = parseFloat(e.target.value);
        this.setRiverLevelDirect(lvl);
        if (this.currentScenario.id !== 'manual') {
          const scSel = document.getElementById('scenarioSelect');
          if (scSel) scSel.value = 'manual';
          this.selectScenario('manual');
        }
      });
    }

    document.querySelectorAll('.markerBtn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = parseFloat(btn.dataset.val);
        if (this.slider) this.slider.value = val;
        this.setRiverLevelDirect(val);
        if (this.currentScenario.id !== 'manual') {
          const scSel = document.getElementById('scenarioSelect');
          if (scSel) scSel.value = 'manual';
          this.selectScenario('manual');
        }
      });
    });

    // 3. Scenario Dropdown
    const scenarioSelect = document.getElementById('scenarioSelect');
    if (scenarioSelect) {
      scenarioSelect.addEventListener('change', (e) => {
        this.selectScenario(e.target.value);
      });
    }

    // 4. Playback buttons
    this.playBtn = document.getElementById('playBtn');
    this.resetBtn = document.getElementById('resetBtn');
    this.speedSlider = document.getElementById('speedSlider');
    this.speedDisplay = document.getElementById('speedDisplay');
    this.timeDisplay = document.getElementById('timeDisplay');

    if (this.playBtn) {
      this.playBtn.addEventListener('click', () => {
        this.isPlaying = !this.isPlaying;
        this.playBtn.textContent = this.isPlaying ? t('btn.pause') : t('btn.play');
        this.playBtn.className = this.isPlaying ? 'btn' : 'btn primary';
      });
    }

    if (this.resetBtn) {
      this.resetBtn.addEventListener('click', () => {
        this.simTimeSec = 0;
        this.volumeHistory = [];
        this.sim.resetStorage();
        if (!this.currentScenario.hasTimeline) return; // manual: drain the basin, keep the river stage
        const initLvl = getScenarioRiverLevel(this.currentScenario.id, 0);
        if (this.slider) this.slider.value = initLvl;
        this.setRiverLevelDirect(initLvl);
      });
    }

    const csvBtn = document.getElementById('csvBtn');
    if (csvBtn) csvBtn.addEventListener('click', () => this.exportScenarioCsv());

    const langToggleBtn = document.getElementById('langToggleBtn');
    if (langToggleBtn) langToggleBtn.addEventListener('click', () => setLang(getLang() === 'ja' ? 'en' : 'ja'));

    if (this.speedSlider) {
      this.speedSlider.addEventListener('input', (e) => {
        this.simSpeed = parseInt(e.target.value, 10);
        if (this.speedDisplay) this.speedDisplay.textContent = `${this.simSpeed}x`;
      });
    }

    // 5. Display & Free View options
    const terrainMode = document.getElementById('terrainMode');
    if (terrainMode) {
      terrainMode.addEventListener('change', (e) => {
        this.scene.setTerrainMode(parseInt(e.target.value, 10));
      });
    }

    const waterMode = document.getElementById('waterMode');
    if (waterMode) {
      waterMode.addEventListener('change', (e) => {
        this.scene.setWaterMode(parseInt(e.target.value, 10));
      });
    }

    const basinLineCheck = document.getElementById('basinLineCheck');
    if (basinLineCheck) {
      basinLineCheck.addEventListener('change', (e) => {
        this.scene.setBasinHighlight(e.target.checked);
      });
    }

    const labelsCheck = document.getElementById('labelsCheck');
    if (labelsCheck) {
      labelsCheck.addEventListener('change', (e) => {
        this.labels.setVisible(e.target.checked);
      });
    }

    // 6. Camera preset buttons
    document.querySelectorAll('.viewBtn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.viewBtn').forEach((b) => b.classList.remove('primaryView'));
        btn.classList.add('primaryView');
        this.scene.setPresetView(btn.dataset.view);
      });
    });

    // 7. Drawer Tabs
    document.querySelectorAll('.drawerTab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.drawerTab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        this.activeDrawerTab = tab.dataset.tab;
        if (this.activeDrawerTab === 'crossSection') {
          this.crossSectionCanvas.style.display = 'block';
          this.chartCanvas.style.display = 'none';
        } else {
          this.crossSectionCanvas.style.display = 'none';
          this.chartCanvas.style.display = 'block';
        }
      });
    });

    // Drawer Minimize Toggle
    const drawerToggleBtn = document.getElementById('drawerToggleBtn');
    const bottomDrawer = document.getElementById('bottomDrawer');
    if (drawerToggleBtn && bottomDrawer) {
      drawerToggleBtn.addEventListener('click', () => {
        this.isDrawerMinimized = !this.isDrawerMinimized;
        bottomDrawer.classList.toggle('minimized', this.isDrawerMinimized);
        drawerToggleBtn.textContent = this.isDrawerMinimized ? t('drawer.expand') : t('drawer.minimize');
      });
    }
  }

  selectScenario(id) {
    this.currentScenario = SCENARIOS[id] || SCENARIOS.manual;
    const descEl = document.getElementById('scenarioDesc');
    if (descEl) descEl.textContent = pick(this.currentScenario, 'desc');

    if (this.currentScenario.hasTimeline) {
      this.simTimeSec = 0;
      this.volumeHistory = [];
      this.sim.resetStorage();
      const initLvl = getScenarioRiverLevel(this.currentScenario.id, 0);
      if (this.slider) this.slider.value = initLvl;
      this.setRiverLevelDirect(initLvl);
    } else {
      this.isPlaying = false;
      if (this.playBtn) this.playBtn.textContent = t('btn.play');
    }
    this.updatePlaybackUI();
  }

  // Reset & speed are shown in every mode (manual mode also advances time); play/time only for timelines
  updatePlaybackUI() {
    const playbackControls = document.getElementById('playbackControls');
    if (playbackControls) playbackControls.style.display = 'flex';
    const timeline = this.currentScenario.hasTimeline;
    if (this.playBtn) this.playBtn.style.display = timeline ? '' : 'none';
    if (this.timeDisplay) this.timeDisplay.style.display = timeline ? '' : 'none';
    const csvBtn = document.getElementById('csvBtn');
    if (csvBtn) csvBtn.style.display = timeline ? '' : 'none';
  }

  setRiverLevelDirect(lvl) {
    if (this.levelVal) this.levelVal.textContent = lvl.toFixed(2);
    if (this.tpVal) this.tpVal.textContent = `T.P. +${toTP(lvl).toFixed(2)}m`;
    this.sim.setRiverLevel(lvl, 0);
  }

  loop(timestamp) {
    requestAnimationFrame(this.loop);
    const dtRealSec = Math.min(0.1, (timestamp - this.lastFrameTime) / 1000);
    this.lastFrameTime = timestamp;

    // Timeline simulation step
    if (this.isPlaying && this.currentScenario.hasTimeline) {
      const dtSimSec = dtRealSec * this.simSpeed;
      this.simTimeSec += dtSimSec;

      const maxSec = this.currentScenario.durationHours * 3600;
      if (this.simTimeSec > maxSec) {
        this.simTimeSec = maxSec;
        this.isPlaying = false;
        if (this.playBtn) this.playBtn.textContent = t('btn.play');
      }

      const riverLvl = getScenarioRiverLevel(this.currentScenario.id, this.simTimeSec);
      if (this.slider) this.slider.value = riverLvl;
      if (this.levelVal) this.levelVal.textContent = riverLvl.toFixed(2);
      if (this.tpVal) this.tpVal.textContent = `T.P. +${toTP(riverLvl).toFixed(2)}m`;

      this.sim.setRiverLevel(riverLvl, dtSimSec);

      // Record volume history for chart
      const metrics = this.sim.getMetrics();
      this.volumeHistory.push({ t: this.simTimeSec, volMan: parseFloat(metrics.volManM3) });
      if (this.volumeHistory.length > 500) this.volumeHistory.shift();

      // Update time display
      if (this.timeDisplay) {
        const curH = Math.floor(this.simTimeSec / 3600);
        const curM = Math.floor((this.simTimeSec % 3600) / 60);
        const totH = this.currentScenario.durationHours;
        this.timeDisplay.textContent = `${String(curH).padStart(2, '0')}:${String(curM).padStart(2, '0')} / ${String(totH).padStart(2, '0')}:00`;
      }
    } else if (!this.currentScenario.hasTimeline) {
      // Manual mode: time keeps running at the playback speed, so a river held above the weir
      // keeps filling the basin compartment by compartment
      this.sim.setRiverLevel(this.sim.riverLevelAP, dtRealSec * this.simSpeed);
    }

    // Update 3D scene water texture and pass dt for keyboard free flight
    this.scene.updateWaterData(this.sim.depth, this.sim.waterLevel);
    this.scene.render(timestamp / 1000, dtRealSec);

    // Update 3D screen labels
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    this.labels.update(vw, vh);

    // Update UI Metrics
    const m = this.sim.getMetrics();
    const elInflow = document.getElementById('metricInflow');
    if (elInflow) elInflow.textContent = `${m.inflowM3s.toLocaleString()} m³/s`;

    const elBasinLvl = document.getElementById('metricBasinLvl');
    if (elBasinLvl) elBasinLvl.textContent = `A.P.+${m.basinLevelAP.toFixed(2)}m`;

    const elVolume = document.getElementById('metricVolume');
    if (elVolume) elVolume.textContent = t('m.volumeValue', { v: m.volManM3, vm: (parseFloat(m.volManM3) / 100).toFixed(2), p: m.volCapPct });

    const capBar = document.getElementById('capacityBar');
    if (capBar) capBar.style.width = `${Math.min(100, m.volCapPct)}%`;

    const elDownstream = document.getElementById('metricDownstream');
    if (elDownstream) elDownstream.textContent = `- ${m.downstreamReductCm} cm`;

    const gateStatus = document.getElementById('metricGateStatus');
    if (gateStatus) {
      gateStatus.textContent = m.exitGateStatus === 'CLOSED' ? t('gate.closed') : t('gate.open');
      gateStatus.className = m.exitGateStatus === 'CLOSED' ? 'metricValue green' : 'metricValue orange';
    }

    // Overflow Badge
    const badge = document.getElementById('overflowBadge');
    if (badge) {
      if (m.isOverflowing) {
        badge.textContent = t('badge.overflow');
        badge.style.color = 'var(--accent-cyan)';
      } else {
        badge.textContent = t('badge.inChannel');
        badge.style.color = 'var(--text-dim)';
      }
    }

    const elWet = document.getElementById('metricWetArea');
    if (elWet) elWet.textContent = `${m.basinWetAreaKm2} km²`;

    // Render Drawer Canvases
    if (!this.isDrawerMinimized) {
      if (this.activeDrawerTab === 'crossSection') {
        this.crossSectionDrawer.draw(m);
      } else {
        this.timeSeriesChart.draw({
          hydrograph: this.currentScenario.hydrograph || [],
          currentHour: this.simTimeSec / 3600,
          volumeHistory: this.volumeHistory,
          totalHours: this.currentScenario.durationHours || 36,
        });
      }
    }
  }
}

new App();
