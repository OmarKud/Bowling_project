// ════════════════════════════════════════════════════════════
// 10_EndSimulation.js
// إنهاء المحاكاة: تكنيس الدبابيس الساقطة، احتساب النتيجة،
// وإعادة تهيئة لوحة التحكم وسهم التصويب للرمية القادمة
// ════════════════════════════════════════════════════════════
export default {
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
};
