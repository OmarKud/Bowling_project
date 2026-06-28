import * as dat from 'lil-gui';

export default class InputPanel {
    constructor(onLaunchCallback) {
        this.onLaunch = onLaunchCallback;
        this.ball     = null;
        // ← الفلاغ الذي يُفعّل update() في Experience.js
        this.isLaunched = false;

        this.gui = new dat.GUI({ title: 'Bowling Physics Simulator' });

        this.parameters = {
            // ── Player Controls ──────────────────────────────────
            xStart      : 16,    // المسار الثالث من اليمين (X=16)
            yStart      : 2.5,
            launchAngle : 0,     // درجات، −45 .. +45
            pushForce   : 250,   // N
            rpm         : 300,   // دورة/دقيقة
            axisRotation: 45,    // درجة دوران المحور (0=مستقيم)
            axisTilt    : 15,    // ميلان المحور

            // ── Physics Sandbox ───────────────────────────────────
            ballMass    : 6.8,   // kg
            ballRadius  : 1.1,   // وحدة نسبية (1.1 = افتراضي)
            oilDistance : 12.19, // m
            muOil       : 0.04,
            muDry       : 0.20,
            restitution : 0.6,
            pinMass     : 1.5,   // kg
            pinHeight   : 3.8,

            launch: () => this._executeLaunch(),
            resetPins: () => this._resetPins()
        };

        this._buildPanel();
    }

    // ─────────────────────────────────────────────────────────
    // بناء واجهة lil-gui
    // ─────────────────────────────────────────────────────────
    _buildPanel() {
        // ── Player Controls ──────────────────────────────────────
        const player = this.gui.addFolder('Player Controls (Throw)');

        player.add(this.parameters, 'xStart', 6, 26)
            .name('X Start (Position)')
            .listen()
            .onChange((value) => {
                const interact = window.experience?.world?.playerInteraction;
                if (interact?.state === 'AIMING') {
                    interact.camera.instance.position.x = value;
                    if (interact.heldBall) interact.heldBall.position.x = value;
                }
            });

        player.add(this.parameters, 'yStart', 1.9, 5.5)
            .name('Y Start (Height)')
            .listen()
            .onChange((value) => {
                const interact = window.experience?.world?.playerInteraction;
                if (interact?.state === 'AIMING' && interact.heldBall) {
                    interact.heldBall.position.y = value;
                }
            });

        player.add(this.parameters, 'launchAngle', -45, 45)
            .name('Launch Angle (°)')
            .listen()
            .onChange((value) => {
                const interact = window.experience?.world?.playerInteraction;
                if (interact?.state === 'AIMING') {
                    interact.currentLaunchAngle = value;
                }
            });

        player.add(this.parameters, 'pushForce', 50, 600)
            .name('Push Force (N)')
            .listen()
            .onChange((value) => {
                const interact = window.experience?.world?.playerInteraction;
                if (interact?.state === 'AIMING') {
                    // إعادة تعيين Z بناءً على القوة (منطق عكسي لما في PlayerInteraction)
                    const newZ = 120 + ((value - 50) / 550) * 20;
                    interact.camera.instance.position.z = newZ;
                    if (interact.heldBall) interact.heldBall.position.z = newZ - 20;
                }
            });

        player.add(this.parameters, 'rpm', 0, 600)
            .name('Spin RPM');

        player.add(this.parameters, 'axisRotation', 0, 90)
            .name('Axis Rotation (°)');

        player.add(this.parameters, 'axisTilt', 0, 45)
            .name('Axis Tilt (°)');

        this._launchController = player.add(this.parameters, 'launch')
            .name('🚀 LAUNCH BALL');

        player.add(this.parameters, 'resetPins')
            .name('🔄 Reset Pins');

        // ── Physics Sandbox ──────────────────────────────────────
        const sandbox = this.gui.addFolder('Physics Sandbox').close();
        sandbox.add(this.parameters, 'ballMass',    2.0, 7.5 ).name('Ball Mass (kg)');
        sandbox.add(this.parameters, 'ballRadius',  0.5, 1.5 ).name('Ball Radius');
        sandbox.add(this.parameters, 'oilDistance', 0.0, 18.28).name('Oil Distance (m)');
        sandbox.add(this.parameters, 'muOil',       0.01, 0.1 ).name('μ Oil');
        sandbox.add(this.parameters, 'muDry',       0.1,  0.5 ).name('μ Dry');
        sandbox.add(this.parameters, 'restitution', 0.1,  1.0 ).name('Restitution');
        sandbox.add(this.parameters, 'pinMass',     1.0,  2.5 ).name('Pin Mass (kg)');
        sandbox.add(this.parameters, 'pinHeight',   2.0,  5.0 ).name('Pin Height');
    }

    // ─────────────────────────────────────────────────────────
    // تُستدعى من PlayerInteraction لمزامنة البانل مع حركة اللاعب
    // ─────────────────────────────────────────────────────────
    updateFromGame(x, y, force, angle) {
        this.parameters.xStart = parseFloat(x.toFixed(2));
        this.parameters.yStart = parseFloat(y.toFixed(2));
        if (force !== undefined) this.parameters.pushForce = parseFloat(force.toFixed(1));
        if (angle !== undefined) this.parameters.launchAngle = parseFloat(angle.toFixed(1));
    }

    // ─────────────────────────────────────────────────────────
    // ربط الكرة الرسومية (يُستدعى من PlayerInteraction عند الدخول لوضع التصويب)
    // ─────────────────────────────────────────────────────────
    setBall(ballMesh) {
        this.ball = ballMesh;
    }

    // ─────────────────────────────────────────────────────────
    // تنفيذ الإطلاق
    // ─────────────────────────────────────────────────────────
    _executeLaunch() {
        // التحقق من وجود الكرة قبل الإطلاق
        if (!this.ball) {
            console.warn('⚠️ لم يتم ربط الكرة بعد. ادخل وضع التصويب (ENTER) أولاً.');
            return;
        }

        if (this.isLaunched) {
            console.warn('⚠️ المحاكاة تعمل بالفعل.');
            return;
        }

        this._launchController.disable();
        console.log('📊 إعدادات الإطلاق:', { ...this.parameters, launch: '[fn]' });

        // تمرير نسخة من الإعدادات لمنع التعديل بعد الإطلاق
        if (this.onLaunch) {
            this.onLaunch({ ...this.parameters });
        }

        // إعادة تفعيل الزر بعد انتهاء المحاكاة (20 ثانية كحد أقصى)
        const reEnable = () => {
            if (!this.isLaunched) {
                this._launchController.enable();
                console.log('✅ جاهز للرمية التالية.');
            } else {
                setTimeout(reEnable, 1000);
            }
        };
        setTimeout(reEnable, 3000);
    }

    // ─────────────────────────────────────────────────────────
    // إعادة ترتيب الدبابيس — تُستدعى من زر GUI
    // ─────────────────────────────────────────────────────────
    _resetPins() {
        const pinsObj = window.experience?.world?.hall?.pins;
        if (!pinsObj) {
            console.warn('⚠️ Pins not available yet.');
            return;
        }
        pinsObj.resetPins();
        console.log('🔄 Pins reset to initial positions.');
    }
}