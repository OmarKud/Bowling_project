import * as THREE from 'three';

// ═══════════════════════════════════════════════════════════════
// STRUCT RigidBody — (الدراسة الخوارزمية: STRUCT RigidBody)
// يمثل القالب الموحد لكل جسم صلب متحرك (كرة أو دبوس)
// ═══════════════════════════════════════════════════════════════
export default class RigidBody {
    constructor(mass, radius, isPin = false) {
        this.mass   = mass;
        this.radius = radius;

        // عزم القصور الذاتي للكرة الصلبة المتجانسة: I = (2/5) m R²
        // (المرحلة 7: Rotational Dynamics)
        this.inertia = (2.0 / 5.0) * mass * (radius * radius);

        // معامل الارتداد (Coefficient of Restitution)
        // (المرحلة 10: Collision Physics)
        this.restitution = 0.6;

        // متجه الموضع: r⃗ = x î + y ĵ + z k̂
        // (المرحلة 2: Coordinate System)
        this.position = new THREE.Vector3();

        // متجه السرعة الخطية: v⃗ = vx î + vy ĵ + vz k̂
        this.velocity = new THREE.Vector3();

        // توجه الجسم (كواتيرنيون) — أكثر استقراراً من زوايا أويلر
        // (المرحلة 11: Numerical Simulation — Quaternion)
        this.orientation = new THREE.Quaternion();

        // متجه السرعة الزاوية: ω⃗ = ωx î + ωy ĵ + ωz k̂
        // (المرحلة 2: Coordinate System)
        this.angularVelocity = new THREE.Vector3();

        // ── علامات الحالة ──
        this.isPin     = isPin; // true = دبوس، false = كرة
        this.isFallen  = false; // سقط الدبوس (تجاوز زاوية الميلان الحرجة > 12°)
        this.isSleeping = false; // خامل — ||v|| < ε و ||ω|| < ε
    }
}