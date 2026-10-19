// 3D Scene Manager for Arakawa River & 1st Retarding Basin (Three.js WebGL)
// High-fidelity terrain conforming to arakawa.tif DEM and GSI aerial photos
// Features 32km x 14km ultra-wide panoramic landscape, exact surveyed levee boundaries, and closed exit sluice gate.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { toTP, toAP } from './proj.js';
import { BASIN_PERIMETER_SURVEYED, LEVEE_EAST_DEFENSE } from './basinGeometry.js';

// Shaders
const TERRAIN_VERT = `
  varying vec2 vUv;
  varying float vElevation;
  varying vec3 vNormalWorld;

  void main() {
    vUv = uv;
    vElevation = position.y;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vNormalWorld = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const TERRAIN_FRAG = `
  uniform sampler2D uAerial;
  uniform int uMode; // 0 = aerial, 1 = elevation color
  uniform vec3 uSun;
  uniform vec2 uHRange; // min, max elevation

  varying vec2 vUv;
  varying float vElevation;
  varying vec3 vNormalWorld;

  vec3 elevationColor(float h) {
    float t = clamp((h - uHRange.x) / (uHRange.y - uHRange.x), 0.0, 1.0);
    vec3 c0 = vec3(0.12, 0.35, 0.65); // water / low
    vec3 c1 = vec3(0.25, 0.70, 0.45); // low floodplain
    vec3 c2 = vec3(0.85, 0.85, 0.40); // terrace
    vec3 c3 = vec3(0.80, 0.50, 0.25); // hills
    vec3 c4 = vec3(0.60, 0.30, 0.20); // high
    if (t < 0.25) return mix(c0, c1, t / 0.25);
    if (t < 0.50) return mix(c1, c2, (t - 0.25) / 0.25);
    if (t < 0.75) return mix(c2, c3, (t - 0.50) / 0.25);
    return mix(c3, c4, (t - 0.75) / 0.25);
  }

  void main() {
    vec3 aerial = texture2D(uAerial, vUv).rgb;
    vec3 norm = normalize(vNormalWorld);
    float diff = max(0.25, dot(norm, uSun));

    vec3 baseCol;
    if (uMode == 1) {
      baseCol = elevationColor(vElevation);
    } else {
      baseCol = aerial;
    }

    vec3 finalCol = baseCol * (diff * 0.75 + 0.35);
    gl_FragColor = vec4(finalCol, 1.0);
  }
