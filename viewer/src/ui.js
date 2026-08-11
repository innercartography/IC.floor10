// Dala-style HUD: ghost text floating on the void — no panels, no borders.
// Hierarchy comes from scale and the two accents: Electric Iris (active),
// Saffron Spark (labels/hover). Plain DOM + anime.js for motion.

import { animate, stagger, createTimeline } from 'animejs';
import { layerLineage } from './layers/index.js';

const REPO_URL = 'https://github.com/innercartography/IC.floor10';

const FILE_LINKS = [
  { label: 'collision mesh', ext: '.ply', href: 'assets/floor10/mesh/ic10thfloor.ply', download: 'ic10thfloor-collision.ply' },
  { label: 'capture trajectory', ext: '.json', href: 'assets/floor10/assets/poses.json', download: 'ic10thfloor-poses.json' },
  { label: 'scene manifest', ext: '.lcc', href: 'assets/floor10/meta.lcc', download: 'ic10thfloor.lcc' }
];

export function buildHud({ layers, onSelectView, onSelectLayer }) {
  const root = document.createElement('div');
  root.className = 'hud';

  const brand = document.createElement('div');
  brand.className = 'hud-brand';
  brand.innerHTML = '<span class="brand-mark">▲</span> IMMERSIVE COMMONS — FLOOR 10';
  root.appendChild(brand);

  const modeBadge = document.createElement('div');
  modeBadge.className = 'hud-mode';
  root.appendChild(modeBadge);

  const layersLabel = document.createElement('div');
  layersLabel.className = 'hud-section-label';
  layersLabel.textContent = 'Layers';
  root.appendChild(layersLabel);

  const layerRow = document.createElement('div');
  layerRow.className = 'hud-layers';
  root.appendChild(layerRow);

  const lineage = document.createElement('div');
  lineage.className = 'hud-lineage';
  root.appendChild(lineage);

  const trackLabel = document.createElement('div');
  trackLabel.className = 'hud-section-label';
  trackLabel.textContent = 'The Track';
  root.appendChild(trackLabel);

  const menu = document.createElement('div');
  menu.className = 'hud-menu';
  root.appendChild(menu);

  const filesLabel = document.createElement('div');
  filesLabel.className = 'hud-section-label';
  filesLabel.textContent = 'Take the World With You';
  root.appendChild(filesLabel);

  const files = document.createElement('div');
  files.className = 'hud-files';
  FILE_LINKS.forEach((f) => {
    const a = document.createElement('a');
    a.className = 'hud-file-link';
    a.href = f.href;
    a.setAttribute('download', f.download);
    a.innerHTML = `${f.label} <span>${f.ext}</span>`;
    files.appendChild(a);
  });
  const soon = document.createElement('div');
  soon.className = 'hud-file-soon';
  soon.textContent = '3DGS .spz / .ply — forging soon';
  files.appendChild(soon);
  const repo = document.createElement('a');
  repo.className = 'hud-repo-pill';
  repo.href = REPO_URL;
  repo.target = '_blank';
  repo.rel = 'noopener';
  repo.textContent = 'Fork the world';
  files.appendChild(repo);
  root.appendChild(files);

  const readout = document.createElement('div');
  readout.className = 'hud-readout';
  readout.hidden = true;
  root.appendChild(readout);

  const hint = document.createElement('div');
  hint.className = 'hud-hint';
  hint.innerHTML =
    '<b>drag</b> look · <b>M</b> free-roam/track · <b>WASD</b> move (free) · <b>P</b> capture waypoint (free)';
  root.appendChild(hint);

  document.body.appendChild(root);

  const chips = new Map();

  function renderMenu(layer) {
    menu.replaceChildren();
    layer.locations.forEach((location) => {
      const stop = document.createElement('div');
      stop.className = 'hud-stop';

      const stopButton = document.createElement('button');
      stopButton.className = 'hud-stop-button';
      stopButton.textContent = location.label;
      stop.appendChild(stopButton);

      const views = document.createElement('div');
      views.className = 'hud-views';
      views.hidden = location.views.length > 1;

      location.views.forEach((view) => {
        const viewButton = document.createElement('button');
        viewButton.className = 'hud-view-button';
        viewButton.textContent = view.label;
        viewButton.addEventListener('click', () => onSelectView(view));
        views.appendChild(viewButton);
      });

      stopButton.addEventListener('click', () => {
        if (location.views.length === 1) {
          onSelectView(location.views[0]);
          return;
        }
        const wasHidden = views.hidden;
        menu.querySelectorAll('.hud-views').forEach((el) => (el.hidden = true));
        views.hidden = !wasHidden;
      });

      stop.appendChild(views);
      menu.appendChild(stop);
    });

    animate(menu.querySelectorAll('.hud-stop'), {
      opacity: [0, 1],
      translateX: [-12, 0],
      delay: stagger(70),
      duration: 500,
      ease: 'outCubic'
    });
  }

  function setActiveLayer(layer) {
    chips.forEach((chip, id) =>
      chip.classList.toggle('hud-layer-chip--active', id === layer.id)
    );
    const chain = layerLineage(layer, layers);
    lineage.innerHTML =
      'lineage · ' + chain.map((id, i) => (i === chain.length - 1 ? `<b>${id}</b>` : id)).join(' → ');
    renderMenu(layer);
  }

  layers.forEach((layer) => {
    const chip = document.createElement('button');
    chip.className = 'hud-layer-chip';
    chip.textContent = layer.title;
    chip.title = `${layer.description ?? ''}\nauthor: ${layer.author}` +
      (layer.forkedFrom ? `\nforked from: ${layer.forkedFrom}` : '\nroot layer');
    chip.addEventListener('click', () => onSelectLayer(layer));
    chips.set(layer.id, chip);
    layerRow.appendChild(chip);
  });

  return {
    setMode(mode) {
      modeBadge.textContent = mode === 'free' ? 'Free-roam · author' : 'Track · story';
      modeBadge.classList.toggle('hud-mode--free', mode === 'free');
    },
    setActiveLayer,
    showReadout(snippetText) {
      readout.hidden = false;
      readout.textContent = snippetText;
    }
  };
}

