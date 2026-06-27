import * as THREE from 'three';
import Experience from '../Experience.js';

export default class PhysicsWorld {
    constructor() {
        this.experience = new Experience();
        // الجاذبية: 1 متر فيزيائي يعادل 20 وحدة على الشاشة
        this.SCALE = 20.0; 
        this.gravity = new THREE.Vector3(0, -9.81, 0);
        
        this.ballBody = null;
        this.pinsBodies = [];
        this.isSimulationActive = false;
        
        this.fixedDt = 1.0 / 120.0; 
        this.accumulator = 0.0;
        this.settings = null;
    }

    createRigidBody(options) {
        return {
            position: options.position || new THREE.Vector3(),
            velocity: options.velocity || new THREE.Vector3(),
            angularVelocity: options.angularVelocity || new THREE.Vector3(),
            mass: options.mass || 1.0,
            radius: options.radius || 0.108,
            inertia: options.inertia || (0.4 * options.mass * Math.pow(options.radius, 2)),
            restitution: options.restitution || 0.6,
            isPin: options.isPin || false,
            isFallen: false,
            isSleeping: false,
            meshRef: options.meshRef || null // مرجع للـ Mesh البصري
        };
    }
initializeSimulation(settings, ballMesh, pinsMeshes) {
    this.settings = settings;
    this.ballMesh = ballMesh; // ربط مباشر بالكرة التي يحملها اللاعب
    this.pinsMeshes = pinsMeshes;
        this.accumulator = 0.0;
        this.pinsBodies = [];

        // 1. جلب الكرة الرسومية الصحيحة
        this.ballMesh = this.experience.inputPanel.ball;
        if (!this.ballMesh) {
            console.error("❌ لم يتم العثور على الكرة! التقط الكرة أولاً.");
            return;
        }

        // 2. إعداد الكرة (فيزيائياً)
        const mass = settings.ballMass; 
        const force = settings.pushForce; 
        const actualBallRadius = 0.108 * (settings.ballRadius / 1.1); 
        
        const v0 = Math.sqrt((2 * (mass * 9.81 * settings.restitution)) / mass) + (force * 0.05) / mass;
        console.log("Initial Velocity:", v0, "Angle:", settings.launchAngle);
        const radAngle = THREE.MathUtils.degToRad(settings.launchAngle || 0);

        this.ballBody = this.createRigidBody({
            // تحويل الإحداثيات الرسومية إلى أمتار فيزيائية
            position: new THREE.Vector3(this.ballMesh.position.x / this.SCALE, this.ballMesh.position.y / this.SCALE, this.ballMesh.position.z / this.SCALE), 
            // 🚨 المحور الطولي في الشاشة هو Z السالب
            velocity: new THREE.Vector3(v0 * Math.sin(radAngle), 0.0, -v0 * Math.cos(radAngle)),
            mass: mass,
            radius: actualBallRadius,
            restitution: settings.restitution,
            meshRef: this.ballMesh
        });

        // 3. إعداد الدبابيس (التي في نفس المسار فقط!)
        const allPins = this.experience.world.hall.pins.pinsArray;
        const currentLaneX = this.ballMesh.position.x;
        
        allPins.forEach((mesh) => {
            // نأخذ الدبابيس التي تبعد عن مسار اللاعب أقل من 20 وحدة فقط
            if (Math.abs(mesh.position.x - currentLaneX) < 20) {
                
                // 🚨 إصلاح اختفاء الدبابيس: نحافظ على المقياس 18 ونضربه بإعدادات البانل
                const pinScale = 18 * (settings.pinHeight / 3.8);
                mesh.scale.set(pinScale, pinScale, pinScale);
                mesh.rotation.set(0, 0, 0); // إعادة إيقاف الدبوس إذا كان واقعاً

                const actualPinRadius = 0.06 * (settings.pinHeight / 3.8);

                const pinBody = this.createRigidBody({
                    position: new THREE.Vector3(mesh.position.x / this.SCALE, mesh.position.y / this.SCALE, mesh.position.z / this.SCALE),
                    velocity: new THREE.Vector3(0, 0, 0),
                    mass: settings.pinMass,
                    radius: actualPinRadius,
                    restitution: settings.restitution,
                    isPin: true,
                    meshRef: mesh
                });
                this.pinsBodies.push(pinBody);
            }
        });

        this.isSimulationActive = true;
        console.log("🚀 انطلقت المحاكاة! الدبابيس المستهدفة:", this.pinsBodies.length);
    }

