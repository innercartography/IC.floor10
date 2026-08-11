# IC.floor10 — the 10th floor of Frontier Tower, walkable in your browser

A Gaussian-splat scan of the **10th floor of Frontier Tower** in San Francisco — the home of **Immersive Commons** — captured with an XGRIDS PortalCam, plus a Three.js viewer you can walk, annotate, and fork.

**Enter the floor:** https://innercartography.github.io/IC.floor10/

---

## What's here

| Path | What it is |
|---|---|
| `lcc-result/` | **The scan itself.** XGRIDS LCC-format splat scene — `ic10thfloor.lcc` is the manifest, `data.bin` holds all ~4.7M splats across 4 LODs (Git LFS), `collision.lci` + `environment.bin` carry physics & ambience, `assets/poses.json` is the path the scanner walked. |
| `mesh-files/ic10thfloor.ply` | **The collision mesh.** Low-poly, uncolored — 17,032 verts / 31,950 tris. Good for physics and raycasting; not the pretty one. |
| `viewer/` | **The portal.** Three.js + XGRIDS LCC Web SDK viewer. Walk the floor, travel between waypoints, and — in the club layer — plant emoji **totems** and leave notes on the space. |

## Run it locally

```bash
cd viewer
npm install
npm run dev
```

The dev server reads the scan straight from `lcc-result/` — one copy of the world, served under `/assets/floor10/`.

> **Git LFS:** `data.bin` (~150MB) is stored in Git LFS. Install [git-lfs](https://git-lfs.com) and run `git lfs pull` after cloning, or the viewer will only find the pointer file.

## Two ways to walk it

- **The track** (`/`) — travel between authored **waypoints**. Press `M` to free-roam (WASD), `P` to capture your current view as a paste-ready waypoint. Waypoints are grouped into **layers**; each layer names the layer it forked from, so contributions compound and every view traces back to the original capture.
- **The club layer** (`/club/`) — forge an ordered emoji **totem** (up to 4 glyphs), plant it on the scan where something happened, and attach a note. Totems are **shared and live**: they persist in a backend, so anyone who visits the floor sees them, and new traces appear in real time. You arrive to only the most recent traces (not the whole floor at once), then **search the meanings** to reveal the layers relevant to what you type. Your own traces are yours to edit or remove; others' open read-only with a report option.

See [`viewer/README.md`](viewer/README.md) for the full controls and how to fork a layer.

## License

Proposed **[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)** — see [LICENSE](LICENSE). Not final until Immersive Commons confirms.

---

*Scanned at Frontier Tower · 10th floor · San Francisco · 2026*
