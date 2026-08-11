// Connection to the shared totem memory (Supabase project ic-floor10-commons).
//
// The publishable/anon key is meant to live in client code — it only grants
// what Row Level Security allows: reading non-hidden totems and calling the
// plant/edit/delete/report RPCs. All ownership and rate-limit enforcement is
// server-side, so exposing this key is safe by design.

export const SUPABASE_URL = 'https://qznctudbdgpafyyvmkfv.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_Qaxq_rWMmu61O-3iyM3_fg_IenseZXV';

// Which place these traces belong to — the scan's guid (from
// lcc-result/ic10thfloor.lcc). Keeping it explicit lets one commons DB hold
// traces for many scans without them bleeding together.
export const SCAN_GUID = 'b053e7270d7dd487cedfa6daaff256f5';
