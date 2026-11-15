import * as THREE from '../vendor/three.module.js';

const EYE_HEIGHT = 1.6;
const FOV = 70;
const UP = new THREE.Vector3(0, 1, 0);
const smooth = value => { const t = THREE.MathUtils.clamp(value, 0, 1); return t * t * (3 - 2 * t); };
const captureTimelineTime = elapsed => THREE.MathUtils.clamp(elapsed, 0, 6.2) * 8 / 6.2;

/** First-person presentation. No simulation, timers, input or scoring live here. */
export function createScene(host) {
  if (!host) throw new Error('The playroom could not find its display area.');
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-label', 'First-person PLAY NICE room');
  canvas.style.cssText = 'display:block;width:100%;height:100%;outline:none';
  const context = canvas.getContext('webgl2', { antialias: true, alpha: false });
  if (!context) throw new Error('PLAY NICE needs WebGL 2. Enable graphics acceleration, then reopen it in Chrome or Edge.');
  const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.info.autoReset = false;
  host.append(canvas);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x11151b);
  scene.fog = new THREE.FogExp2(0x11151b, 0.018);
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.055, 70);
  camera.rotation.order = 'YXZ';
  scene.add(camera);
  // A separate depth pass prevents camera-attached hands clipping into nearby walls.
  const viewScene = new THREE.Scene();
  const viewCamera = new THREE.PerspectiveCamera(FOV, 1, 0.035, 4);
  const viewModel = new THREE.Group();
  viewScene.add(viewModel);
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  const objectViews = new Map();
  const assetStatus = { requested: 0, loaded: 0, failed: [] };
  let disposed = false;
  let width = 1;
  let height = 1;
  let assetWarning = null;
  let darkRoom = false;
  let torchActive = true;
  let handsVisible = true;
  let previousDark = null;
  let handToy = null;
  let stormFlash = 0;
  let captureTime = -1;
  let captureVisible = false;
  let completedJobs = 0;
  let secretSlide = 0;
  let secretOpen = false;
  let hiddenSpotId = null;
  let peeking = false;
  const geo = value => { geometries.add(value); return value; };
  const mat = (color, options = {}) => {
    const value = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...options });
    materials.add(value); return value;
  };
  const basic = (color, options = {}) => {
    const value = new THREE.MeshBasicMaterial({ color, ...options });
    materials.add(value); return value;
  };
  const cubeGeo = geo(new THREE.BoxGeometry(1, 1, 1));
  const sphereGeo = geo(new THREE.SphereGeometry(1, 20, 14));
  const cylinderGeo = geo(new THREE.CylinderGeometry(1, 1, 1, 20));
  const planeGeo = geo(new THREE.PlaneGeometry(1, 1));
  const coneGeo = geo(new THREE.ConeGeometry(1, 1, 7));
  const ringGeo = geo(new THREE.TorusGeometry(1, 0.06, 8, 32));

  function surface(name, repeatX = 1, repeatY = 1) {
    assetStatus.requested++;
    const texture = new THREE.TextureLoader().load(new URL(`../assets/extracted/${name}.png`, import.meta.url).href,
      () => { assetStatus.loaded++; }, undefined, () => {
        assetStatus.failed.push(name);
        if (disposed || assetWarning) return;
        assetWarning = document.createElement('p');
        assetWarning.setAttribute('role', 'alert');
        assetWarning.textContent = 'A room material is missing. Restore assets/extracted beside the game files and reload.';
        assetWarning.style.cssText = 'position:absolute;left:20px;bottom:90px;z-index:30;max-width:430px;padding:16px;background:#201713;color:#eed4a5;border:1px solid #af7145;font:15px Segoe UI,sans-serif';
        host.append(assetWarning);
      });
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    textures.add(texture); return texture;
  }
  // Every surface map is genuinely extracted imagery. Canvas is used only for labels.
  const maps = {
    floor: surface('wood-floor', 4, 3), wood: surface('shelf-wood', 1.6, 1),
    plaster: surface('wall-plaster', 4, 1), metal: surface('switch-metal'),
    rust: surface('worn-metal'), concrete: surface('worn-concrete', 3, 2),
    tile: surface('wall-tiles', 5, 1), fabric: surface('mascot-fabric', 2, 2),
    peeling: surface('peeling-wall', 4, 1), skin: surface('hand-skin'),
  };
  // Clean palm region of the real UV atlas: avoid cuffs/nails on finger primitives.
  maps.skin.repeat.set(0.18, 0.16);
  maps.skin.offset.set(0.46, 0.5);
  maps.skin.wrapS = maps.skin.wrapT = THREE.ClampToEdgeWrapping;

  function mesh(parent, geometry, material, scale, position, cast = true) {
    const value = new THREE.Mesh(geometry, material);
    value.scale.fromArray(scale); value.position.fromArray(position);
    value.castShadow = cast; value.receiveShadow = true;
    parent.add(value); return value;
  }
  const box = (parent, scale, position, material, cast = true) => mesh(parent, cubeGeo, material, scale, position, cast);
  const sphere = (parent, scale, position, material, cast = true) => mesh(parent, sphereGeo, material, scale, position, cast);
  const cylinder = (parent, radius, length, position, material, cast = true) => mesh(parent, cylinderGeo, material, [radius, length, radius], position, cast);
  function bone(parent, from, to, radius, material, cast = true) {
    const a = new THREE.Vector3().fromArray(from);
    const b = new THREE.Vector3().fromArray(to);
    const delta = b.clone().sub(a);
    const value = cylinder(parent, radius, delta.length(), a.add(b).multiplyScalar(0.5).toArray(), material, cast);
    value.quaternion.setFromUnitVectors(UP, delta.normalize());
    return value;
  }
  function textPlate(text, plateWidth, plateHeight = 0.28, color = '#e3d9b2', background = '#24221b') {
    const surface = document.createElement('canvas');
    surface.width = 768; surface.height = Math.max(144, Math.round(768 * plateHeight / plateWidth));
    const ctx = surface.getContext('2d');
    ctx.fillStyle = background; ctx.fillRect(0, 0, surface.width, surface.height);
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const lines = text.split('\n');
    const lineHeight = surface.height / (lines.length + 0.65);
    ctx.font = `700 ${Math.min(90, lineHeight * 0.72)}px Georgia,serif`;
    lines.forEach((line, i) => ctx.fillText(line, 384, surface.height / 2 + (i - (lines.length - 1) / 2) * lineHeight, 710));
    const texture = new THREE.CanvasTexture(surface); texture.colorSpace = THREE.SRGBColorSpace; textures.add(texture);
    const material = mat(0xffffff, { map: texture, roughness: 0.95, emissive: 0x777060, emissiveIntensity: 0.065, side: THREE.DoubleSide });
    const plate = new THREE.Mesh(planeGeo, material); plate.scale.set(plateWidth, plateHeight, 1); return plate;
  }
  const floorMat = mat(0xbca485, { map: maps.floor, roughness: 0.9 });
  const woodMat = mat(0xaa8f70, { map: maps.wood, roughness: 0.8 });
  const upperWallMat = mat(0x9a9580, { map: maps.plaster, roughness: 0.97 });
  const tileMat = mat(0xa4a692, { map: maps.tile, roughness: 0.75 });
  const ceilingMat = mat(0x827f70, { map: maps.concrete, roughness: 1 });
  const metalMat = mat(0x768385, { map: maps.metal, metalness: 0.6, roughness: 0.48 });
  const rustMat = mat(0x665e50, { map: maps.rust, metalness: 0.35, roughness: 0.92 });
  const blackMat = mat(0x101718, { roughness: 0.72 });
  const creamMat = mat(0xd8caa8, { roughness: 0.92 });
  const redMat = mat(0x953f30, { roughness: 0.7 });
  const blueMat = mat(0x365c70, { roughness: 0.78 });
  const yellowMat = mat(0xb58c34, { roughness: 0.74 });
  const skinMat = mat(0xf5d9c2, { map: maps.skin, roughness: 0.76 });
  const sleeveMat = mat(0x303e37, { map: maps.fabric, roughness: 1 });
  const room = new THREE.Group(); scene.add(room);
  box(room, [16.4, 0.18, 12.4], [0, -0.09, 0], floorMat, false);
  box(room, [16.4, 0.22, 12.4], [0, 3.71, 0], ceilingMat, false);
  // Real opening behind the sliding bookcase: no invisible wall across the passage.
  box(room, [6.7, 3.6, 0.24], [-4.85, 1.8, -6.12], upperWallMat, false);
  box(room, [6.7, 3.6, 0.24], [4.85, 1.8, -6.12], upperWallMat, false);
  box(room, [3, 0.58, 0.24], [0, 3.31, -6.12], upperWallMat, false);
  const secretPanel = box(room, [3.05, 3.02, 0.13], [0, 1.51, -6.06], upperWallMat, false);
  box(room, [16.4, 3.6, 0.24], [0, 1.8, 6.12], upperWallMat, false);
  box(room, [0.24, 3.6, 12.4], [8.12, 1.8, 0], upperWallMat, false);
  // Split the left wall around a real window aperture, x=-8 / z=-1.5.
  box(room, [0.24, 3.6, 2], [-8.12, 1.8, -5], upperWallMat, false);
  box(room, [0.24, 3.6, 5], [-8.12, 1.8, 3.5], upperWallMat, false);
  box(room, [0.24, 1.1, 5], [-8.12, 0.55, -1.5], tileMat, false);
  box(room, [0.24, 0.65, 5], [-8.12, 3.275, -1.5], upperWallMat, false);
  for (const z of [-6, 6]) {
    const spans = z < 0 ? [[-4.75, 6.5], [4.75, 6.5]] : [[0, 16]];
    for (const [x, span] of spans) {
      box(room, [span, 1, 0.035], [x, 0.5, z - Math.sign(z) * 0.018], tileMat, false);
      box(room, [span, 0.1, 0.1], [x, 1.04, z - Math.sign(z) * 0.065], woodMat, false);
      box(room, [span, 0.16, 0.1], [x, 0.08, z - Math.sign(z) * 0.065], woodMat, false);
    }
  }
  for (const x of [-8, 8]) {
    box(room, [0.035, 1, 12], [x - Math.sign(x) * 0.018, 0.5, 0], tileMat, false);
    box(room, [0.1, 0.1, 12], [x - Math.sign(x) * 0.065, 1.04, 0], woodMat, false);
    box(room, [0.1, 0.16, 12], [x - Math.sign(x) * 0.065, 0.08, 0], woodMat, false);
  }
  for (const z of [-3, 1, 5]) box(room, [16, 0.14, 0.13], [0, 3.52, z], woodMat, false);
  for (let x = -6; x <= 6; x += 2) box(room, [0.018, 0.003, 12], [x, 0.002, 0], blackMat, false);
  const secretRoom = new THREE.Group(); secretRoom.visible = false; scene.add(secretRoom);
  box(secretRoom, [6.2, 0.18, 5.2], [0, -0.09, -8.5], floorMat, false);
  box(secretRoom, [6.2, 0.22, 5.2], [0, 3.71, -8.5], ceilingMat, false);
  box(secretRoom, [6.2, 3.6, 0.2], [0, 1.8, -11.1], upperWallMat, false);
  for (const x of [-3.1, 3.1]) box(secretRoom, [0.2, 3.6, 5.2], [x, 1.8, -8.5], upperWallMat, false);
  for (const x of [-2.25, 2.25]) box(secretRoom, [1.5, 3.6, 0.16], [x, 1.8, -6.12], upperWallMat, false);
  for (const side of [-1, 1]) {
    const rack = new THREE.Group(); rack.position.set(side * 2.63, 0, -8.55); rack.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2; secretRoom.add(rack);
    for (const x of [-1.65, 1.65]) box(rack, [0.1, 2.6, 0.48], [x, 1.3, 0], rustMat);
    for (let tier = 0; tier < 4; tier++) {
      const y = 0.15 + tier * 0.63; box(rack, [3.4, 0.085, 0.55], [0, y, 0], metalMat);
      for (let item = 0; item < 5; item++) {
        const x = -1.28 + item * 0.62; box(rack, [0.5, 0.38, 0.42], [x, y + 0.235, 0], woodMat);
        const tag = textPlate(`${side > 0 ? 'RECORD' : 'HELPER'} ${tier * 5 + item + 1}`, 0.38, 0.12); tag.position.set(x, y + 0.26, 0.215); rack.add(tag);
      }
    }
  }
  box(secretRoom, [1.6, 0.13, 0.85], [0, 0.86, -9.2], woodMat);
  for (const x of [-0.65, 0.65]) for (const z of [-10.2, -9.6]) box(secretRoom, [0.1, 0.82, 0.1], [x, 0.41, z], woodMat);
  const records = textPlate('INVENTORY ARCHIVE\nDO NOT COUNT THE CHILDREN', 2.3, 0.5); records.position.set(0, 2.15, -10.97); secretRoom.add(records);
  for (let i = 0; i < 5; i++) { const folder = box(secretRoom, [0.52, 0.035, 0.35], [-0.45 + i * 0.18, 0.97 + i * 0.035, -9.85], creamMat); folder.rotation.y = i * 0.08; }
  const archiveLight = new THREE.PointLight(0xc18a51, 3, 6, 2); archiveLight.position.set(0, 2.7, -9.5); secretRoom.add(archiveLight);
  const windowGroup = new THREE.Group(); room.add(windowGroup);
  for (const z of [-4, 1]) box(windowGroup, [0.35, 1.99, 0.13], [-7.98, 2.025, z], woodMat);
  for (const y of [1.1, 2.95]) box(windowGroup, [0.35, 0.12, 5.1], [-7.98, y, -1.5], woodMat);
  box(windowGroup, [0.16, 1.86, 0.065], [-7.96, 2.025, -1.5], woodMat);
  box(windowGroup, [0.16, 0.065, 4.95], [-7.96, 2.08, -1.5], woodMat);
  box(windowGroup, [0.48, 0.1, 5.25], [-7.84, 1.07, -1.5], woodMat);
  const glassMat = mat(0xaeb8b8, { map: maps.plaster, transparent: true, opacity: 0.88, roughness: 0.98, metalness: 0.02, depthWrite: false });
  box(windowGroup, [0.025, 1.75, 4.82], [-8.04, 2.025, -1.5], glassMat, false);
  const curtainMat = mat(0x4d5c50, { map: maps.fabric, roughness: 1 });
  [-3.78, 0.78].forEach((z, index) => {
    for (let fold = 0; fold < 4; fold++) {
      const drape = box(windowGroup, [0.09, 2.24 - fold * 0.025, 0.16], [-7.75 + Math.sin(fold * 1.7) * 0.08, 1.9, z + (index ? -1 : 1) * fold * 0.12], curtainMat);
      drape.rotation.x = (index ? 1 : -1) * 0.018;
    }
  });
  const outside = new THREE.Group(); scene.add(outside);
  const skyMat = basic(0x4c536b, { fog: false });
  box(outside, [0.1, 16, 32], [-18, 5, -1.5], skyMat, false);
  const silhouetteMat = basic(0x080d13, { fog: false });
  box(outside, [14, 0.1, 32], [-13, -0.1, -1.5], silhouetteMat, false);
  for (let i = 0; i < 15; i++) {
    const z = -13 + i * 1.7; const treeHeight = 3 + ((i * 7) % 9) * 0.34; const x = -12 - (i % 3) * 1.5;
    cylinder(outside, 0.1 + (i % 2) * 0.035, treeHeight, [x, treeHeight / 2, z], silhouetteMat, false);
    for (let branch = 0; branch < 3; branch++) mesh(outside, coneGeo, silhouetteMat, [0.85 - branch * 0.18, treeHeight * 0.56, 0.85 - branch * 0.18], [x, treeHeight * (0.44 + branch * 0.19), z], false);
  }
  const moon = sphere(outside, [0.09, 0.43, 0.43], [-17.8, 4.6, -3], basic(0x9cabb2, { fog: false }), false);
  const cloudMat = basic(0x5f6471, { map: maps.concrete, transparent: true, opacity: 0.24, fog: false, depthWrite: false });
  for (let i = 0; i < 4; i++) box(outside, [0.025, 3.8, 14], [-17.2 + i * 0.22, 3 + i * 0.6, -3 + i * 2], cloudMat, false);
  const stormLight = new THREE.PointLight(0xc9d7ef, 0, 22, 1.7); stormLight.position.set(-8.8, 3.2, -1.5); scene.add(stormLight);
  const rainMat = basic(0xabb8c6, { transparent: true, opacity: 0.44, depthWrite: false, fog: false });
  const rain = new THREE.InstancedMesh(cubeGeo, rainMat, 220); outside.add(rain);
  const dropMat = mat(0xb9c3cc, { transparent: true, opacity: 0.32, metalness: 0.15, roughness: 0.1, depthWrite: false });
  const drops = new THREE.InstancedMesh(sphereGeo, dropMat, 56); windowGroup.add(drops);
  const rainTransform = new THREE.Object3D();
  const stormColor = new THREE.Color(0x4c536b); const flashColor = new THREE.Color(0xc9d7ef);
  const ambient = new THREE.HemisphereLight(0x8b9ba9, 0x211c16, 0.2); scene.add(ambient);
  // A close fill reveals nearby floor without illuminating the whole room.
  const playerFill = new THREE.PointLight(0xb8c2bd, 1.7, 3.2, 2); scene.add(playerFill);
  const windowLight = new THREE.PointLight(0x9aabc4, 13, 14, 2); windowLight.position.set(-7.6, 2.25, -1.5); scene.add(windowLight);
  const bulbMat = mat(0xf1d6a6, { emissive: 0xffbc63, emissiveIntensity: 1.5 });
  const shadeMat = mat(0x74807e, { map: maps.metal, metalness: 0.6, side: THREE.DoubleSide });
  const shadeGeo = geo(new THREE.CylinderGeometry(0.18, 0.46, 0.25, 24, 1, true));
  const lamps = [];
  [[-4.7, -1.5], [4.3, 2.1]].forEach(([x, z]) => {
    bone(room, [x, 3.6, z], [x, 3.2, z], 0.018, blackMat, false);
    mesh(room, shadeGeo, shadeMat, [1, 1, 1], [x, 3.12, z]);
    sphere(room, [0.1, 0.13, 0.1], [x, 2.99, z], bulbMat, false);
    const light = new THREE.PointLight(0xffc580, 17, 11, 2); light.position.set(x, 2.94, z); scene.add(light); lamps.push(light);
  });
  const ceilingLight = new THREE.SpotLight(0xffd29a, 23, 15, 1.12, 0.8, 2);
  ceilingLight.position.set(0, 3.42, -1); ceilingLight.target.position.set(0, 0, -1);
  ceilingLight.castShadow = true; ceilingLight.shadow.mapSize.set(512, 512); ceilingLight.shadow.bias = -0.001; ceilingLight.shadow.normalBias = 0.025;
  scene.add(ceilingLight, ceilingLight.target);
  const flashlight = new THREE.SpotLight(0xffecd1, 75, 25, Math.PI / 7, 0.62, 2);
  flashlight.position.set(0.28, -0.19, -0.15); flashlight.castShadow = true;
  flashlight.shadow.mapSize.set(1024, 1024); flashlight.shadow.bias = -0.00035; flashlight.shadow.normalBias = 0.02;
  flashlight.shadow.camera.near = 0.1; flashlight.shadow.camera.far = 25;
  const torchTarget = new THREE.Object3D(); torchTarget.position.set(0, 0, -9); flashlight.target = torchTarget; camera.add(flashlight, torchTarget);

  // Sparse worn clutter stays along the edges; no new gameplay collision rules.
  const banner = textPlate('EVERY TOY HAS ITS PLACE', 4.5, 0.5, '#d9c9a1', '#30382f'); banner.position.set(0, 2.86, -5.97); room.add(banner);
  const rules = textPlate('PLAY NICE\nBE KIND\nPUT THINGS BACK', 1.05, 1.34, '#342a23', '#b3a17c'); rules.position.set(7.96, 2.05, 1.5); rules.rotation.y = -Math.PI / 2; room.add(rules);
  const clockFrame = cylinder(room, 0.32, 0.08, [-3.2, 2.8, -5.92], woodMat, false); clockFrame.rotation.x = Math.PI / 2;
  const clockFace = cylinder(room, 0.27, 0.09, [-3.2, 2.8, -5.89], creamMat, false); clockFace.rotation.x = Math.PI / 2;
  const clockHand = box(room, [0.025, 0.2, 0.025], [-3.2, 2.86, -5.83], blackMat, false); clockHand.rotation.z = -0.65;
  box(room, [0.18, 0.02, 0.025], [-3.12, 2.8, -5.83], blackMat, false);
  function stool(x, z, rotation) {
    const group = new THREE.Group(); group.position.set(x, 0, z); group.rotation.y = rotation; room.add(group);
    box(group, [0.72, 0.13, 0.66], [0, 0.61, 0], woodMat);
    for (const a of [-1, 1]) for (const b of [-1, 1]) bone(group, [a * 0.26, 0.57, b * 0.23], [a * 0.31, 0.03, b * 0.28], 0.045, woodMat);
  }
  stool(-7, 5.2, 0.2); stool(7.35, 0, -0.4);
  box(room, [0.8, 0.12, 2.3], [-7.42, 0.79, -1.45], woodMat);
  for (const z of [-2.35, -0.55]) for (const x of [-7.7, -7.15]) box(room, [0.1, 0.76, 0.1], [x, 0.38, z], woodMat);
  [[-6.6, 4.95, 'A', redMat], [-6.2, 4.82, 'B', blueMat], [-6.42, 5.28, 'C', yellowMat], [7.4, 3.7, 'D', redMat]].forEach(([x, z, letter, paint], i) => {
    const block = new THREE.Group(); block.position.set(x, i === 2 ? 0.48 : 0.2, z); block.rotation.y = i * 0.31; room.add(block);
    box(block, [0.37, 0.37, 0.37], [0, 0, 0], paint);
    const tag = textPlate(letter, 0.29, 0.29, '#d7c598', '#403629'); tag.position.z = 0.19; block.add(tag);
  });
  box(room, [5.4, 0.012, 4], [0, 0.014, 0.5], mat(0x586459, { map: maps.fabric, roughness: 1 }), false);
  for (const x of [-2.62, 2.62]) box(room, [0.06, 0.005, 3.92], [x, 0.024, 0.5], creamMat, false);
  for (const z of [-1.42, 2.42]) box(room, [5.24, 0.005, 0.06], [0, 0.024, z], creamMat, false);

  function makeToy(id, color) {
    const root = new THREE.Group(); const paint = mat(color, { map: id === 'bear' ? maps.fabric : null, roughness: id === 'bear' ? 1 : 0.62 });
    const toyPupils = [];
    if (id === 'bear') {
      sphere(root, [0.26, 0.3, 0.21], [0, 0.33, 0], paint); sphere(root, [0.26, 0.24, 0.22], [0, 0.69, 0], paint);
      for (const side of [-1, 1]) {
        sphere(root, [0.12, 0.13, 0.085], [side * 0.2, 0.88, 0], paint); sphere(root, [0.1, 0.2, 0.1], [side * 0.27, 0.36, 0], paint);
        sphere(root, [0.13, 0.1, 0.17], [side * 0.15, 0.1, 0.09], paint);
        sphere(root, [0.045, 0.045, 0.022], [side * 0.09, 0.73, 0.195], creamMat);
        const pupil = sphere(root, [0.022, 0.027, 0.018], [side * 0.09, 0.73, 0.216], blackMat); pupil.userData.baseX = side * 0.09; pupil.userData.baseY = 0.73; toyPupils.push(pupil);
      }
      sphere(root, [0.13, 0.08, 0.05], [0, 0.63, 0.21], creamMat); sphere(root, [0.035, 0.026, 0.02], [0, 0.66, 0.26], blackMat);
    } else if (id === 'duck') {
      sphere(root, [0.32, 0.24, 0.27], [0, 0.26, 0], paint); sphere(root, [0.21, 0.22, 0.2], [0, 0.53, 0.1], paint);
      sphere(root, [0.16, 0.055, 0.15], [0, 0.49, 0.28], redMat);
      for (const side of [-1, 1]) sphere(root, [0.027, 0.035, 0.02], [side * 0.11, 0.58, 0.27], blackMat);
    } else {
      sphere(root, [0.34, 0.34, 0.34], [0, 0.35, 0], paint);
      for (const angle of [0, Math.PI / 2]) { const band = mesh(root, ringGeo, creamMat, [0.34, 0.34, 0.34], [0, 0.35, 0]); band.rotation.y = angle; }
    }
    if (toyPupils.length) eyeTrackers.push({ head: root, pupils: toyPupils });
    return { root };
  }
  function makeSwitch(data) {
    const root = new THREE.Group(); const lampMat = mat(0xdd7050, { emissive: 0xe74419, emissiveIntensity: 1.2, roughness: 0.28 });
    box(root, [0.82, 0.72, 0.07], [0, 1.17, -0.18], metalMat);
    box(root, [0.67, 0.49, 0.36], [0, 1.16, 0], rustMat); box(root, [0.48, 0.33, 0.04], [0, 1.16, 0.2], blackMat);
    const handle = new THREE.Group(); handle.position.set(0, 1.13, 0.26); root.add(handle);
    bone(handle, [0, 0, 0], [0, 0.2, 0.08], 0.035, metalMat); box(handle, [0.29, 0.09, 0.1], [0, 0.2, 0.08], lampMat);
    sphere(root, [0.036, 0.036, 0.02], [0.22, 1.27, 0.205], lampMat);
    const activeLabel = textPlate(data.name, 0.83, 0.17, '#d7bf9c', '#24211c'); const offLabel = textPlate('DISABLED', 0.83, 0.17, '#9cbea5', '#14241c');
    activeLabel.position.set(0, 1.52, 0.03); offLabel.position.copy(activeLabel.position); root.add(activeLabel, offLabel);
    return { root, handle, lampMat, activeLabel, offLabel };
  }
  function makeExit() {
    const root = new THREE.Group(); const lampMat = mat(0xc9754d, { emissive: 0xc94c1e, emissiveIntensity: 0.8 });
    for (const x of [-0.86, 0.86]) box(root, [0.17, 2.6, 1.5], [x, 1.3, -0.65], rustMat);
    box(root, [1.9, 0.2, 1.5], [0, 2.65, -0.65], rustMat); box(root, [1.58, 2.46, 0.05], [0, 1.26, -1.37], basic(0x020302), false);
    const door = box(root, [1.55, 2.4, 0.16], [0, 1.26, 0], metalMat); const handle = box(root, [0.12, 0.33, 0.09], [0.53, 1.17, 0.13], rustMat);
    const panel = box(root, [0.45, 0.29, 0.06], [0, 1.93, 0.12], blackMat);
    const signLocked = textPlate('EXIT / LOCKED', 1.45, 0.25, '#d7bd9a', '#37251e'); const signOpen = textPlate('EXIT / OPEN', 1.45, 0.25, '#bdd6aa', '#1b352a');
    signLocked.position.set(0, 2.48, 0.14); signOpen.position.copy(signLocked.position); root.add(signLocked, signOpen);
    box(root, [1.4, 0.045, 0.08], [0, 0.055, 0.14], lampMat);
    return { root, door, handle, panel, lampMat, signLocked, signOpen };
  }
  function viewFor(id, create) {
    if (!objectViews.has(id)) { const value = create(); objectViews.set(id, value); scene.add(value.root); }
    return objectViews.get(id);
  }
  function makeHidingSpot(data) {
    const root = new THREE.Group(); const w = data.width, d = data.depth;
    const height = data.kind === 'closet' ? 2.65 : 1.15;
    box(root, [w, 0.1, d], [0, 0.05, 0], woodMat);
    box(root, [w, 0.1, d], [0, height - 0.05, 0], woodMat);
    for (const side of [-1, 1]) box(root, [0.09, height, d], [side * (w / 2 - 0.045), height / 2, 0], woodMat);
    box(root, [w, height, 0.09], [0, height / 2, -d / 2 + 0.045], woodMat);
    if (data.kind === 'closet') {
      for (const side of [-1, 1]) {
        box(root, [w / 2 - 0.075, height - 0.15, 0.08], [side * (w / 4 + 0.035), height / 2, d / 2], woodMat);
        sphere(root, [0.035, 0.035, 0.04], [side * 0.14, 1.25, d / 2 + 0.07], rustMat);
      }
    } else {
      box(root, [w, 0.5, 0.08], [0, 0.25, d / 2], woodMat);
      box(root, [w, 0.3, 0.08], [0, height - 0.15, d / 2], woodMat);
      for (const side of [-1, 1]) box(root, [0.16, height, 0.035], [side * (w / 2 - 0.1), height / 2, d / 2 + 0.05], rustMat);
    }
    const label = textPlate(data.kind === 'closet' ? 'STORAGE' : 'TOY CHEST', w * 0.65, 0.18); label.position.set(0, data.kind === 'closet' ? 2.2 : 0.29, d / 2 + 0.05); root.add(label);
    return { root, hidingKind: data.kind };
  }

  function childChair() {
    const root = new THREE.Group();
    box(root, [0.7, 0.12, 0.65], [0, 0.63, 0], woodMat);
    for (const x of [-0.28, 0.28]) for (const z of [-0.25, 0.25]) box(root, [0.075, 0.6, 0.075], [x, 0.3, z], woodMat);
    for (const x of [-0.28, 0.28]) box(root, [0.075, 1.16, 0.075], [x, 0.61, -0.25], woodMat);
    box(root, [0.62, 0.31, 0.085], [0, 1.05, -0.25], woodMat);
    return root;
  }
  const childTable = new THREE.Group(); childTable.position.set(-5.9, 0, -2); room.add(childTable);
  box(childTable, [1.35, 0.12, 1.25], [0, 0.91, 0], woodMat);
  for (const x of [-0.52, 0.52]) for (const z of [-0.48, 0.48]) box(childTable, [0.12, 0.9, 0.12], [x, 0.45, z], woodMat);
  const extraChair = childChair(); extraChair.position.set(-6.8, 0, -2); extraChair.rotation.y = -Math.PI / 2; room.add(extraChair);
  const cushionMat = mat(0x525f55, { map: maps.fabric, roughness: 1 });
  for (const [x, z, angle] of [[-5.7, 4.9, 0.35], [7.1, 0.4, -0.25], [6.9, 4.8, 0.7]]) {
    const pillow = sphere(room, [0.48, 0.13, 0.37], [x, 0.16, z], cushionMat); pillow.rotation.y = angle;
  }
  const train = new THREE.Group(); train.position.set(-4.2, 0.09, 5.2); train.rotation.y = 0.22; room.add(train);
  for (let car = 0; car < 3; car++) {
    const x = car * 0.7; box(train, [0.57, 0.23, 0.36], [x, 0.2, 0], [redMat, blueMat, yellowMat][car]);
    for (const side of [-1, 1]) for (const axle of [-1, 1]) { const wheel = cylinder(train, 0.1, 0.05, [x + axle * 0.18, 0.1, side * 0.2], blackMat); wheel.rotation.x = Math.PI / 2; }
    if (car === 0) { box(train, [0.2, 0.3, 0.34], [x + 0.16, 0.43, 0], redMat); cylinder(train, 0.055, 0.21, [x - 0.14, 0.41, 0], metalMat); }
  }
  const rocker = new THREE.Group(); rocker.position.set(7.05, 0, 2.6); rocker.rotation.y = -0.6; room.add(rocker);
  sphere(rocker, [0.43, 0.2, 0.2], [0, 0.56, 0], woodMat); bone(rocker, [0.3, 0.55, 0], [0.42, 0.95, 0], 0.1, woodMat);
  sphere(rocker, [0.19, 0.15, 0.11], [0.4, 1.02, 0], woodMat);
  for (const side of [-1, 1]) { box(rocker, [1.1, 0.1, 0.075], [0, 0.12, side * 0.23], woodMat); bone(rocker, [-0.25, 0.5, 0], [-0.35, 0.16, side * 0.23], 0.04, woodMat); bone(rocker, [0.25, 0.5, 0], [0.35, 0.16, side * 0.23], 0.04, woodMat); }
  const childDrawing = textPlate('MY FRIEND\n:)\nHE SEES ME', 0.65, 0.85, '#3c3426', '#baad8d'); childDrawing.position.set(-7.97, 2.15, 3.3); childDrawing.rotation.y = Math.PI / 2; room.add(childDrawing);
  const journalTable = new THREE.Group(); journalTable.position.set(-3, 0, 2); room.add(journalTable);
  box(journalTable, [1.15, 0.12, 0.86], [0, 0.89, 0], woodMat);
  for (const x of [-0.45, 0.45]) for (const z of [-0.32, 0.32]) box(journalTable, [0.1, 0.86, 0.1], [x, 0.43, z], woodMat);
  const journalBook = new THREE.Group(); journalBook.position.set(0, 0.98, 0.02); journalBook.rotation.y = -0.18; journalTable.add(journalBook);
  box(journalBook, [0.64, 0.06, 0.44], [0, 0, 0], redMat);
  for (const side of [-1, 1]) { const page = box(journalBook, [0.29, 0.035, 0.4], [side * 0.155, 0.04, 0], creamMat); page.rotation.z = side * 0.09; }
  const journalWords = textPlate('A STORY\nFOR THE LAST HELPER', 0.5, 0.28, '#35271c', '#c6b58d'); journalWords.rotation.x = -Math.PI / 2; journalWords.position.set(0, 0.072, 0.01); journalBook.add(journalWords);
  const journalTag = textPlate('READ STORYBOOK', 0.95, 0.18); journalTag.position.set(0, 0.82, 0.44); journalTable.add(journalTag);

  function makeTask(data) {
    const root = new THREE.Group(); const dirty = new THREE.Group(); const clean = new THREE.Group(); const levers = []; root.add(dirty, clean);
    if (data.kind === 'spill') {
      const spillMat = mat(data.id === 'spill-1' ? 0x776b34 : 0x566748, { transparent: true, opacity: 0.76, roughness: 0.22, depthWrite: false });
      for (let i = 0; i < 6; i++) sphere(dirty, [0.34 + i * 0.025, 0.004, 0.2 + (i % 2) * 0.08], [Math.sin(i * 2.7) * 0.35, 0.018, Math.cos(i * 2.1) * 0.25], spillMat, false);
      const cup = cylinder(dirty, 0.11, 0.25, [0.5, 0.12, -0.08], creamMat); cup.rotation.z = 1.4;
    } else if (data.kind === 'rubbish') {
      for (let i = 0; i < 9; i++) { const item = box(dirty, [0.13 + i % 3 * 0.04, 0.025, 0.16], [Math.sin(i * 2.3) * 0.56, 0.025 + i % 2 * 0.015, Math.cos(i * 1.7) * 0.42], i % 3 ? creamMat : redMat); item.rotation.set(i * 0.1, i * 0.7, i * 0.16); }
      cylinder(dirty, 0.075, 0.22, [0.35, 0.09, 0.31], metalMat).rotation.z = 1.5;
    } else if (data.kind === 'chair') {
      const crooked = childChair(); crooked.rotation.set(0, -0.7, -0.28); crooked.position.set(0.1, 0.1, 0.16); dirty.add(crooked);
      const straight = childChair(); straight.rotation.y = Math.PI / 2; clean.add(straight);
    } else if (data.kind === 'books') {
      // The cleanup point stays at (0,-4.3); the case front meets book targets at z=-5.
      const caseCenterZ = -1.15;
      box(root, [2.75, 2.95, 0.11], [0, 1.53, caseCenterZ - 0.4], woodMat);
      for (const x of [-1.4, 1.4]) box(root, [0.14, 3.08, 0.92], [x, 1.55, caseCenterZ], woodMat);
      for (const y of [0.1, 0.72, 1.45, 2.18, 3.02]) box(root, [2.95, 0.12, 0.95], [0, y, caseCenterZ], woodMat);
      const libraryTag = textPlate('NURSERY LIBRARY', 1.85, 0.23); libraryTag.position.set(0, 2.82, -0.66); root.add(libraryTag);
      const tidyFirst = textPlate('ARRANGE THE BOOKS FIRST', 1.6, 0.17); tidyFirst.position.set(0, 1.3, -0.65); dirty.add(tidyFirst);
      for (let tier = 0; tier < 2; tier++) for (let i = 0; i < 13; i++) {
        const cover = [redMat, blueMat, yellowMat, cushionMat][(i + tier) % 4];
        const book = box(root, [0.13 + i % 2 * 0.025, 0.39 + i % 3 * 0.04, 0.32], [-1.19 + i * 0.19, (tier ? 2.48 : 0.37), -0.83], cover); book.rotation.z = i === 12 ? -0.08 : 0;
      }
      ['MOON', 'STAR', 'SUN'].forEach((name, index) => {
        const lever = new THREE.Group(); lever.position.set((index - 1) * 0.65, 1.8, -0.77); root.add(lever);
        box(lever, [0.42, 0.59, 0.34], [0, 0, 0], [blueMat, redMat, yellowMat][index]);
        const spine = textPlate(name, 0.38, 0.2); spine.position.set(0, 0, 0.178); lever.add(spine);
        box(lever, [0.34, 0.018, 0.025], [0, 0.22, 0.18], creamMat, false); box(lever, [0.34, 0.018, 0.025], [0, -0.22, 0.18], creamMat, false);
        levers.push(lever);
      });
      for (let i = 0; i < 7; i++) {
        const cover = [redMat, blueMat, yellowMat, cushionMat][i % 4];
        const messy = box(dirty, [0.31, 0.07, 0.36], [Math.sin(i * 1.3) * 0.8, 0.81 + (i % 3) * 0.075, -0.83 + Math.cos(i) * 0.07], cover); messy.rotation.y = i * 0.51;
        const orderly = box(clean, [0.15, 0.39 + i % 3 * 0.04, 0.3], [-0.65 + i * 0.21, 1.03, -0.83], cover);
        box(clean, [0.12, 0.022, 0.008], [orderly.position.x, 1.12, -0.675], creamMat, false);
      }
    } else if (data.kind === 'blocks') {
      const basket = mat(0x9e865d, { map: maps.fabric, roughness: 1 });
      box(root, [0.9, 0.12, 0.72], [0, 0.08, 0.09], basket);
      for (const x of [-0.44, 0.44]) box(root, [0.06, 0.36, 0.74], [x, 0.27, 0.09], basket);
      for (const z of [-0.25, 0.43]) box(root, [0.9, 0.36, 0.06], [0, 0.27, z], basket);
      const basketTag = textPlate('TOYS', 0.52, 0.15); basketTag.position.set(0, 0.29, 0.466); root.add(basketTag);
      for (let i = 0; i < 8; i++) {
        const color = [redMat, blueMat, yellowMat][i % 3];
        const loose = box(dirty, [0.2, 0.2, 0.2], [Math.sin(i * 2.1) * 0.75, 0.12, 0.65 + Math.cos(i * 1.7) * 0.38], color); loose.rotation.y = i * 0.5;
        const tidy = box(clean, [0.19, 0.19, 0.19], [-0.27 + i % 3 * 0.24, 0.25 + Math.floor(i / 6) * 0.19, -0.06 + Math.floor(i / 3) % 2 * 0.24], color); tidy.rotation.y = (i % 2) * 0.1;
      }
    }
    return { root, dirty, clean, levers, taskKind: data.kind };
  }

  // Jointed original long-eared mascot; the coordinator supplies rise/pursuit time.
  const bunny = new THREE.Group(); scene.add(bunny); const bunnyTorso = new THREE.Group(); bunny.add(bunnyTorso);
  const bunnyMat = mat(0x7b6b50, { map: maps.fabric, roughness: 1 }); const muzzleMat = mat(0x9b8d70, { map: maps.fabric, roughness: 1 });
  const eyeMat = mat(0xa4ad97, { emissive: 0xff6f37, emissiveIntensity: 0.05 });
  sphere(bunnyTorso, [0.38, 0.61, 0.24], [0, 1.37, 0], bunnyMat); sphere(bunnyTorso, [0.3, 0.21, 0.23], [0, 0.95, 0], bunnyMat);
  const bunnyHead = new THREE.Group(); bunnyHead.name = 'bunny-head'; bunnyHead.position.set(0, 2.05, 0.03); bunnyTorso.add(bunnyHead);
  sphere(bunnyHead, [0.39, 0.37, 0.3], [0, 0, 0], bunnyMat); sphere(bunnyHead, [0.23, 0.15, 0.12], [0, -0.14, 0.25], muzzleMat);
  sphere(bunnyHead, [0.058, 0.045, 0.03], [0, -0.065, 0.365], blackMat); const quietMouth = box(bunnyHead, [0.13, 0.07, 0.035], [0, -0.25, 0.31], blackMat);
  const innerEarMat = mat(0x684c42, { map: maps.fabric });
  for (const side of [-1, 1]) {
    const ear = sphere(bunnyHead, [0.12, 0.52, 0.085], [side * 0.24, 0.7, -0.02], bunnyMat); ear.rotation.z = -side * 0.14;
    const inner = sphere(bunnyHead, [0.055, 0.38, 0.024], [side * 0.24, 0.71, 0.062], innerEarMat); inner.rotation.z = -side * 0.14;
    sphere(bunnyHead, [0.11, 0.125, 0.045], [side * 0.145, 0.025, 0.267], blackMat);
    const pupil = sphere(bunnyHead, [0.045, 0.066, 0.022], [side * 0.145, 0.025, 0.306], eyeMat); pupil.name = `tracking-pupil-${side}`; pupil.userData.baseX = side * 0.145;
  }
  const limbs = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(side * 0.34, 1.78, 0); bunnyTorso.add(arm);
    sphere(arm, [0.13, 0.15, 0.13], [0, 0, 0], bunnyMat); bone(arm, [0, 0, 0], [side * 0.06, -0.62, 0.035], 0.095, bunnyMat);
    sphere(arm, [0.105, 0.105, 0.105], [side * 0.06, -0.62, 0.035], bunnyMat); bone(arm, [side * 0.06, -0.62, 0.035], [side * 0.13, -1.18, 0.07], 0.075, bunnyMat);
    sphere(arm, [0.12, 0.17, 0.08], [side * 0.13, -1.25, 0.08], muzzleMat);
    const thigh = new THREE.Group(); thigh.position.set(side * 0.2, 0.95, 0); bunny.add(thigh); bone(thigh, [0, 0, 0], [0, -0.5, 0], 0.14, bunnyMat);
    const calf = new THREE.Group(); calf.position.y = -0.5; thigh.add(calf); sphere(calf, [0.14, 0.13, 0.13], [0, 0, 0], bunnyMat);
    bone(calf, [0, 0, 0], [0, -0.39, 0], 0.1, bunnyMat); sphere(calf, [0.16, 0.095, 0.29], [0, -0.4, 0.16], muzzleMat);
    limbs.push({ side, arm, thigh, calf });
  }
  // Long reaching arms stay jointed so jitter is a pose, never a gameplay teleport.
  limbs.forEach(({ arm }) => { arm.scale.set(0.94, 1.18, 0.94); });
  const bowLeft = box(bunnyTorso, [0.17, 0.11, 0.06], [-0.1, 1.77, 0.23], redMat); bowLeft.rotation.z = 0.2;
  const bowRight = box(bunnyTorso, [0.17, 0.11, 0.06], [0.1, 1.77, 0.23], redMat); bowRight.rotation.z = -0.2;
  const grin = new THREE.Group(); grin.name = 'capture-grin'; bunnyHead.add(grin); grin.visible = false;
  sphere(grin, [0.28, 0.125, 0.045], [0, -0.22, 0.343], blackMat);
  for (let i = 0; i < 11; i++) {
    const x = (i - 5) * 0.043; const curve = Math.abs(i - 5) * 0.009;
    const tooth = box(grin, [0.031, 0.065, 0.025], [x, -0.17 - curve, 0.386], creamMat); tooth.rotation.z = (i - 5) * -0.035;
    if (i % 2 === 0) box(grin, [0.031, 0.04, 0.025], [x, -0.29 + curve, 0.382], creamMat);
  }
  const smirk = sphere(grin, [0.14, 0.032, 0.022], [0.16, -0.15, 0.39], muzzleMat); smirk.rotation.z = 0.3;
  const eyeTrackers = [{ head: bunnyHead, pupils: [] }];
  bunnyHead.traverse(part => { if (part.name.startsWith('tracking-pupil-')) eyeTrackers[0].pupils.push(part); });
  const decorativeTeddies = [];
  [[-6.9, 0.92, -1.7, 0.34, 1.1], [-6.6, 0, -4.8, 0.38, 0.2], [-4.9, 0, -5.25, 0.26, -0.4], [6.9, 0, 0.45, 0.5, -1.4], [-5.7, 0, 4.9, 0.43, 1.5], [7.3, 0, -3.3, 0.3, -1.3]].forEach(([x, y, z, size, turn]) => {
    const teddy = bunny.clone(true); teddy.position.set(x, y, z); teddy.scale.setScalar(size); teddy.rotation.y = turn;
    teddy.children[0].position.y = -0.48; teddy.children[0].rotation.x = 0.18;
    teddy.children.slice(1).forEach(thigh => { thigh.position.y = 0.47; thigh.rotation.x = -1.12; thigh.children.at(-1).rotation.x = 1.15; });
    const head = teddy.getObjectByName('bunny-head'); const pupils = [];
    head.traverse(part => { if (part.name.startsWith('tracking-pupil-')) pupils.push(part); });
    eyeTrackers.push({ head, pupils }); decorativeTeddies.push(teddy); scene.add(teddy);
  });
  const trackedPoint = new THREE.Vector3();
  const captureBlood = new THREE.Group(); captureBlood.visible = false; scene.add(captureBlood);
  const bloodMat = mat(0x421315, { transparent: true, opacity: 0.62, roughness: 0.38, depthWrite: false });
  for (let i = 0; i < 16; i++) sphere(captureBlood, [0.06 + i % 3 * 0.02, 0.003, 0.2 + i % 4 * 0.045], [(i % 2 ? -1 : 1) * (0.08 + i % 4 * 0.025), 0.024, i * 0.115], bloodMat, false);

  const viewAmbient = new THREE.HemisphereLight(0xb9c1bc, 0x252017, 0.65);
  const viewKey = new THREE.PointLight(0xffdab0, 1.9, 4, 2); viewKey.position.set(-0.4, 0.2, -0.4); viewScene.add(viewAmbient, viewKey);
  function makeHand(side, position, grip = true) {
    const group = new THREE.Group(); group.position.fromArray(position); viewModel.add(group);
    bone(group, [side * 0.21, -0.38, 0.34], [side * 0.035, -0.1, 0.06], 0.087, sleeveMat, false);
    bone(group, [side * 0.035, -0.1, 0.06], [0, -0.025, 0], 0.061, skinMat, false); sphere(group, [0.092, 0.11, 0.052], [0, 0.025, -0.025], skinMat, false);
    for (let i = 0; i < 4; i++) {
      const x = (i - 1.5) * 0.042; const top = 0.095 - Math.abs(i - 1.5) * 0.012;
      const start = [x, top, -0.034]; const bend = [x, top + (grip ? 0.037 : 0.02), -0.095]; const end = [x, top - (grip ? 0.035 : 0.055), -0.13];
      bone(group, start, bend, 0.022, skinMat, false); sphere(group, [0.023, 0.025, 0.023], bend, skinMat, false);
      bone(group, bend, end, 0.019, skinMat, false); sphere(group, [0.02, 0.021, 0.02], end, skinMat, false);
    }
    bone(group, [-side * 0.075, -0.005, 0.005], [-side * 0.12, 0.055, -0.035], 0.027, skinMat, false);
    bone(group, [-side * 0.12, 0.055, -0.035], [-side * 0.065, 0.088, -0.095], 0.024, skinMat, false);
    return group;
  }
  const rightHand = makeHand(1, [0.33, -0.34, -0.61]); rightHand.rotation.z = -0.15;
  const leftHand = makeHand(-1, [-0.32, -0.44, -0.7], false); leftHand.rotation.z = 0.23;
  const torch = new THREE.Group(); torch.position.set(0.33, -0.245, -0.7); torch.rotation.x = -0.03; viewModel.add(torch);
  const barrel = cylinder(torch, 0.067, 0.4, [0, 0, 0.025], rustMat, false); barrel.rotation.x = Math.PI / 2;
  const torchHead = cylinder(torch, 0.11, 0.17, [0, 0, -0.24], metalMat, false); torchHead.rotation.x = Math.PI / 2;
  for (let i = 0; i < 4; i++) mesh(torch, ringGeo, blackMat, [0.07, 0.07, 0.07], [0, 0, 0.13 - i * 0.065], false);
  const lensMat = basic(0xffedc4); const lens = cylinder(torch, 0.094, 0.012, [0, 0, -0.332], lensMat, false); lens.rotation.x = Math.PI / 2;
  const endCap = cylinder(torch, 0.074, 0.025, [0, 0, 0.234], blackMat, false); endCap.rotation.x = Math.PI / 2;
  box(torch, [0.035, 0.018, 0.065], [0, 0.065, -0.015], blackMat, false);
  const droppedTorch = torch.clone(true); droppedTorch.visible = false; scene.add(droppedTorch);
  const droppedAim = new THREE.Vector3();
  const targetMat = basic(0xd2ad62, { transparent: true, opacity: 0.65, depthWrite: false });
  const targetRing = mesh(scene, ringGeo, targetMat, [0.55, 0.55, 0.55], [0, 0.04, 0], false); targetRing.rotation.x = -Math.PI / 2; targetRing.visible = false;
  const captureScreen = new THREE.Group(); captureScreen.visible = false; viewScene.add(captureScreen);
  const redVeilMat = basic(0x5c090b, { transparent: true, opacity: 0, depthWrite: false, depthTest: false });
  const redVeil = mesh(captureScreen, planeGeo, redVeilMat, [2, 1.4, 1], [0, 0, -0.5], false); redVeil.renderOrder = 100;
  const crackPositions = [];
  for (let ray = 0; ray < 9; ray++) {
    const angle = ray * Math.PI * 2 / 9 + 0.18; let x = 0.08, y = 0.035;
    for (let segment = 1; segment <= 5; segment++) {
      const radius = segment * 0.095; const nx = 0.08 + Math.cos(angle + Math.sin(segment * 4 + ray) * 0.1) * radius; const ny = 0.035 + Math.sin(angle) * radius;
      crackPositions.push(x, y, -0.4, nx, ny, -0.4);
      if (segment === 3) crackPositions.push(nx, ny, -0.4, nx + Math.cos(angle + 0.6) * 0.13, ny + Math.sin(angle + 0.6) * 0.13, -0.4);
      x = nx; y = ny;
    }
  }
  const crackGeo = geo(new THREE.BufferGeometry()); crackGeo.setAttribute('position', new THREE.Float32BufferAttribute(crackPositions, 3));
  const crackMat = new THREE.LineBasicMaterial({ color: 0xcbb6a3, transparent: true, opacity: 0, depthTest: false, depthWrite: false }); materials.add(crackMat);
  const cracks = new THREE.LineSegments(crackGeo, crackMat); cracks.renderOrder = 101; captureScreen.add(cracks);
  const hideAperture = new THREE.Group(); hideAperture.visible = false; viewScene.add(hideAperture);
  const hideMaskMat = basic(0x020303, { depthTest: false, depthWrite: false });
  const hideMasks = Array.from({ length: 4 }, () => { const part = mesh(hideAperture, planeGeo, hideMaskMat, [2, 2, 1], [0, 0, -0.35], false); part.renderOrder = 110; return part; });

  function applyCapture(state) {
    const t = captureTime; const start = state.capture.player; const enemy = state.capture.enemy;
    let dx = enemy.x - start.x, dz = enemy.z - start.z; const length = Math.hypot(dx, dz);
    if (length < 0.01) { dx = -Math.sin(start.yaw); dz = -Math.cos(start.yaw); } else { dx /= length; dz /= length; }
    const inArchive = start.z < -6;
    const insideX = value => THREE.MathUtils.clamp(value, inArchive ? -2.65 : -7.65, inArchive ? 2.65 : 7.65);
    const insideZ = value => THREE.MathUtils.clamp(value, inArchive ? -10.65 : -5.65, inArchive ? -6.35 : 5.65);
    const drag = smooth((t - 0.7) / 2.3); const lift = smooth((t - 3) / 2.2); const close = smooth((t - 5.2) / 1.3);
    const endX = insideX(start.x + dx * 1.7); const endZ = insideZ(start.z + dz * 1.7);
    const groundX = THREE.MathUtils.lerp(start.x, endX, drag); const groundZ = THREE.MathUtils.lerp(start.z, endZ, drag);
    const villainX = inArchive ? 0 : THREE.MathUtils.clamp(groundX + dx * .85, -6.2, 6.2);
    const villainZ = inArchive ? -8.5 : THREE.MathUtils.clamp(groundZ + dz * .85, -4.2, 4.2);
    bunny.position.set(villainX, 0, villainZ); bunny.rotation.y = Math.atan2(-dx, -dz);
    bunnyTorso.position.y = 0; bunnyTorso.rotation.x = THREE.MathUtils.lerp(0.38, 0, lift); bunnyHead.rotation.z = 0.055 + close * 0.09;
    for (const { side, arm, thigh, calf } of limbs) {
      arm.rotation.x = t < 3 ? -1.35 : THREE.MathUtils.lerp(-1.35, -2.25, lift); arm.rotation.z = side * (t < 3 ? 0.17 : 0.06);
      thigh.position.y = 0.95; thigh.rotation.x = 0; calf.rotation.x = 0;
    }
    const drop = smooth(t / 0.7);
    const finalX = villainX - dx * (1.25 - close * 0.15); const finalZ = villainZ - dz * (1.25 - close * 0.15);
    camera.position.set(insideX(THREE.MathUtils.lerp(groundX, finalX, lift)), THREE.MathUtils.lerp(THREE.MathUtils.lerp(1.6, 0.19, drop), 2.07, lift), insideZ(THREE.MathUtils.lerp(groundZ, finalZ, lift)));
    const dragBump = t > 0.7 && t < 3 ? Math.sin(t * 26) * 0.015 : 0; camera.position.y += dragBump;
    camera.lookAt(villainX, THREE.MathUtils.lerp(1.33, 1.93, lift), villainZ);
    camera.rotateZ(THREE.MathUtils.lerp(0.08 * Math.sin(t * 5) * drop, Math.PI, lift));
    camera.fov = FOV - smooth((t - 6.5) / 1.5) * 16; camera.updateProjectionMatrix();
    quietMouth.visible = t < 5.2; grin.visible = t >= 5.2; grin.scale.set(0.85 + close * 0.2, 0.8 + close * 0.35, 1);
    captureBlood.visible = t > 0.75;
    captureBlood.position.set(start.x, 0, start.z); captureBlood.rotation.y = Math.atan2(dx, dz);
    captureBlood.children.forEach((stain, i) => { stain.visible = i / 16 < drag; });
    captureScreen.visible = t >= 6.5; redVeilMat.opacity = smooth((t - 6.5) / 1.5) * 0.58; crackMat.opacity = t >= 6.5 ? 0.8 : 0;
  }

  function resize(nextWidth, nextHeight) {
    if (disposed) return;
    width = Math.max(1, nextWidth || host.clientWidth || window.innerWidth); height = Math.max(1, nextHeight || host.clientHeight || window.innerHeight);
    renderer.setSize(width, height, false); camera.aspect = viewCamera.aspect = width / height; camera.updateProjectionMatrix(); viewCamera.updateProjectionMatrix();
  }
  function sync(state, shot = null) {
    if (disposed || !state?.world) return;
    const world = state.world; const player = world.player; const time = Number.isFinite(state.elapsed) ? state.elapsed : 0;
    const walked = Number.isFinite(player.distanceWalked) ? player.distanceWalked : 0;
    secretSlide = THREE.MathUtils.clamp(world.secret?.slide || 0, 0, 1);
    secretOpen = Boolean(world.secret?.open);
    secretPanel.position.x = secretSlide * 3.2;
    secretRoom.visible = secretSlide > 0.02;
    journalTag.material.emissiveIntensity = world.secret?.clueRead ? 0.14 : 0.065;
    captureVisible = Boolean(state.capture) && (state.phase === 'CAPTURE' || state.phase === 'LOSE');
    captureTime = captureVisible ? (state.phase === 'CAPTURE' ? captureTimelineTime(state.phaseElapsed || 0) : 8) : -1;
    darkRoom = state.phase === 'LEVEL_TRANSITION' || world.level === 2 || (shot?.corruption || 0) >= 1;
    torchActive = state.torchOn !== false;
    if (previousDark !== darkRoom) {
      skyMat.color.setHex(darkRoom ? 0x941318 : 0x4c536b); moon.material.color.setHex(darkRoom ? 0xc04e36 : 0x9cabb2);
      windowLight.color.setHex(darkRoom ? 0xe33a21 : 0x9aabc4); windowLight.intensity = darkRoom ? 15 : 13;
      ambient.intensity = darkRoom ? 0.075 : 0.2; upperWallMat.map = darkRoom ? maps.peeling : maps.plaster;
      upperWallMat.color.setHex(darkRoom ? 0x777a72 : 0x9a9580); upperWallMat.needsUpdate = true;
      ceilingLight.intensity = darkRoom ? 0 : 23; lamps.forEach(light => { light.intensity = darkRoom ? 0 : 17; }); bulbMat.emissiveIntensity = darkRoom ? 0.015 : 1.5;
      scene.fog.density = darkRoom ? 0.027 : 0.018; previousDark = darkRoom;
    }
    // One isolated lightning pulse per eleven visible seconds; thunder is 1.2s later.
    // No independent clock: focus/ESC pause freezes both rain and weather phase.
    const cycle = ((time % 11) + 11) % 11;
    stormFlash = cycle >= 1 && cycle < 1.7 ? Math.exp(-(cycle - 1) * 7.5) : 0;
    stormColor.setHex(darkRoom ? 0x941318 : 0x4c536b);
    skyMat.color.copy(stormColor).lerp(flashColor, stormFlash * 0.62);
    stormLight.intensity = stormFlash * 95;
    ambient.intensity = (darkRoom ? 0.075 : 0.2) + stormFlash * 0.045;
    for (let i = 0; i < 220; i++) {
      const seed = (i * 0.6180339887) % 1;
      rainTransform.position.set(-8.4 - i % 9 * 0.73, 0.15 + ((seed * 7.2 - time * (5 + i % 4 * 0.2)) % 7.2 + 7.2) % 7.2, -9 + ((i * 0.731) % 17));
      rainTransform.scale.set(0.012, 0.25 + i % 4 * 0.06, 0.012); rainTransform.rotation.set(0.11, 0, -0.17); rainTransform.updateMatrix(); rain.setMatrixAt(i, rainTransform.matrix);
    }
    rain.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < 56; i++) {
      const travel = (((i * 0.271 + time * (0.025 + i % 3 * 0.009)) % 1) + 1) % 1;
      rainTransform.position.set(-7.925, 2.87 - travel * 1.66, -3.88 + ((i * 0.739) % 4.75));
      rainTransform.rotation.set(0, 0, 0); rainTransform.scale.set(0.009, 0.023 + i % 4 * 0.016, 0.009 + i % 2 * 0.004); rainTransform.updateMatrix(); drops.setMatrixAt(i, rainTransform.matrix);
    }
    drops.instanceMatrix.needsUpdate = true;
    const active = state.phase === 'LEVEL_1' || state.phase === 'LEVEL_2'; const pose = shot?.camera;
    const hidingSpot = (world.hidingSpots || []).find(spot => spot.id === player.hiddenIn);
    hiddenSpotId = hidingSpot?.id ?? null; peeking = Boolean(hidingSpot && player.peeking);
    const bob = active ? Math.sin(walked * 7.2) * 0.018 : 0;
    if (pose?.position && pose?.target) { camera.position.fromArray(pose.position); camera.lookAt(...pose.target); if (pose.roll) camera.rotateZ(pose.roll); }
    else {
      camera.position.set(player.x, EYE_HEIGHT + bob, player.z);
      camera.rotation.set(player.pitch || 0, player.yaw || 0, active ? Math.sin(walked * 3.6) * 0.002 : 0, 'YXZ');
      if (state.phase === 'LEVEL_TRANSITION') camera.rotation.z = Math.sin((state.phaseElapsed || 0) * 24) * Math.max(0, 0.035 * (1 - (state.phaseElapsed || 0) / 0.38));
    }
    if (hidingSpot && !captureVisible) {
      camera.position.set(hidingSpot.bodyX, hidingSpot.kind === 'closet' ? 1.5 : 0.7, hidingSpot.bodyZ + (peeking ? hidingSpot.depth * 0.44 : 0));
      camera.rotation.set(player.pitch || 0, player.yaw ?? hidingSpot.entryYaw, 0, 'YXZ');
    }
    const zoom = pose?.zoom || 1; if (camera.zoom !== zoom) { camera.zoom = zoom; camera.updateProjectionMatrix(); }
    const desiredFov = pose?.fov || FOV; if (!captureVisible && camera.fov !== desiredFov) { camera.fov = desiredFov; camera.updateProjectionMatrix(); }
    torchActive = state.torchOn !== false && !hidingSpot;
    flashlight.intensity = torchActive ? 75 : 0; lensMat.color.setHex(torchActive ? 0xffedc4 : 0x424e4d);
    viewKey.intensity = torchActive ? (darkRoom ? 1.25 : 1.9) : (darkRoom ? 0.13 : 0.65); viewAmbient.intensity = darkRoom ? 0.2 : 0.65;
    handsVisible = !pose && !hidingSpot && !['WIN', 'LOSE', 'CAPTURE'].includes(state.phase); viewModel.visible = handsVisible;
    hideAperture.visible = Boolean(hidingSpot) && !captureVisible && !['WIN', 'LOSE'].includes(state.phase);
    if (hideAperture.visible) {
      const apertureX = peeking ? 0.3 : 0.115; const apertureY = peeking ? 0.15 : 0.035;
      hideMasks[0].scale.set(2, 1, 1); hideMasks[0].position.set(0, apertureY + 0.5, -0.35);
      hideMasks[1].scale.set(2, 1, 1); hideMasks[1].position.set(0, -apertureY - 0.5, -0.35);
      hideMasks[2].scale.set(1, 2, 1); hideMasks[2].position.set(apertureX + 0.5, 0, -0.35);
      hideMasks[3].scale.set(1, 2, 1); hideMasks[3].position.set(-apertureX - 0.5, 0, -0.35);
    }
    captureScreen.visible = false; captureBlood.visible = false; quietMouth.visible = true; grin.visible = false;
    viewModel.position.set(Math.sin(walked * 3.6) * 0.008, -Math.abs(Math.sin(walked * 3.6)) * 0.008, 0);
    leftHand.visible = Boolean(player.carriedToyId); handToy = null;
    objectViews.forEach(view => { view.root.visible = false; });
    (world.hidingSpots || []).forEach(data => { const view = viewFor(data.id, () => makeHidingSpot(data)); view.root.visible = true; view.root.position.set(data.bodyX, 0, data.bodyZ); });
    (world.toys || []).forEach(data => {
      const view = viewFor(data.id, () => makeToy(data.id, data.color)); view.root.visible = world.level === 1;
      if (world.tasks?.length) {
        if (view.root.parent !== scene) scene.add(view.root);
        view.root.visible = true; view.root.scale.setScalar(data.id === 'bear' ? 0.65 : 0.7); view.root.rotation.set(0, data.id === 'duck' ? 1.1 : 0, 0);
        const decorativePosition = data.id === 'bear' ? [-6.9, 0.92, -0.9] : data.id === 'ball' ? [-4.7, 0, 5.15] : [7.3, 0.78, -1.0];
        view.root.position.fromArray(decorativePosition); return;
      }
      if (data.status === 'carried') {
        if (view.root.parent !== viewModel) viewModel.add(view.root);
        view.root.scale.setScalar(0.44); view.root.position.set(-0.31, -0.4, -0.78); view.root.rotation.set(0.08, -0.2, -0.1); handToy = data.id;
      } else {
        if (view.root.parent !== scene) scene.add(view.root); view.root.scale.setScalar(1); view.root.rotation.set(0, 0, 0);
        if (data.status === 'delivered') { const shelf = world.shelves.find(item => item.id === data.shelfId); view.root.position.set(shelf?.x ?? data.x, 0.75, (shelf?.z ?? data.z) + 0.07); }
        else view.root.position.set(data.x, 0, data.z);
      }
    });
    completedJobs = world.completedTasks ?? 0;
    (world.tasks || []).forEach(data => {
      const view = viewFor(`task:${data.id}`, () => makeTask(data)); view.root.visible = true; view.root.position.set(data.x, 0, data.z);
      view.dirty.visible = !data.done; view.clean.visible = data.done;
      if (data.kind === 'books') {
        view.root.position.x += secretSlide * 3.2;
        view.levers.forEach((lever, index) => { lever.rotation.x = secretOpen && world.secret?.targetIndex === index ? -0.18 : 0; });
      }
    });
    (world.switches || []).forEach(data => {
      const view = viewFor(data.id, () => makeSwitch(data)); view.root.visible = world.level === 2; view.root.position.set(data.x, 0, data.z); view.root.rotation.y = data.rotation || 0;
      view.handle.rotation.z = data.disabled ? -Math.PI / 2 : 0; view.lampMat.color.setHex(data.disabled ? 0x8cbb91 : 0xdd7050); view.lampMat.emissive.setHex(data.disabled ? 0x2e704a : 0xe74419);
      view.activeLabel.visible = !data.disabled; view.offLabel.visible = data.disabled;
    });
    if (world.exit) {
      const view = viewFor('exit', makeExit); view.root.visible = world.level === 2; view.root.position.set(world.exit.x, 0, world.exit.z); const unlocked = world.exit.unlocked;
      view.lampMat.emissive.setHex(unlocked ? 0x4c8d52 : 0xc94c1e); view.signLocked.visible = !unlocked; view.signOpen.visible = unlocked; view.door.visible = view.handle.visible = view.panel.visible = !unlocked;
    }
    const enemy = world.enemy; bunny.position.set(enemy.x, 0, enemy.z); const rise = enemy.active ? smooth((enemy.wakeElapsed ?? 2) / 1.1) : 0;
    bunny.rotation.y = enemy.active ? (Number.isFinite(enemy.heading) ? enemy.heading + Math.PI : Math.atan2(player.x - enemy.x, player.z - enemy.z)) : -2.6;
    bunnyTorso.position.y = -0.48 * (1 - rise) + (enemy.active ? Math.sin(time * 5.8) * 0.025 * rise : 0); bunnyTorso.rotation.x = 0.18 * (1 - rise);
    const cleanupTension = THREE.MathUtils.clamp(completedJobs / 6, 0, 1);
    bunnyHead.rotation.z = enemy.active ? Math.sin(time * 1.7) * 0.035 : -0.1 - cleanupTension * 0.035;
    const twistCycle = ((time % 17) + 17) % 17;
    bunnyHead.rotation.y = world.level === 2 ? (twistCycle > 12 ? Math.PI * 2 * smooth((twistCycle - 12) / 2) : 0) + Math.sin(time * 13.2) * 0.025 : 0;
    bunnyTorso.rotation.z = world.level === 2 ? Math.sin(time * 8.5) * 0.035 + Math.sin(time * 22) * 0.008 : 0;
    quietMouth.scale.x = 0.13 * (1 + cleanupTension * 0.85); quietMouth.rotation.z = -cleanupTension * 0.12;
    limbs.forEach(({ side, arm, thigh, calf }) => {
      thigh.position.y = 0.95 - 0.48 * (1 - rise); thigh.rotation.x = -1.12 * (1 - rise) + (enemy.active ? Math.sin(time * 5.8 + (side > 0 ? Math.PI : 0)) * 0.24 * rise : 0);
      calf.rotation.x = 1.15 * (1 - rise); arm.rotation.x = -0.35 * (1 - rise) + (enemy.active ? Math.sin(time * 5.8 + (side < 0 ? Math.PI : 0)) * 0.18 * rise : 0); arm.rotation.z = side * 0.11 + (enemy.active ? Math.sin(time * 19 + side) * 0.035 : 0);
    });
    eyeMat.emissiveIntensity = enemy.active ? 4 : darkRoom ? 2 : 0.05 + cleanupTension * 0.45; eyeMat.color.setHex(darkRoom ? 0xff3828 : 0x9b9b7d); eyeMat.emissive.setHex(darkRoom ? 0xff1609 : 0xff6f37);
    if (darkRoom) { grin.visible = true; grin.scale.set(1.05, 1.05, 1); quietMouth.visible = false; }
    if (captureVisible) applyCapture(state);
    playerFill.position.copy(camera.position); playerFill.position.y -= 0.18;
    playerFill.intensity = captureVisible || hidingSpot ? 0 : 1.7;
    droppedTorch.visible = captureVisible;
    if (captureVisible) {
      // Capture uses one physical world-space cone; no camera or face fill remains.
      if (flashlight.parent !== scene) { scene.add(flashlight); scene.add(torchTarget); }
      const origin = state.capture.player; const drop = smooth(captureTime / 0.7);
      droppedTorch.position.set(THREE.MathUtils.clamp(origin.x + Math.cos(origin.yaw) * 0.28, -7.8, 7.8), 0.11 + Math.abs(Math.sin(captureTime * 17)) * 0.25 * (1 - drop), origin.z - Math.sin(origin.yaw) * 0.28);
      const settling = 1 - drop; const cameraDirection = new THREE.Vector3().subVectors(camera.position, bunny.position).normalize();
      droppedAim.set(bunny.position.x, 1.85, bunny.position.z).addScaledVector(cameraDirection, 0.24);
      droppedAim.x += Math.sin(captureTime * 21) * settling * 4; droppedAim.y += Math.sin(captureTime * 18) * settling * 1.5; droppedAim.z += Math.cos(captureTime * 16) * settling * 4;
      droppedTorch.lookAt(droppedAim); droppedTorch.rotateY(Math.PI); droppedTorch.rotateZ(Math.sin(captureTime * 22) * settling * 1.8);
      flashlight.position.copy(droppedTorch.position); flashlight.position.y += 0.05; torchTarget.position.copy(droppedAim);
      flashlight.intensity = 16 + Math.sin(captureTime * 11) * 2; flashlight.angle = Math.PI / 40; flashlight.penumbra = 0.55;
      eyeMat.emissiveIntensity = 5.5;
      bunnyHead.rotation.y = 0; bunnyTorso.rotation.z = 0;
    } else {
      if (flashlight.parent !== camera) { camera.add(flashlight); camera.add(torchTarget); }
      flashlight.position.set(0.28, -0.19, -0.15); torchTarget.position.set(0, 0, -9); flashlight.angle = Math.PI / 7; flashlight.penumbra = 0.62;
    }
    scene.updateMatrixWorld(true);
    eyeTrackers.forEach(({ head, pupils }) => {
      if (captureVisible) trackedPoint.copy(camera.position); else trackedPoint.set(player.x, EYE_HEIGHT, player.z);
      head.worldToLocal(trackedPoint);
      const distance = Math.max(0.1, trackedPoint.length());
      pupils.forEach(pupil => { pupil.position.x = pupil.userData.baseX + THREE.MathUtils.clamp(trackedPoint.x / distance, -1, 1) * 0.026; pupil.position.y = (pupil.userData.baseY ?? 0.025) + THREE.MathUtils.clamp(trackedPoint.y / distance, -1, 1) * 0.035; });
    });
    targetRing.visible = Boolean(state.target) && active && !state.paused;
    if (state.target) { targetRing.position.set(state.target.x, 0.035, state.target.z); targetRing.scale.setScalar(state.target.kind === 'shelf' ? 0.78 : 0.48); targetMat.color.setHex(darkRoom ? 0xc98b55 : 0xd2ad62); }
  }
  function render() {
    if (disposed) return; renderer.info.reset(); renderer.autoClear = true; renderer.render(scene, camera);
    if (handsVisible || captureScreen.visible || hideAperture.visible) { renderer.autoClear = false; renderer.clearDepth(); renderer.render(viewScene, viewCamera); renderer.autoClear = true; }
  }
  function getDiagnostics() {
    return {
      threeRevision: THREE.REVISION, projection: 'perspective', fieldOfView: camera.fov,
      camera: { position: camera.position.toArray(), yaw: camera.rotation.y, pitch: camera.rotation.x, roll: camera.rotation.z },
      torchActive, handsVisible, handToy, darkRoom, exteriorSky: `#${skyMat.color.getHexString()}`,
      completedJobs, taskViews: [...objectViews.keys()].filter(id => id.startsWith('task:')).length,
      secret: { open: secretOpen, slide: secretSlide, roomVisible: secretRoom.visible, panelX: secretPanel.position.x },
      storm: { lightning: stormFlash, rainCount: rain.count, windowDroplets: drops.count, period: 11, lightningAt: 1, thunderAt: 2.2 },
      capture: { active: captureVisible, elapsed: captureTime, bloodVisible: captureBlood.visible, grinVisible: grin.visible, lensBroken: captureScreen.visible },
      hiding: { id: hiddenSpotId, peeking, apertureVisible: hideAperture.visible },
      trackingTeddies: eyeTrackers.length,
      lighting: { playerFillRange: playerFill.distance, playerFillIntensity: playerFill.intensity, captureFaceIntensity: 0, droppedTorch: droppedTorch.visible, torchParent: flashlight.parent === camera ? 'camera' : 'world', glassOpacity: glassMat.opacity },
      geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, programs: renderer.info.programs?.length || 0, drawCalls: renderer.info.render.calls,
      trackedGeometries: geometries.size, trackedMaterials: materials.size, trackedTextures: textures.size, objectViews: objectViews.size,
      assets: { requested: assetStatus.requested, loaded: assetStatus.loaded, failed: [...assetStatus.failed] }, width, height, disposed,
    };
  }
  function dispose() {
    if (disposed) return; disposed = true;
    rain.dispose(); drops.dispose();
    geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); textures.forEach(value => value.dispose());
    flashlight.shadow.map?.dispose(); ceilingLight.shadow.map?.dispose(); renderer.dispose(); canvas.remove(); assetWarning?.remove();
  }
  resize(host.clientWidth, host.clientHeight);
  return { sync, render, resize, dispose, getDiagnostics };
}