`;

const WATER_VERT = `
  uniform sampler2D uDepth;
  uniform sampler2D uWL;
  uniform vec2 uSize; // nx, ny
  uniform float uRes;

  varying vec2 vUv;
  varying float vDepth;
  varying float vWL;
  varying vec3 vNormalWorld;
  varying vec3 vViewDir;

  void main() {
    vUv = uv;
    float depth = texture2D(uDepth, uv).r;
    float wl = texture2D(uWL, uv).r;
    vDepth = depth;
    vWL = wl;

    vec3 pos = position;
    if (depth > 0.005) {
      pos.y = wl + 0.05; // conform directly to simulated water level
    }

    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vNormalWorld = vec3(0.0, 1.0, 0.0);
    vViewDir = normalize(cameraPosition - worldPos.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const WATER_FRAG = `
  uniform sampler2D uDepth;
  uniform vec3 uSun;
  uniform float uTime;
  uniform int uWaterMode; // 0 = realistic, 1 = hazard color
  uniform float uOpacity;

  varying vec2 vUv;
  varying float vDepth;
  varying float vWL;
  varying vec3 vNormalWorld;
  varying vec3 vViewDir;

  vec3 depthToHazardColor(float d) {
    if (d < 0.5) return vec3(1.0, 0.95, 0.4);   // < 0.5m yellow
    if (d < 3.0) return vec3(1.0, 0.55, 0.0);   // 0.5 - 3m orange
    if (d < 5.0) return vec3(0.95, 0.20, 0.20);  // 3 - 5m red
    return vec3(0.65, 0.10, 0.70);              // > 5m purple
  }

  void main() {
    // Soft alpha fade at shorelines to ensure smooth transition
    if (vDepth < 0.01) discard;
    float shoreAlpha = smoothstep(0.01, 0.35, vDepth);

    // Realistic water surface
    vec2 waveUv = vUv * 60.0 + vec2(uTime * 0.03, uTime * 0.02);
    float wave = sin(waveUv.x * 6.28) * cos(waveUv.y * 6.28) * 0.04;
    vec3 norm = normalize(vec3(wave, 1.0, wave));

    vec3 deepWater = vec3(0.04, 0.28, 0.58);
    vec3 shallowWater = vec3(0.0, 0.65, 0.92);
    vec3 col = mix(shallowWater, deepWater, clamp(vDepth / 4.0, 0.0, 1.0));

    // Fresnel specular
    float fresnel = pow(1.0 - max(0.0, dot(norm, vViewDir)), 3.0);
    vec3 halfVec = normalize(uSun + vViewDir);
    float spec = pow(max(0.0, dot(norm, halfVec)), 32.0) * 0.5;

    float diff = max(0.4, dot(norm, uSun));
    vec3 finalCol = col * (diff * 0.5 + 0.5) + vec3(spec + fresnel * 0.3);

    if (uWaterMode == 1) {
      finalCol = depthToHazardColor(vDepth);
    }

    float alpha = clamp(uOpacity * shoreAlpha, 0.0, 0.92);
    gl_FragColor = vec4(finalCol, alpha);
  }
`;

export class ArakawaScene {
  constructor(canvas, region) {
    this.canvas = canvas;
    this.region = region;
    this.keys = { forward: false, backward: false, left: false, right: false, up: false, down: false };

    const { nx, ny, res } = region;
    this.W = nx * res;
    this.H = ny * res;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    // Scene & Camera
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0f1d);
    this.scene.fog = new THREE.FogExp2(0x0a0f1d, 0.000035);

    this.camera = new THREE.PerspectiveCamera(
      42,
      canvas.clientWidth / canvas.clientHeight,
      50,
      600000 // far enough to see the whole 荒川 basin backdrop
    );

    // Controls
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.screenSpacePanning = true;
    this.controls.maxPolarAngle = Math.PI * 0.485; // Allow viewing almost horizontally
    this.controls.minDistance = 200;
    this.controls.maxDistance = 250000;

    // Setup free-flight keyboard
    this._setupKeyboard();

    // Lights
    this.sun = new THREE.Vector3(-0.45, 0.8, 0.4).normalize();
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const dirLight = new THREE.DirectionalLight(0xfff5e6, 1.4);
    dirLight.position.copy(this.sun).multiplyScalar(6000);
    this.scene.add(dirLight);

    // Water data textures (flipY = true to match terrain UV mapping)
    this.depthTex = new THREE.DataTexture(new Float32Array(nx * ny), nx, ny, THREE.RedFormat, THREE.FloatType);
    this.depthTex.flipY = true;
    this.depthTex.needsUpdate = true;
    this.wlTex = new THREE.DataTexture(new Float32Array(nx * ny), nx, ny, THREE.RedFormat, THREE.FloatType);
    this.wlTex.flipY = true;
    this.wlTex.needsUpdate = true;

    // Build scene objects
    this._buildTerrain();
    this._buildWater();
    this._buildBasinEnclosureLine();

    // Default view
    this.setPresetView('overview');
  }

  _setupKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.code === 'KeyW' || e.code === 'ArrowUp') this.keys.forward = true;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') this.keys.backward = true;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.keys.left = true;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') this.keys.right = true;
      if (e.code === 'Space' || e.code === 'KeyE') this.keys.up = true;
      if (e.code === 'ShiftLeft' || e.code === 'KeyQ') this.keys.down = true;
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') this.keys.forward = false;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') this.keys.backward = false;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.keys.left = false;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') this.keys.right = false;
      if (e.code === 'Space' || e.code === 'KeyE') this.keys.up = false;
      if (e.code === 'ShiftLeft' || e.code === 'KeyQ') this.keys.down = false;
    });
  }

  _buildTerrain() {
    const { nx, ny, res, ground } = this.region;
    const pos = new Float32Array(nx * ny * 3);
    const uv = new Float32Array(nx * ny * 2);

    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        const x = (i + 0.5) * res;
        const z = (j + 0.5) * res;
        pos[k * 3] = x;
        pos[k * 3 + 1] = ground[k];
        pos[k * 3 + 2] = z;
        uv[k * 2] = x / this.W;
        uv[k * 2 + 1] = 1.0 - z / this.H;
      }
    }

    const idx = new Uint32Array((nx - 1) * (ny - 1) * 6);
    let p = 0;
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
        idx[p++] = a; idx[p++] = c; idx[p++] = b;
        idx[p++] = b; idx[p++] = c; idx[p++] = d;
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeVertexNormals();

    const aerialTex = new THREE.TextureLoader().load(
      `/data/regions/${this.region.meta.name}/aerial.jpg`
    );
    aerialTex.anisotropy = 4;

    this.terrainMat = new THREE.ShaderMaterial({
      vertexShader: TERRAIN_VERT,
      fragmentShader: TERRAIN_FRAG,
      uniforms: {
        uAerial: { value: aerialTex },
        uMode: { value: 0 },
        uSun: { value: this.sun },
        uHRange: { value: new THREE.Vector2(this.region.meta.groundMin, this.region.meta.groundMax) },
      },
    });

    this.terrainMesh = new THREE.Mesh(geo, this.terrainMat);
    this.scene.add(this.terrainMesh);

    // Build solid architectural skirt base around the 32km x 14km terrain
    this._buildTerrainSkirt();
  }

  _buildTerrainSkirt() {
    const { nx, ny, res, ground } = this.region;
    const skirtBottomY = -50.0;
    const skirtVerts = [];
    const skirtIndices = [];

    // Helper to add a quad wall
    const addQuad = (x1, y1, z1, x2, y2, z2) => {
      const baseIdx = skirtVerts.length / 3;
      skirtVerts.push(x1, y1, z1,  x2, y2, z2,  x2, skirtBottomY, z2,  x1, skirtBottomY, z1);
      skirtIndices.push(baseIdx, baseIdx + 1, baseIdx + 2,  baseIdx, baseIdx + 2, baseIdx + 3);
    };

    // North edge (j = 0)
    for (let i = 0; i < nx - 1; i++) {
      addQuad(i * res, ground[i], 0,  (i + 1) * res, ground[i + 1], 0);
    }
    // South edge (j = ny - 1)
    const southOffset = (ny - 1) * nx;
    for (let i = 0; i < nx - 1; i++) {
      addQuad((i + 1) * res, ground[southOffset + i + 1], this.H,  i * res, ground[southOffset + i], this.H);
    }
    // West edge (i = 0)
    for (let j = 0; j < ny - 1; j++) {
      addQuad(0, ground[(j + 1) * nx], (j + 1) * res,  0, ground[j * nx], j * res);
    }
    // East edge (i = nx - 1)
    for (let j = 0; j < ny - 1; j++) {
      addQuad(this.W, ground[j * nx + (nx - 1)], j * res,  this.W, ground[(j + 1) * nx + (nx - 1)], (j + 1) * res);
    }

    const skirtGeo = new THREE.BufferGeometry();
    skirtGeo.setAttribute('position', new THREE.Float32BufferAttribute(skirtVerts, 3));
    skirtGeo.setIndex(skirtIndices);
    skirtGeo.computeVertexNormals();

    const skirtMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.9,
      metalness: 0.1,
    });
    this.skirtMesh = new THREE.Mesh(skirtGeo, skirtMat);
    this.scene.add(this.skirtMesh);
  }

  _buildWater() {
    const { nx, ny, res, ground } = this.region;
    const pos = new Float32Array(nx * ny * 3);
    const uv = new Float32Array(nx * ny * 2);

    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        const x = (i + 0.5) * res;
        const z = (j + 0.5) * res;
        pos[k * 3] = x;
        pos[k * 3 + 1] = ground[k];
        pos[k * 3 + 2] = z;
        uv[k * 2] = x / this.W;
        uv[k * 2 + 1] = 1.0 - z / this.H;
      }
    }

    const idx = new Uint32Array((nx - 1) * (ny - 1) * 6);
    let p = 0;
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
        idx[p++] = a; idx[p++] = c; idx[p++] = b;
        idx[p++] = b; idx[p++] = c; idx[p++] = d;
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));

    this.waterMat = new THREE.ShaderMaterial({
      vertexShader: WATER_VERT,
      fragmentShader: WATER_FRAG,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uDepth: { value: this.depthTex },
        uWL: { value: this.wlTex },
        uRes: { value: res },
        uSize: { value: new THREE.Vector2(nx, ny) },
        uWaterMode: { value: 0 },
        uOpacity: { value: 0.88 },
        uSun: { value: this.sun },
        uTime: { value: 0 },
      },
    });

    this.waterMesh = new THREE.Mesh(geo, this.waterMat);
    this.waterMesh.renderOrder = 2;
    this.scene.add(this.waterMesh);
  }

  /**
   * Prominently enclose and highlight the 1st Retarding Basin boundary with 3D Glowing Ribbons
   * Strictly based on surveyed coordinates of 越流堤, 囲ぎょう堤, 荒川左岸本堤, and 笹目流出水門.
   * Completely excludes the urban city areas!
   */
  _buildBasinEnclosureLine() {
    this.basinGroup = new THREE.Group();
    const { originE, originN } = this.region;

    // High-fidelity surveyed Retarding Basin perimeter vertices
    const pts = BASIN_PERIMETER_SURVEYED.map((pt) => {
      const x = pt.e - originE;
      const z = originN - pt.n;
      const y = toTP(pt.ap) + 3.0; // elevated 3m above levee crest for crisp visibility
      return new THREE.Vector3(x, y, z);
    });

    // 1. Thick Glowing Boundary Tube
    const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.2);
    const tubeGeo = new THREE.TubeGeometry(curve, 256, 9.0, 8, true);
    const tubeMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.95,
    });
    this.basinGroup.add(new THREE.Mesh(tubeGeo, tubeMat));

    // 2. Outer Halo Ribbon for glowing brilliance
    const haloGeo = new THREE.TubeGeometry(curve, 256, 18.0, 8, true);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x0077b6,
      transparent: true,
      opacity: 0.40,
      blending: THREE.AdditiveBlending,
    });
    this.basinGroup.add(new THREE.Mesh(haloGeo, haloMat));

    // 3. Highlight 荒川左岸本堤 (Eastern Defense Levee A.P.+15.2m) with golden shield ribbon
    // Clearly showing that Toda City and Sakura-ku are outside this protective shield!
    const leveeEastPts = LEVEE_EAST_DEFENSE.map((pt) => {
      return new THREE.Vector3(pt.e - originE, toTP(pt.ap) + 4.0, originN - pt.n);
    });
    const leveeCurve = new THREE.CatmullRomCurve3(leveeEastPts, false, 'catmullrom', 0.2);
    const leveeGeo = new THREE.TubeGeometry(leveeCurve, 128, 12.0, 8, false);
    const leveeMat = new THREE.MeshBasicMaterial({ color: 0xffb703 });
    this.basinGroup.add(new THREE.Mesh(leveeGeo, leveeMat));

    // 4. Highlight 越流堤 (Overflow Weir: 8.70m) in high-contrast magenta/cyan
    const weirPts = BASIN_PERIMETER_SURVEYED.filter(p => p.type === 'weir').map(pt => {
      return new THREE.Vector3(pt.e - originE, toTP(pt.ap) + 4.0, originN - pt.n);
    });
    const weirCurve = new THREE.CatmullRomCurve3(weirPts, false);
    const weirGeo = new THREE.TubeGeometry(weirCurve, 32, 14.0, 8, false);
    const weirMat = new THREE.MeshBasicMaterial({ color: 0xff0055 });
    this.basinGroup.add(new THREE.Mesh(weirGeo, weirMat));

    // 5. 3D Exit Sluice Gate Structure at 笹目流出水門 / 荒川第一調節池排水門 (South end outlet)
    // Conspicuously represented as CLOSED during flood storage!
    const gatePt = BASIN_PERIMETER_SURVEYED.find(p => p.type === 'gate') || { e: -17424.4, n: -21396.9, ap: 7.50 };
    const gateX = gatePt.e - originE;
    const gateZ = originN - gatePt.n;
    const gateY = toTP(gatePt.ap);

    const gateGroup = new THREE.Group();
    gateGroup.position.set(gateX, gateY, gateZ);

    // Concrete gate towers
    const towerGeo = new THREE.BoxGeometry(16, 28, 16);
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.6 });
    const towerL = new THREE.Mesh(towerGeo, towerMat);
    towerL.position.set(-18, 14, 0);
    const towerR = new THREE.Mesh(towerGeo, towerMat);
    towerR.position.set(18, 14, 0);
    gateGroup.add(towerL, towerR);

    // Cross beam
    const beamGeo = new THREE.BoxGeometry(52, 8, 14);
    const beam = new THREE.Mesh(beamGeo, towerMat);
    beam.position.set(0, 24, 0);
    gateGroup.add(beam);

    // Heavy steel closed sluice doors (red/dark steel)
    const doorGeo = new THREE.BoxGeometry(24, 18, 6);
    const doorMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.7, roughness: 0.3 });
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(0, 9, 0);
    gateGroup.add(door);

    // Glowing Closed Lock Symbol
    const lockSignGeo = new THREE.CylinderGeometry(8, 8, 4, 16);
    const lockSignMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    const lockSign = new THREE.Mesh(lockSignGeo, lockSignMat);
    lockSign.rotation.x = Math.PI / 2;
    lockSign.position.set(0, 32, 0);
    gateGroup.add(lockSign);

    this.basinGroup.add(gateGroup);
    this.scene.add(this.basinGroup);
  }

  setBasinHighlight(enabled) {
    this.basinGroup.visible = enabled;
  }

  setTerrainMode(mode) {
    this.terrainMat.uniforms.uMode.value = mode;
    if (this.backdropMat) this.backdropMat.uniforms.uMode.value = mode;
  }

  /**
   * Wide-area backdrop (arakawa.tif + aerial photo) around the detailed terrain.
   * Cells under the detailed region are cut out and the seam ring is lowered beneath it.
   * @param {{meta: Object, ground: Float32Array}} outer
   */
  addBackdrop({ meta, ground }) {
    const { nx, ny, res } = meta;
    const inner = this.region;
    const W = nx * res, H = ny * res;
    const pos = new Float32Array(nx * ny * 3);
    const uv = new Float32Array(nx * ny * 2);
    const inside = new Uint8Array(nx * ny);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        const x = meta.originE + (i + 0.5) * res - inner.originE;
        const z = inner.originN - (meta.originN - (j + 0.5) * res);
        // "inside" = under the detailed mesh (its vertices span half a cell in from each edge),
        // so the cut-out never opens a gap beyond the detailed terrain
        const half = inner.res / 2;
        const inX = x >= half && x <= this.W - half, inZ = z >= half && z <= this.H - half;
        inside[k] = inX && inZ ? 1 : 0;
        pos[k * 3] = x;
        pos[k * 3 + 1] = inside[k] ? ground[k] - 2 : ground[k];
        pos[k * 3 + 2] = z;
        uv[k * 2] = ((i + 0.5) * res) / W;
        uv[k * 2 + 1] = 1.0 - ((j + 0.5) * res) / H;
      }
    }
    const idx = [];
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
        if (inside[a] && inside[b] && inside[c] && inside[d]) continue;
        idx.push(a, c, b, b, c, d);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));
    geo.computeVertexNormals();

    const tex = new THREE.TextureLoader().load(`/data/regions/${meta.name}/aerial.jpg`);
    tex.anisotropy = 4;
    this.backdropMat = new THREE.ShaderMaterial({
      vertexShader: TERRAIN_VERT,
      fragmentShader: TERRAIN_FRAG,
      uniforms: {
        uAerial: { value: tex },
        uMode: { value: this.terrainMat.uniforms.uMode.value },
        uSun: { value: this.sun },
        uHRange: { value: new THREE.Vector2(-5, 2000) },
      },
      polygonOffset: true,
      polygonOffsetFactor: 4,
      polygonOffsetUnits: 4,
    });
    this.backdropMesh = new THREE.Mesh(geo, this.backdropMat);
    this.scene.add(this.backdropMesh);
    if (this.skirtMesh) this.skirtMesh.visible = false; // the backdrop now surrounds the detailed terrain
  }

  setWaterMode(mode) {
    this.waterMat.uniforms.uWaterMode.value = mode;
  }

  setWaterOpacity(opacity) {
    this.waterMat.uniforms.uOpacity.value = opacity;
  }

  updateWaterData(depthArray, wlArray) {
    this.depthTex.image.data.set(depthArray);
    this.depthTex.needsUpdate = true;
    this.wlTex.image.data.set(wlArray);
    this.wlTex.needsUpdate = true;
  }

  _updateKeyboard(dt) {
    if (!this.keys) return;
    const speed = 2500 * dt;
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const side = new THREE.Vector3().crossVectors(dir, this.camera.up).normalize();

    if (this.keys.forward) {
      this.camera.position.addScaledVector(dir, speed);
      this.controls.target.addScaledVector(dir, speed);
    }
    if (this.keys.backward) {
      this.camera.position.addScaledVector(dir, -speed);
      this.controls.target.addScaledVector(dir, -speed);
    }
    if (this.keys.left) {
      this.camera.position.addScaledVector(side, -speed);
      this.controls.target.addScaledVector(side, -speed);
    }
    if (this.keys.right) {
      this.camera.position.addScaledVector(side, speed);
      this.controls.target.addScaledVector(side, speed);
    }
    if (this.keys.up) {
      this.camera.position.y += speed;
      this.controls.target.y += speed;
    }
    if (this.keys.down) {
      this.camera.position.y -= speed;
      this.controls.target.y -= speed;
    }
  }

  setPresetView(view) {
    const { originE, originN } = this.region;
    const midH = (this.region.meta.groundMin + this.region.meta.groundMax) / 2;

    // Local coordinates of key landmarks in the 32km x 14km terrain
    // 越流堤 (外周ポリゴンの weir 区間の中点)
    const weirPts = BASIN_PERIMETER_SURVEYED.filter(p => p.type === 'weir');
    const weirX = (weirPts[0].e + weirPts[weirPts.length - 1].e) / 2 - originE;
    const weirZ = originN - (weirPts[0].n + weirPts[weirPts.length - 1].n) / 2;
    // 彩湖中心
    const saikoX = -18370 - originE;
    const saikoZ = originN - (-19600);
    // 荒川第一調節池排水門 (出口関門)
    const gatePt = BASIN_PERIMETER_SURVEYED.find(p => p.type === 'gate');
    const gateX = gatePt.e - originE;
    const gateZ = originN - gatePt.n;
    // 調節池全体重心
    const basinX = -19300 - originE;
    const basinZ = originN - (-18000);

    if (view === 'basin') {
      // Direct focus on the 1st Retarding Basin (秋ヶ瀬・彩湖・囲ぎょう堤)
      this.controls.target.set(basinX, toTP(6.0), basinZ);
      this.camera.position.set(basinX - 3500, toTP(6.0) + 2800, basinZ + 4200);
    } else if (view === 'weir') {
      // Close-up on the 越流堤 (Overflow weir & Hanekura Bridge)
      this.controls.target.set(weirX, toTP(8.70), weirZ);
      this.camera.position.set(weirX - 1600, toTP(8.70) + 900, weirZ - 1800);
    } else if (view === 'saiko') {
      // Overview of Saiko reservoir & southern basin
      this.controls.target.set(saikoX, toTP(4.0), saikoZ);
      this.camera.position.set(saikoX - 2200, toTP(4.0) + 1600, saikoZ + 2500);
    } else if (view === 'gate') {
      // Close-up on 笹目流出水門 (出口関門・全閉)
      this.controls.target.set(gateX, toTP(7.50), gateZ);
      this.camera.position.set(gateX - 900, toTP(7.50) + 650, gateZ + 1100);
    } else if (view === 'eyeLevel') {
      // Standing on the levee crest (荒川左岸本堤 A.P.+15.2m) looking west across the basin
      const leveeX = -17992 - originE; // 本堤天端 (139.6342, 35.8245)
      const leveeZ = originN - (-19458);
      this.controls.target.set(leveeX - 1800, toTP(10.0), leveeZ - 800);
      this.camera.position.set(leveeX, toTP(15.0) + 20, leveeZ);
    } else if (view === 'regional') {
      // Whole 荒川 basin backdrop (arakawa.tif): from the 秩父 mountains to Tokyo Bay
      this.controls.target.set(16000, midH, 7000);
      this.camera.position.set(16000 - 30000, midH + 55000, 7000 + 70000);
    } else if (view === 'free') {
      // Free Camera Reset
      this.controls.target.set(this.W * 0.5, midH, this.H * 0.5);
      this.camera.position.set(this.W * 0.5, midH + 4500, this.H * 0.95);
    } else {
      // Ultra-Wide Panoramic Corridor View (32km x 14km)
      // View along the river valley showing full regional expanse
      this.controls.target.set(16000, midH, 7000);
      this.camera.position.set(16000 - 8500, midH + 11500, 7000 + 13500);
    }
    this.controls.update();
  }

  render(timeSec, dt) {
    this.waterMat.uniforms.uTime.value = timeSec;
    if (dt) this._updateKeyboard(dt);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  onResize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }
}
