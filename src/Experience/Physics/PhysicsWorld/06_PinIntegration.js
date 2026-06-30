// ════════════════════════════════════════════════════════════
// 06_PinIntegration.js
// تكامل حركة الدبوس (جاذبية + ارتداد بسيط عن أرضية المسار)
// ════════════════════════════════════════════════════════════
export default {
    _integratePin(pin, dt) {
        if (pin.isSleeping) return;
        pin.velocity.y += this.gravity * dt;
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
    }
};
