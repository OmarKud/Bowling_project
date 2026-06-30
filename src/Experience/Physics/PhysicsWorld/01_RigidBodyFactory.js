// ════════════════════════════════════════════════════════════
// 01_RigidBodyFactory.js
// إنشاء الجسم الصلب (RigidBody Struct) — الكرة أو الدبوس
// يقابل: STRUCT RigidBody في الدراسة الخوارمية
// ════════════════════════════════════════════════════════════
import * as THREE from 'three';

export default {
    _createBody(options) {
        const mass   = options.mass   ?? 1.0;
        const radius = options.radius ?? 0.108;
        return {
            position        : options.position        ?? new THREE.Vector3(),
            velocity        : options.velocity        ?? new THREE.Vector3(),
            angularVelocity : options.angularVelocity ?? new THREE.Vector3(),
            mass,
            radius,
            inertia    : (2 / 5) * mass * radius * radius,
            restitution: options.restitution ?? 0.6,
            isPin      : options.isPin  ?? false,
            isFallen   : false,
            isSleeping : false,
            meshRef    : options.meshRef ?? null
        };
    }
};
