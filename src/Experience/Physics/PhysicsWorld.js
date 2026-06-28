import * as THREE from 'three';
import Experience from '../Experience.js';

export default class PhysicsWorld {
    constructor() {
        this.experience = new Experience();
        this.SCALE = 20.0;
        this.gravity = -9.81;
        this.ballBody  = null;
        this.pinsBodies = [];
        this.isSimulationActive = false;
        this.fixedDt    = 1.0 / 120.0;
        this.accumulator = 0.0;
        this.settings   = null;
        this.ballMesh = null;

        // ══════════════════════════════════════════════════════
        // هندسة المسار — مستخرجة مباشرة من BowlingLanes.js
        // ══════════════════════════════════════════════════════
        //   laneComponentWidth = 32  → فيزيائياً 32/20 = 1.6 م
        //   laneWidth          = 21  → فيزيائياً 21/20 = 1.05 م
        //   gutterWidth        = 3   → فيزيائياً  3/20 = 0.15 م
        //   cappingRadius      = 2.5 → فيزيائياً 2.5/20= 0.125م (نصف قطر الأسطوانة الفاصلة)
        //
        //   مراكز المسارات الـ6 (رسومياً): -80, -48, -16, 16, 48, 80
        //   فيزيائياً: -4.0, -2.4, -0.8, 0.8, 2.4, 4.0
        // ══════════════════════════════════════════════════════
        this.LANE_CENTERS_PHYS = [-4.0, -2.4, -0.8, 0.8, 2.4, 4.0];

        // نصف عرض المسار الفيزيائي (21/2 / 20) = 0.525 م
        this.LANE_HALF_WIDTH = 21 / 2 / this.SCALE;  // 0.525

        // عرض الحفرة فيزيائياً
        this.GUTTER_WIDTH_PHYS = 3 / this.SCALE;     // 0.15

        // نصف قطر الأسطوانة الفاصلة (cappingRadius) فيزيائياً
        this.CAPPING_RADIUS_PHYS = 2.5 / this.SCALE; // 0.125

        // ارتفاع سطح الحفرة أقل من سطح المسار
        // المسار عند Y=0.2 رسومياً = 0.01 فيزيائياً (رفيع جداً)
        // الحفرة عند Y=0.22 رسومياً ≈ 0.011 فيزيائياً
        // الفرق البصري ضئيل لكننا نعالجه كـ "خندق" منحدر
        this.GUTTER_DEPTH_PHYS = 0.05; // عمق الحفرة الفيزيائي (متر)
    }

    // ─────────────────────────────────────────────────────────
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

