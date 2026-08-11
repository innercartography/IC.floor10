import * as THREE from 'three';

function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

// Tweens the camera's position/orientation between authored waypoints.
// Deliberately dumb: no path-following, no collision awareness -- it's a
// straight lerp in position and a slerp in orientation. Good enough for
// waypoint-to-waypoint travel inside one room; would need real pathing if
// waypoints ever needed to route around obstacles.
export class TrackController {
  constructor(camera, { duration = 1.4, onArrive } = {}) {
    this.camera = camera;
    this.duration = duration;
    this.onArrive = onArrive;

    this.active = false;
    this.t = 0;

    this.fromPos = new THREE.Vector3();
    this.fromQuat = new THREE.Quaternion();
    this.toPos = new THREE.Vector3();
    this.toQuat = new THREE.Quaternion();

    this._lookMatrix = new THREE.Matrix4();
    this._targetVec = new THREE.Vector3();
  }

  goTo(position, target) {
    this.fromPos.copy(this.camera.position);
    this.fromQuat.copy(this.camera.quaternion);

    this.toPos.set(position[0], position[1], position[2]);
    this._targetVec.set(target[0], target[1], target[2]);
    this._lookMatrix.lookAt(this.toPos, this._targetVec, this.camera.up);
    this.toQuat.setFromRotationMatrix(this._lookMatrix);

    this.t = 0;
    this.active = true;
  }

  update(delta) {
    if (!this.active) return;

    this.t = Math.min(1, this.t + delta / this.duration);
    const e = easeInOutCubic(this.t);

    this.camera.position.lerpVectors(this.fromPos, this.toPos, e);
    this.camera.quaternion.slerpQuaternions(this.fromQuat, this.toQuat, e);

    if (this.t >= 1) {
      this.active = false;
      this.onArrive?.();
    }
  }
}
