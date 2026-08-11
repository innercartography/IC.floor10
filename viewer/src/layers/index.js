// The layer registry. A "layer" is one person's (or one story's) set of
// authored waypoints over the shared scan — the scan compounds, the layers
// trace back. To add yours:
//
//   1. Copy origin.js to layers/<your-handle>-<story>.js
//   2. Set:  id         — unique slug, e.g. 'mika-first-night'
//            author     — your handle (as known in the Immersive Commons Discord)
//            forkedFrom — the id of the layer you started from ('origin'
//                         if you started fresh) — this is the provenance
//                         chain; never leave it null (only ORIGIN is null)
//            tint       — your layer's HUD accent color
//   3. Author waypoints in the viewer: M = free-look, walk somewhere,
//      P = print a ready-to-paste view object.
//   4. Import + add it to LAYERS below, then PR it back to the club repo.
//
// Rule of the commons: layers are additive. Don't edit someone else's
// layer file in a PR — fork it (copy + forkedFrom) and change your copy.

import origin from './origin.js';

export const LAYERS = [origin];

export function layerLineage(layer, layers = LAYERS) {
  // Walk forkedFrom links back to ORIGIN, e.g. "origin → mika → you".
  const byId = new Map(layers.map((l) => [l.id, l]));
  const chain = [];
  let current = layer;
  while (current) {
    chain.unshift(current.id);
    current = current.forkedFrom ? byId.get(current.forkedFrom) : null;
  }
  return chain;
}
