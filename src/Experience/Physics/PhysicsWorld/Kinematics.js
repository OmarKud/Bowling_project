// ════════════════════════════════════════════════════════════
// Kinematics.js
// كل شي متعلق بحركة الكرة عالمسار: حدود المسار والحفرة، الاحتكاك
// وقوى الانزلاق/الانحناء، والتكامل العددي (RK4) يلي بيحرّك الجسم
// كل خطوة زمنية.
// ════════════════════════════════════════════════════════════
import * as THREE from 'three';

export default {
    // بنحسب مسار الانطلاق مرة وحدة بس ونخزنه، لأنه ما لازم يتغير
    // طول الرمية حتى لو الكرة انحرفت لمسار جنبي بصريًا
    _getStartLane() {
        if (this._startLane) return this._startLane;
        const bx = this._ballPhysicsOrigin.x;
        let nearest = this.LANE_CENTERS_PHYS[0];
        let minDist = Infinity;
        for (const c of this.LANE_CENTERS_PHYS) {
            const d = Math.abs(bx - c);
            if (d < minDist) { minDist = d; nearest = c; }
        }
        this._startLane = {
            center     : nearest,
            laneLeft   : nearest - this.LANE_HALF_WIDTH,
            laneRight  : nearest + this.LANE_HALF_WIDTH,
            gutterLeft : nearest - this.LANE_HALF_WIDTH - this.GUTTER_WIDTH_PHYS,
            gutterRight: nearest + this.LANE_HALF_WIDTH + this.GUTTER_WIDTH_PHYS
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

    // ─────────────────────────────────────────────────────────
    // الإصلاح #4: أضفنا GUTTER_ENTRY_BUFFER (0.02م) عشان الكرة
    // ما تنقفل بالحفرة فوراً عند أول لمسة للحافة، فتعطي فرصة لـ
    // _computeGutterForce تردها للمسار قبل ما تقفل الحالة.
    // قبلاً كانت العتبة = laneLeft بالضبط، فكانت الدالتان تتعارضان:
    // _computeGutterForce تحاول الرد ← _checkGutterEntry تقفل الحفرة
    // ← _computeGutterForce ترجع صفر لأن _gutterAlerted=true ← الكرة
    // تنشفط للداخل بدون مقاومة.
    // ─────────────────────────────────────────────────────────
    _checkGutterEntry(ballX) {
        if (this._gutterAlerted) return;

        const lane = this._getStartLane();
        const pastStart = this.ballBody.position.z < this._ballPhysicsOrigin.z - 0.1;
        if (!pastStart) return;

        // الإصلاح: بافر 0.02م قبل ما نقفل حالة الحفرة
        const GUTTER_ENTRY_BUFFER = 0.02;
        const inLeftGutter  = ballX < lane.laneLeft  - GUTTER_ENTRY_BUFFER;
        const inRightGutter = ballX > lane.laneRight + GUTTER_ENTRY_BUFFER;

        if (inLeftGutter || inRightGutter) {
            this._gutterAlerted      = true;
            this._gutterLockedX      = ballX;
            this._gutterLockedFloorY = this.LANE_SURFACE_OFFSET - this.GUTTER_DEPTH_PHYS;
            console.log(`Gutter Ball - x=${ballX.toFixed(3)} side=${inLeftGutter ? 'LEFT' : 'RIGHT'}`);
        }
    },

    _applyGutterConstraints(body) {
        const lane = this._getStartLane();
        const isLeftGutter = body.position.x < lane.center;

        const gutterCenter = isLeftGutter
            ? lane.center - this.LANE_HALF_WIDTH - (this.GUTTER_WIDTH_PHYS / 2)
            : lane.center + this.LANE_HALF_WIDTH + (this.GUTTER_WIDTH_PHYS / 2);

        const diffX = gutterCenter - body.position.x;
        body.velocity.x = diffX * 8.0;
        body.position.x += body.velocity.x * this.fixedDt;

        if (isLeftGutter) {
            if (body.position.x > lane.laneLeft) body.position.x = lane.laneLeft - 0.01;
        } else {
            if (body.position.x < lane.laneRight) body.position.x = lane.laneRight + 0.01;
        }

        const floorY = this._gutterLockedFloorY + body.radius;
        if (body.position.y < floorY || body.velocity.y < 0) {
            body.position.y = floorY;
            body.velocity.y = 0;
        }

        body.angularVelocity.set(0, 0, 0);
        body.velocity.z *= 0.999;
    },

    _computeGutterForce(body) {
        const force = new THREE.Vector3(0, 0, 0);
        if (this._gutterAlerted) return force;

        const lane = this._getStartLane();
        const bx   = body.position.x;

        const dxLeft = bx - lane.laneLeft;
        if (dxLeft < 0 && dxLeft > -this.GUTTER_WIDTH_PHYS) {
            const wallX  = lane.gutterLeft;
            const distW  = bx - wallX;
            const minCl  = this.CAPPING_RADIUS_PHYS + body.radius;
            if (distW < minCl) {
                const pen = minCl - distW;
                force.x  += pen * 120.0;
                if (body.velocity.x < 0) body.velocity.x *= 0.05;
            }
        }

        const dxRight = lane.laneRight - bx;
        if (dxRight < 0 && dxRight > -this.GUTTER_WIDTH_PHYS) {
            const wallX  = lane.gutterRight;
            const distW  = wallX - bx;
            const minCl  = this.CAPPING_RADIUS_PHYS + body.radius;
            if (distW < minCl) {
                const pen = minCl - distW;
                force.x  -= pen * 120.0;
                if (body.velocity.x > 0) body.velocity.x *= 0.05;
            }
        }

        return force;
    },

    _computeContactVelocity(body) {
        const r  = new THREE.Vector3(0, -body.radius, 0);
        const vB = body.velocity.clone().add(
            new THREE.Vector3().crossVectors(body.angularVelocity, r)
        );
        vB.y = 0;
        return vB;
    },

    _getFriction(body) {
        const dz = Math.abs(body.position.z - this._ballPhysicsOrigin.z);
        return dz < this.settings.oilDistance ? this.settings.muOil : this.settings.muDry;
    },

    // ─────────────────────────────────────────────────────────
    // الإصلاح #2: حذفنا angAcc.addScaledVector(angularVelocity, -DAMPING_K)
    // لأنه كان يقتل السرعة الزاوية قبل ما تأثيرها يبين على مسار الكرة،
    // وبقّينا التخميد الخطي بس (linAcc) بقيمة خفيفة (0.008).
    //
    // الإصلاح #3: أضفنا Hysteresis للانتقال بين حالة الانزلاق والتدحرج:
    //   - دخول التدحرج النقي عند slipSpeed < 0.01 (بدل 0.005)
    //   - الخروج منه عند slipSpeed > 0.02
    // هيك ما في قفزة مفاجئة بالتسارع عند الحد، وRK4 يضل مستقر.
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

        if (this._gutterAlerted) {
            return { linAcc, angAcc };
        }

        const floorY   = this.LANE_SURFACE_OFFSET;
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

            // ── الإصلاح #3: Hysteresis ──
            // isRolling تُخزن على body عشان تضل ثابتة بين خطوات RK4
            if (body._isRolling === undefined) body._isRolling = false;
            if (!body._isRolling && slipSpeed < 0.01)  body._isRolling = true;
            if ( body._isRolling && slipSpeed > 0.02)  body._isRolling = false;

            if (!body._isRolling) {
                // ── مرحلة الانزلاق (Sliding): احتكاك حركي ──
                const fricForce = vB.clone().normalize().multiplyScalar(-mu * N);
                linAcc.add(fricForce.clone().divideScalar(body.mass));
                const torque = new THREE.Vector3().crossVectors(rVector, fricForce);
                angAcc.add(torque.clone().divideScalar(body.inertia));
            } else {
                // ── مرحلة التدحرج النقي (Pure Rolling): احتكاك تدحرج خفيف ──
                const mu_rolling    = 0.002;
                const rollFricForce = body.velocity.clone().normalize()
                                         .multiplyScalar(-mu_rolling * N);
                linAcc.add(rollFricForce.clone().divideScalar(body.mass));
                const torque = new THREE.Vector3().crossVectors(rVector, rollFricForce);
                angAcc.add(torque.clone().divideScalar(body.inertia));
            }

            console.log(`Angular Accel: ${angAcc.length().toFixed(4)} | Slip Speed: ${slipSpeed.toFixed(4)} | Rolling: ${body._isRolling}`);
        }

        // ── الإصلاح #2: تخميد خطي خفيف فقط (بدون تخميد زاوي) ──
        // التخميد الخطي يعوّض الاحتكاك الهوائي الخفيف، بدون ما يقتل
        // تأثير الدوران (angularVelocity) على مسار الكرة
        const DAMPING_K = 0.008;
        linAcc.addScaledVector(body.velocity, -DAMPING_K);
        // ❌ حذفنا: angAcc.addScaledVector(body.angularVelocity, -DAMPING_K)

        const gutterForce = this._computeGutterForce(body);
        linAcc.x += gutterForce.x / body.mass;

        console.log(`Speed: ${body.velocity.length().toFixed(2)} | Accel: ${linAcc.length().toFixed(4)}`);
        return { linAcc, angAcc };
    },

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