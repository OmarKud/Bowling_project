// ════════════════════════════════════════════════════════════
// 00_Constructor.js
// المنشئ (Constructor) + كل الثوابت الفيزيائية والهندسية للعالم
// (Physical Constants + Lane/Gutter Geometry + Internal State)
// ════════════════════════════════════════════════════════════
import * as THREE from 'three';
import Experience from '../../Experience.js';

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
}
