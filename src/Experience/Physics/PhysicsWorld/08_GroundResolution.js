// ════════════════════════════════════════════════════════════
// 08_GroundResolution.js
// حل تلامس الكرة مع أرضية المسار + تتبع ارتفاع السقوط وقوة الارتطام
// ════════════════════════════════════════════════════════════
import * as THREE from 'three';

export default {
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
};
