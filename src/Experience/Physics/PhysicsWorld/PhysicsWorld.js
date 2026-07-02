// Core physics constants, factory, and main loop.
import * as THREE from "three";
import Experience from "../../Experience.js";
export default class PhysicsWorldBase {
  constructor() {
    this.experience = new Experience();
    this.SCALE = 20.0;
    this.gravity = -9.81;
    this.PIN_HEIGHT = 3.8;
    this.ballBody = null;
    this.pinsBodies = [];
    this.isSimulationActive = false;
    this.currentLaneIndex = 0;
    this.fixedDt = 1.0 / 120.0;
    this.accumulator = 0.0;
    this.settings = null;
    this.ballMesh = null;

    // Derived from BowlingLanes.js geometry. Matches visual exactly.
    this.LANE_CENTERS_PHYS = [-4.0, -2.4, -0.8, 0.8, 2.4, 4.0];
    this.LANE_HALF_WIDTH = 21 / 2 / this.SCALE;
    this.GUTTER_WIDTH_PHYS = 3 / this.SCALE;
    this.CAPPING_RADIUS_PHYS = 2.5 / this.SCALE;
    this.GUTTER_DEPTH_PHYS = 0.05;
    // Corrects visual z-fighting with the lane mesh. Surface Y offset.
    this.LANE_SURFACE_OFFSET = 0.3 / this.SCALE;
    // Gutter state (locks once triggered).
    this._gutterAlerted = false;
    this._gutterLockedX = null;
    this._gutterLockedXr = null;
    this._gutterLockedFloorY = 0;
    // Drop tracking for impact force.
    this._isFalling = false;
    this._fallStartY = null;
    this.lastImpactInfo = null;
  }
}

// Rigid body factory.
Object.assign(PhysicsWorldBase.prototype, {
  _createBody(options) {
    const mass = options.mass ?? 1.0;
    const radius = options.radius ?? 0.108;
    return {
      position: options.position ?? new THREE.Vector3(),
      velocity: options.velocity ?? new THREE.Vector3(),
      angularVelocity: options.angularVelocity ?? new THREE.Vector3(),
      orientation: options.orientation ?? new THREE.Quaternion(),
      mass,
      radius,
      inertia: (2 / 5) * mass * radius * radius,
      restitution: options.restitution ?? 0.6,
      isPin: options.isPin ?? false,
      isFallen: false,
      isSleeping: false,
      meshRef: options.meshRef ?? null,
    };
  },
});

// Fixed-timestep main loop.
export const MainLoop = {
  update(deltaTime) {
    if (!this.isSimulationActive || !this.ballBody) return;
    this.accumulator += Math.min(deltaTime, 0.02);
    while (this.accumulator >= this.fixedDt) {
      if (!this.ballBody.isSleeping) {
        this._checkGutterEntry(this.ballBody.position.x);

        if (this._gutterAlerted) {
          this._applyGutterConstraints(this.ballBody);
          this.ballBody.position.z += this.ballBody.velocity.z * this.fixedDt;
        } else {
          this._integrateRK4(this.ballBody, this.fixedDt);
          this._resolveGround(this.ballBody);
        }
        // Put ball to sleep if almost stationary.
        const ballSpeed = this.ballBody.velocity.length();
        if (
          ballSpeed < 0.05 &&
          this.ballBody.position.z < this._ballPhysicsOrigin.z - 5
        ) {
          this.ballBody.isSleeping = true;
        }
      }

      // Integrate pins and resolve ball-pin collisions (skip if gutter).
      for (let i = 0; i < this.pinsBodies.length; i++) {
        const pin = this.pinsBodies[i];
        if (!pin.isSleeping) this._integratePin(pin, this.fixedDt);
        if (!this._gutterAlerted) this._resolveCollision(this.ballBody, pin);
      }
      // Pin-pin collisions.
      for (let i = 0; i < this.pinsBodies.length; i++) {
        for (let j = i + 1; j < this.pinsBodies.length; j++) {
          const pA = this.pinsBodies[i],
            pB = this.pinsBodies[j];
          if (!pA.isSleeping || !pB.isSleeping) this._resolveCollision(pA, pB);
        }
      }

      // Sleep pins when stable.
      this.pinsBodies.forEach((pin) => {
        if (pin.isSleeping) return;
        if (pin.velocity.lengthSq() < 0.005 && !pin.isFallen) {
          pin.velocity.set(0, 0, 0);
          pin.isSleeping = true;
        }
      });
      this.accumulator -= this.fixedDt;
    }
    this._syncMeshes();
    // End condition: ball past pins OR asleep with all pins stable.
    const ballScreenZ = this.ballMesh ? this.ballMesh.position.z : 0;
    const allPinsSleeping = this.pinsBodies.every(
      (p) => p.isSleeping || p.isFallen,
    );
    if (ballScreenZ < -260 || (this.ballBody.isSleeping && allPinsSleeping)) {
      this._endSimulation(this._gutterAlerted);
    }
  },
};
