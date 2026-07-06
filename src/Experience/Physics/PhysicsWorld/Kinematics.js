// Ball kinematics: lane/gutter constraints, friction, and RK4 integration.
import * as THREE from "three";

export default {
  // Cache the starting lane based on ball X. Static per throw.
  _getStartLane() {
    if (this._startLane) return this._startLane;
    const bx = this._ballPhysicsOrigin.x;
    let nearest = this.LANE_CENTERS_PHYS[0];
    let minDist = Infinity;
    for (const c of this.LANE_CENTERS_PHYS) {
      const d = Math.abs(bx - c);
      if (d < minDist) {
        minDist = d;
        nearest = c;
      }
    }
    this._startLane = {
      center: nearest,
      laneLeft: nearest - this.LANE_HALF_WIDTH,
      laneRight: nearest + this.LANE_HALF_WIDTH,
      gutterLeft: nearest - this.LANE_HALF_WIDTH - this.GUTTER_WIDTH_PHYS,
      gutterRight: nearest + this.LANE_HALF_WIDTH + this.GUTTER_WIDTH_PHYS,
    };
    return this._startLane;
  },

  _getLaneIndexFromX(x) {
    let bestIndex = 0;
    let bestDistance = Infinity;

    this.LANE_CENTERS_PHYS.forEach((center, index) => {
      const distance = Math.abs(x - center);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });

    return bestIndex;
  },

  // Check if ball exits the lane's wood surface. Locks state immediately.
  _checkGutterEntry(ballX) {
    if (this._gutterAlerted) return;
    const lane = this._getStartLane();
    const pastStart =
      this.ballBody.position.z < this._ballPhysicsOrigin.z - 0.1;
    if (!pastStart) return;
    const PIN_ZONE_Z = -234 / this.SCALE;
    if (this.ballBody.position.z < PIN_ZONE_Z) return;
    const inLeftGutter = ballX < lane.laneLeft;
    const inRightGutter = ballX > lane.laneRight;

    if (inLeftGutter || inRightGutter) {
      this._gutterAlerted = true;
      this._gutterLockedX = ballX;
      this._gutterLockedFloorY =
        this.LANE_SURFACE_OFFSET - this.GUTTER_DEPTH_PHYS;
      console.log(
        `Gutter Ball - x=${ballX.toFixed(3)} side=${inLeftGutter ? "LEFT" : "RIGHT"}`,
      );
    }
  },

  // Gutter physics: slide towards the concave bottom, no weird bouncing.
  _applyGutterConstraints(body) {
    const lane = this._getStartLane();
    const isLeftGutter = body.position.x < lane.center;
    const gutterCenter = isLeftGutter
      ? lane.center - this.LANE_HALF_WIDTH - this.GUTTER_WIDTH_PHYS / 2
      : lane.center + this.LANE_HALF_WIDTH + this.GUTTER_WIDTH_PHYS / 2;
    const diffX = gutterCenter - body.position.x;
    body.velocity.x = diffX * 8.0;
    body.position.x += body.velocity.x * this.fixedDt;

    // Safety lock: prevent escape back to lane.
    if (isLeftGutter) {
      if (body.position.x > lane.laneLeft)
        body.position.x = lane.laneLeft - 0.01;
    } else {
      if (body.position.x < lane.laneRight)
        body.position.x = lane.laneRight + 0.01;
    }
    const floorY = this._gutterLockedFloorY + body.radius;
    if (body.position.y < floorY || body.velocity.y < 0) {
      body.position.y = floorY;
      body.velocity.y = 0;
    }
    body.angularVelocity.set(0, 0, 0);
    body.velocity.z *= 0.999;
  },

  // No wall force - gutter detection is purely positional.
  _computeGutterForce(body) {
    return new THREE.Vector3(0, 0, 0);
  },
  // قوة صد عند حافة المسار الأصلي، وبتشتغل بس قبل ما الكرة تدخل الحفرة فعليًا
//     _computeGutterForce(body) {
//         const force = new THREE.Vector3(0, 0, 0);
//         if (this._gutterAlerted) return force; // بعد الدخول ما منضيف قوة إضافية
// const PIN_ZONE_Z = -234 / this.SCALE;
//     if (body.position.z < PIN_ZONE_Z) return force;
//         const lane  = this._getStartLane();
//         const bx    = body.position.x;

//         // حافة يسار
//         const dxLeft = bx - lane.laneLeft;
//         if (dxLeft < 0 && dxLeft > -this.GUTTER_WIDTH_PHYS) {
//             const wallX   = lane.gutterLeft;
//             const distW   = bx - wallX;
//             const minCl   = this.CAPPING_RADIUS_PHYS + body.radius;
//             if (distW < minCl) {
//                 const pen  = minCl - distW;
//                 force.x   += pen * 120.0;
//                 if (body.velocity.x < 0) body.velocity.x *= 0.05;
//             }
//         }

//         // حافة يمين
//         const dxRight = lane.laneRight - bx;
//         if (dxRight < 0 && dxRight > -this.GUTTER_WIDTH_PHYS) {
//             const wallX   = lane.gutterRight;
//             const distW   = wallX - bx;
//             const minCl   = this.CAPPING_RADIUS_PHYS + body.radius;
//             if (distW < minCl) {
//                 const pen  = minCl - distW;
//                 force.x   -= pen * 120.0;
//                 if (body.velocity.x > 0) body.velocity.x *= 0.05;
//             }
//         }

//         return force;
//     },
  // Contact velocity at the ball's bottom point (for friction).
  _computeContactVelocity(body) {
    const r = new THREE.Vector3(0, -body.radius, 0);
    const vB = body.velocity
      .clone()
      .add(new THREE.Vector3().crossVectors(body.angularVelocity, r));
    vB.y = 0;
    return vB;
  },

  // Friction coefficient: oil zone vs dry lane.
  _getFriction(body) {
    const dz = Math.abs(body.position.z - this._ballPhysicsOrigin.z);
    return dz < this.settings.oilDistance
      ? this.settings.muOil
      : this.settings.muDry;
  },
// Sum forces: gravity, friction, lane walls. Returns linear & angular acceleration.
  _computeAccelerations(body) {
    const linAcc = new THREE.Vector3();
    const angAcc = new THREE.Vector3();

    if (body.isPin) {
      linAcc.y = this.gravity;
      linAcc.x = -(body.velocity.x * 2.0);
      linAcc.z = -(body.velocity.z * 2.0);
      return { linAcc, angAcc };
    }
    if (this._gutterAlerted) {
      return { linAcc, angAcc };
    }

    const lane = this._getStartLane();
    const floorY = this.LANE_SURFACE_OFFSET;
    const onGround = body.position.y <= floorY + body.radius + 0.001;

    if (!onGround) {
      linAcc.y += this.gravity;
    }

    const speed = body.velocity.length();
    if (speed < 0.001 && body.angularVelocity.length() < 0.001) {
      const gf = this._computeGutterForce(body);
      linAcc.x += gf.x / body.mass;
      return { linAcc, angAcc };
    }

    const N = body.mass * Math.abs(this.gravity);
    let fricMagnitude = 0;

    if (onGround) {
      const vB = this._computeContactVelocity(body);
      const slipSpeed = vB.length();
      const mu = this._getFriction(body);
      const rVector = new THREE.Vector3(0, -body.radius, 0);

      if (slipSpeed > 0.005) {
        fricMagnitude = mu * N;
        const fricForce = vB.clone().normalize().multiplyScalar(-fricMagnitude);
        linAcc.add(fricForce.clone().divideScalar(body.mass));
        const torque = new THREE.Vector3().crossVectors(rVector, fricForce);
        angAcc.add(torque.clone().divideScalar(body.inertia));
      } else {
        const mu_rolling = 0.002;
        fricMagnitude = mu_rolling * N;
        const rollFricForce = body.velocity.clone().normalize().multiplyScalar(-fricMagnitude);
        linAcc.add(rollFricForce.clone().divideScalar(body.mass));
        const torque = new THREE.Vector3().crossVectors(rVector, rollFricForce);
        angAcc.add(torque.clone().divideScalar(body.inertia));
      }

      if (!body.isPin) {
        this.liveStats.F = fricMagnitude;
        this.liveStats.N = N;
        // this.liveStats.laneZone = this.currentLaneIndex;
      }
    }

    const gutterForce = this._computeGutterForce(body);
    linAcc.x += gutterForce.x / body.mass;

    return { linAcc, angAcc };
  },

  // RK4 integrator for high precision (smooth friction transitions).
  _integrateRK4(body, dt) {
    const { linAcc: a1, angAcc: aa1 } = this._computeAccelerations(body);
    const k1v = body.velocity.clone();

    const b2 = {
      ...body,
      position: body.position.clone().addScaledVector(k1v, dt * 0.5),
      velocity: body.velocity.clone().addScaledVector(a1, dt * 0.5),
      angularVelocity: body.angularVelocity
        .clone()
        .addScaledVector(aa1, dt * 0.5),
    };
    const { linAcc: a2, angAcc: aa2 } = this._computeAccelerations(b2);
    const k2v = b2.velocity.clone();

    const b3 = {
      ...body,
      position: body.position.clone().addScaledVector(k2v, dt * 0.5),
      velocity: body.velocity.clone().addScaledVector(a2, dt * 0.5),
      angularVelocity: body.angularVelocity
        .clone()
        .addScaledVector(aa2, dt * 0.5),
    };
    const { linAcc: a3, angAcc: aa3 } = this._computeAccelerations(b3);
    const k3v = b3.velocity.clone();

    const b4 = {
      ...body,
      position: body.position.clone().addScaledVector(k3v, dt),
      velocity: body.velocity.clone().addScaledVector(a3, dt),
      angularVelocity: body.angularVelocity.clone().addScaledVector(aa3, dt),
    };
    const { linAcc: a4, angAcc: aa4 } = this._computeAccelerations(b4);
    const k4v = b4.velocity.clone();

    const w = dt / 6.0;
    body.position
      .addScaledVector(k1v, w)
      .addScaledVector(k2v, w * 2)
      .addScaledVector(k3v, w * 2)
      .addScaledVector(k4v, w);
    body.velocity
      .addScaledVector(a1, w)
      .addScaledVector(a2, w * 2)
      .addScaledVector(a3, w * 2)
      .addScaledVector(a4, w);
    body.angularVelocity
      .addScaledVector(aa1, w)
      .addScaledVector(aa2, w * 2)
      .addScaledVector(aa3, w * 2)
      .addScaledVector(aa4, w);
  },
};