    // ─────────────────────────────────────────────────────────
    initializeSimulation(settings, _ballMesh, _pinsMeshes) {
        this.settings    = settings;
        this.accumulator = 0.0;
        this.pinsBodies  = [];

        this.ballMesh = this.experience.inputPanel.ball;
        if (!this.ballMesh) return;

        const mass   = settings.ballMass;
        const radius = 0.108 * (settings.ballRadius / 1.1);
        const force  = settings.pushForce;
        const angle  = THREE.MathUtils.degToRad(settings.launchAngle);

        const Ek = 40.0;
        const delta_t = 0.15;
        const v0 = Math.sqrt((2 * Ek) / mass) + ((force * delta_t) / mass);

        const vx = v0 * Math.sin(angle);
        const vz = -v0 * Math.cos(angle);

        const startPosPhysics = new THREE.Vector3(
            this.ballMesh.position.x / this.SCALE,
            radius,
            this.ballMesh.position.z / this.SCALE
        );

        this._ballScreenOrigin = this.ballMesh.position.clone();
        this._ballScreenOrigin.y = radius * this.SCALE;
        this._ballPhysicsOrigin = startPosPhysics.clone();

        const omega    = (2 * Math.PI * settings.rpm) / 60.0;
        const axisRot  = THREE.MathUtils.degToRad(settings.axisRotation);
        const axisTilt = THREE.MathUtils.degToRad(settings.axisTilt);
        const spinAxis = new THREE.Vector3(
            Math.sin(axisRot) * Math.cos(axisTilt),
            Math.sin(axisTilt),
            Math.cos(axisRot) * Math.cos(axisTilt)
        ).normalize();
        const angularVel = spinAxis.multiplyScalar(omega);

        this.ballBody = this._createBody({
            position       : startPosPhysics,
            velocity       : new THREE.Vector3(vx, 0, vz),
            angularVelocity: angularVel,
            mass,
            radius,
            restitution    : settings.restitution,
            meshRef        : this.ballMesh
        });

        console.log(`🎳 Ball Launch | v0: ${v0.toFixed(2)} m/s | Force: ${force} N`);

        const allPins = this.experience.world?.hall?.pins?.pinsArray;
        if (allPins) {
            const currentLaneX = this.ballMesh.position.x;
            const pinRadius    = 0.110 * (settings.pinHeight / 3.8);

            allPins.forEach((mesh) => {
                if (Math.abs(mesh.position.x - currentLaneX) >= 16) return;
                if (mesh.userData.isFallen) return;

                const pinScale = 18 * (settings.pinHeight / 3.8);
                mesh.scale.set(pinScale, pinScale, pinScale);
                mesh.rotation.set(0, 0, 0);
                mesh.position.y = settings.pinHeight * (3.8 / 3.8);

                const pinBody = this._createBody({
                    position   : new THREE.Vector3(
                        mesh.position.x / this.SCALE,
                        mesh.position.y / this.SCALE,
                        mesh.position.z / this.SCALE
                    ),
                    velocity   : new THREE.Vector3(),
                    mass       : settings.pinMass,
                    radius     : pinRadius,
                    restitution: settings.restitution * 0.5,
                    isPin      : true,
                    meshRef    : mesh
                });
                pinBody.startPos = pinBody.position.clone();
                this.pinsBodies.push(pinBody);
            });
        }

        this.isSimulationActive = true;
        this.experience.inputPanel.isLaunched = true;
    }

    // ══════════════════════════════════════════════════════════
    // نظام الحواف والحفر
    // ══════════════════════════════════════════════════════════

    // يُرجع بيانات المسار الأقرب للكرة
    _getNearestLane(ballX_phys) {
        let nearest = this.LANE_CENTERS_PHYS[0];
        let minDist = Infinity;
        for (const c of this.LANE_CENTERS_PHYS) {
            const d = Math.abs(ballX_phys - c);
            if (d < minDist) { minDist = d; nearest = c; }
        }
        return {
            center     : nearest,
            laneLeft   : nearest - this.LANE_HALF_WIDTH,
            laneRight  : nearest + this.LANE_HALF_WIDTH,
            gutterLeft : nearest - this.LANE_HALF_WIDTH - this.GUTTER_WIDTH_PHYS,
            gutterRight: nearest + this.LANE_HALF_WIDTH + this.GUTTER_WIDTH_PHYS
        };
    }

    // ─────────────────────────────────────────────────────────
    // تحديد منطقة الكرة بدقة
    // ─────────────────────────────────────────────────────────
    _getBallZone(ballX_phys) {
        const lane = this._getNearestLane(ballX_phys);

        const inLane        = ballX_phys >= lane.laneLeft  && ballX_phys <= lane.laneRight;
        const inLeftGutter  = ballX_phys >= lane.gutterLeft  && ballX_phys < lane.laneLeft;
        const inRightGutter = ballX_phys >  lane.laneRight   && ballX_phys <= lane.gutterRight;

        return { lane, inLane, inLeftGutter, inRightGutter };
    }

