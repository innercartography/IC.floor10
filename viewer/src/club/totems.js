// Identity + small shared helpers for the club layer. Totem *persistence*
// now lives in the shared backend (see commons.js); this file keeps only the
// anonymous local identity and the emoji-stack rules.
//
// The author is an anonymous local id, never a nametag. An optional handle
// can ride along with a trace, but it's never required and never shown as a
// login.

const AUTHOR_KEY = 'ic_floor10_author';

export const MAX_GLYPHS = 4;

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

// Export whatever traces are currently in view as a portable json snapshot.
export function exportTotems(totems) {
  const blob = new Blob([JSON.stringify({ scan: 'ic10thfloor', totems }, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'totems.json';
  a.click();
  URL.revokeObjectURL(url);
}
