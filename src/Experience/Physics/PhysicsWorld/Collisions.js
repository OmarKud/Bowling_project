// ════════════════════════════════════════════════════════════
// Collisions.js
// كل شي متعلق بالتصادم: حركة الدبابيس نفسها، تصادم الأجسام
// (كرة-دبوس ودبوس-دبوس) بحفظ الزخم، وملامسة الكرة لأرضية المسار.
// ════════════════════════════════════════════════════════════
import * as THREE from 'three';

export default {
    // تكامل بسيط لحركة الدبوس: جاذبية + احتكاك هوائي خفيف + ارتداد
    // بسيط عن الأرضية. ما بنستخدم RK4 هون لأنه حركة الدبوس أبسط بكثير
    // من حركة الكرة وما بتحتاج هالدقة
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
    },

    // حل التصادم بين جسمين (كرة-دبوس أو دبوس-دبوس) عن طريق حفظ الزخم
    // الخطي ومعامل الارتداد e. منطبق على المستوى الأفقي بس (X,Z) لأنه
    // التصادم الرأسي بيتعالج بشكل منفصل بـ _resolveGround
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

        // الكرة بتتأثر أقل بكثير من اصطدامها بدبوس (وزنها أكبر بكثير)،
        // فمنخفف تأثير الدفعة عليها مقارنة بالدبوس
        if (!bodyA.isPin) bodyA.velocity.addScaledVector(impulse, -invMassA * 0.1);
        else              bodyA.velocity.addScaledVector(impulse, -invMassA);
        bodyB.velocity.addScaledVector(impulse, invMassB);

        // الدبوس بيعتبر واقع إذا الدفعة يلي أخدها كانت أكبر من عتبة معينة
        if (bodyB.isPin && Math.abs(j * invMassB) > (bodyA.isPin ? 1.2 : 0.3))
            bodyB.isFallen = true;
        if (bodyA.isPin && Math.abs(j * invMassA) > (bodyB.isPin ? 1.2 : 0.3))
            bodyA.isFallen = true;

        this._separateBodies(bodyA, bodyB, normal, minDist - dist);
    },

    // فصل الجسمين عن بعض بعد التصادم عشان ما يضلوا متداخلين فيزيائيًا
    _separateBodies(bodyA, bodyB, normal, penetration) {
        const correction = normal.clone().multiplyScalar(penetration * 0.5);
        if (!bodyA.isPin) bodyA.position.sub(correction.clone().multiplyScalar(0.1));
        bodyB.position.add(correction);
    },

    // حل ملامسة الكرة لأرضية المسار + تتبع ارتفاع السقوط وقوة الارتطام
    // عشان نعطي تأثير واقعي (كل ما زاد ارتفاع الرمية زاد الارتداد وفقدان التوازن)
    _resolveGround(body) {
        if (this._gutterAlerted) return;

        // الأرضية الصحيحة هي سطح المسار الحقيقي زائد نصف قطر الكرة. مهم
        // إنه هاد يطابق بالضبط نفس عتبة onGround المستخدمة بـ
        // _computeAccelerations (floorY + radius + 0.001)، وإلا الكرة
        // بترجرج بين onGround=true/false كل خطوة فيزياء وهالشي بيعطّل
        // تأثير الاحتكاك (وبالتالي تأثير RPM وOil Distance)
        const floorY = body.radius + this.LANE_SURFACE_OFFSET;

        // تتبع بداية الهبوط: أول لحظة تصير فيها الكرة فوق الأرضية فعليًا
        if (body.position.y > floorY + 0.001) {
            if (!this._isFalling) {
                this._isFalling  = true;
                this._fallStartY = body.position.y;
            }
        }

        if (body.position.y < floorY) {
            if (this._isFalling) {
                // لحظة الارتطام الفعلية بعد هبوط حر، منحسب تأثير الارتفاع على القوة
                const dropHeightScene = Math.max(0, (this._fallStartY - floorY)) * this.SCALE;
                const impactSpeed     = Math.abs(body.velocity.y);
                const impactForce     = body.mass * impactSpeed / this.fixedDt;

                this.lastImpactInfo = { dropHeightScene, impactSpeed, impactForce };
                console.log(
                    `هبوط الكرة | ارتفاع السقوط: ${dropHeightScene.toFixed(2)} وحدة مشهد | ` +
                    `سرعة الارتطام: ${impactSpeed.toFixed(2)} m/s | قوة الارتطام التقريبية: ${impactForce.toFixed(0)} N`
                );

                const bounceFactor = THREE.MathUtils.clamp(impactSpeed / 3.0, 0, 1);
                if (body.velocity.y < 0) {
                    body.velocity.y = -body.velocity.y * body.restitution * (0.05 + bounceFactor * 0.15);
                }

                this._isFalling = false;
            } else if (body.velocity.y < 0) {
                // امتصاص الصدمة عشان نمنع ارتداد غير مرغوب فيه بالتماس الخفيف العادي
                body.velocity.y = -body.velocity.y * body.restitution * 0.1;
            }

            body.position.y = floorY;
        }
    }
};
