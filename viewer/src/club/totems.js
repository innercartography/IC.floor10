// The club layer's data model + persistence. v1 is fully static: the layer
// lives in localStorage, the author is an anonymous random id, and "publish"
// is exporting layer.json for the existing PR / fork-the-world flow.
//
// Schema (Supabase-ready later — keep it a clean object tree):
//   WaypointTotem { glyphs: string[] (1–4, ordered), pos: [x,y,z] (world
//                   coords, same frame as waypoints), text, author }
//   Layer { id, name, scope: 'public'|'private',
//           cap: { total: number|null, perPerson: number|null },
//           totems: WaypointTotem[] }

const LAYER_KEY = 'ic_floor10_club_layer_v1';
const AUTHOR_KEY = 'ic_floor10_author';

export const MAX_GLYPHS = 4;

const DEFAULT_LAYER = {
  id: 'club-totems',
  name: 'The Floor 10 Club Layer — first walk',
  scope: 'public',
  forkedFrom: 'origin',
  cap: { total: 3, perPerson: 3 },
  totems: []
};

// --- author: an anonymous local id, never a nametag -----------------------

export function getAuthor() {
  try {
    const stored = JSON.parse(localStorage.getItem(AUTHOR_KEY));
    if (stored?.id) return stored;
  } catch { /* fall through to mint */ }
  return null;
}

export function ensureAuthor() {
  let author = getAuthor();
  if (!author) {
    author = { id: 'trav-' + Math.random().toString(36).slice(2, 8), handle: null };
    localStorage.setItem(AUTHOR_KEY, JSON.stringify(author));
  }
  return author;
}

export function setHandle(handle) {
  const author = ensureAuthor();
  author.handle = handle?.trim() || null;
  localStorage.setItem(AUTHOR_KEY, JSON.stringify(author));
  return author;
}

// --- layer store ----------------------------------------------------------

export function loadLayer() {
  try {
    const stored = JSON.parse(localStorage.getItem(LAYER_KEY));
    if (stored?.id && Array.isArray(stored.totems)) {
      // keep cap/shape current if the default schema moved under an old save
      return { ...DEFAULT_LAYER, ...stored, cap: { ...DEFAULT_LAYER.cap, ...stored.cap } };
    }
  } catch { /* corrupted save — start fresh */ }
  return structuredClone(DEFAULT_LAYER);
}

export function saveLayer(layer) {
  localStorage.setItem(LAYER_KEY, JSON.stringify(layer));
}

// --- caps -----------------------------------------------------------------

export function capState(layer, authorId) {
  const mine = layer.totems.filter((t) => t.author === authorId).length;
  const total = layer.totems.length;
  const totalFull = layer.cap.total !== null && total >= layer.cap.total;
  const personFull = layer.cap.perPerson !== null && mine >= layer.cap.perPerson;
  return { total, mine, totalFull, personFull, blocked: totalFull || personFull };
}

export function plantTotem(layer, { glyphs, pos, authorId }) {
  const state = capState(layer, authorId);
  if (state.blocked) return { ok: false, reason: state.totalFull ? 'layer full' : 'your quota is spent' };
  if (!glyphs.length || glyphs.length > MAX_GLYPHS) return { ok: false, reason: 'compose 1–4 glyphs' };
  const totem = {
    glyphs: [...glyphs],
    pos: pos.map((v) => Math.round(v * 1000) / 1000),
    text: '',
    author: authorId,
    at: new Date().toISOString() // the moment is part of the utterance
  };
  layer.totems.push(totem);
  saveLayer(layer);
  return { ok: true, totem };
}

export function removeTotem(layer, totem) {
  const i = layer.totems.indexOf(totem);
  if (i !== -1) {
    layer.totems.splice(i, 1);
    saveLayer(layer);
  }
}

export function exportLayer(layer) {
  const blob = new Blob([JSON.stringify(layer, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'layer.json';
  a.click();
  URL.revokeObjectURL(url);
}
