// The Club Layer — /club/ entry point. Reuses the root viewer's scene
// bootstrap, splat loading, portal, track controller, and the origin
// layer's waypoints, then adds the totem system: compose an ordered emoji
// stack, raycast-plant it onto the collision mesh, attach a note. v1 is
// fully static — the layer lives in localStorage, export is layer.json.

import '../style.css';
import './club.css';
import * as THREE from 'three';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';
import { FirstPersonControls } from '../lcc/FirstPersonControls.js';
import { LCCRender } from '../lcc/lcc-web-sdk.js';
import { TrackController } from '../track.js';
import { LAYERS } from '../layers/index.js';
import { buildPortal } from '../ui.js';
import { armPortalWatchdog } from '../portal-watchdog.js';
import { buildClubHud, buildNotePanel } from './club-hud.js';
import { createTotemOverlay } from './overlay.js';
import { ensureAuthor, loadLayer, saveLayer, plantTotem, removeTotem, exportLayer } from './totems.js';

const origin = LAYERS[0];

// site root = this page's URL minus the club/ suffix (works on dev and Pages,
// with or without a trailing slash or explicit index.html)
const pageUrl = location.href.replace(/index\.html$/, '');
const siteRoot = new URL('..', pageUrl.endsWith('/') ? pageUrl : pageUrl + '/');
const assetUrl = (rel) => new URL(rel, siteRoot).toString();

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

const FREE_MOVEMENT_SPEED = 5;
const TRACK_MOVEMENT_SPEED = 0;

let mode = 'track';
const trackController = new TrackController(camera);

// --- club layer state ------------------------------------------------------

const author = ensureAuthor();
const layer = loadLayer();

const notePanel = buildNotePanel({
  onSave: () => {
    saveLayer(layer);
    overlay.refresh();
  },
  onRemove: (totem) => {
    removeTotem(layer, totem);
    overlay.sync(layer.totems);
    hud.refreshCaps();
  },
  anchorFor: (totem) => overlay.screenPos(totem),
  onReturn: (totem) => overlay.pop(totem)
});

const overlay = createTotemOverlay({
  camera,
  onSelect: (totem) => notePanel.open(totem)
});

const hud = buildClubHud({
  locations: origin.locations,
  author,
  layer,
  onSelectView: goToView,
  onArmChange: () => {},
  onExport: () => exportLayer(layer)
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

setMode('track');
overlay.sync(layer.totems);

function isTextEntry(target) {
  if (!target) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable === true;
}

window.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  if (isTextEntry(event.target)) return; // typing a note must never move the camera
  if (event.code === 'KeyM') setMode(mode === 'free' ? 'track' : 'free');
  if (event.code === 'Escape') {
    hud.disarm();
    notePanel.close();
  }
});

// --- collision mesh: the raycast target for planting -----------------------
// Same Z-up -> Y-up remap the splats get, so intersection points land in the
// exact coordinate frame waypoints (and totem.pos) use.

const modelMatrix = new THREE.Matrix4(
  -1, 0, 0, 0,
  0, 0, 1, 0,
  0, 1, 0, 0,
  0, 0, 0, 1
);

let collisionMesh = null;
new PLYLoader().load(assetUrl('assets/floor10/mesh/ic10thfloor.ply'), (geometry) => {
  geometry.applyMatrix4(modelMatrix);
  geometry.computeVertexNormals();
  collisionMesh = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
  );
  scene.add(collisionMesh);
});

// --- planting: a *click* (not a look-drag) raycasts onto the mesh ----------

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let downAt = null;

renderer.domElement.addEventListener('pointerdown', (e) => {
  downAt = { x: e.clientX, y: e.clientY };
});

renderer.domElement.addEventListener('pointerup', (e) => {
  if (!downAt) return;
  const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
  downAt = null;
  if (moved > 6 || !hud.isArmed() || !collisionMesh) return;

  ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObject(collisionMesh, false)[0];
  if (!hit) return;

  // nudge the totem off the surface toward the viewer so it never z-fights
  const pos = hit.point.clone().addScaledVector(raycaster.ray.direction, -0.05);
  const result = plantTotem(layer, {
    glyphs: hud.getStack(),
    pos: [pos.x, pos.y, pos.z],
    authorId: author.id
  });
  if (result.ok) {
    hud.consumeStack();
    overlay.sync(layer.totems);
    hud.refreshCaps();
    notePanel.open(result.totem);
  } else {
    hud.disarm();
  }
});

// --- splat scene -----------------------------------------------------------

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
    dataPath: assetUrl('assets/floor10/meta.lcc'),
    useEnv: true,
    useIndexDB: true,
    useLoadingEffect: true,
    modelMatrix,
    appKey: null
  },
  (mesh) => {
    console.log('Floor 10 loaded (club):', mesh);
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
window.scene = scene;
window.camera = camera;
window.clubLayer = layer;

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
  overlay.update();
}

renderer.setAnimationLoop(render);

if (import.meta.hot) {
  import.meta.hot.accept(() => {
    location.reload();
  });
}
