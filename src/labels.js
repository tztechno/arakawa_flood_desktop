// 3D Landmark & Levee Labels Manager
import * as THREE from 'three';
import { toPlane } from './proj.js';
import { pick } from './i18n.js';

export class SceneLabels {
  constructor(container, camera, region) {
    this.container = container;
    this.camera = camera;
    this.region = region;
    this.elements = [];
    this.visible = true;
    this.v3 = new THREE.Vector3();
  }

  load(items) {
    // Clear old tags
    this.container.innerHTML = '';
    this.elements = [];
    const { originE, originN, ground, nx, ny, res } = this.region;
    const W = nx * res, H = ny * res;

    items.forEach(item => {
      const [e, n] = toPlane(item.lon, item.lat);
      const x = e - originE;
      const z = originN - n;

      if (x < -100 || x > W + 100 || z < -100 || z > H + 100) return;

      // Sample ground elevation
      const gx = Math.min(nx - 1, Math.max(0, Math.floor(x / res)));
      const gy = Math.min(ny - 1, Math.max(0, Math.floor(z / res)));
      const groundZ = ground ? ground[gy * nx + gx] : 5;
      const y = Math.max(groundZ + 12, (item.elevTP || 5) + 8);

      const el = document.createElement('div');
      el.className = `mapLabel type-${item.type || 'default'}`;
      el.innerHTML = `
        <div class="labelPin"></div>
        <div class="labelCard">
          <span class="labelTitle">${pick(item, 'name')}</span>
          ${item.elevAP ? `<span class="labelElev">A.P.+${item.elevAP.toFixed(2)}m</span>` : ''}
        </div>
      `;
      el.title = pick(item, 'desc') || '';
      this.container.appendChild(el);

      this.elements.push({
        el,
        worldPos: new THREE.Vector3(x, y, z),
      });
    });
  }

  setVisible(visible) {
    this.visible = visible;
    this.container.style.display = visible ? 'block' : 'none';
  }

  update(width, height) {
    if (!this.visible || !this.elements.length) return;

    this.elements.forEach(item => {
      this.v3.copy(item.worldPos);
      this.v3.project(this.camera);

      // In front of camera
      if (this.v3.z > 0 && this.v3.z < 1) {
        const sx = (this.v3.x * 0.5 + 0.5) * width;
        const sy = (-this.v3.y * 0.5 + 0.5) * height;

        if (sx >= 0 && sx <= width && sy >= 0 && sy <= height) {
          item.el.style.transform = `translate(${sx}px, ${sy}px)`;
          item.el.style.display = 'block';
          return;
        }
      }
      item.el.style.display = 'none';
    });
  }
}
