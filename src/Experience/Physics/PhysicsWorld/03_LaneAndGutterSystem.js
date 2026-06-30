// ════════════════════════════════════════════════════════════
// 03_LaneAndGutterSystem.js
// نظام المسار والحفر (Gutters)
// كشف خروج الكرة عن حدود مسارها وتطبيق قيود الانزلاق داخل الحفرة
// ════════════════════════════════════════════════════════════
import * as THREE from 'three';

export default {
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
    },

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
    },

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
};