    getFrictionCoefficient(currentZ_m) {
        // حساب المسافة المقطوعة بالأمتار (الكرة تبدأ من Z=120)
        const startZ_m = 120 / this.SCALE; 
        const distanceTraveled = startZ_m - currentZ_m; 

        if (distanceTraveled < this.settings.oilDistance) return this.settings.muOil;
        return this.settings.muDry;
    }

   integrateRK4(body, dt) {
    const acc1 = this.computeForcesAndTorque(body, dt);
    const b1 = this.evaluateRK4State(body, dt * 0.5, acc1);

    const acc2 = this.computeForcesAndTorque(b1, dt);
    const b2 = this.evaluateRK4State(body, dt * 0.5, acc2);

    const acc3 = this.computeForcesAndTorque(b2, dt);
    const b3 = this.evaluateRK4State(body, dt, acc3);

    const acc4 = this.computeForcesAndTorque(b3, dt);

    body.position.addScaledVector(body.velocity.clone().addScaledVector(b1.velocity, 2.0).addScaledVector(b2.velocity, 2.0).addScaledVector(b3.velocity, 1.0), dt / 6.0);
    body.velocity.addScaledVector(acc1[0].clone().addScaledVector(acc2[0], 2.0).addScaledVector(acc3[0], 2.0).addScaledVector(acc4[0], 1.0), dt / 6.0);
    body.angularVelocity.addScaledVector(acc1[1].clone().addScaledVector(acc2[1], 2.0).addScaledVector(acc3[1], 2.0).addScaledVector(acc4[1], 1.0), dt / 6.0);
}
    resolveCollision(bodyA, bodyB) {
        const normal = new THREE.Vector3().subVectors(bodyB.position, bodyA.position);
        normal.y = 0; 
        const distance = normal.length();
        const minDistance = bodyA.radius + bodyB.radius;

        if (distance >= minDistance) return;

        normal.normalize();
        const vRel = new THREE.Vector3().subVectors(bodyB.velocity, bodyA.velocity);
        const vRelN = vRel.dot(normal);

        if (vRelN < 0) {
            const e = Math.min(bodyA.restitution, bodyB.restitution);
            const j = -(1.0 + e) * vRelN / ((1.0 / bodyA.mass) + (1.0 / bodyB.mass));
            const impulseVec = normal.clone().multiplyScalar(j);

            bodyA.velocity.subVectors(bodyA.velocity, impulseVec.clone().divideScalar(bodyA.mass));
            bodyB.velocity.addVectors(bodyB.velocity, impulseVec.clone().divideScalar(bodyB.mass));

            if (bodyB.isPin) bodyB.isSleeping = false;
        }

        // إبعاد الأجسام عن بعضها لمنع التداخل
        const penetration = minDistance - distance;
        const correction = normal.clone().multiplyScalar(penetration * 0.5);
        bodyA.position.sub(correction);
        bodyB.position.add(correction);
    }

    checkPinFallAndSleep(pin) {
        if (pin.isSleeping) return;

        // إذا تحرك الدبوس بقوة، نعتبره سقط (Fallen)
        if (!pin.isFallen && (Math.abs(pin.velocity.x) > 0.5 || Math.abs(pin.velocity.z) > 0.5)) {
            pin.isFallen = true;
        }

        if (pin.velocity.lengthSq() < 0.01) {
            pin.isSleeping = true;
            pin.velocity.set(0, 0, 0);
        }
    }