// ---------------------------------------------------------------------------
// Loading portal: black void, left copy block, right an animated constellation
// of outlined triangles — the scan's splats, abstracted.

const TRI_COLORS = ['#8052ff', '#ffb829', '#15846e', '#c84bff', '#4b7bff', '#ff4bb5'];

function trianglePath(cx, cy, r, rot) {
  const pts = [0, 1, 2].map((i) => {
    const a = rot + (i * 2 * Math.PI) / 3;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  });
  return `M${pts[0]}L${pts[1]}L${pts[2]}Z`;
}

// Organic cloud: dense core cluster shaped like a loose profile, plus a
// sparse ambient field drifting across the whole panel.
function buildConstellationSvg() {
  const W = 600;
  const H = 700;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  const rand = (a, b) => a + Math.random() * (b - a);

  const addTriangle = (cx, cy, size, opacity) => {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', trianglePath(cx, cy, size, rand(0, Math.PI * 2)));
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', TRI_COLORS[(Math.random() * TRI_COLORS.length) | 0]);
    p.setAttribute('stroke-width', rand(1, 2).toFixed(1));
    p.dataset.baseOpacity = opacity;
    p.classList.add('tri');
    svg.appendChild(p);
    return p;
  };

  // core cluster — an organic blob, denser toward its middle
  const coreX = W * 0.52;
  const coreY = H * 0.46;
  for (let i = 0; i < 190; i++) {
    const angle = rand(0, Math.PI * 2);
    // sqrt biases inward; the lobed radius makes the silhouette organic
    const lobe = 1 + 0.35 * Math.sin(angle * 3 + 1.7) + 0.2 * Math.sin(angle * 5);
    const radius = Math.sqrt(Math.random()) * 190 * lobe;
    addTriangle(
      coreX + radius * Math.cos(angle) * 0.95,
      coreY + radius * Math.sin(angle) * 1.1,
      rand(3, 8),
      rand(0.5, 1)
    );
  }

  // ambient field
  for (let i = 0; i < 45; i++) {
    addTriangle(rand(0, W), rand(0, H), rand(2, 5), rand(0.15, 0.35));
  }

  return svg;
}

export function buildPortal() {
  const el = document.createElement('div');
  el.className = 'portal';
  el.innerHTML = `
    <div class="portal-copy">
      <div class="portal-label">Immersive Commons · Frontier Tower · Floor 10</div>
      <h1 class="portal-title"><span class="word">Enter</span> <span class="word">the</span> <span class="word">floor.</span></h1>
      <p class="portal-body">The 10th floor of Frontier Tower, San Francisco, cast in points of light.
      Walk it. Fork a layer. Leave a story behind.</p>
      <div class="portal-progress">
        <span class="portal-pill">summoning</span>
        <span class="portal-bar"><span class="portal-bar-fill"></span></span>
      </div>
    </div>
    <div class="portal-constellation"></div>
  `;
  document.body.appendChild(el);

  const constellation = el.querySelector('.portal-constellation');
  const svg = buildConstellationSvg();
  constellation.appendChild(svg);

  const tris = svg.querySelectorAll('.tri');
  tris.forEach((t) => (t.style.opacity = 0));

  const tl = createTimeline();
  tl.add(el.querySelector('.portal-label'), {
    opacity: [0, 1],
    translateY: [12, 0],
    duration: 600,
    ease: 'outCubic'
  })
    .add(
      el.querySelectorAll('.portal-title .word'),
      {
        opacity: [0, 1],
        translateY: [28, 0],
        delay: stagger(110),
        duration: 700,
        ease: 'outCubic'
      },
      '-=300'
    )
    .add(el.querySelector('.portal-body'), { opacity: [0, 1], duration: 600 }, '-=350')
    .add(el.querySelector('.portal-progress'), { opacity: [0, 1], duration: 600 }, '-=300');

  animate(tris, {
    opacity: (t) => [0, Number(t.dataset.baseOpacity)],
    delay: stagger(9, { from: 'center' }),
    duration: 900,
    ease: 'outQuad',
    onComplete: () => {
      // perpetual slow drift — the constellation breathes
      animate(tris, {
        translateX: () => [0, (Math.random() - 0.5) * 26],
        translateY: () => [0, (Math.random() - 0.5) * 26],
        rotate: () => [0, (Math.random() - 0.5) * 40],
        opacity: (t) => [
          Number(t.dataset.baseOpacity),
          Number(t.dataset.baseOpacity) * 0.45
        ],
        delay: stagger(12, { from: 'random' }),
        duration: () => 2600 + Math.random() * 2600,
        alternate: true,
        loop: true,
        ease: 'inOutSine'
      });
    }
  });

  const fill = el.querySelector('.portal-bar-fill');
  const pill = el.querySelector('.portal-pill');
  let closed = false;

  return {
    progress(fraction) {
      const clamped = Math.max(0, Math.min(1, fraction));
      fill.style.width = `${(clamped * 100).toFixed(1)}%`;
      pill.textContent = `${(clamped * 100).toFixed(0)}%`;
    },
    close() {
      if (closed) return;
      closed = true;
      pill.textContent = 'entering';
      animate(el, {
        opacity: [1, 0],
        duration: 1100,
        ease: 'inOutQuad',
        onComplete: () => el.remove()
      });
    },
    fail(message) {
      pill.textContent = message;
    }
  };
}
