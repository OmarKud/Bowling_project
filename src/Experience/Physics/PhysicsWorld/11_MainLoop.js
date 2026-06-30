// ════════════════════════════════════════════════════════════
// 11_MainLoop.js
// الحلقة الرئيسية (Master Loop) — تُستدعى من Experience.update()
// خطوة زمنية ثابتة (Fixed Timestep) تشمل: تكامل الكرة، الحفرة،
// تكامل الدبابيس، تصادم الكرة بالدبابيس، تصادم الدبابيس ببعضها،
// فحص السكون (Sleep)، ومزامنة الرسوميات، وشرط إنهاء المحاكاة
// ════════════════════════════════════════════════════════════
export default {
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
    }
};
