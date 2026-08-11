// ORIGIN — the root layer. Every other layer forks from this one,
// directly or through another layer. Keep it minimal and canonical:
// it represents the scan itself, not anyone's story about it.
//
// The waypoints below are seed placeholders — the scan's coordinate frame
// is specific to this capture, so roam the viewer in free mode (M), find
// the real spots, press P, and paste the printed view objects in.

export default {
  id: 'origin',
  title: 'ORIGIN — the scan',
  author: 'immersive-commons',
  forkedFrom: null, // the root: no parent
  scanGuid: 'b053e7270d7dd487cedfa6daaff256f5', // guid from lcc-result/ic10thfloor.lcc
  created: '2026-08-10',
  tint: '#00f0ff',
  description:
    'Frontier Tower, 10th floor — home of Immersive Commons, San Francisco. As the PortalCam saw it: the unedited starting point every layer traces back to.',
  locations: [
    {
      id: 'first-light',
      label: 'First Light',
      views: [
        {
          id: 'first-light-spawn',
          label: "The scanner's first breath",
          position: [0.8, 1.0, 0.8],
          target: [-7, 0.3, -6],
          phase: 'any',
          epoch: null,
          asserter: 'immersive-commons',
          scope: 'club'
        }
      ]
    },
    {
      id: 'the-commons',
      label: 'The Commons',
      views: [
        {
          id: 'commons-floor',
          label: 'The main floor, where the builders gather',
          position: [0, 1.5, 0],
          target: [-5, 1, -5],
          phase: 'any',
          epoch: null,
          asserter: 'immersive-commons',
          scope: 'club'
        }
      ]
    }
  ]
};