    countFallenPins() {
        return this.pinsBodies.filter(p => p.isFallen).length;
    }

    update(deltaTime) {
        if (!this.isSimulationActive) return;

        this.accumulator += Math.min(deltaTime, 0.1);

        while (this.accumulator >= this.fixedDt) {
            // 1. تحديث الكرة
            if (!this.ballBody.isSleeping) {
                this.integrateRK4(this.ballBody, this.fixedDt);
                this.resolveGroundAndBoundaries(this.ballBody);
            }

            // 2. تحديث الدبابيس والتصادم مع الكرة
            this.pinsBodies.forEach((pin) => {
                if (!pin.isSleeping) {
                    pin.position.addScaledVector(pin.velocity, this.fixedDt);
                    this.checkPinFallAndSleep(pin);
                }

                if (pin.position.distanceTo(this.ballBody.position) <= (this.ballBody.radius + pin.radius)) {
                    this.resolveCollision(this.ballBody, pin);
                }
            });

            // 3. تصادم الدبابيس ببعضها
            for (let i = 0; i < this.pinsBodies.length; i++) {
                for (let j = i + 1; j < this.pinsBodies.length; j++) {
                    const pinA = this.pinsBodies[i];
                    const pinB = this.pinsBodies[j];
                    if (!pinA.isSleeping || !pinB.isSleeping) {
                        this.resolveCollision(pinA, pinB);
                    }
                }
            }
            this.accumulator -= this.fixedDt;
        }

       // في نهاية دالة update()
if (this.ballMesh && this.ballBody) {
    // 🚨 المزامنة الصحيحة:
    // إذا كان الممر يبدأ عند Z=100 في الرسوم، والكرة تبدأ عند Z=0 في الفيزياء
    // فالمعادلة هي: Z_رسوم = 100 - (Z_فيزياء * SCALE)
    this.ballMesh.position.x = this.ballBody.position.x * this.SCALE;
    this.ballMesh.position.y = (this.ballBody.position.y * this.SCALE); 
    this.ballMesh.position.z = 100 - (this.ballBody.position.z * this.SCALE); 
    
    // تدوير الكرة (اجعل الرقم أكبر لتشعر بالحركة)
    this.ballMesh.rotation.x -= this.ballBody.velocity.z * 0.01; 
}

        this.pinsBodies.forEach((pin) => {
            if (pin.meshRef) {
                pin.meshRef.position.x = pin.position.x * this.SCALE;
                pin.meshRef.position.z = pin.position.z * this.SCALE;
                
                // أنيميشن سقوط الدبوس بسلاسة
                if (pin.isFallen) {
                    // إمالة الدبوس للوراء حتى يلتصق بالأرض (PI / 2)
                    pin.meshRef.rotation.x = THREE.MathUtils.lerp(pin.meshRef.rotation.x, -Math.PI / 2, 0.1);
                    pin.meshRef.position.y = THREE.MathUtils.lerp(pin.meshRef.position.y, 1.0, 0.1);
                }
            }
        });

        // ==========================================
        // 🛑 إنهاء المحاكاة
        // ==========================================
        // إذا تجاوزت الكرة الدبابيس (Z= -250) نوقف اللعبة
        if (this.ballMesh.position.z < -250) {
            this.isSimulationActive = false;
            this.experience.inputPanel.isLaunched = false;
            
            const fallenCount = this.countFallenPins();
            console.log(`🎯 انتهت الرمية! النتيجة: سقوط ${fallenCount} دبابيس.`);
            
            setTimeout(() => {
                alert(fallenCount === 10 ? "🎉 STRIKE! أسقطت 10 دبابيس!" : `النتيجة: أسقطت ${fallenCount} دبابيس`);
            }, 1000);
        }
    }
}