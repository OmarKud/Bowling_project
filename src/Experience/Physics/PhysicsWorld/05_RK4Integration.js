// ════════════════════════════════════════════════════════════
// 05_RK4Integration.js
// المحاكاة العددية — تكامل رونج-كوتا من الدرجة الرابعة (RK4)
// يقابل: FUNCTION integrateRK4(body, dt) في الدراسة الخوارمية
// ════════════════════════════════════════════════════════════
export default {
    _integrateRK4(body, dt) {
        const { linAcc: a1, angAcc: aa1 } = this._computeAccelerations(body);
        const k1v = body.velocity.clone();

        const b2 = {
            ...body,
            position        : body.position.clone().addScaledVector(k1v, dt * 0.5),
            velocity        : body.velocity.clone().addScaledVector(a1,  dt * 0.5),
            angularVelocity : body.angularVelocity.clone().addScaledVector(aa1, dt * 0.5)
        };
        const { linAcc: a2, angAcc: aa2 } = this._computeAccelerations(b2);
        const k2v = b2.velocity.clone();

        const b3 = {
            ...body,
            position        : body.position.clone().addScaledVector(k2v, dt * 0.5),
            velocity        : body.velocity.clone().addScaledVector(a2,  dt * 0.5),
            angularVelocity : body.angularVelocity.clone().addScaledVector(aa2, dt * 0.5)
        };
        const { linAcc: a3, angAcc: aa3 } = this._computeAccelerations(b3);
        const k3v = b3.velocity.clone();

        const b4 = {
            ...body,
            position        : body.position.clone().addScaledVector(k3v, dt),
            velocity        : body.velocity.clone().addScaledVector(a3,  dt),
            angularVelocity : body.angularVelocity.clone().addScaledVector(aa3, dt)
        };
        const { linAcc: a4, angAcc: aa4 } = this._computeAccelerations(b4);
        const k4v = b4.velocity.clone();

        const w = dt / 6.0;
        body.position.addScaledVector(k1v, w).addScaledVector(k2v, w*2)
                     .addScaledVector(k3v, w*2).addScaledVector(k4v, w);
        body.velocity.addScaledVector(a1,  w).addScaledVector(a2,  w*2)
                     .addScaledVector(a3,  w*2).addScaledVector(a4, w);
        body.angularVelocity
                     .addScaledVector(aa1, w).addScaledVector(aa2, w*2)
                     .addScaledVector(aa3, w*2).addScaledVector(aa4, w);
    }
};
