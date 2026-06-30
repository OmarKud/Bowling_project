// ════════════════════════════════════════════════════════════
// PhysicsWorld.js
// النواة الأساسية لعالم الفيزياء: الثوابت، إنشاء الأجسام الصلبة،
// والحلقة الرئيسية يلي بتشغل كل خطوة محاكاة.
// باقي السلوك (الحركة، التصادم، التهيئة) موزع على الملفات التانية
// بنفس المجلد وبينضم كله هون عن طريق index.js.
// ════════════════════════════════════════════════════════════
import * as THREE from 'three';
import Experience from '../../Experience.js';

// المنشئ بيحمل كل القيم الثابتة المشتقة من هندسة المسار (BowlingLanes.js)
// وكمان الحالة الداخلية يلي بتتغير خلال الرمية (حالة الحفرة، تتبع الهبوط...الخ)
export default class PhysicsWorldBase {
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

        // هندسة المسار، مأخوذة مباشرة من BowlingLanes.js عشان تطابق الرسم تمامًا:
        //   laneComponentWidth = 32  -> فيزيائياً 1.6 م
        //   laneWidth          = 21  -> فيزيائياً 1.05 م
        //   gutterWidth        = 3   -> فيزيائياً 0.15 م
        //   cappingRadius      = 2.5 -> فيزيائياً 0.125 م
        // مراكز المسارات الستة رسومياً: -80,-48,-16,16,48,80
        // ونفسها فيزيائياً بعد القسمة على SCALE: -4.0,-2.4,-0.8,0.8,2.4,4.0
        this.LANE_CENTERS_PHYS = [-4.0, -2.4, -0.8, 0.8, 2.4, 4.0];
        this.LANE_HALF_WIDTH   = 21 / 2 / this.SCALE;   // 0.525 م
        this.GUTTER_WIDTH_PHYS = 3  / this.SCALE;        // 0.15 م
        this.CAPPING_RADIUS_PHYS = 2.5 / this.SCALE;     // 0.125 م
        this.GUTTER_DEPTH_PHYS   = 0.05;                 // عمق الحفرة بالمتر

        // ارتفاع سطح المسار الحقيقي بوحدات المشهد (مأخوذ من BowlingLanes.js:
        // laneGeometry height=0.2, position.y=0.2 -> السطح العلوي = 0.3).
        // قبل ما نضيف هاد الأوفسيت كانت الكرة دايمًا "تغرق" داخل خشب المسار
        // بمقدار ثابت لأن الفيزياء كانت تفترض أرضية عند y=0، وهاد الغرق كان
        // بيبين أوضح كل ما صغّرنا حجم الكرة. هاد الثابت بيصحح المرجع الصفري
        // لكل حسابات ملامسة الأرضية.
        this.LANE_SURFACE_OFFSET = 0.3 / this.SCALE; // 0.015 م

        // حالة الحفرة: مرة ما تنقفل ما بترجع تتغير لباقي الرمية
        this._gutterAlerted  = false;
        this._gutterLockedX  = null;   // الإحداثي X يلي انقفلت عليه الكرة جوا الحفرة
        this._gutterLockedXr = null;
        this._gutterLockedFloorY = 0;  // ارتفاع أرضية الحفرة

        // تتبع لحظة هبوط الكرة على المسار عشان نحسب قوة الارتطام حسب الارتفاع
        this._isFalling   = false;
        this._fallStartY  = null;
        this.lastImpactInfo = null; // { dropHeightScene, impactSpeed, impactForce }
    }
}

// إنشاء جسم صلب (Rigid Body) جديد، سواء كان كرة أو دبوس.
// كل القيم الافتراضية هون مأخوذة من القياسات الحقيقية لكرة البولينغ.
Object.assign(PhysicsWorldBase.prototype, {
    _createBody(options) {
        const mass   = options.mass   ?? 1.0;
        const radius = options.radius ?? 0.108;
        return {
            position        : options.position        ?? new THREE.Vector3(),
            velocity        : options.velocity        ?? new THREE.Vector3(),
            angularVelocity : options.angularVelocity ?? new THREE.Vector3(),
            // توجه الجسم (نقطة 4): كواتيرنيون يتبع دوران الدبوس الحقيقي
            // حول كل المحاور، أساس معيار السقوط الفعلي (tiltAngle > 12°)
            orientation     : options.orientation      ?? new THREE.Quaternion(),
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
});

// الحلقة الرئيسية للمحاكاة. بتنادى من Experience._update() كل فريم،
// وبتشتغل بخطوة زمنية ثابتة (Fixed Timestep) لتضمن نفس النتيجة بغض
// النظر عن معدل الفريمات عند المستخدم.
export const MainLoop = {
    update(deltaTime) {
        if (!this.isSimulationActive || !this.ballBody) return;

        this.accumulator += Math.min(deltaTime, 0.02);
        while (this.accumulator >= this.fixedDt) {

            if (!this.ballBody.isSleeping) {
                // لازم نتأكد من دخول الحفرة قبل ما نكمل التكامل، عشان
                // نعرف نختار المسار الصح (تكامل عادي أو تثبيت داخل الحفرة)
                this._checkGutterEntry(this.ballBody.position.x);

                if (this._gutterAlerted) {
                    // جوا الحفرة منكتفي بتقدّم الكرة على المحور Z بس
                    this._applyGutterConstraints(this.ballBody);
                    this.ballBody.position.z += this.ballBody.velocity.z * this.fixedDt;
                } else {
                    // الوضع الطبيعي: تكامل RK4 كامل + فحص ملامسة الأرضية
                    this._integrateRK4(this.ballBody, this.fixedDt);
                    this._resolveGround(this.ballBody);
                }

                // لو صارت سرعة الكرة قريبة من الصفر نخليها تنام، عشان
                // نوقف المحاكاة. الفحص هون شغال بكل الحالات (حفرة أو لأ)
                const ballSpeed = this.ballBody.velocity.length();
                if (ballSpeed < 0.05 && this.ballBody.position.z < this._ballPhysicsOrigin.z - 5) {
                    this.ballBody.isSleeping = true;
                }
            }

            // تكامل الدبابيس + تصادمها مع الكرة (الكرة جوا الحفرة ما بتصدم دبابيس)
            for (let i = 0; i < this.pinsBodies.length; i++) {
                const pin = this.pinsBodies[i];
                if (!pin.isSleeping) this._integratePin(pin, this.fixedDt);
                if (!this._gutterAlerted) this._resolveCollision(this.ballBody, pin);
            }

            // تصادم الدبابيس مع بعضها
            for (let i = 0; i < this.pinsBodies.length; i++) {
                for (let j = i + 1; j < this.pinsBodies.length; j++) {
                    const pA = this.pinsBodies[i], pB = this.pinsBodies[j];
                    if (!pA.isSleeping || !pB.isSleeping)
                        this._resolveCollision(pA, pB);
                }
            }

            // فحص سكون الدبابيس عشان نوقف حساباتها لما تستقر
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

        // شرط إنهاء الرمية: إما الكرة تجاوزت الدبابيس، أو وقفت (بالحفرة أو
        // عالمسار) والدبابيس كلها صارت نائمة أو واقعة.
        const ballScreenZ     = this.ballMesh ? this.ballMesh.position.z : 0;
        const allPinsSleeping = this.pinsBodies.every(p => p.isSleeping || p.isFallen);

        if (ballScreenZ < -260 || (this.ballBody.isSleeping && allPinsSleeping)) {
            this._endSimulation(this._gutterAlerted);
        }
    }
};