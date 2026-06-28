import * as THREE from 'three';
import Experience from '../Experience.js';

export default class PhysicsWorld {
    constructor() {
        this.experience = new Experience();

        // 1 metre في الواقع = 20 وحدة رسومية
        this.SCALE = 20.0;

        this.gravity = -9.81; // m/s²

        this.ballBody  = null;
        this.pinsBodies = [];
        this.isSimulationActive = false;

        // Fixed timestep 120 Hz للدقة
        this.fixedDt    = 1.0 / 120.0;
        this.accumulator = 0.0;
        this.settings   = null;

        // حفظ مرجع للـ mesh
        this.ballMesh = null;
    }

    // ─────────────────────────────────────────────────────────
    // إنشاء rigid body
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
            // عزم القصور الذاتي للكرة الصلبة: I = 2/5 m r²
            inertia    : (2 / 5) * mass * radius * radius,
            restitution: options.restitution ?? 0.6,
            isPin      : options.isPin  ?? false,
            isFallen   : false,
            isSleeping : false,
            meshRef    : options.meshRef ?? null
        };
    }

    // ─────────────────────────────────────────────────────────
    // تهيئة المحاكاة — تُستدعى من InputPanel عند الضغط على Launch
    // ─────────────────────────────────────────────────────────
    initializeSimulation(settings, _ballMesh, _pinsMeshes) {
        this.settings    = settings;
        this.accumulator = 0.0;
        this.pinsBodies  = [];

        // ── 1. الكرة ──────────────────────────────────────────
        this.ballMesh = this.experience.inputPanel.ball;
        if (!this.ballMesh) {
            console.error('❌ لا يوجد مرجع للكرة. التقط الكرة أولاً.');
            return;
        }

        const mass   = settings.ballMass;                              // kg
        const radius = 0.108 * (settings.ballRadius / 1.1);           // m
        const force  = settings.pushForce;                             // N
        const angle  = THREE.MathUtils.degToRad(settings.launchAngle);// rad

        // السرعة الخطية من قانون نيوتن: a = F/m، ثم v ≈ a · dt_launch (ضربة 0.5 ثانية افتراضية)
        // أكثر واقعية: v = F / (mass * 10) — نُعطي push impulse / mass
        const v0 = Math.min((force / mass) * 0.35, 28.0); // cap عند 28 m/s (حد واقعي بولينغ)

        // الزاوية تُعطي مكوّني X و Z
        // المحور Z السالب هو اتجاه المسار (نحو الدبابيس)
        const vx = v0 * Math.sin(angle);
        const vz = -v0 * Math.cos(angle);

        // ── تحويل موقع الكرة من وحدات رسومية → أمتار ──
        // Z_physics = (Z_screen_startZ - Z_mesh) / SCALE
        // نحتاج نعرف Z المرجعي للبداية — الكرة موضوعة عند z ≈ 100 (قريبة اللاعب)
        const startPosPhysics = new THREE.Vector3(
            this.ballMesh.position.x / this.SCALE,
            this.ballMesh.position.y / this.SCALE,
            this.ballMesh.position.z / this.SCALE
        );

        // حفظ نقطة البداية لمزامنة الإحداثيات لاحقاً
        this._ballScreenOrigin = this.ballMesh.position.clone();
        this._ballPhysicsOrigin = startPosPhysics.clone();

        // ── السرعة الزاوية من RPM ──
        // ω = 2π · rpm / 60 (rad/s) على محور مُميَّل حسب axisRotation + axisTilt
        const omega     = (2 * Math.PI * settings.rpm) / 60.0;
        const axisRot   = THREE.MathUtils.degToRad(settings.axisRotation);
        const axisTilt  = THREE.MathUtils.degToRad(settings.axisTilt);
        // محور الدوران: مُميَّل في المستوى XZ حسب axisRotation ثم مُمال Y حسب axisTilt
        const spinAxis  = new THREE.Vector3(
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

        console.log(`🎳 Ball: v0=${v0.toFixed(2)} m/s, angle=${settings.launchAngle}°, rpm=${settings.rpm}`);

        // ── 2. الدبابيس ───────────────────────────────────────
        const allPins = this.experience.world?.hall?.pins?.pinsArray;
        if (!allPins || allPins.length === 0) {
            console.warn('⚠️ لم يتم تحميل الدبابيس بعد.');
        } else {
            const currentLaneX = this.ballMesh.position.x;
            const pinRadius    = 0.060 * (settings.pinHeight / 3.8); // m

            allPins.forEach((mesh) => {
                // أخذ دبابيس المسار الحالي فقط (±20 وحدة)
                if (Math.abs(mesh.position.x - currentLaneX) >= 20) return;

                // إعادة ضبط شكل الدبوس بناءً على pinHeight من البانل
                const pinScale = 18 * (settings.pinHeight / 3.8);
                mesh.scale.set(pinScale, pinScale, pinScale);
                mesh.rotation.set(0, 0, 0);
                mesh.position.y = settings.pinHeight * (3.8 / 3.8); // حافظ على Y الأصلية

                const pinBody = this._createBody({
                    position   : new THREE.Vector3(
                        mesh.position.x / this.SCALE,
                        mesh.position.y / this.SCALE,
                        mesh.position.z / this.SCALE
                    ),
                    velocity   : new THREE.Vector3(),
                    mass       : settings.pinMass,
                    radius     : pinRadius,
                    restitution: settings.restitution * 0.5, // الدبابيس أقل ارتداداً
                    isPin      : true,
                    meshRef    : mesh
                });

                // حفظ موقع البداية لمنع الانجراف
                pinBody.startPos = pinBody.position.clone();
                this.pinsBodies.push(pinBody);
            });
        }

        this.isSimulationActive = true;
        // ← هذا الفلاغ هو ما يُشغّل update() في Experience.js
        this.experience.inputPanel.isLaunched = true;

        console.log(`🚀 المحاكاة بدأت | دبابيس: ${this.pinsBodies.length} | v0: ${v0.toFixed(2)} m/s`);
    }

    // ─────────────────────────────────────────────────────────
    // احتكاك بناءً على الزيت
    // ─────────────────────────────────────────────────────────
    _getFriction(body) {
        // المسافة المقطوعة بالأمتار منذ البداية
        const dz = Math.abs(body.position.z - this._ballPhysicsOrigin.z);
        return dz < this.settings.oilDistance ? this.settings.muOil : this.settings.muDry;
    }

    // ─────────────────────────────────────────────────────────
    // حساب التسارع الخطي والزاوي (تُستخدم في RK4)
    // القوى: احتكاك الأرض + تأثير السبين (Magnus effect خفيف)
    // ─────────────────────────────────────────────────────────
    _computeAccelerations(body) {
        const linAcc = new THREE.Vector3();
        const angAcc = new THREE.Vector3();

        if (body.isPin) {
            // الدبابيس: الجاذبية فقط + تخميد بسيط
            linAcc.y = this.gravity;
            // تخميد الحركة الأفقية ليتوقفوا بشكل طبيعي
            linAcc.x = -body.velocity.x * 2.0;
            linAcc.z = -body.velocity.z * 2.0;
            return { linAcc, angAcc };
        }

        // ── الكرة ──
        const speed = body.velocity.length();
        if (speed < 0.001) return { linAcc, angAcc };

        const mu   = this._getFriction(body);
        const N    = body.mass * Math.abs(this.gravity);  // قوة ردّ الفعل الطبيعية (الأرض مستوية)
        const fric = mu * N;                               // مقدار قوة الاحتكاك

        // اتجاه الاحتكاك عكس الحركة (المستوى الأفقي)
        const horizVel = new THREE.Vector3(body.velocity.x, 0, body.velocity.z);
        const horizSpeed = horizVel.length();
        if (horizSpeed > 0.001) {
            const fricDir = horizVel.clone().negate().normalize();
            linAcc.addScaledVector(fricDir, fric / body.mass);
        }

        // تأثير Magnus (السبين يُولّد قوة جانبية خفيفة)
        // F_magnus ∝ ω × v (مُخففة)
        const magnus = new THREE.Vector3()
            .crossVectors(body.angularVelocity, body.velocity)
            .multiplyScalar(0.003 * body.radius);
        linAcc.add(magnus);

        // تخميد السبين بسبب الاحتكاك: τ = -μ · N · r
        const spinDamp = -(mu * N * body.radius) / body.inertia;
        if (body.angularVelocity.length() > 0.01) {
            angAcc.addScaledVector(body.angularVelocity.clone().normalize(), spinDamp);
        }

        return { linAcc, angAcc };
    }

    // ─────────────────────────────────────────────────────────
    // RK4 integration — للكرة فقط
    // ─────────────────────────────────────────────────────────
    _integrateRK4(body, dt) {
        // k1
        const { linAcc: a1, angAcc: aa1 } = this._computeAccelerations(body);
        const k1v  = body.velocity.clone();
        const k1av = body.angularVelocity.clone();

        // حالة مؤقتة k2
        const b2 = {
            ...body,
            position        : body.position.clone().addScaledVector(k1v,  dt * 0.5),
            velocity        : body.velocity.clone().addScaledVector(a1,   dt * 0.5),
            angularVelocity : body.angularVelocity.clone().addScaledVector(aa1, dt * 0.5)
        };
        const { linAcc: a2, angAcc: aa2 } = this._computeAccelerations(b2);
        const k2v  = b2.velocity.clone();
        const k2av = b2.angularVelocity.clone();

        // k3
        const b3 = {
            ...body,
            position        : body.position.clone().addScaledVector(k2v,  dt * 0.5),
            velocity        : body.velocity.clone().addScaledVector(a2,   dt * 0.5),
            angularVelocity : body.angularVelocity.clone().addScaledVector(aa2, dt * 0.5)
        };
        const { linAcc: a3, angAcc: aa3 } = this._computeAccelerations(b3);
        const k3v  = b3.velocity.clone();
        const k3av = b3.angularVelocity.clone();

        // k4
        const b4 = {
            ...body,
            position        : body.position.clone().addScaledVector(k3v,  dt),
            velocity        : body.velocity.clone().addScaledVector(a3,   dt),
            angularVelocity : body.angularVelocity.clone().addScaledVector(aa3, dt)
        };
        const { linAcc: a4, angAcc: aa4 } = this._computeAccelerations(b4);
        const k4v  = b4.velocity.clone();
        const k4av = b4.angularVelocity.clone();

        // تجميع — الوزن: 1/6 (k1 + 2k2 + 2k3 + k4)
        const w = dt / 6.0;
        body.position.addScaledVector(k1v,  w)
                     .addScaledVector(k2v,  w * 2)
                     .addScaledVector(k3v,  w * 2)
                     .addScaledVector(k4v,  w);

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
    // تكامل بسيط للدبابيس (Symplectic Euler كافٍ)
    // ─────────────────────────────────────────────────────────
    _integratePin(pin, dt) {
        const { linAcc } = this._computeAccelerations(pin);
        pin.velocity.addScaledVector(linAcc, dt);

        // منع السرعة من الانفجار
        const maxSpeed = 15.0;
        if (pin.velocity.length() > maxSpeed) pin.velocity.setLength(maxSpeed);

        pin.position.addScaledVector(pin.velocity, dt);

        // الأرض (y = 0 في الفيزياء = 0 في الشاشة)
        if (pin.position.y < 0) {
            pin.position.y = 0;
            pin.velocity.y = Math.abs(pin.velocity.y) * 0.2; // ارتداد ضعيف عن الأرض
            pin.velocity.x *= 0.85;
            pin.velocity.z *= 0.85;
        }
    }

    // ─────────────────────────────────────────────────────────
    // حلّ الاصطدام بين جسمين كرويين (Impulse-based)
    // ─────────────────────────────────────────────────────────
    _resolveCollision(bodyA, bodyB) {
        const diff = new THREE.Vector3().subVectors(bodyB.position, bodyA.position);
        // نتجاهل مكوّن Y للحفاظ على الدبابيس على الأرض لحين السقوط
        const diffFlat = new THREE.Vector3(diff.x, 0, diff.z);
        const dist     = diffFlat.length();
        const minDist  = bodyA.radius + bodyB.radius;

        if (dist >= minDist || dist < 0.0001) return;

        const normal = diffFlat.divideScalar(dist); // وحدة اتجاه

        // السرعة النسبية على المحور الطبيعي
        const vRel  = new THREE.Vector3().subVectors(bodyB.velocity, bodyA.velocity);
        const vRelN = vRel.dot(normal);

        // لا نُعالج الأجسام المبتعدة
        if (vRelN >= 0) {
            // فقط تصحيح التداخل
            this._separateBodies(bodyA, bodyB, normal, minDist - dist);
            return;
        }

        const e = Math.min(bodyA.restitution, bodyB.restitution);
        const invMassA = 1.0 / bodyA.mass;
        const invMassB = bodyB.isPin ? 1.0 / bodyB.mass : 0; // الكرة لا تأخذ ردة فعل كاملة
        const j = -(1.0 + e) * vRelN / (invMassA + invMassB);

        const impulse = normal.clone().multiplyScalar(j);

        // الكرة تفقد جزءاً صغيراً من سرعتها
        if (!bodyA.isPin) bodyA.velocity.addScaledVector(impulse, -invMassA * 0.15);
        bodyB.velocity.addScaledVector(impulse, invMassB);

        if (bodyB.isPin) {
            bodyB.isFallen    = true;
            bodyB.isSleeping  = false;
        }

        this._separateBodies(bodyA, bodyB, normal, minDist - dist);
    }

    _separateBodies(bodyA, bodyB, normal, penetration) {
        const correction = normal.clone().multiplyScalar(penetration * 0.5);
        if (!bodyA.isPin) bodyA.position.sub(correction.clone().multiplyScalar(0.1));
        bodyB.position.add(correction);
    }

    // ─────────────────────────────────────────────────────────
    // ضبط الكرة على الأرض (ترتد إن ضربت الأرض)
    // ─────────────────────────────────────────────────────────
    _resolveGround(body) {
        const floorY = 0.0; // 0 في الفيزياء = سطح اللين
        if (body.position.y - body.radius < floorY) {
            body.position.y = floorY + body.radius;
            if (body.velocity.y < 0) {
                body.velocity.y = -body.velocity.y * body.restitution * 0.4;
                // احتكاك أرضي إضافي عند الارتداد
                body.velocity.x *= 0.95;
                body.velocity.z *= 0.95;
            }
        }
    }

    // ─────────────────────────────────────────────────────────
    // مزامنة الـ mesh مع الفيزياء
    // ─────────────────────────────────────────────────────────
    _syncMeshes() {
        // ── الكرة ──
        if (this.ballMesh && this.ballBody) {
            // تحويل: موقع رسومي = موقع فيزيائي × SCALE
            // لكن نحتاج تعويض نقطة الأصل لأن الكرة تبدأ عند موقع رسومي ≠ 0
            const dp = new THREE.Vector3().subVectors(
                this.ballBody.position,
                this._ballPhysicsOrigin
            );
            this.ballMesh.position.x = this._ballScreenOrigin.x + dp.x * this.SCALE;
            this.ballMesh.position.y = this._ballScreenOrigin.y + dp.y * this.SCALE;
            this.ballMesh.position.z = this._ballScreenOrigin.z + dp.z * this.SCALE;

            // تدوير الكرة بناءً على الـ angular velocity
            const av = this.ballBody.angularVelocity;
            this.ballMesh.rotation.x += av.x * this.fixedDt * 0.5;
            this.ballMesh.rotation.y += av.y * this.fixedDt * 0.5;
            this.ballMesh.rotation.z += av.z * this.fixedDt * 0.5;
        }

        // ── الدبابيس ──
        this.pinsBodies.forEach((pin) => {
            if (!pin.meshRef) return;

            // حركة أفقية
            pin.meshRef.position.x = pin.position.x * this.SCALE;
            pin.meshRef.position.z = pin.position.z * this.SCALE;

            if (pin.isFallen) {
                // إمالة تدريجية نحو الأرض
                pin.meshRef.rotation.x = THREE.MathUtils.lerp(
                    pin.meshRef.rotation.x, -Math.PI / 2, 0.08
                );
                // نزول Y تدريجي
                pin.meshRef.position.y = THREE.MathUtils.lerp(
                    pin.meshRef.position.y, 0.5, 0.08
                );
            }
        });
    }

    // ─────────────────────────────────────────────────────────
    // إنهاء المحاكاة وعرض النتيجة
    // ─────────────────────────────────────────────────────────
    _endSimulation() {
        this.isSimulationActive = false;
        if (this.experience.inputPanel) {
            this.experience.inputPanel.isLaunched = false;
        }

        const fallen = this.pinsBodies.filter(p => p.isFallen).length;
        const total  = this.pinsBodies.length;
        console.log(`🎯 انتهت الرمية | سقط: ${fallen} / ${total} دبابيس`);

        setTimeout(() => {
            if (fallen === total && total === 10) {
                alert('🎉 STRIKE! أسقطت جميع الدبابيس!');
            } else if (fallen >= 7) {
                alert(`👍 رمية ممتازة! أسقطت ${fallen} من ${total} دبابيس`);
            } else {
                alert(`🎳 النتيجة: ${fallen} / ${total} دبابيس`);
            }
        }, 800);
    }

    // ─────────────────────────────────────────────────────────
    // الحلقة الرئيسية — تُستدعى من Experience.update()
    // ─────────────────────────────────────────────────────────
    update(deltaTime) {
        if (!this.isSimulationActive || !this.ballBody) return;

        // تجنّب الخطوات الضخمة (tab switch إلخ)
        this.accumulator += Math.min(deltaTime, 0.05);

        while (this.accumulator >= this.fixedDt) {
            // ── 1. تكامل الكرة ──
            if (!this.ballBody.isSleeping) {
                this._integrateRK4(this.ballBody, this.fixedDt);
                this._resolveGround(this.ballBody);

                // إيقاف الكرة إذا أصبحت بطيئة جداً (بعد الدبابيس)
                const ballSpeed = this.ballBody.velocity.length();
                if (ballSpeed < 0.05 && this.ballBody.position.z < this._ballPhysicsOrigin.z - 5) {
                    this.ballBody.isSleeping = true;
                }
            }

            // ── 2. تكامل الدبابيس + اصطدام بالكرة ──
            for (let i = 0; i < this.pinsBodies.length; i++) {
                const pin = this.pinsBodies[i];
                if (!pin.isSleeping) {
                    this._integratePin(pin, this.fixedDt);
                }
                // اصطدام دبوس ↔ كرة
                this._resolveCollision(this.ballBody, pin);
            }

            // ── 3. اصطدام الدبابيس ببعضها ──
            for (let i = 0; i < this.pinsBodies.length; i++) {
                for (let j = i + 1; j < this.pinsBodies.length; j++) {
                    const pA = this.pinsBodies[i];
                    const pB = this.pinsBodies[j];
                    if (!pA.isSleeping || !pB.isSleeping) {
                        this._resolveCollision(pA, pB);
                    }
                }
            }

            // ── 4. sleep check للدبابيس ──
            this.pinsBodies.forEach((pin) => {
                if (pin.isSleeping) return;
                if (pin.velocity.lengthSq() < 0.005 && !pin.isFallen) {
                    pin.velocity.set(0, 0, 0);
                    pin.isSleeping = true;
                }
            });

            this.accumulator -= this.fixedDt;
        }

        // ── مزامنة الرسوم ──
        this._syncMeshes();

        // ── شرط الإنهاء: الكرة تجاوزت الدبابيس بـ 10 أمتار أو توقفت ──
        const ballScreenZ = this.ballMesh ? this.ballMesh.position.z : 0;
        const allPinsSleeping = this.pinsBodies.every(p => p.isSleeping || p.isFallen);

        if (ballScreenZ < -260 || (this.ballBody.isSleeping && allPinsSleeping)) {
            this._endSimulation();
        }
    }
}
