# The Viewer — walk the floor, fork a layer

Three.js + XGRIDS LCC Web SDK viewer for the Immersive Commons Floor 10 scan (Frontier Tower, San Francisco). Live build: **https://innercartography.github.io/IC.floor10/**

```bash
cd viewer
npm install
npm run dev
```

The dev server reads the scan straight from `../lcc-result/` — the repo keeps exactly one copy of the world.

## Controls

| Key | Power |
|---|---|
| drag | look around |
| `M` | toggle **track** (story) / **free-roam** (author) mode |
| `W A S D` | move (free-roam only) |
| `P` | capture your current view as a ready-to-paste waypoint (free-roam only) |

## Layers — how the world compounds

A **layer** is one storyteller's set of waypoints over the shared scan. The scan never changes; layers stack on top and every layer names its parent. That's the whole model:

```
origin (the scan, Immersive Commons)
  └─ your-layer  (forkedFrom: 'origin')
       └─ someone-elses-remix  (forkedFrom: 'your-layer')
```

### Fork one

1. Copy `src/layers/origin.js` → `src/layers/<your-handle>-<story>.js`
2. Set `id`, `author` (your Discord handle), `tint` (your accent color), and — **the sacred field** — `forkedFrom`: the id of the layer you built on (`'origin'` if you started fresh). Only ORIGIN may be `null`.
3. Run the viewer, press `M`, roam with WASD to your spots, press `P`, paste the printed waypoints into your file.
4. Register it in `src/layers/index.js`, then PR back to the club repo.

The HUD shows every registered layer as a chip and prints its full lineage back to the scan — provenance is always one glance away.

**Rule of the commons:** layers are additive. Never edit someone else's layer in a PR — fork it and change your copy.
