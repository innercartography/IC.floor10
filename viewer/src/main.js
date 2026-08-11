import './style.css';
import * as THREE from 'three';
import { FirstPersonControls } from './lcc/FirstPersonControls.js';
import { LCCRender } from './lcc/lcc-web-sdk.js';
import { TrackController } from './track.js';
import { LAYERS } from './layers/index.js';
import { buildHud, buildPortal } from './ui.js';
import { armPortalWatchdog } from './portal-watchdog.js';

const scene = new THREE.Scene();

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0x040211);
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 150000);
camera.position.set(0.8, 1.0, 0.8);

const clock = new THREE.Clock();

const controls = new FirstPersonControls(camera, renderer.domElement);
controls.movementSpeed = 5;
controls.lookSpeed = 0.05;
controls.lookAt(new THREE.Vector3(-7, 0.3, -6));

// --- Modes ---------------------------------------------------------------
//   'track' (default) - travel between a layer's authored waypoints only.
//   'free'            - full WASD roam, for exploring and authoring new
//                       waypoints (press P to capture one).
const FREE_MOVEMENT_SPEED = 5;
const TRACK_MOVEMENT_SPEED = 0;

let mode = 'track';
let activeLayer = LAYERS[0];

const trackController = new TrackController(camera);

const hud = buildHud({
  layers: LAYERS,
  onSelectView: goToView,
  onSelectLayer: setActiveLayer
});

function setMode(next) {
  mode = next;
  controls.movementSpeed = mode === 'free' ? FREE_MOVEMENT_SPEED : TRACK_MOVEMENT_SPEED;
  hud.setMode(mode);
}

function goToView(view) {
  setMode('track');
  trackController.goTo(view.position, view.target);
}

function setActiveLayer(layer) {
  activeLayer = layer;
  hud.setActiveLayer(layer);
}

setActiveLayer(activeLayer);
setMode('track');

function isTextEntry(target) {
  if (!target) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable === true;
}

window.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  if (isTextEntry(event.target)) return; // typing must never move the camera

  if (event.code === 'KeyM') {
    setMode(mode === 'free' ? 'track' : 'free');
  }

  if (event.code === 'KeyP' && mode === 'free') {
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const target = camera.position.clone().addScaledVector(forward, 3);
    const round = (v) => Math.round(v * 100) / 100;
    const snippet =
      `{\n` +
      `  id: 'CHANGE_ME',\n` +
      `  label: 'CHANGE_ME',\n` +
      `  position: [${round(camera.position.x)}, ${round(camera.position.y)}, ${round(camera.position.z)}],\n` +
      `  target: [${round(target.x)}, ${round(target.y)}, ${round(target.z)}],\n` +
      `  phase: 'any',\n` +
      `  epoch: null,\n` +
      `  asserter: 'YOUR_HANDLE',\n` +
      `  scope: 'club'\n` +
      `}\n` +
      `// paste into your layer file (see src/layers/index.js to fork one)`;
    console.log(snippet);
    hud.showReadout(snippet);
  }
});

// Same coordinate-system fix used in XGRIDS' own three.html example
// (their exports are Z-up; this remaps into three's Y-up world).
const modelMatrix = new THREE.Matrix4(
  -1, 0, 0, 0,
  0, 0, 1, 0,
  0, 1, 0, 0,
  0, 0, 0, 1
);

const portal = buildPortal();

let progressed = false;
armPortalWatchdog({ portal, scene, hasProgress: () => progressed });

const lccObj = LCCRender.load(
  {
    camera,
    scene,
    renderer,
    canvas: renderer.domElement,
    renderLib: THREE,
    // Relative to wherever the site is served (root on dev, /IC.floor10/ on Pages)
    dataPath: new URL('assets/floor10/meta.lcc', location.href).toString(),
    useEnv: true,
    useIndexDB: true,
    useLoadingEffect: true,
    modelMatrix,
    appKey: null
  },
  (mesh) => {
    console.log('Floor 10 loaded:', mesh);
    portal.close();
  },
  (percent) => {
    progressed = true;
    portal.progress(percent);
  },
  () => {
    console.error('Floor 10 failed to load');
    portal.fail('THE PORTAL RESISTS — reload to retry');
  }
);

window.lccObj = lccObj;
window.LCCRender = LCCRender;
window.scene = scene;
window.renderer = renderer;
window.camera = camera;
window.trackController = trackController;
window.controls = controls;

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function render() {
  const delta = clock.getDelta();

  if (trackController.active) {
    trackController.update(delta);
  } else if (controls.enabled) {
    controls.update(delta);
  }

  LCCRender.update();
  renderer.render(scene, camera);
}

renderer.setAnimationLoop(render);

// Vite hot-reloads this module on every edit without tearing down the
// previous LCCRender instance, so each save stacks another full copy of
// the splat cloud in GPU memory. Force a hard reload instead so there's
// only ever one instance loaded at a time.
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    location.reload();
  });
}
