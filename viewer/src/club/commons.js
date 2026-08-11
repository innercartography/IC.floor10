// The shared totem memory — the client half of "the place remembers."
//
// Totems now live in Postgres (Supabase), readable by anyone and streamed
// live. This module is the whole surface the viewer talks to: identity,
// edit-token custody, the plant/edit/remove/report writes, the recent-first
// and keyword reads, and the realtime subscription.
//
// Ownership without accounts: planting mints a server-side edit_token that is
// returned once and kept only in this browser's localStorage. Editing or
// removing a trace requires that token, so a trace is yours to change only
// from the browser that made it — no login, but not forgeable from the public
// read feed either.

import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, SCAN_GUID } from './commons-config.js';
import { ensureAuthor } from './totems.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
  realtime: { params: { eventsPerSecond: 5 } }
});

const TOKENS_KEY = 'ic_floor10_tokens'; // { [totemId]: editToken }

// --- edit-token custody ----------------------------------------------------

function loadTokens() {
  try {
    return JSON.parse(localStorage.getItem(TOKENS_KEY)) || {};
  } catch {
    return {};
  }
}

function rememberToken(id, token) {
  const tokens = loadTokens();
  tokens[id] = token;
  localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
}

function forgetToken(id) {
  const tokens = loadTokens();
  delete tokens[id];
  localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
}

export function isMine(id) {
  return Boolean(loadTokens()[id]);
}

// --- normalize a DB row into the totem shape the viewer already speaks ------
// (overlay + note panel expect { glyphs, pos, text }; the DB calls it meaning)

function normalize(row) {
  return {
    id: row.id,
    glyphs: row.glyphs,
    pos: row.pos,
    text: row.meaning ?? '',
    author: row.author_id,
    handle: row.handle,
    layer: row.layer,
    at: row.created_at,
    mine: isMine(row.id)
  };
}

// --- reads -----------------------------------------------------------------

// The freshest traces — what a visitor sees on arrival (not the whole floor).
export async function recent(limit = 3) {
  const { data, error } = await supabase
    .from('totems')
    .select('*')
    .eq('scan_guid', SCAN_GUID)
    .eq('hidden', false)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data.map(normalize);
}

// Keyword search over the meaning text — powers "toggle layers relevant to
// what you type." Returns matches most-relevant-ish (recent) first.
export async function search(query, limit = 80) {
  const q = query.trim();
  if (!q) return [];
  const { data, error } = await supabase
    .from('totems')
    .select('*')
    .eq('scan_guid', SCAN_GUID)
    .eq('hidden', false)
    .textSearch('search', q, { type: 'websearch', config: 'english' })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data.map(normalize);
}

// --- writes ----------------------------------------------------------------

export async function plant({ glyphs, pos, layer = null }) {
  const author = ensureAuthor();
  const { data, error } = await supabase.rpc('plant_totem', {
    p_scan_guid: SCAN_GUID,
    p_glyphs: glyphs,
    p_pos: pos,
    p_author_id: author.id,
    p_handle: author.handle,
    p_layer: layer
  });
  if (error) throw error;
  const { id, edit_token } = data[0];
  rememberToken(id, edit_token);
  return normalize({
    id,
    glyphs,
    pos,
    meaning: '',
    author_id: author.id,
    handle: author.handle,
    layer: layer || author.handle || author.id,
    created_at: new Date().toISOString()
  });
}

export async function edit(id, meaning) {
  const token = loadTokens()[id];
  if (!token) throw new Error('not your totem');
  const { error } = await supabase.rpc('edit_totem', {
    p_id: id,
    p_edit_token: token,
    p_meaning: meaning
  });
  if (error) throw error;
}

export async function remove(id) {
  const token = loadTokens()[id];
  if (!token) throw new Error('not your totem');
  const { error } = await supabase.rpc('delete_totem', { p_id: id, p_edit_token: token });
  if (error) throw error;
  forgetToken(id);
}

export async function report(id) {
  const { error } = await supabase.rpc('report_totem', { p_id: id });
  if (error) throw error;
}

// --- realtime --------------------------------------------------------------
// Fires as other travelers plant / edit / remove traces while you're here.

export function subscribe({ onInsert, onUpdate, onDelete }) {
  const channel = supabase
    .channel('totems-' + SCAN_GUID)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'totems', filter: `scan_guid=eq.${SCAN_GUID}` },
      (payload) => onInsert?.(normalize(payload.new)))
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'totems', filter: `scan_guid=eq.${SCAN_GUID}` },
      (payload) => onUpdate?.(normalize(payload.new)))
    .on('postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'totems' },
      (payload) => onDelete?.(payload.old.id))
    .subscribe();
  return () => supabase.removeChannel(channel);
}
