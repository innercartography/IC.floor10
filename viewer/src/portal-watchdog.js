// The LCC SDK only fires its load/progress callbacks on the network path.
// When the whole scan is already in IndexedDB (any return visit), it mounts
// the splat group silently — and the portal would wait forever. This
// watchdog closes the portal once the splat group is in the scene and the
// network path has stayed silent, while leaving cold (first-visit) loads
// to the SDK's real onLoad.

export function armPortalWatchdog({ portal, scene, hasProgress, graceMs = 3000 }) {
  const started = Date.now();
  const interval = setInterval(() => {
    if (hasProgress()) {
      // network streaming is active — the SDK's own onLoad will close it
      clearInterval(interval);
      return;
    }
    const splats = scene.children.find((c) => c.type === 'Group');
    if (splats && Date.now() - started > graceMs) {
      clearInterval(interval);
      portal.close();
    }
  }, 400);
  return () => clearInterval(interval);
}
