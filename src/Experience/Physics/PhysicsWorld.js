import RigidBody from './RigidBody.js';

export default class PhysicsWorld {
    constructor() {
        this.ball = null;
        this.pins = [];
        this.isActive = false;
        this.fixedDt = 1.0 / 120.0; // تردد المحرك الفيزيائي 120Hz
    }

    /**
     * دالة التهيئة: تستقبل إعدادات اللاعب من الـ Panel وتحولها لفيزياء
     */
    initializeSimulation(settings) {
        console.log("🚀 بدء المحاكاة بالقيم:", settings);

        // 1. إنشاء الكرة بناءً على الخصائص الفيزيائية من الـ Panel
        this.ball = new RigidBody(settings.ballMass, settings.ballRadius, false);

        // 2. تحديد نقطة البداية (X) والارتفاع (Y/Z)
        // ملاحظة: الارتفاع نثبته لنصف القطر كما اتفقنا
        this.ball.position.set(
            settings.startX * 0.027, 
            settings.releaseHeight, // الارتفاع من الـ Panel
            0 
        );

        // 3. حساب السرعة الخطية الابتدائية (من قوة الدفع والزاوية)
        const v0 = settings.pushForce / settings.ballMass;
        const angleRad = (settings.launchAngle * Math.PI) / 180;
        
        this.ball.velocity.set(
            v0 * Math.sin(angleRad),
            0,
            -v0 * Math.cos(angleRad)
        );

        // 4. تحويل الـ RPM وزوايا الدوران إلى سرعة زاوية (Angular Velocity)
        const omegaMag = settings.rpm * ((2 * Math.PI) / 60);
        // هنا يتم دمج AxisRotation و AxisTilt لتوزيع الدوران على المحاور
        const rotRad = (settings.axisRotation * Math.PI) / 180;
        const tiltRad = (settings.axisTilt * Math.PI) / 180;

        this.ball.angularVelocity.set(
            omegaMag * Math.cos(tiltRad) * Math.sin(rotRad),
            omegaMag * Math.sin(tiltRad),
            omegaMag * Math.cos(tiltRad) * Math.cos(rotRad)
        );

        this.isActive = true;
    }

    /**
     * الحلقة الرئيسية للفيزياء (تُستدعى في كل إطار)
     */
    stepSimulation() {
        if (!this.isActive) return;

        // هنا سيقوم كل شخص منكم بإضافة "جزئيته" في المكان المناسب:
        
        // 1. حساب القوى (الشخص 2):
        // computeForces(this.ball, this.fixedDt);

        // 2. التكامل العددي (الشخص 1):
        // integrateRK4(this.ball, this.fixedDt);

        // 3. حل التصادم (الشخص 3):
        // resolveCollision(this.ball, this.pins);
    }
}