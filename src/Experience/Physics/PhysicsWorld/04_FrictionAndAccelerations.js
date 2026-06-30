// ════════════════════════════════════════════════════════════
// 04_FrictionAndAccelerations.js
// فيزياء الاحتكاك (Friction Physics) + سرعة نقطة التلامس (vB)
// + حساب القوى والتسارعات الخطية والزاوية (Skid / Hook / Roll)
// ════════════════════════════════════════════════════════════
import * as THREE from 'three';

export default {
    // سرعة نقطة التماس اللحظية بين الكرة وأرضية الممر (vB)
    _computeContactVelocity(body) {
        const r  = new THREE.Vector3(0, -body.radius, 0);
        const vB = body.velocity.clone().add(
            new THREE.Vector3().crossVectors(body.angularVelocity, r)
        );
        vB.y = 0;
        return vB;
    },

    // معامل الاحتكاك μ(x,y) — منطقة الزيت مقابل المنطقة الجافة
    _getFriction(body) {
        const dz = Math.abs(body.position.z - this._ballPhysicsOrigin.z);
        return dz < this.settings.oilDistance ? this.settings.muOil : this.settings.muDry;
    },

    // ─────────────────────────────────────────────────────────
    // تجميع كل القوى المؤثرة (احتكاك / جاذبية / حواف المسار)
    // وتحويلها إلى تسارع خطي وزاوي (a = F/m , α = τ/I)
    // ─────────────────────────────────────────────────────────
    _computeAccelerations(body) {
        const linAcc = new THREE.Vector3();
        const angAcc = new THREE.Vector3();

        if (body.isPin) {
            linAcc.y = this.gravity;
            linAcc.x = -body.velocity.x * 2.0;
            linAcc.z = -body.velocity.z * 2.0;
            return { linAcc, angAcc };
        }

        // في الحفرة: فقط تحكم Z (يُطبّق بـ _applyGutterConstraints)
        if (this._gutterAlerted) {
            // لا نضيف أي تسارع X أو Y هنا
            return { linAcc, angAcc };
        }

        const lane    = this._getStartLane();
        // 🌟 سطح المسار الحقيقي (وليس صفر مطلق) — يطابق ارتفاع خشب المسار الفعلي
        const floorY  = this.LANE_SURFACE_OFFSET;
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

        if (onGround) {
            const vB        = this._computeContactVelocity(body);
            const slipSpeed = vB.length();
            const mu        = this._getFriction(body);
            const rVector   = new THREE.Vector3(0, -body.radius, 0);

            if (slipSpeed > 0.005) {
                // ── مرحلة الانزلاق / الانحناء (Skid / Hook) ──
                const fricForce = vB.clone().normalize().multiplyScalar(-mu * N);
                linAcc.add(fricForce.clone().divideScalar(body.mass));
                const torque = new THREE.Vector3().crossVectors(rVector, fricForce);
                angAcc.add(torque.clone().divideScalar(body.inertia));
            } else {
                // ── مرحلة التدحرج الصافي (Pure Rolling) ──
                const mu_rolling    = 0.002;
                const rollFricForce = body.velocity.clone().normalize()
                                         .multiplyScalar(-mu_rolling * N);
                linAcc.add(rollFricForce.clone().divideScalar(body.mass));
                const torque = new THREE.Vector3().crossVectors(rVector, rollFricForce);
                angAcc.add(torque.clone().divideScalar(body.inertia));
            }
        }

        const gutterForce = this._computeGutterForce(body);
        linAcc.x += gutterForce.x / body.mass;

        return { linAcc, angAcc };
    }
};
