// Renders planted totems as camera-facing DOM billboards. Each totem is a
// shen-ring cartouche: an elongated ring (black fill, Electric Iris border,
// knot bar at the base) enclosing the ordered emoji stack — "these signs
// belong together; hold them as one utterance." A dashed ring means the
// totem is still unwritten; the ring closes solid once it holds a note.

import * as THREE from 'three';
import { animate } from 'animejs';

const _v = new THREE.Vector3();

export function createTotemOverlay({ camera, onSelect }) {
  const root = document.createElement('div');
  root.className = 'totem-overlay';
  document.body.appendChild(root);

  let entries = []; // { totem, el }

  function elementFor(totem) {
    const el = document.createElement('button');
    el.className = 'totem';
    el.type = 'button';
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      onSelect(totem);
    });
    const cartouche = document.createElement('span');
    cartouche.className = 'totem-cartouche';
    const stack = document.createElement('span');
    stack.className = 'totem-stack';
    cartouche.appendChild(stack);
    el.appendChild(cartouche);
    const knot = document.createElement('span');
    knot.className = 'totem-knot';
    el.appendChild(knot);
    const stem = document.createElement('span');
    stem.className = 'totem-stem';
    el.appendChild(stem);
    return el;
  }

  function sync(totems) {
    root.replaceChildren();
    entries = totems.map((totem) => {
      const el = elementFor(totem);
      root.appendChild(el);
      return { totem, el };
    });
    refresh();
  }

  // re-read note state (dashed ring = unwritten, solid = has a note)
  function refresh() {
    for (const { totem, el } of entries) {
      el.querySelector('.totem-stack').textContent = totem.glyphs.join('\n');
      el.classList.toggle('totem--noted', Boolean(totem.text?.trim()));
      el.classList.toggle('totem--mine', Boolean(totem.mine));
    }
  }

  // screen-space anchor of a totem (for the note panel's pop animations);
  // null when it's behind the camera or not planted
  function screenPos(totem) {
    const entry = entries.find((e) => e.totem === totem);
    if (!entry) return null;
    _v.set(totem.pos[0], totem.pos[1], totem.pos[2]).project(camera);
    if (_v.z > 1 || _v.z < -1) return null;
    return {
      x: (_v.x * 0.5 + 0.5) * window.innerWidth,
      y: (-_v.y * 0.5 + 0.5) * window.innerHeight
    };
  }

  // the "note landed" bounce — scale the cartouche, not the positioned root
  // (the root's transform is rewritten every frame by update())
  function pop(totem) {
    const entry = entries.find((e) => e.totem === totem);
    if (!entry) return;
    animate(entry.el.querySelector('.totem-cartouche'), {
      scale: [
        { to: 1.3, duration: 170, ease: 'outQuad' },
        { to: 1, duration: 260, ease: 'outBack' }
      ]
    });
  }

  function update() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    for (const { totem, el } of entries) {
      _v.set(totem.pos[0], totem.pos[1], totem.pos[2]).project(camera);
      const behind = _v.z > 1 || _v.z < -1;
      if (behind) {
        el.style.display = 'none';
        continue;
      }
      el.style.display = '';
      const x = (_v.x * 0.5 + 0.5) * w;
      const y = (-_v.y * 0.5 + 0.5) * h;
      const dist = camera.position.distanceTo(
        _v.set(totem.pos[0], totem.pos[1], totem.pos[2])
      );
      const scale = THREE.MathUtils.clamp(2.4 / dist, 0.55, 1.5);
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%) scale(${scale.toFixed(3)})`;
    }
  }

  return { sync, refresh, update, screenPos, pop };
}
