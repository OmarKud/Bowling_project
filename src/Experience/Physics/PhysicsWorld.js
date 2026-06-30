import * as THREE from 'three';
import Experience from '../Experience.js';

export default class PhysicsWorld {
    constructor() {
        this.experience = new Experience();
        this.SCALE = 20.0;
        this.gravity = -9.81;
        this.PIN_HEIGHT = 3.8;
        this.ballBody  = null;
        this.pinsBodies = [];
        this.isSimulationActive = false;
        this.currentLaneIndex = 0;
        this.fixedDt    = 1.0 / 120.0;
        this.accumulator = 0.0;
        this.settings   = null;
        this.ballMesh   = null;

        // ══════════════════════════════════════════════════════
        // هندسة المسار — مستخرجة مباشرة من BowlingLanes.js
        //   laneComponentWidth = 32  → فيزيائياً 1.6 م
        //   laneWidth          = 21  → فيزيائياً 1.05 م
        //   gutterWidth        = 3   → فيزيائياً 0.15 م
        //   cappingRadius      = 2.5 → فيزيائياً 0.125 م
        //   مراكز الـ6 مسارات رسومياً: -80,-48,-16,16,48,80
        //   فيزيائياً: -4.0,-2.4,-0.8,0.8,2.4,4.0
        // ══════════════════════════════════════════════════════
        this.LANE_CENTERS_PHYS = [-4.0, -2.4, -0.8, 0.8, 2.4, 4.0];
        this.LANE_HALF_WIDTH   = 21 / 2 / this.SCALE;   // 0.525 م
        this.GUTTER_WIDTH_PHYS = 3  / this.SCALE;        // 0.15 م
        this.CAPPING_RADIUS_PHYS = 2.5 / this.SCALE;     // 0.125 م
        this.GUTTER_DEPTH_PHYS   = 0.05;                 // عمق الحفرة (م)

        // ══════════════════════════════════════════════════════
        // 🌟 ارتفاع سطح المسار الحقيقي في المشهد (Scene Units)
        // مأخوذ من BowlingLanes.js: laneGeometry height=0.2, position.y=0.2
        //   → سطح المسار العلوي = 0.2 + 0.2/2 = 0.3 (وحدة مشهد)
        // الفيزياء كانت تفترض أرضية عند y=0 دائماً، فكانت الكرة
        // "تغرق" داخل خشب المسار بمقدار ثابت (0.3) بغض النظر عن نصف قطرها،
        // وكلما صغّرنا الكرة كان الغرق الظاهري أوضح نسبةً لحجمها.
        // هاد الثابت بيصحح المرجع الصفري لكل حسابات الأرضية فيزيائياً.
        // ══════════════════════════════════════════════════════
        this.LANE_SURFACE_OFFSET = 0.3 / this.SCALE; // 0.015 م

        // ── حالة الحفرة (تُقفل عند الدخول ولا تتغير) ──
        this._gutterAlerted  = false;
        this._gutterLockedX  = null;   // X مقفول داخل الحفرة
        this._gutterLockedXr = null;   // null حتى يُقفل
        this._gutterLockedFloorY = 0;  // Y أرضية الحفرة

        // ── تتبع الهبوط (سقوط الكرة على المسار) لإظهار تأثير الارتفاع على قوة الارتطام ──
        this._isFalling   = false;
        this._fallStartY  = null;
        this.lastImpactInfo = null; // { dropHeightScene, impactSpeed, impactForce }
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
    }initializeSimulation(settings, _ballMesh, _pinsMeshes) {
        this.settings    = settings;
        this.accumulator = 0.0;
        this.pinsBodies  = [];

        this._gutterAlerted      = false;
        this._gutterLockedX      = null;
        this._gutterLockedFloorY = 0;

        // ريسيت تتبع الهبوط لكل رمية جديدة
        this._isFalling     = false;
        this._fallStartY    = null;
        this.lastImpactInfo = null;

        this.ballMesh = this.experience.inputPanel.ball;
        if (!this.ballMesh) return;

        const mass       = settings.ballMass;
        const scaleRatio = settings.ballRadius / 1.1;
        const radius     = 0.108 * scaleRatio; // نصف القطر الفيزيائي

        const DEFAULT_BALL_SCALE = 2.7;
        const ballScale = DEFAULT_BALL_SCALE * scaleRatio;
        this.ballMesh.scale.set(ballScale, ballScale, ballScale);

        // 🌟 إرجاع الأوفسيت الإجباري لمنع الغرق!
        // يحسب الفرق بين الحجم الرسومي (2.7) والحجم الفيزيائي (2.16)
        const scaledPhysicsRadius = 0.108 * this.SCALE; // 2.16
        this.visualRadiusOffset = (DEFAULT_BALL_SCALE - scaledPhysicsRadius) * scaleRatio;

        const force   = settings.pushForce;
        const angle   = THREE.MathUtils.degToRad(settings.launchAngle);

        const Ek      = 40.0;
        const delta_t = 0.15;
        const v0      = Math.sqrt((2 * Ek) / mass) + ((force * delta_t) / mass);
        const vx      = v0 * Math.sin(angle);
        const vz      = -v0 * Math.cos(angle);

        // خصم الإزاحة الرسومية لتبدأ الفيزياء من النقطة الصحيحة
        const physicsVisualY = this.ballMesh.position.y - this.visualRadiusOffset;

        // 🌟 الحد الأدنى لارتفاع البداية الآن radius + LANE_SURFACE_OFFSET
        // (مرجع الأرضية الفيزيائي الصحيح) بدل radius فقط، عشان ما تبلش الكرة وهي غاطسة بالخشب
        const minStartY = radius + this.LANE_SURFACE_OFFSET;

        const startPosPhysics = new THREE.Vector3(
            this.ballMesh.position.x / this.SCALE,
            Math.max(physicsVisualY / this.SCALE, minStartY), 
            this.ballMesh.position.z / this.SCALE
        );

        this.currentLaneIndex = this._getLaneIndexFromX(startPosPhysics.x);
        this.experience.world?.hall?.bowlingScreens?.resetLaneDisplay?.(this.currentLaneIndex);

        this._ballScreenOrigin   = this.ballMesh.position.clone();
        this._ballScreenOrigin.y = radius * this.SCALE;
        this._ballPhysicsOrigin  = startPosPhysics.clone();

        const omega    = (2 * Math.PI * settings.rpm) / 60.0;
        const axisRot  = THREE.MathUtils.degToRad(settings.axisRotation);
        const axisTilt = THREE.MathUtils.degToRad(settings.axisTilt);
        const spinAxis = new THREE.Vector3(
            Math.sin(axisRot) * Math.cos(axisTilt),
            Math.sin(axisTilt),
            Math.cos(axisRot) * Math.cos(axisTilt)
        ).normalize();

        this.ballBody = this._createBody({
            position       : startPosPhysics,
            velocity       : new THREE.Vector3(vx, 0, vz),
            angularVelocity: spinAxis.multiplyScalar(omega),
            mass,
            radius,
            restitution    : settings.restitution,
            meshRef        : this.ballMesh
        });

        console.log(`🎳 Ball Launch | v0: ${v0.toFixed(2)} m/s | angle: ${settings.launchAngle}° | startY: ${startPosPhysics.y.toFixed(3)} m | radius: ${radius.toFixed(3)} m`);

        const allPins = this.experience.world?.hall?.pins?.pinsArray;
        if (allPins) {
            const currentLaneX = this.ballMesh.position.x;
            const pinRadius    = 0.110 * (this.PIN_HEIGHT / 3.8);

            allPins.forEach((mesh) => {
                if (Math.abs(mesh.position.x - currentLaneX) >= 16) return;
                if (mesh.userData.isFallen) return;

                const pinScale = 18 * (this.PIN_HEIGHT / 3.8);
                mesh.scale.set(pinScale, pinScale, pinScale);
                mesh.rotation.set(0, 0, 0);
                mesh.position.y = this.PIN_HEIGHT;

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

        this.isSimulationActive          = true;
        this.experience.inputPanel.isLaunched = true;
    }

    // ══════════════════════════════════════════════════════════
    // نظام المسار والحفر
    // ══════════════════════════════════════════════════════════

    // المسار الذي انطلقت منه الكرة (يُحسب مرة واحدة فقط)
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
    }

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
    }

    // ─────────────────────────────────────────────────────────
    // هل الكرة تجاوزت حدود مسارها الأصلي؟
    // يعمل بناءً على مسار البداية فقط — لا يتغير
    // ─────────────────────────────────────────────────────────
  _checkGutterEntry(ballX) {
        if (this._gutterAlerted) return; // مقفول بالفعل

        const lane = this._getStartLane();
        
        // ❌ تم حذف شرط الـ 1.5 متر الذي كان يعمي المحرك!
        // وضعنا 0.1 متر فقط لتجنب وقوع الكرة وهي ما زالت في يد اللاعب
        const pastStart = this.ballBody.position.z < this._ballPhysicsOrigin.z - 0.1;
        if (!pastStart) return;

        // أي إحداثيات خارج حدود الخشب تُعتبر سقوطاً في الحفرة فوراً
        const inLeftGutter  = ballX < lane.laneLeft;
        const inRightGutter = ballX > lane.laneRight;

        if (inLeftGutter || inRightGutter) {
            // ── دخلت الحفرة — قفّل الحالة الآن ──
            this._gutterAlerted      = true;
            this._gutterLockedX      = ballX;                         
            // 🌟 أرضية الحفرة الآن نسبة لسطح المسار الحقيقي (LANE_SURFACE_OFFSET) ناقص عمقها
            this._gutterLockedFloorY = this.LANE_SURFACE_OFFSET - this.GUTTER_DEPTH_PHYS;     
            console.log(`🚫 Gutter Ball! x=${ballX.toFixed(3)} | side=${inLeftGutter ? 'LEFT' : 'RIGHT'}`);
        }
    }

  // ─────────────────────────────────────────────────────────
    // تطبيق قيود الحفرة (مُعدلة: انزلاق واقعي نحو قاع الحفرة المقعر)
    // ─────────────────────────────────────────────────────────
 _applyGutterConstraints(body) {
        const lane = this._getStartLane();
        const isLeftGutter = body.position.x < lane.center;
        
        const gutterCenter = isLeftGutter 
            ? lane.center - this.LANE_HALF_WIDTH - (this.GUTTER_WIDTH_PHYS / 2)
            : lane.center + this.LANE_HALF_WIDTH + (this.GUTTER_WIDTH_PHYS / 2);

        // 1. سحب الكرة بقوة أكبر لقاع الحفرة لمنعها من تسلق الجدار والهرب
        const diffX = gutterCenter - body.position.x;
        body.velocity.x = diffX * 8.0; 
        body.position.x += body.velocity.x * this.fixedDt;

        // 2. قفل أمني (Hard Clamp): يمنع الكرة من العودة للممر أو القفز للمسار المجاور مهما بلغت سرعتها
        if (isLeftGutter) {
            if (body.position.x > lane.laneLeft) body.position.x = lane.laneLeft - 0.01;
        } else {
            if (body.position.x < lane.laneRight) body.position.x = lane.laneRight + 0.01;
        }

        // 3. قفل Y على قاع الحفرة
        const floorY = this._gutterLockedFloorY + body.radius;
        if (body.position.y < floorY || body.velocity.y < 0) {
            body.position.y = floorY;
            body.velocity.y = 0;
        }

        body.angularVelocity.set(0, 0, 0);
        body.velocity.z *= 0.999; 
    }
    // ─────────────────────────────────────────────────────────
    // قوة حافة المسار الأصلي فقط (للكرة قبل دخول الحفرة)
    // ─────────────────────────────────────────────────────────
    _computeGutterForce(body) {
        const force = new THREE.Vector3(0, 0, 0);
        if (this._gutterAlerted) return force; // بعد الدخول لا نضيف قوة

        const lane  = this._getStartLane();
        const bx    = body.position.x;

        // ── حافة يسار ──
        const dxLeft = bx - lane.laneLeft;
        if (dxLeft < 0 && dxLeft > -this.GUTTER_WIDTH_PHYS) {
            // داخل الحفرة اليسرى — جدارها الخارجي
            const wallX   = lane.gutterLeft;
            const distW   = bx - wallX;
            const minCl   = this.CAPPING_RADIUS_PHYS + body.radius;
            if (distW < minCl) {
                const pen  = minCl - distW;
                force.x   += pen * 120.0;
                if (body.velocity.x < 0) body.velocity.x *= 0.05;
            }
        }

        // ── حافة يمين ──
        const dxRight = lane.laneRight - bx;
        if (dxRight < 0 && dxRight > -this.GUTTER_WIDTH_PHYS) {
            // داخل الحفرة اليمنى — جدارها الخارجي
            const wallX   = lane.gutterRight;
            const distW   = wallX - bx;
            const minCl   = this.CAPPING_RADIUS_PHYS + body.radius;
            if (distW < minCl) {
                const pen  = minCl - distW;
                force.x   -= pen * 120.0;
                if (body.velocity.x > 0) body.velocity.x *= 0.05;
            }
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

        const gutterForce = this._computeGutterForce(body);
        linAcc.x += gutterForce.x / body.mass;

        return { linAcc, angAcc };
    }

    // ─────────────────────────────────────────────────────────
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

    // ─────────────────────────────────────────────────────────
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
    }

    _separateBodies(bodyA, bodyB, normal, penetration) {
        const correction = normal.clone().multiplyScalar(penetration * 0.5);
        if (!bodyA.isPin) bodyA.position.sub(correction.clone().multiplyScalar(0.1));
        bodyB.position.add(correction);
    }

    // ─────────────────────────────────────────────────────────
    // ...existing code...
// ...existing code...
_resolveGround(body) {
    if (this._gutterAlerted) return;

    // 🌟 الأرضية الصحيحة = سطح المسار الحقيقي (LANE_SURFACE_OFFSET) + نصف القطر.
    // مهم: هاد لازم يطابق بالضبط نفس threshold الـ onGround المستخدم بـ
    // _computeAccelerations (floorY + radius + 0.001)، وإلا الكرة بترتجف بين
    // onGround=true/false كل خطوة فيزياء، وهالشي كان يعطّل تأثير الاحتكاك
    // (وبالتالي RPM وOil Distance) لأنه friction بس بتنطبق لما onGround=true.
    const floorY = body.radius + this.LANE_SURFACE_OFFSET;

    // ── تتبّع بداية الهبوط (أول لحظة تصبح فيها الكرة فوق الأرضية فعلياً) ──
    if (body.position.y > floorY + 0.001) {
        if (!this._isFalling) {
            this._isFalling  = true;
            this._fallStartY = body.position.y;
        }
    }

    if (body.position.y < floorY) {
        if (this._isFalling) {
            // 🌟 لحظة الارتطام الفعلية بعد هبوط حر — نحسب تأثير الارتفاع على القوة
            const dropHeightScene = Math.max(0, (this._fallStartY - floorY)) * this.SCALE; // بوحدات المشهد
            const impactSpeed     = Math.abs(body.velocity.y);                              // m/s
            const impactForce     = body.mass * impactSpeed / this.fixedDt;                 // تقريب القوة اللحظية (نيوتن)

            this.lastImpactInfo = { dropHeightScene, impactSpeed, impactForce };
            console.log(
                `⬇️ هبوط الكرة (Y) | ارتفاع السقوط: ${dropHeightScene.toFixed(2)} وحدة مشهد | ` +
                `سرعة الارتطام: ${impactSpeed.toFixed(2)} m/s | قوة الارتطام التقريبية: ${impactForce.toFixed(0)} N`
            );

            // 🌟 كلما زاد الارتفاع (وبالتالي سرعة الارتطام) زاد الارتداد وفقدان التوازن قليلاً — تأثير واقعي
            const bounceFactor = THREE.MathUtils.clamp(impactSpeed / 3.0, 0, 1);
            if (body.velocity.y < 0) {
                body.velocity.y = -body.velocity.y * body.restitution * (0.05 + bounceFactor * 0.15);
            }

            this._isFalling = false;
        } else if (body.velocity.y < 0) {
            // امتصاص الصدمة (Damping) لمنع الارتداد غير المرغوب فيه عند التماس الخفيف العادي
            body.velocity.y = -body.velocity.y * body.restitution * 0.1;
        }

        body.position.y = floorY;
    }
}
_syncMeshes() {
    if (this.ballMesh && this.ballBody) {
        const dp = new THREE.Vector3().subVectors(
            this.ballBody.position, this._ballPhysicsOrigin
        );

        this.ballMesh.position.x = this._ballScreenOrigin.x + dp.x * this.SCALE;

        // كان يسبب الغرق البصري
        this.ballMesh.position.y =
            (this.ballBody.position.y * this.SCALE) + this.visualRadiusOffset;

        this.ballMesh.position.z = this._ballScreenOrigin.z + dp.z * this.SCALE;

        if (!this._gutterAlerted) {
            const av = this.ballBody.angularVelocity;
            this.ballMesh.rotation.x += av.x * this.fixedDt * 0.5;
            this.ballMesh.rotation.y += av.y * this.fixedDt * 0.5;
            this.ballMesh.rotation.z += av.z * this.fixedDt * 0.5;
        }
    }
    // ...existing code...


        this.pinsBodies.forEach((pin) => {
            if (!pin.meshRef) return;
            pin.meshRef.position.x = pin.position.x * this.SCALE;
            pin.meshRef.position.z = pin.position.z * this.SCALE;

            if (pin.isFallen) {
                const targetRot = -Math.PI / 2;
                const diff      = targetRot - pin.meshRef.rotation.x;
                if (Math.abs(diff) > 0.01) pin.meshRef.rotation.x += diff * 0.18;
                else                        pin.meshRef.rotation.x  = targetRot;
                const yDiff = 0.0 - pin.meshRef.position.y;
                if (Math.abs(yDiff) > 0.05) pin.meshRef.position.y += yDiff * 0.18;
                else                         pin.meshRef.position.y  = 0.0;
            }
        });
   }

    // ─────────────────────────────────────────────────────────
    // إنهاء المحاكاة (مُعدلة: تكنيس الدبابيس للرمية الثانية وإرجاع السهم)
    // ─────────────────────────────────────────────────────────
    _endSimulation(isGutterBall = false) {
        this.isSimulationActive  = false;
        this._gutterAlerted      = false;
        this._gutterLockedX      = null;
        this._startLane          = null;   // reset للرمية القادمة

        // إعادة تفعيل لوحة التحكم
        if (this.experience.inputPanel) {
            this.experience.inputPanel.isLaunched = false;
        }

        // إرجاع سهم التصويب للرمية القادمة
        if (this.experience.world?.playerInteraction) {
            if(typeof this.experience.world.playerInteraction.restoreAimArrow === 'function') {
                this.experience.world.playerInteraction.restoreAimArrow();
            }
        }

        let newlyFallen = 0;

        // ── التكنيس الآلي (Sweep) ──
        // نقل حالة السقوط من الفيزياء إلى الموديل الرسومي لإخفائه في الرمية القادمة
        this.pinsBodies.forEach((pin) => {
            if (pin.isFallen && pin.meshRef) {
                newlyFallen++;
                // حفظ حالة السقوط في الموديل الرسومي
                pin.meshRef.userData.isFallen = true; 
                // إخفاء الدبوس لمحاكاة سحبه بالماكينة
                pin.meshRef.visible = false; 
            }
        });

        // حساب إجمالي الدبابيس الساقطة (الرمية الأولى + الثانية)
        const allPins = this.experience.world?.hall?.pins?.pinsArray || [];
        const totalFallen = allPins.filter(m => m.userData.isFallen).length;

        console.log(`🎯 انتهت الرمية | سقط الآن: ${newlyFallen} | الإجمالي: ${totalFallen}/10 | Gutter: ${isGutterBall}`);

        setTimeout(() => {
            this.experience.world?.hall?.bowlingScreens?.showResultForLane?.(this.currentLaneIndex, {
                newlyFallen,
                totalFallen,
                isGutterBall
            });
        }, 800);
    }

    // ─────────────────────────────────────────────────────────
   // ─────────────────────────────────────────────────────────
    // الحلقة الرئيسية — تُستدعى من Experience.update()
    // ─────────────────────────────────────────────────────────
    update(deltaTime) {
        if (!this.isSimulationActive || !this.ballBody) return;

this.accumulator += Math.min(deltaTime, 0.02);
        while (this.accumulator >= this.fixedDt) {

            if (!this.ballBody.isSleeping) {
                // ── كشف دخول الحفرة قبل التكامل ──
                this._checkGutterEntry(this.ballBody.position.x);

                if (this._gutterAlerted) {
                    // ── وضع الحفرة: فقط تقدّم على Z ──
                    this._applyGutterConstraints(this.ballBody);
                    this.ballBody.position.z += this.ballBody.velocity.z * this.fixedDt;
                } else {
                    // ── وضع طبيعي ──
                    this._integrateRK4(this.ballBody, this.fixedDt);
                    this._resolveGround(this.ballBody);
                }

                // ── التعديل هنا: تم نقل فحص السكون لخارج الـ else ليعمل على الحفرة أيضاً ──
                // إذا أصبحت الكرة بطيئة جداً (توقفت)، نجعلها تنام لتنتهي المحاكاة
                const ballSpeed = this.ballBody.velocity.length();
                if (ballSpeed < 0.05 && this.ballBody.position.z < this._ballPhysicsOrigin.z - 5) {
                    this.ballBody.isSleeping = true;
                }
            }

            // ── دبابيس + تصادم (الكرة في الحفرة لا تصطدم بالدبابيس) ──
            for (let i = 0; i < this.pinsBodies.length; i++) {
                const pin = this.pinsBodies[i];
                if (!pin.isSleeping) this._integratePin(pin, this.fixedDt);
                if (!this._gutterAlerted) this._resolveCollision(this.ballBody, pin);
            }

            // ── تصادم دبابيس ببعضها ──
            for (let i = 0; i < this.pinsBodies.length; i++) {
                for (let j = i + 1; j < this.pinsBodies.length; j++) {
                    const pA = this.pinsBodies[i], pB = this.pinsBodies[j];
                    if (!pA.isSleeping || !pB.isSleeping)
                        this._resolveCollision(pA, pB);
                }
            }

            // ── sleep check للدبابيس ──
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

        // ── شرط الإنهاء ──
        const ballScreenZ     = this.ballMesh ? this.ballMesh.position.z : 0;
        const allPinsSleeping = this.pinsBodies.every(p => p.isSleeping || p.isFallen);

        // تنتهي المحاكاة إذا تجاوزت الكرة الدبابيس، أو (إذا توقفت الكرة في الحفرة والدبابيس نائمة)
        if (ballScreenZ < -260 || (this.ballBody.isSleeping && allPinsSleeping)) {
            this._endSimulation(this._gutterAlerted);
        }
    }}