// The Club Layer — /club/ entry point. Reuses the root viewer's scene
// bootstrap, splat loading, portal, track controller, and the origin layer's
// waypoints, then adds the shared totem memory: compose an ordered emoji
// stack, raycast-plant it onto the collision mesh, attach a note. Totems now
// live in a shared backend (commons.js) — you arrive to the freshest traces,
// search to reveal more layers, and others' traces appear live.

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
import { ensureAuthor, exportTotems } from './totems.js';
import { isTouch, buildSheet, buildJoystick } from './mobile.js';
import * as commons from './commons.js';

const TOUCH = isTouch();

const origin = LAYERS[0];

const pageUrl = location.href.replace(/index\.html$/, '');
const siteRoot = new URL('..', pageUrl.endsWith('/') ? pageUrl : pageUrl + '/');
const assetUrl = (rel) => new URL(rel, siteRoot).toString();

const scene = new THREE.Scene();

const renderer = new THREE.WebGLRenderer({ powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
// Clamp pixel ratio hard on touch: a phone at DPR 3 rendering millions of
// splats builds an enormous framebuffer and routinely loses the GL context
// (which shows up as a black screen after the scene "loads").
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, TOUCH ? 1.25 : 2));
renderer.setClearColor(0x040211);
document.body.appendChild(renderer.domElement);

// If the context is lost anyway, say so instead of showing a silent black void.
renderer.domElement.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  showFatal('THE FLOOR OVERWHELMED THIS DEVICE — the scan is heavy for mobile GPUs. Try desktop, or reload.');
});

function showFatal(msg) {
  let el = document.querySelector('.fatal-banner');
  if (!el) {
    el = document.createElement('div');
    el.className = 'fatal-banner';
    document.body.appendChild(el);
  }
  el.textContent = msg;
}

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

// The set of totems currently drawn. `pinned` ids stay regardless of search
// toggles (the recent traces, your own, and any that arrive live); search
// reveals add non-pinned layers on top.
const visible = new Map(); // id -> totem
const pinned = new Set();
let sheet = null; // mobile bottom-sheet controller (touch only)

function rebuild() {
  overlay.sync([...visible.values()]);
  const mine = [...visible.values()].filter((t) => t.mine).length;
  hud.setCount(visible.size, mine);
}

function addTotem(totem, { pin = false } = {}) {
  const existing = visible.get(totem.id);
  if (existing) {
    Object.assign(existing, totem);
  } else {
    visible.set(totem.id, totem);
  }
  if (pin) pinned.add(totem.id);
}

function dropTotem(id) {
  visible.delete(id);
  pinned.delete(id);
}

const notePanel = buildNotePanel({
  onSave: (totem) => scheduleSave(totem),
  onRemove: async (totem) => {
    try {
      await commons.remove(totem.id);
      dropTotem(totem.id);
      rebuild();
    } catch (e) {
      console.warn('remove failed', e);
    }
  },
  onReport: async (totem) => {
    try { await commons.report(totem.id); } catch (e) { console.warn('report failed', e); }
  },
  anchorFor: (totem) => overlay.screenPos(totem),
  onReturn: (totem) => overlay.pop(totem)
});

// debounce meaning edits so autosave is one write per pause, not per keystroke
let saveTimer = null;
let savePending = null;
function scheduleSave(totem) {
  savePending = totem;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const t = savePending;
    try {
      await commons.edit(t.id, t.text);
      notePanel.saved(true);
      overlay.refresh();
    } catch (e) {
      console.warn('save failed', e);
      notePanel.saved(false);
    }
  }, 500);
}

const overlay = createTotemOverlay({
  camera,
  onSelect: (totem) => notePanel.open(totem)
});

const hud = buildClubHud({
  locations: origin.locations,
  author,
  onSelectView: goToView,
  onArmChange: (armed) => {
    // on touch, collapse the sheet when arming so the world is tappable
    if (armed && TOUCH) sheet?.close();
  },
  onBack: siteRoot.toString(),
  onExport: () => exportTotems([...visible.values()]),
  onSearch: runSearch,
  onToggleLayer: toggleLayer,
  onClearDiscovery: clearDiscovery
});

// --- discovery -------------------------------------------------------------

let lastResults = new Map(); // layer -> totems[]

async function runSearch(query) {
  try {
    const rows = await commons.search(query);
    lastResults = groupByLayer(rows);
    const groups = [...lastResults.entries()].map(([layer, totems]) => ({ layer, totems }));
    hud.showResults(groups, rows.length);
  } catch (e) {
    console.warn('search failed', e);
    hud.searchFailed('search unavailable');
  }
}

function groupByLayer(rows) {
  const m = new Map();
  for (const t of rows) {
    if (!m.has(t.layer)) m.set(t.layer, []);
    m.get(t.layer).push(t);
  }
  return m;
}

function toggleLayer(layer, totems, on) {
  if (on) {
    totems.forEach((t) => addTotem(t));
  } else {
    totems.forEach((t) => { if (!pinned.has(t.id)) visible.delete(t.id); });
  }
  rebuild();
}

function clearDiscovery() {
  // drop everything the search revealed; keep pinned (recent / mine / live)
  for (const id of [...visible.keys()]) {
    if (!pinned.has(id)) visible.delete(id);
  }
  rebuild();
}

// --- mode / track ----------------------------------------------------------

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

// --- touch: bottom-sheet HUD + joystick, free movement by default ----------
if (TOUCH) {
  document.body.classList.add('is-touch');
  sheet = buildSheet();
  buildJoystick(controls);
  setMode('free'); // so the joystick can actually move the camera
}

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

// --- load the freshest traces + go live ------------------------------------

commons.recent(3)
  .then((rows) => {
    rows.forEach((t) => addTotem(t, { pin: true }));
    rebuild();
  })
  .catch((e) => console.warn('could not load recent totems', e));

commons.subscribe({
  onInsert: (totem) => {
    if (!visible.has(totem.id)) {
      addTotem(totem, { pin: true }); // a fresh trace surfaces for everyone here
      rebuild();
    }
  },
  onUpdate: (totem) => {
    const t = visible.get(totem.id);
    if (t) {
      t.text = totem.text;
      overlay.refresh();
    }
  },
  onDelete: (id) => {
    if (visible.has(id)) {
      if (notePanel.current()?.id === id) notePanel.close();
      dropTotem(id);
      rebuild();
    }
  }
});

// --- collision mesh: the raycast target for planting -----------------------

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

renderer.domElement.addEventListener('pointerup', async (e) => {
  if (!downAt) return;
  const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
  downAt = null;
  if (moved > 6 || !hud.isArmed() || !collisionMesh) return;

  ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObject(collisionMesh, false)[0];
  if (!hit) return;

  const p = hit.point.clone().addScaledVector(raycaster.ray.direction, -0.05);
  const glyphs = hud.getStack();
  hud.consumeStack();
  try {
    const totem = await commons.plant({
      glyphs,
      pos: [Math.round(p.x * 1000) / 1000, Math.round(p.y * 1000) / 1000, Math.round(p.z * 1000) / 1000]
    });
    addTotem(totem, { pin: true });
    rebuild();
    notePanel.open(totem);
  } catch (err) {
    console.warn('plant failed', err);
    hud.searchFailed(String(err.message || err).includes('rate') ? 'rate limit — slow down' : 'could not plant');
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
window.controls = controls;
window.commons = commons;

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
