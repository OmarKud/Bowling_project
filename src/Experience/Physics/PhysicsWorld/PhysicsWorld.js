// Core physics constants, factory, and main loop.
import * as THREE from "three";
import Experience from "../../Experience.js";
import RigidBody from "../RigidBody.js";
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
    this.gutterAlerted = false;
    this._gutterLockedX = null;
    this._gutterLockedXr = null;
    this._gutterLockedFloorY = 0;
    // Drop tracking for impact force.
    this._isFalling = false;
    this._fallStartY = null;
    this.lastImpactInfo = null;
    // Live physics stats for the HUD (PhysicsHUD.js reads this every frame).
    this.liveStats = {
      v0: 0,
      speed: 0,
      Ek: 0,
      Ep: 0,
      F: 0,
      pushForce: 0,
      N: 0,
      laneZone: 0,
      newlyFallen: 0,
      totalFallen: 0,
      isGutter: false,
    };
  }
}

// Rigid body factory.
Object.assign(PhysicsWorldBase.prototype, {
  createBody(options) {
    const position = options.position ?? new THREE.Vector3();
    const velocity = options.velocity ?? new THREE.Vector3();
    const angularVelocity = options.angularVelocity ?? new THREE.Vector3();
    const orientation = options.orientation ?? new THREE.Quaternion();
    const mass = options.mass ?? 1.0;
    const radius = options.radius ?? 0.108;
    // const inertia = (2 / 5) * mass * radius * radius;
    const restitution = options.restitution ?? 0.6;
    const isPin = options.isPin ?? false;
    // const isFallen = false;
    // const isSleeping = false;
    const meshRef = options.meshRef ?? null;

    return new RigidBody(
      position,
      velocity,
      angularVelocity,
      orientation,
      mass,
      radius,
      restitution,
      isPin,
      meshRef,
    );
  },
});

// Fixed-timestep main loop.
export const MainLoop = {
  update(deltaTime) {
    if (!this.isSimulationActive || !this.ballBody) return;
    this.accumulator += Math.min(deltaTime, 0.02);
    while (this.accumulator >= this.fixedDt) {
      if (!this.ballBody.isSleeping) {
        this.checkGutterEntry(this.ballBody.position.x);

        if (this.gutterAlerted) {
          this.applyGutterConstraints(this.ballBody);
          //apply phisics on gutter
          this.ballBody.position.z += this.ballBody.velocity.z * this.fixedDt;
        } else {
          this.integrateRK4(this.ballBody, this.fixedDt);
          this.resolveGround(this.ballBody);
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
        if (!pin.isSleeping) this.integratePin(pin, this.fixedDt);
        if (!this.gutterAlerted) this.resolveCollision(this.ballBody, pin);
      }
      // Pin-pin collisions.
      for (let i = 0; i < this.pinsBodies.length; i++) {
        for (let j = i + 1; j < this.pinsBodies.length; j++) {
          const pA = this.pinsBodies[i],
            pB = this.pinsBodies[j];
          if (!pA.isSleeping || !pB.isSleeping) this.resolveCollision(pA, pB);
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
    this.syncMeshes();

    // Push live values to the HUD (read-only, no effect on physics).
    if (this.ballBody) {
      this.liveStats.speed = this.ballBody.velocity.length();
      this.liveStats.Ek = 0.5 * this.ballBody.mass * this.liveStats.speed ** 2;
    const heightAboveFloor = Math.max(
  0,
  this.ballBody.position.y - this.LANE_SURFACE_OFFSET - this.ballBody.radius,
);
this.liveStats.Ep =
  this.ballBody.mass * Math.abs(this.gravity) * heightAboveFloor;
      this.liveStats.isGutter = this.gutterAlerted;
    }
    // Zone status: gutter takes priority, otherwise oil vs dry based on
    // distance traveled from the throw origin (same rule getFriction uses).
    if (this.gutterAlerted) {
      this.liveStats.laneZone = "gutter";
    } else {
      const dz = Math.abs(this.ballBody.position.z - this._ballPhysicsOrigin.z);
      this.liveStats.laneZone = dz < this.settings.oilDistance ? "oil" : "dry";
    }

    this.liveStats.totalFallen = this.pinsBodies.filter(
      (p) => p.isFallen,
    ).length;
    if (this.experience?.physicsHUD) {
      this.experience.physicsHUD.update(this.liveStats);
    }

    // End condition: ball past pins OR asleep with all pins stable.
    const ballScreenZ = this.ballMesh ? this.ballMesh.position.z : 0;
    const allPinsSleeping = this.pinsBodies.every(
      (p) => p.isSleeping || p.isFallen,
    );
    if (ballScreenZ < -260 || (this.ballBody.isSleeping && allPinsSleeping)) {
      this.endSimulation(this.gutterAlerted);
    }
  },
};
