// The club layer's HUD: ghost text on the void, plus the totem forge.
// The compose preview is itself a cartouche — you are forging the ring
// before you plant it. The palette is the full emoji library (searchable,
// every glyph, skin tones) served offline from bundled data. The note
// panel opens out of its totem and pops back into it on done.

import { animate } from 'animejs';
import { Picker } from 'emoji-picker-element';
import emojiDataUrl from 'emoji-picker-element-data/en/emojibase/data.json?url';
import { MAX_GLYPHS, capState, setHandle } from './totems.js';

export function buildClubHud({ locations, author, layer, onSelectView, onArmChange, onExport }) {
  const root = document.createElement('div');
  root.className = 'hud';

  const brand = document.createElement('div');
  brand.className = 'hud-brand';
  brand.innerHTML = '<span class="brand-mark">▲</span> IMMERSIVE COMMONS — FLOOR 10 · CLUB';
  root.appendChild(brand);

  const modeBadge = document.createElement('div');
  modeBadge.className = 'hud-mode';
  root.appendChild(modeBadge);

  // door back to the root viewer (the track / waypoints)
  const backRow = document.createElement('div');
  backRow.className = 'hud-files';
  const backLink = document.createElement('a');
  backLink.className = 'hud-file-link';
  backLink.href = new URL('../', location.href).toString();
  backLink.innerHTML = '← back to <span>the track</span>';
  backRow.appendChild(backLink);
  root.appendChild(backRow);

  // --- track stops (reused from the origin layer) ---
  const trackLabel = document.createElement('div');
  trackLabel.className = 'hud-section-label';
  trackLabel.textContent = 'The Track';
  root.appendChild(trackLabel);

  const menu = document.createElement('div');
  menu.className = 'hud-menu hud-menu--compact';
  root.appendChild(menu);

  locations.forEach((location) => {
    const stop = document.createElement('div');
    stop.className = 'hud-stop';
    const button = document.createElement('button');
    button.className = 'hud-stop-button';
    button.textContent = location.label;
    button.addEventListener('click', () => onSelectView(location.views[0]));
    stop.appendChild(button);
    menu.appendChild(stop);
  });

  // --- totem forge ---
  const composeLabel = document.createElement('div');
  composeLabel.className = 'hud-section-label';
  composeLabel.textContent = 'Forge a Totem';
  root.appendChild(composeLabel);

  const compose = document.createElement('div');
  compose.className = 'hud-compose';
  root.appendChild(compose);

  // the ring being forged — cartouche preview of the ordered stack
  const stackRow = document.createElement('div');
  stackRow.className = 'compose-cartouche';
  compose.appendChild(stackRow);

  const stackGlyphs = document.createElement('span');
  stackGlyphs.className = 'compose-stack-glyphs';
  stackRow.appendChild(stackGlyphs);

  const stackEmpty = document.createElement('span');
  stackEmpty.className = 'compose-stack-empty';
  stackEmpty.textContent = `stack up to ${MAX_GLYPHS} — order matters`;
  stackRow.appendChild(stackEmpty);

  const clear = document.createElement('button');
  clear.className = 'compose-clear';
  clear.textContent = 'clear the ring';
  compose.appendChild(clear);

  // full emoji library — offline data, search, categories, skin tones
  const picker = new Picker({ dataSource: emojiDataUrl });
  picker.classList.add('dark', 'compose-picker');
  compose.appendChild(picker);

  const plant = document.createElement('button');
  plant.className = 'compose-plant';
  compose.appendChild(plant);

  const count = document.createElement('div');
  count.className = 'compose-count';
  compose.appendChild(count);

  const handleInput = document.createElement('input');
  handleInput.className = 'compose-handle';
  handleInput.placeholder = 'handle (optional, never shown)';
  handleInput.value = author.handle ?? '';
  handleInput.addEventListener('change', () => setHandle(handleInput.value));
  compose.appendChild(handleInput);

  // --- export ---
  const filesLabel = document.createElement('div');
  filesLabel.className = 'hud-section-label';
  filesLabel.textContent = 'Take the Layer With You';
  root.appendChild(filesLabel);

  const files = document.createElement('div');
  files.className = 'hud-files';
  const exportLink = document.createElement('a');
  exportLink.className = 'hud-file-link';
  exportLink.href = '#';
  exportLink.innerHTML = 'export layer <span>.json</span>';
  exportLink.addEventListener('click', (e) => {
    e.preventDefault();
    onExport();
  });
  files.appendChild(exportLink);
  const note = document.createElement('div');
  note.className = 'hud-file-soon';
  note.textContent = 'PR it back — the world compounds';
  files.appendChild(note);
  root.appendChild(files);

  const hint = document.createElement('div');
  hint.className = 'hud-hint';
  hint.innerHTML =
    '<b>drag</b> look · <b>M</b> free-roam/track · <b>WASD</b> move (free) · forge a ring, then <b>plant</b> and click the world';
  root.appendChild(hint);

  document.body.appendChild(root);

  // --- plant-mode hint (center bottom) ---
  const plantHint = document.createElement('div');
  plantHint.className = 'plant-hint';
  plantHint.hidden = true;
  plantHint.textContent = 'click where it happened — the room is part of the sentence';
  document.body.appendChild(plantHint);

  // --- state ---
  let glyphStack = [];
  let armed = false;

  picker.addEventListener('emoji-click', (e) => {
    const glyph = e.detail.unicode ?? e.detail.emoji?.unicode;
    if (!glyph || glyphStack.length >= MAX_GLYPHS) return;
    glyphStack.push(glyph);
    syncCompose();
    animate(stackRow, {
      scale: [
        { to: 1.06, duration: 120, ease: 'outQuad' },
        { to: 1, duration: 180, ease: 'outQuad' }
      ]
    });
  });

  clear.addEventListener('click', () => {
    glyphStack = [];
    setArmed(false);
    syncCompose();
  });

  plant.addEventListener('click', () => setArmed(!armed));

  function setArmed(next) {
    armed = next && glyphStack.length > 0;
    plant.classList.toggle('compose-plant--armed', armed);
    plantHint.hidden = !armed;
    syncCompose();
    onArmChange(armed);
  }

  function syncCompose() {
    stackGlyphs.textContent = glyphStack.join(' ');
    stackEmpty.style.display = glyphStack.length ? 'none' : '';
    stackRow.classList.toggle('compose-cartouche--charged', glyphStack.length > 0);
    const caps = capState(layer, author.id);
    count.textContent = `${caps.total} / ${layer.cap.total ?? '∞'} planted in this layer`;
    if (caps.blocked) {
      plant.disabled = true;
      plant.textContent = caps.totalFull ? 'layer full' : 'quota spent';
    } else {
      plant.disabled = glyphStack.length === 0;
      plant.textContent = armed ? 'click the world…' : 'plant totem';
    }
  }

  syncCompose();

  return {
    setMode(mode) {
      modeBadge.textContent = mode === 'free' ? 'Free-roam · author' : 'Track · story';
      modeBadge.classList.toggle('hud-mode--free', mode === 'free');
    },
    getStack: () => [...glyphStack],
    consumeStack() {
      const used = glyphStack;
      glyphStack = [];
      setArmed(false);
      syncCompose();
      return used;
    },
    disarm: () => setArmed(false),
    isArmed: () => armed,
    refreshCaps: syncCompose
  };
}