    // ─────────────────────────────────────────────────────────
    // ارتفاع سطح الأرض تحت الكرة
    //   داخل المسار          → Y = 0
    //   داخل الحفرة          → Y = -GUTTER_DEPTH  (الحفرة أعمق)
    //   خارج كل المسارات     → Y = 0
    // ─────────────────────────────────────────────────────────
    _getFloorY(ballX_phys, _ballRadius) {
        const { inLeftGutter, inRightGutter } = this._getBallZone(ballX_phys);
        if (inLeftGutter || inRightGutter) return -this.GUTTER_DEPTH_PHYS;
        return 0.0;
    }

    // ─────────────────────────────────────────────────────────
    // قوة الحواف الجانبية — المنطق الجديد الصحيح:
    //
    //  ┌─────────────────────────────────────────────────────┐
    //  │  المسار (Lane)  │ حافة │  الحفرة (Gutter)  │ حافة │
    //  └─────────────────────────────────────────────────────┘
    //
    //  1. الكرة داخل المسار → لا قوة جانبية (تمشي طبيعي)
    //
    //  2. الكرة تتجاوز حافة المسار (laneLeft/laneRight):
    //     → لا نوقفها، نتركها تعدي للحفرة بحرية
    //     → فقط نلغي مكوّن السرعة X الراجع (لتمنع الارتداد الغريب)
    //
    //  3. الكرة داخل الحفرة → لا قوة جانبية (تمشي مستقيم للأمام)
    //
    //  4. الكرة تضرب الجدار الخارجي (cappingRadius الأسطوانة الخارجية):
    //     → دفع قوي للداخل (تبقى في الحفرة ولا تخرج لبراها)
    // ─────────────────────────────────────────────────────────
    _computeGutterForce(body) {
        const force = new THREE.Vector3(0, 0, 0);
        const { lane, inLane, inLeftGutter, inRightGutter } = this._getBallZone(body.position.x);

        // ── الكرة داخل المسار → لا تدخّل ──
        if (inLane) return force;

        // ── الكرة داخل الحفرة اليسرى ──
        if (inLeftGutter) {
            // جدار الحفرة الخارجي (الأسطوانة الفاصلة بين مسارين أو الجدار الجانبي)
            const wallX     = lane.gutterLeft;
            const distWall  = body.position.x - wallX;        // المسافة من الجدار الخارجي
            const minClear  = this.CAPPING_RADIUS_PHYS + body.radius;

            if (distWall < minClear) {
                // اختراق في الجدار الخارجي → ادفع للداخل (يمين)
                const pen = minClear - distWall;
                force.x  += pen * 120.0;                       // نابض صلب للداخل
                // امتص السرعة X الراجعة فقط (لا تعكسها، فقط امتصها)
                if (body.velocity.x < 0) body.velocity.x *= 0.1;
            }
            // لا قوة جانبية في وسط الحفرة — تمشي مستقيم
            return force;
        }

        // ── الكرة داخل الحفرة اليمنى ──
        if (inRightGutter) {
            const wallX    = lane.gutterRight;
            const distWall = wallX - body.position.x;
            const minClear = this.CAPPING_RADIUS_PHYS + body.radius;

            if (distWall < minClear) {
                // اختراق في الجدار الخارجي → ادفع للداخل (يسار)
                const pen = minClear - distWall;
                force.x  -= pen * 120.0;
                if (body.velocity.x > 0) body.velocity.x *= 0.1;
            }
            return force;
        }

        // ── خارج كل المسارات (بين مسارين) → دفع للحفرة الأقرب ──
        // هذا يمنع الكرة من الانزلاق على الأسطوانة الفاصلة بين مسارين
        const distLeft  = body.position.x - lane.gutterLeft;
        const distRight = lane.gutterRight - body.position.x;
        if (distLeft < distRight) {
            // أقرب للحفرة اليسرى → ادفع يساراً
            force.x -= body.radius * 60.0;
        } else {
            // أقرب للحفرة اليمنى → ادفع يميناً
            force.x += body.radius * 60.0;
        }

        return force;
    }

