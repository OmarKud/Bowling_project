// ════════════════════════════════════════════════════════════
// 07_CollisionResolution.js
// فيزياء التصادم (Collision Physics)
// حفظ الزخم الخطي + معامل الارتداد 'e' + فصل الأجسام المتداخلة
// يقابل: FUNCTION resolveCollision(bodyA, bodyB) في الدراسة الخوارمية
// ════════════════════════════════════════════════════════════
import * as THREE from 'three';

export default {
    _resolveCollision(bodyA, bodyB) {
        if (bodyA.isSleeping && bodyB.isSleeping) return;
        if ((bodyA.isFallen && !bodyB.isPin) || (bodyB.isFallen && !bodyA.isPin)) return;

        const diffFlat = new THREE.Vector3(
            bodyB.position.x - bodyA.position.x,
            0,
            bodyB.position.z - bodyA.position.z
        );
        const dist    = diffFlat.length();
        const minDist = bodyA.radius + bodyB.radius;
        if (dist >= minDist || dist < 0.0001) return;

        const normal = diffFlat.clone().divideScalar(dist);
        const vRel   = new THREE.Vector3().subVectors(bodyB.velocity, bodyA.velocity);
        const vRelN  = vRel.dot(normal);
        if (vRelN >= 0) { this._separateBodies(bodyA, bodyB, normal, minDist - dist); return; }

        bodyA.isSleeping = false;
        bodyB.isSleeping = false;

        const e          = Math.min(bodyA.restitution, bodyB.restitution);
        const invMassA   = 1.0 / (bodyA.isPin ? bodyA.mass * 1.2 : bodyA.mass);
        const invMassB   = 1.0 / (bodyB.isPin ? bodyB.mass * 1.2 : bodyB.mass);
        const j          = -(1.0 + e) * vRelN / (invMassA + invMassB);
        const impulse    = normal.clone().multiplyScalar(j);

        if (!bodyA.isPin) bodyA.velocity.addScaledVector(impulse, -invMassA * 0.1);
        else              bodyA.velocity.addScaledVector(impulse, -invMassA);
        bodyB.velocity.addScaledVector(impulse, invMassB);

        if (bodyB.isPin && Math.abs(j * invMassB) > (bodyA.isPin ? 1.2 : 0.3))
            bodyB.isFallen = true;
        if (bodyA.isPin && Math.abs(j * invMassA) > (bodyB.isPin ? 1.2 : 0.3))
            bodyA.isFallen = true;

        this._separateBodies(bodyA, bodyB, normal, minDist - dist);
    },

    _separateBodies(bodyA, bodyB, normal, penetration) {
        const correction = normal.clone().multiplyScalar(penetration * 0.5);
        if (!bodyA.isPin) bodyA.position.sub(correction.clone().multiplyScalar(0.1));
        bodyB.position.add(correction);
    }
};
