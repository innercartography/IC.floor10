// Touch controls for the club layer. On phones the desktop HUD buries the
// scene and there's no WASD, so here:
//   - the HUD becomes a bottom sheet with a handle (collapsed by default, so
//     the world stays open); tap the handle to open/close it
//   - a thumb joystick (bottom-left) drives movement
//   - one-finger drag on the world looks around (handled by FirstPersonControls)
//   - tap the world to plant / select (handled in main.js)

export function isTouch() {
  return matchMedia('(pointer: coarse)').matches || window.innerWidth <= 768;
}

// Turn the existing .hud panel into a collapsible bottom sheet. Returns
// helpers so the caller can auto-collapse it (e.g. when arming a totem).
export function buildSheet() {
  const hud = document.querySelector('.hud');
  if (!hud) return { open() {}, close() {}, toggle() {} };

  const handle = document.createElement('button');
  handle.className = 'hud-handle';
  handle.type = 'button';
  handle.innerHTML = '<span class="hud-handle-grip"></span><span class="hud-handle-label">controls</span>';
  hud.prepend(handle);

  const setOpen = (open) => hud.classList.toggle('hud--open', open);
  handle.addEventListener('click', () => setOpen(!hud.classList.contains('hud--open')));

  return {
    open: () => setOpen(true),
    close: () => setOpen(false),
    toggle: () => setOpen(!hud.classList.contains('hud--open'))
  };
}

// A radial thumb joystick. Drives the FirstPersonControls move flags from the
// knob's offset — 8-way is plenty for walking a room.
export function buildJoystick(controls) {
  const base = document.createElement('div');
  base.className = 'joystick';
  const knob = document.createElement('div');
  knob.className = 'joystick-knob';
  base.appendChild(knob);
  document.body.appendChild(base);

  const RADIUS = 46;      // px travel of the knob
  const DEAD = 0.28;      // fraction of travel treated as neutral
  let active = false;
  let originX = 0;
  let originY = 0;

  const clearMove = () => {
    controls.moveForward = controls.moveBackward = controls.moveLeft = controls.moveRight = false;
  };

  const apply = (dx, dy) => {
    const len = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(len, RADIUS);
    const nx = (dx / len) * clamped;
    const ny = (dy / len) * clamped;
    knob.style.transform = `translate(${nx.toFixed(1)}px, ${ny.toFixed(1)}px)`;
    const fx = nx / RADIUS;
    const fy = ny / RADIUS;
    clearMove();
    if (fy < -DEAD) controls.moveForward = true;
    if (fy > DEAD) controls.moveBackward = true;
    if (fx < -DEAD) controls.moveLeft = true;
    if (fx > DEAD) controls.moveRight = true;
  };

  base.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    active = true;
    const r = base.getBoundingClientRect();
    originX = r.left + r.width / 2;
    originY = r.top + r.height / 2;
    try { base.setPointerCapture(e.pointerId); } catch { /* not capturable — fine */ }
    apply(e.clientX - originX, e.clientY - originY);
  });

  base.addEventListener('pointermove', (e) => {
    if (!active) return;
    e.stopPropagation();
    apply(e.clientX - originX, e.clientY - originY);
  });

  const end = (e) => {
    if (!active) return;
    active = false;
    e.stopPropagation();
    clearMove();
    knob.style.transform = 'translate(0px, 0px)';
  };
  base.addEventListener('pointerup', end);
  base.addEventListener('pointercancel', end);

  return base;
}