// --- note panel ------------------------------------------------------------
// Opens out of its totem's cartouche and, on done, visually pops back into
// it — the note "returns to the ring." anchorFor(totem) supplies the
// totem's current screen position; onReturn(totem) lets the overlay bounce
// the cartouche when the note lands.

export function buildNotePanel({ onSave, onRemove, anchorFor, onReturn }) {
  const panel = document.createElement('div');
  panel.className = 'note-panel';
  panel.hidden = true;
  panel.innerHTML = `
    <div class="note-label">Totem Note</div>
    <div class="note-glyphs"></div>
    <textarea class="note-text" placeholder="What does this mark? A memory, a claim, a dare, a seed of a story…"></textarea>
    <div class="note-status"></div>
    <div class="note-actions">
      <button class="note-done">done</button>
      <button class="note-remove">remove totem</button>
    </div>
  `;
  document.body.appendChild(panel);

  const glyphsEl = panel.querySelector('.note-glyphs');
  const textEl = panel.querySelector('.note-text');
  const statusEl = panel.querySelector('.note-status');

  let current = null;
  let statusTimer = null;
  let animating = false;

  textEl.addEventListener('input', () => {
    if (!current) return;
    current.text = textEl.value;
    onSave(current);
    statusEl.textContent = 'saved';
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => (statusEl.textContent = ''), 1200);
  });

  panel.querySelector('.note-done').addEventListener('click', () => close());
  panel.querySelector('.note-remove').addEventListener('click', () => {
    if (!current) return;
    const doomed = current;
    hide();
    onRemove(doomed);
  });

  function resetTransform() {
    panel.style.transform = '';
    panel.style.opacity = '';
  }

  function panelCenter() {
    const r = panel.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function open(totem) {
    current = totem;
    glyphsEl.textContent = totem.glyphs.join(' ');
    textEl.value = totem.text ?? '';
    statusEl.textContent = '';
    panel.hidden = false;
    resetTransform();

    const anchor = anchorFor?.(totem);
    if (anchor) {
      // grow out of the cartouche
      const c = panelCenter();
      animate(panel, {
        translateX: [anchor.x - c.x, 0],
        translateY: [anchor.y - c.y, 0],
        scale: [0.05, 1],
        opacity: [0, 1],
        duration: 480,
        ease: 'outCubic'
      });
    } else {
      animate(panel, { translateX: [40, 0], opacity: [0, 1], duration: 350, ease: 'outCubic' });
    }
    textEl.focus();
  }

  function hide() {
    current = null;
    panel.hidden = true;
    resetTransform();
  }

  function close() {
    if (!current || animating) return;
    const totem = current;
    const anchor = anchorFor?.(totem);
    if (!anchor) {
      hide();
      return;
    }
    // shrink back into the cartouche, then bounce the ring
    animating = true;
    const c = panelCenter();
    animate(panel, {
      translateX: [0, anchor.x - c.x],
      translateY: [0, anchor.y - c.y],
      scale: [1, 0.05],
      opacity: [1, 0],
      duration: 460,
      ease: 'inCubic',
      onComplete: () => {
        animating = false;
        hide();
        onReturn?.(totem);
      }
    });
  }

  return { open, close, isOpen: () => !panel.hidden };
}
