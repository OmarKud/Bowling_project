// Pin motion: gravity, air drag, floor collision.
import * as THREE from "three";

export default {
 _integratePin(pin, dt) {
    if (pin.isSleeping) return;
    pin.velocity.y += this.gravity * dt;
    // normalize to default mass
    pin.velocity.x *= 0.92;
    pin.velocity.z *= 0.92;

    if (pin.velocity.length() > 15.0) pin.velocity.setLength(15.0);
    pin.position.addScaledVector(pin.velocity, dt);
    const floorY = pin.radius;
    if (pin.position.y < floorY) {
      pin.position.y = floorY;
      if (pin.velocity.y < 0)
        pin.velocity.y = -pin.velocity.y * pin.restitution * 0.3;
    }

    if (pin.meshRef && !pin.isFallen) {
      pin.meshRef.rotation.x += pin.angularVelocity.x * dt;
      pin.meshRef.rotation.y += pin.angularVelocity.y * dt;
      pin.meshRef.rotation.z += pin.angularVelocity.z * dt;
    }
},
  // Impulse-based collision (ball-pin & pin-pin). Conserves momentum.
  _resolveCollision(bodyA, bodyB) {
    if (bodyA.isSleeping && bodyB.isSleeping) return;
    if (bodyA.isFallen && bodyB.isFallen) return;
    if ((bodyA.isFallen && !bodyB.isPin) || (bodyB.isFallen && !bodyA.isPin))
      return;
    const diffFlat = new THREE.Vector3(
      bodyB.position.x - bodyA.position.x,
      0,
      bodyB.position.z - bodyA.position.z,
    );
    const dist = diffFlat.length();
    const minDist = bodyA.radius + bodyB.radius;
    if (dist >= minDist || dist < 0.0001) return;
    const normal = diffFlat.clone().divideScalar(dist);
    const vRel = new THREE.Vector3().subVectors(bodyB.velocity, bodyA.velocity);
    const vRelN = vRel.dot(normal);
    if (vRelN >= 0) {
      this._separateBodies(bodyA, bodyB, normal, minDist - dist);
      return;
    }
    bodyA.isSleeping = false;
    bodyB.isSleeping = false;

    // Wood-on-wood pins bounce harder (0.75) for domino effect.
    let e = Math.min(bodyA.restitution, bodyB.restitution);
    if (bodyA.isPin && bodyB.isPin) {
      e = 0.75;
    }
    const invMassA = 1.0 / bodyA.mass;
    const invMassB = 1.0 / bodyB.mass;
    const j = (-(1.0 + e) * vRelN) / (invMassA + invMassB);
    const impulse = normal.clone().multiplyScalar(j);

    // Linear impulse.
    bodyA.velocity.addScaledVector(impulse, -invMassA);
    bodyB.velocity.addScaledVector(impulse, invMassB);

    // Angular impulse for pins (tipping effect).
    if (bodyB.isPin) {
      const rB = new THREE.Vector3(
        normal.x * bodyB.radius,
        bodyA.position.y - bodyB.position.y,
        normal.z * bodyB.radius,
      );
      const angImpulseB = new THREE.Vector3().crossVectors(rB, impulse);
      bodyB.angularVelocity.addScaledVector(angImpulseB, 1.0 / bodyB.inertia);
    }
    if (bodyA.isPin) {
      const rA = new THREE.Vector3(
        -normal.x * bodyA.radius,
        bodyB.position.y - bodyA.position.y,
        -normal.z * bodyA.radius,
      );
      const angImpulseA = new THREE.Vector3()
        .crossVectors(rA, impulse)
        .multiplyScalar(-1);
      bodyA.angularVelocity.addScaledVector(angImpulseA, 1.0 / bodyA.inertia);
    }
   // Play collision sound
    const soundManager = window.experience?.soundManager;
    // Fall threshold (0.5 m/s of Δv) - mass-independent by design.
    if (bodyB.isPin && !bodyB.isFallen && Math.abs(j * invMassB) > 0.5) {
      bodyB.isFallen = true;
      bodyB.fallAxis = new THREE.Vector3()
        .crossVectors(new THREE.Vector3(0, 1, 0), normal)
        .normalize();
      if (bodyB.fallAxis.lengthSq() < 0.0001) bodyB.fallAxis.set(1, 0, 0);
      soundManager?.playPinFall();
    }
    if (bodyA.isPin && !bodyA.isFallen && Math.abs(j * invMassA) > 0.5) {
      bodyA.isFallen = true;
      const normalA = normal.clone().multiplyScalar(-1);
      bodyA.fallAxis = new THREE.Vector3()
        .crossVectors(new THREE.Vector3(0, 1, 0), normalA)
        .normalize();
      if (bodyA.fallAxis.lengthSq() < 0.0001) bodyA.fallAxis.set(1, 0, 0);
      soundManager?.playPinFall();
    }
    this._separateBodies(bodyA, bodyB, normal, minDist - dist);
  },

  // Push bodies apart to prevent overlapping.
  _separateBodies(bodyA, bodyB, normal, penetration) {
    const correction = normal.clone().multiplyScalar(penetration * 0.5);
    if (!bodyA.isPin)
      bodyA.position.sub(correction.clone().multiplyScalar(0.1));
    bodyB.position.add(correction);
  },

  // Ball floor collision with impact tracking (higher drop = more bounce).
  _resolveGround(body) {
    if (this._gutterAlerted) return;

    const floorY = body.radius + this.LANE_SURFACE_OFFSET;

    if (body.position.y > floorY + 0.001) {
      if (!this._isFalling) {
        this._isFalling = true;
        this._fallStartY = body.position.y;
      }
    }
    if (body.position.y < floorY) {
      if (this._isFalling) {
        const dropHeightScene =
          Math.max(0, this._fallStartY - floorY) * this.SCALE;
        const impactSpeed = Math.abs(body.velocity.y);
        const impactForce = (body.mass * impactSpeed) / this.fixedDt;
        this.lastImpactInfo = { dropHeightScene, impactSpeed, impactForce };
        console.log(
          `Ball landed | Drop: ${dropHeightScene.toFixed(2)} scene units | ` +
            `Speed: ${impactSpeed.toFixed(2)} m/s | Force: ${impactForce.toFixed(0)} N`,
        );
        
        const bounceFactor = THREE.MathUtils.clamp(impactSpeed / 3.0, 0, 1);
        if (body.velocity.y < 0) {
          body.velocity.y =
            -body.velocity.y * body.restitution * (0.05 + bounceFactor * 0.15);
        }
        this._isFalling = false;
      } else if (body.velocity.y < 0) {
        body.velocity.y = -body.velocity.y * body.restitution * 0.1;
      }
      body.position.y = floorY;
    }
  },
};