    // ─────────────────────────────────────────────────────────
    _computeContactVelocity(body) {
        const r  = new THREE.Vector3(0, -body.radius, 0);
        const vB = body.velocity.clone().add(
            new THREE.Vector3().crossVectors(body.angularVelocity, r)
        );
        vB.y = 0;
        return vB;
    }

    _getFriction(body) {
        const dz = Math.abs(body.position.z - this._ballPhysicsOrigin.z);
        return dz < this.settings.oilDistance ? this.settings.muOil : this.settings.muDry;
    }

    // ─────────────────────────────────────────────────────────
    // حساب التسارعات — محدّث لدعم الحواف والحفر
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

        // ── حساب ارتفاع الأرض الفعلي تحت الكرة ──
        const floorY  = this._getFloorY(body.position.x, body.radius);
        const onGround = body.position.y <= floorY + body.radius + 0.001;

        if (!onGround) {
            // الكرة في الهواء → جاذبية فقط
            linAcc.y += this.gravity;
        }

        const speed = body.velocity.length();
        if (speed < 0.001 && body.angularVelocity.length() < 0.001) {
            // ── إضافة قوة الحافة حتى لو كانت الكرة شبه ساكنة ──
            const gf = this._computeGutterForce(body);
            linAcc.x += gf.x / body.mass;
            linAcc.z += gf.z / body.mass;
            return { linAcc, angAcc };
        }

        const N = body.mass * Math.abs(this.gravity);

        if (onGround) {
            const vB       = this._computeContactVelocity(body);
            const slipSpeed = vB.length();
            const mu        = this._getFriction(body);
            const rVector   = new THREE.Vector3(0, -body.radius, 0);

            if (slipSpeed > 0.005) {
                const fricForce = vB.clone().normalize().multiplyScalar(-mu * N);
                linAcc.add(fricForce.clone().divideScalar(body.mass));
                const torque = new THREE.Vector3().crossVectors(rVector, fricForce);
                angAcc.add(torque.clone().divideScalar(body.inertia));
            } else {
                const mu_rolling    = 0.002;
                const rollFricForce = body.velocity.clone().normalize()
                                         .multiplyScalar(-mu_rolling * N);
                linAcc.add(rollFricForce.clone().divideScalar(body.mass));
                const torque = new THREE.Vector3().crossVectors(rVector, rollFricForce);
                angAcc.add(torque.clone().divideScalar(body.inertia));
            }
        }

        // ── قوة الحواف (تعمل دائماً، داخل أو خارج المسار) ──
        const gutterForce = this._computeGutterForce(body);
        linAcc.x += gutterForce.x / body.mass;
        linAcc.z += gutterForce.z / body.mass;

