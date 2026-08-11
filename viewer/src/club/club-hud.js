// The club layer's HUD: ghost text on the void, a discovery panel, and the
// totem forge. Discovery is the answer to "the whole floor at once is a
// clusterfuck": you arrive to only the freshest traces, then type what you're
// looking for and reveal the layers whose meanings match, one toggle at a
// time. The forge is unchanged — compose an ordered emoji ring, then plant it.

import { animate } from 'animejs';
import { Picker } from 'emoji-picker-element';
import emojiDataUrl from 'emoji-picker-element-data/en/emojibase/data.json?url';
import { MAX_GLYPHS, setHandle } from './totems.js';

export function buildClubHud({
  locations, author, onSelectView, onArmChange, onExport,
  onBack, onSearch, onToggleLayer, onRevealAll, onClearDiscovery
}) {
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
  backLink.href = onBack || '../';
  backLink.innerHTML = '← back to <span>the track</span>';
  backRow.appendChild(backLink);
  root.appendChild(backRow);

  // --- discover: search meanings, reveal matching layers -------------------
  const discoverLabel = document.createElement('div');
  discoverLabel.className = 'hud-section-label';
  discoverLabel.textContent = 'Discover';
  root.appendChild(discoverLabel);

  const discover = document.createElement('div');
  discover.className = 'hud-discover';
  root.appendChild(discover);

  const searchInput = document.createElement('input');
  searchInput.className = 'discover-search';
  searchInput.type = 'search';
  searchInput.placeholder = 'what are you looking for?';
  discover.appendChild(searchInput);

  const discoverStatus = document.createElement('div');
  discoverStatus.className = 'discover-status';
  discoverStatus.textContent = 'the floor shows its most recent traces first';
  discover.appendChild(discoverStatus);

  const results = document.createElement('div');
  results.className = 'discover-results';
  discover.appendChild(results);

  let searchTimer = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const q = searchInput.value;
    searchTimer = setTimeout(() => {
      if (!q.trim()) {
        results.replaceChildren();
        discoverStatus.textContent = 'the floor shows its most recent traces first';
        onClearDiscovery?.();
        return;
      }
      discoverStatus.textContent = 'searching…';
      onSearch?.(q.trim());
    }, 300);
  });

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
  exportLink.innerHTML = 'export what you see <span>.json</span>';
  exportLink.addEventListener('click', (e) => {
    e.preventDefault();
    onExport();
  });
  files.appendChild(exportLink);
  const note = document.createElement('div');
  note.className = 'hud-file-soon';
  note.textContent = 'the floor remembers — everyone plants into it';
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
    plant.disabled = glyphStack.length === 0;
    plant.textContent = armed ? 'click the world…' : 'plant totem';
  }

  syncCompose();

  // --- discovery result rendering -----------------------------------------
  // groups: [{ layer, totems: [...] }], each layer a reveal toggle.
  const revealed = new Set();

  function renderResults(groups, total) {
    results.replaceChildren();
    revealed.clear();
    if (!groups.length) {
      discoverStatus.textContent = 'no traces match — try other words';
      return;
    }
    discoverStatus.textContent = `${total} trace${total === 1 ? '' : 's'} across ${groups.length} layer${groups.length === 1 ? '' : 's'}`;

    if (groups.length > 1) {
      const all = document.createElement('button');
      all.className = 'discover-all';
      all.textContent = 'reveal all';
      all.addEventListener('click', () => {
        groups.forEach((g) => {
          if (!revealed.has(g.layer)) {
            revealed.add(g.layer);
            onToggleLayer?.(g.layer, g.totems, true);
          }
        });
        results.querySelectorAll('.discover-layer').forEach((el) => el.classList.add('discover-layer--on'));
      });
      results.appendChild(all);
    }

    groups.forEach((g) => {
      const row = document.createElement('button');
      row.className = 'discover-layer';
      const glyphs = g.totems[0]?.glyphs?.join(' ') ?? '✦';
      const snippet = (g.totems[0]?.text || '').slice(0, 60);
      row.innerHTML =
        `<span class="discover-layer-glyphs">${glyphs}</span>` +
        `<span class="discover-layer-body"><b>${g.layer}</b> · ${g.totems.length}` +
        `<span class="discover-layer-snippet">${snippet ? '“' + snippet + '”' : 'unwritten'}</span></span>`;
      row.addEventListener('click', () => {
        const on = !revealed.has(g.layer);
        if (on) revealed.add(g.layer); else revealed.delete(g.layer);
        row.classList.toggle('discover-layer--on', on);
        onToggleLayer?.(g.layer, g.totems, on);
      });
      results.appendChild(row);
    });
  }

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
    setCount(shown, mine) {
      count.textContent = mine > 0
        ? `${shown} in view · you've left ${mine}`
        : `${shown} in view`;
    },
    showResults: renderResults,
    searchFailed(msg) {
      discoverStatus.textContent = msg || 'search unavailable';
    }
  };
}

// --- note panel ------------------------------------------------------------
// Owner-aware: your own trace is editable and removable; someone else's opens
// read-only with a quiet "report" instead. Opens out of its totem's cartouche
// and pops back into it on done.

export function buildNotePanel({ onSave, onRemove, onReport, anchorFor, onReturn }) {
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
      <button class="note-report">report</button>
    </div>
  `;
  document.body.appendChild(panel);

  const glyphsEl = panel.querySelector('.note-glyphs');
  const textEl = panel.querySelector('.note-text');
  const statusEl = panel.querySelector('.note-status');
  const removeBtn = panel.querySelector('.note-remove');
  const reportBtn = panel.querySelector('.note-report');

  let current = null;
  let statusTimer = null;
  let animating = false;

  textEl.addEventListener('input', () => {
    if (!current || !current.mine) return;
    current.text = textEl.value;
    statusEl.textContent = 'saving…';
    onSave(current);
  });

  panel.querySelector('.note-done').addEventListener('click', () => close());
  removeBtn.addEventListener('click', () => {
    if (!current) return;
    const doomed = current;
    hide();
    onRemove(doomed);
  });
  reportBtn.addEventListener('click', () => {
    if (!current) return;
    reportBtn.disabled = true;
    reportBtn.textContent = 'reported';
    onReport?.(current);
  });

  // called by the owner-side save path to confirm the write landed
  function saved(ok) {
    statusEl.textContent = ok ? 'saved' : 'save failed';
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => (statusEl.textContent = ''), 1200);
  }

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
    textEl.readOnly = !totem.mine;
    textEl.placeholder = totem.mine
      ? 'What does this mark? A memory, a claim, a dare, a seed of a story…'
      : 'someone left this here';
    removeBtn.style.display = totem.mine ? '' : 'none';
    reportBtn.style.display = totem.mine ? 'none' : '';
    reportBtn.disabled = false;
    reportBtn.textContent = 'report';
    statusEl.textContent = '';
    panel.hidden = false;
    resetTransform();

    const anchor = anchorFor?.(totem);
    if (anchor) {
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
    if (totem.mine) textEl.focus();
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

  return { open, close, saved, isOpen: () => !panel.hidden, current: () => current };
}
