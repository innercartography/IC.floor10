import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const LCC_DIR = path.resolve(here, '..', 'lcc-result');
const MESH_DIR = path.resolve(here, '..', 'mesh-files');

// The canonical scan lives once, at the repo root (lcc-result/). The viewer
// serves it under /assets/floor10/ instead of keeping a 150MB duplicate in
// public/. `meta.lcc` is an alias for `ic10thfloor.lcc` so the loader path
// stays stable even if the scan file is renamed.
const RENAMES = { 'meta.lcc': 'ic10thfloor.lcc' };
const SKIP = new Set(['log.txt', 'thumb.jpg']);

function lccScanPlugin() {
  return {
    name: 'isc-lcc-scan',
    configureServer(server) {
      server.middlewares.use('/assets/floor10', (req, res, next) => {
        const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
        const mapped = RENAMES[rel] ?? rel;
        // mesh/* serves the collision mesh from repo-root mesh-files/
        const file = mapped.startsWith('mesh/')
          ? path.join(MESH_DIR, mapped.slice(5))
          : path.join(LCC_DIR, mapped);
        const allowedRoot = mapped.startsWith('mesh/') ? MESH_DIR : LCC_DIR;
        if (!file.startsWith(allowedRoot) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
          return next();
        }
        res.setHeader('Content-Type', file.endsWith('.json') || file.endsWith('.lcc')
          ? 'application/json'
          : 'application/octet-stream');
        res.setHeader('Accept-Ranges', 'bytes');

        // The LCC SDK streams data.bin chunk-by-chunk via Range requests.
        const size = fs.statSync(file).size;
        const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range ?? '');
        if (range) {
          const start = Number(range[1]);
          const end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
          res.statusCode = 206;
          res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
          res.setHeader('Content-Length', end - start + 1);
          fs.createReadStream(file, { start, end }).pipe(res);
        } else {
          res.setHeader('Content-Length', size);
          fs.createReadStream(file).pipe(res);
        }
      });
    },
    closeBundle() {
      const out = path.resolve(here, 'dist', 'assets', 'floor10');
      fs.mkdirSync(out, { recursive: true });
      for (const entry of fs.readdirSync(LCC_DIR)) {
        if (SKIP.has(entry)) continue;
        fs.cpSync(path.join(LCC_DIR, entry), path.join(out, entry), { recursive: true });
      }
      fs.renameSync(path.join(out, RENAMES['meta.lcc']), path.join(out, 'meta.lcc'));
      fs.cpSync(path.join(MESH_DIR, 'ic10thfloor.ply'), path.join(out, 'mesh', 'ic10thfloor.ply'));
      console.log(`[isc-lcc-scan] scan + mesh copied into ${out}`);
    }
  };
}

export default defineConfig({
  base: './',
  plugins: [lccScanPlugin()],
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(here, 'index.html'),
        club: path.resolve(here, 'club', 'index.html')
      }
    }
  }
});