        return { linAcc, angAcc };
    }

    // ─────────────────────────────────────────────────────────
    // RK4 — بدون تغيير
    // ─────────────────────────────────────────────────────────
    _integrateRK4(body, dt) {
        const { linAcc: a1, angAcc: aa1 } = this._computeAccelerations(body);
        const k1v  = body.velocity.clone();
        const k1av = body.angularVelocity.clone();

        const b2 = {
            ...body,
            position        : body.position.clone().addScaledVector(k1v,  dt * 0.5),
            velocity        : body.velocity.clone().addScaledVector(a1,   dt * 0.5),
            angularVelocity : body.angularVelocity.clone().addScaledVector(aa1, dt * 0.5)
        };
        const { linAcc: a2, angAcc: aa2 } = this._computeAccelerations(b2);
        const k2v  = b2.velocity.clone();

        const b3 = {
            ...body,
            position        : body.position.clone().addScaledVector(k2v,  dt * 0.5),
            velocity        : body.velocity.clone().addScaledVector(a2,   dt * 0.5),
            angularVelocity : body.angularVelocity.clone().addScaledVector(aa2, dt * 0.5)
        };
        const { linAcc: a3, angAcc: aa3 } = this._computeAccelerations(b3);
        const k3v  = b3.velocity.clone();

        const b4 = {
            ...body,
            position        : body.position.clone().addScaledVector(k3v,  dt),
            velocity        : body.velocity.clone().addScaledVector(a3,   dt),
            angularVelocity : body.angularVelocity.clone().addScaledVector(aa3, dt)
        };
        const { linAcc: a4, angAcc: aa4 } = this._computeAccelerations(b4);
        const k4v  = b4.velocity.clone();

        const w = dt / 6.0;
        body.position.addScaledVector(k1v, w)
                     .addScaledVector(k2v, w * 2)
                     .addScaledVector(k3v, w * 2)
                     .addScaledVector(k4v, w);

        body.velocity.addScaledVector(a1, w)
                     .addScaledVector(a2, w * 2)
                     .addScaledVector(a3, w * 2)
                     .addScaledVector(a4, w);

        body.angularVelocity.addScaledVector(aa1, w)
                            .addScaledVector(aa2, w * 2)
                            .addScaledVector(aa3, w * 2)
                            .addScaledVector(aa4, w);
    }

    // ─────────────────────────────────────────────────────────
    // تكامل الدبابيس — بدون تغيير
    // ─────────────────────────────────────────────────────────
    _integratePin(pin, dt) {
        if (pin.isSleeping) return;
        pin.velocity.y += this.gravity * dt;
        const pinFriction = 0.92;
        pin.velocity.x *= pinFriction;
        pin.velocity.z *= pinFriction;
        const maxSpeed = 15.0;
        if (pin.velocity.length() > maxSpeed) pin.velocity.setLength(maxSpeed);
        pin.position.addScaledVector(pin.velocity, dt);
        const floorY = pin.radius;
        if (pin.position.y < floorY) {
            pin.position.y = floorY;
            if (pin.velocity.y < 0)
                pin.velocity.y = -pin.velocity.y * pin.restitution * 0.3;
        }
    }

    // ─────────────────────────────────────────────────────────
    // حل التصادم — بدون تغيير
    // ─────────────────────────────────────────────────────────
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

        if (vRelN >= 0) {
            this._separateBodies(bodyA, bodyB, normal, minDist - dist);
            return;
        }

        bodyA.isSleeping = false;
        bodyB.isSleeping = false;

        const e = Math.min(bodyA.restitution, bodyB.restitution);
        const effectiveMassA = bodyA.isPin ? bodyA.mass * 1.2 : bodyA.mass;
        const effectiveMassB = bodyB.isPin ? bodyB.mass * 1.2 : bodyB.mass;
        const invMassA = 1.0 / effectiveMassA;
        const invMassB = 1.0 / effectiveMassB;
        const j = -(1.0 + e) * vRelN / (invMassA + invMassB);
        const impulse = normal.clone().multiplyScalar(j);

        if (!bodyA.isPin) {
            bodyA.velocity.addScaledVector(impulse, -invMassA * 0.1);
        } else {
            bodyA.velocity.addScaledVector(impulse, -invMassA);
        }
        bodyB.velocity.addScaledVector(impulse, invMassB);

        if (bodyB.isPin) {
            const acquiredSpeed  = j * invMassB;
            const fallThreshold  = bodyA.isPin ? 1.2 : 0.3;
            if (Math.abs(acquiredSpeed) > fallThreshold) bodyB.isFallen = true;
        }
        if (bodyA.isPin) {
            const acquiredSpeedA = j * invMassA;
            const fallThresholdA = bodyB.isPin ? 1.2 : 0.3;
            if (Math.abs(acquiredSpeedA) > fallThresholdA) bodyA.isFallen = true;
        }
        this._separateBodies(bodyA, bodyB, normal, minDist - dist);
    }

    _separateBodies(bodyA, bodyB, normal, penetration) {
        const correction = normal.clone().multiplyScalar(penetration * 0.5);
        if (!bodyA.isPin) bodyA.position.sub(correction.clone().multiplyScalar(0.1));
        bodyB.position.add(correction);
    }

    // ─────────────────────────────────────────────────────────
    // ضبط الكرة على الأرض — محدّث لدعم الحفر
    // ─────────────────────────────────────────────────────────
    _resolveGround(body) {
        const { inLeftGutter, inRightGutter } = this._getBallZone(body.position.x);
        const inGutter = inLeftGutter || inRightGutter;
        const floorY   = inGutter ? -this.GUTTER_DEPTH_PHYS : 0.0;

        if (body.position.y < floorY + body.radius) {
            body.position.y = floorY + body.radius;

            if (body.velocity.y < 0) {
                // ارتداد عمودي خفيف جداً (الكرة تستقر في الحفرة)
                body.velocity.y = -body.velocity.y * body.restitution * 0.1;
            }

            if (inGutter) {
                // ── داخل الحفرة: امتص السرعة الجانبية X فوراً ──
                // الكرة تمشي مستقيم للأمام فقط (محور Z)، لا ترتد يميناً أو يساراً
                body.velocity.x *= 0.05; // كبح شبه كامل للمكوّن الجانبي
                // احتكاك أرضي أعلى قليلاً في الحفرة (خشب غير مزيّت)
                body.velocity.z *= 0.98;
            }
        }
    }

    // ─────────────────────────────────────────────────────────
    // مزامنة الرسوميات — محدّثة لتعكس ارتفاع الحفرة بصرياً
    // ─────────────────────────────────────────────────────────
    _syncMeshes() {
        if (this.ballMesh && this.ballBody) {
            const dp = new THREE.Vector3().subVectors(
                this.ballBody.position,
                this._ballPhysicsOrigin
            );
            this.ballMesh.position.x = this._ballScreenOrigin.x + dp.x * this.SCALE;
            // Y الرسومي = موقع الفيزياء مباشرة × SCALE (يشمل عمق الحفرة تلقائياً)
            this.ballMesh.position.y = this.ballBody.position.y * this.SCALE;
            this.ballMesh.position.z = this._ballScreenOrigin.z + dp.z * this.SCALE;

            const av = this.ballBody.angularVelocity;
            this.ballMesh.rotation.x += av.x * this.fixedDt * 0.5;
            this.ballMesh.rotation.y += av.y * this.fixedDt * 0.5;
            this.ballMesh.rotation.z += av.z * this.fixedDt * 0.5;
        }

        this.pinsBodies.forEach((pin) => {
            if (!pin.meshRef) return;
            pin.meshRef.position.x = pin.position.x * this.SCALE;
            pin.meshRef.position.z = pin.position.z * this.SCALE;

            if (pin.isFallen) {
                const targetRot = -Math.PI / 2;
                const diff      = targetRot - pin.meshRef.rotation.x;
                if (Math.abs(diff) > 0.01) {
                    pin.meshRef.rotation.x += diff * 0.18;
                } else {
                    pin.meshRef.rotation.x = targetRot;
                }
                const yDiff = 0.0 - pin.meshRef.position.y;
                if (Math.abs(yDiff) > 0.05) {
                    pin.meshRef.position.y += yDiff * 0.18;
                } else {
                    pin.meshRef.position.y = 0.0;
                }
            }
        });
    }

    // ─────────────────────────────────────────────────────────
    _endSimulation(isGutterBall = false) {
        this.isSimulationActive = false;
        this._gutterAlerted     = false;
        if (this.experience.inputPanel) {
            this.experience.inputPanel.isLaunched = false;
        }
        // أعد إظهار الكرة دائماً (كانت مخفية في حالة Gutter)
        if (this.ballMesh) this.ballMesh.visible = true;
        const fallen = this.pinsBodies.filter(p => p.isFallen).length;
        const total  = this.pinsBodies.length;
        console.log(`🎯 انتهت الرمية | سقط: ${fallen} / ${total} | Gutter: ${isGutterBall}`);
        setTimeout(() => {
            if (isGutterBall) {
                alert('🚫 Gutter Ball! الكرة وقعت في الحفرة — 0 دبابيس');
            } else if (fallen === total && total === 10) {
                alert('🎉 STRIKE! أسقطت جميع الدبابيس!');
            } else if (fallen >= 7) {
                alert(`👍 رمية ممتازة! أسقطت ${fallen} من ${total} دبابيس`);
            } else {
                alert(`🎳 النتيجة: ${fallen} / ${total} دبابيس`);
            }
        }, 800);
    }

    // ─────────────────────────────────────────────────────────
    update(deltaTime) {
        if (!this.isSimulationActive || !this.ballBody) return;

        this.accumulator += Math.min(deltaTime, 0.05);

        while (this.accumulator >= this.fixedDt) {
            if (!this.ballBody.isSleeping) {
                this._integrateRK4(this.ballBody, this.fixedDt);
                this._resolveGround(this.ballBody);

                const ballSpeed = this.ballBody.velocity.length();
                if (ballSpeed < 0.05 && this.ballBody.position.z < this._ballPhysicsOrigin.z - 5) {
                    this.ballBody.isSleeping = true;
                }
            }

            for (let i = 0; i < this.pinsBodies.length; i++) {
                const pin = this.pinsBodies[i];
                if (!pin.isSleeping) this._integratePin(pin, this.fixedDt);

                // ── الكرة في الحفرة لا تصطدم بالدبابيس ──
                const { inLeftGutter: bLG, inRightGutter: bRG } =
                    this._getBallZone(this.ballBody.position.x);
                if (!bLG && !bRG) {
                    this._resolveCollision(this.ballBody, pin);
                }
            }

            for (let i = 0; i < this.pinsBodies.length; i++) {
                for (let j = i + 1; j < this.pinsBodies.length; j++) {
                    const pA = this.pinsBodies[i];
                    const pB = this.pinsBodies[j];
                    if (!pA.isSleeping || !pB.isSleeping) {
                        this._resolveCollision(pA, pB);
                    }
                }
            }

            this.pinsBodies.forEach((pin) => {
                if (pin.isSleeping) return;
                if (pin.velocity.lengthSq() < 0.005 && !pin.isFallen) {
                    pin.velocity.set(0, 0, 0);
                    pin.isSleeping = true;
                }
            });

            this.accumulator -= this.fixedDt;
        }

        this._syncMeshes();

        // ── كشف Gutter Ball — Game Over فوري عند دخول الحفرة ──
        const { inLeftGutter, inRightGutter } = this._getBallZone(this.ballBody.position.x);
        const inGutter  = inLeftGutter || inRightGutter;
        const pastStart = this.ballBody.position.z < this._ballPhysicsOrigin.z - 1.5;

        if (inGutter && pastStart && !this._gutterAlerted) {
            this._gutterAlerted = true;
            console.log('🚫 Gutter Ball! الكرة في الحفرة — تكمل مستقيم');
        }

        // ── إذا الكرة في الحفرة: قفّل X و Y وأوقف الدوران كل frame ──
        if (this._gutterAlerted) {
            this.ballBody.velocity.x = 0;
            this.ballBody.velocity.y = 0;
            this.ballBody.angularVelocity.set(0, 0, 0);
            // قفل Y على قاع الحفرة حتى لا تغوص أو تطير
            this.ballBody.position.y = this.GUTTER_DEPTH_PHYS + this.ballBody.radius;
            // قفل X على مركز الحفرة الحالية
            if (!this._gutterLockedX) {
                this._gutterLockedX = this.ballBody.position.x;
            }
            this.ballBody.position.x = this._gutterLockedX;
        }

        // ── شرط الإنهاء الطبيعي ──
        const ballScreenZ     = this.ballMesh ? this.ballMesh.position.z : 0;
        const allPinsSleeping = this.pinsBodies.every(p => p.isSleeping || p.isFallen);

        if (ballScreenZ < -260 || (this.ballBody.isSleeping && allPinsSleeping)) {
            this._endSimulation(false);
        }
    }
}