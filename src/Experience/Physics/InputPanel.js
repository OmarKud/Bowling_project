import * as dat from 'lil-gui';

export default class InputPanel {
    constructor(onLaunchCallback) {
        this.onLaunch = onLaunchCallback;
        this.ball = null;
        this.gui = new dat.GUI({ title: 'Bowling Physics Simulator' });
        
        // جميع المتغيرات التي طلبتها بالقيم الافتراضية
        this.parameters = {
            // Player Controls
            xStart: 16, // مثبت افتراضياً على المسار الثالث من اليمين
            yStart: 1.0,
            launchAngle: 0,
            pushForce: 250,
            rpm: 300,
            axisRotation: 45,
            axisTilt: 15,
            
            // Physics Sandbox
            ballMass: 6.8,
            ballRadius: 1.1,
            oilDistance: 12.19,
            muOil: 0.04,
            muDry: 0.20,
            restitution: 0.6,
            pinMass: 1.5,
            pinHeight: 3.8,

            launch: () => this.executeLaunch()
        };

        this.buildPanel();
    }

 buildPanel() {
        const playerControls = this.gui.addFolder('Player Controls (Throw)');
        
        // 🚨 التعديل هنا: توسيع الحدود والربط اللحظي من البانل إلى المشهد (X)
        playerControls.add(this.parameters, 'xStart', 6, 26).name('X Start (Position)').listen().onChange((value) => {
            // تحديث مكان اللاعب والكرة فوراً عند سحب السلايدر
            const interact = window.experience?.world?.playerInteraction;
            if (interact && interact.state === 'AIMING') {
                interact.camera.instance.position.x = value;
                if (interact.heldBall) interact.heldBall.position.x = value;
            }
        });

        // 🚨 التعديل هنا: رفع الـ Y إلى 5.5 والربط اللحظي (Y)
        playerControls.add(this.parameters, 'yStart', 1.9, 5.5).name('Y Start (Height)').listen().onChange((value) => {
            const interact = window.experience?.world?.playerInteraction;
            if (interact && interact.state === 'AIMING' && interact.heldBall) {
                interact.heldBall.position.y = value;
            }
        });

// استبدل السطر القديم في InputPanel.js بهذا السطر:
playerControls.add(this.parameters, 'launchAngle', -45, 45)
    .name('Launch Angle (Theta)')
    .listen() // لتحديث السلايدر تلقائياً إذا تغيرت القيمة من الكيبورد
    .onChange((value) => { // لتحديث اللعبة فوراً إذا حركت السلايدر بالماوس
        const interact = window.experience?.world?.playerInteraction;
        if (interact && interact.state === 'AIMING') {
            interact.currentLaunchAngle = value;
        }
    });// 🚨 التعديل هنا: إضافة onChange مع هندسة رياضية عكسية لحساب الـ Z بناءً على القوة
        playerControls.add(this.parameters, 'pushForce', 50, 600).name('Push Force (N)').listen().onChange((value) => {
            const interact = window.experience?.world?.playerInteraction;
            if (interact && interact.state === 'AIMING') {
                // نفس الثوابت التي استخدمناها في PlayerInteraction
                const minZ = 120;
                const maxZ = 140;
                const forceRange = 600 - 50; // 550
                
                // 🧮 المعادلة العكسية: أين يجب أن يكون الـ Z بناءً على القوة المختارة؟
                const newZ = minZ + ((value - 50) / forceRange) * (maxZ - minZ);
                
                // تحريك الكاميرا (اللاعب) للمكان الجديد
                interact.camera.instance.position.z = newZ;
                
                // تحريك الكرة لتتبع اللاعب
                if (interact.heldBall) {
                    interact.heldBall.position.z = newZ - 20;
                }
            }
        });        playerControls.add(this.parameters, 'axisRotation', 0, 90).name('Axis Rotation');
        playerControls.add(this.parameters, 'axisTilt', 0, 90).name('Axis Tilt');
        
        this.launchController = playerControls.add(this.parameters, 'launch').name('🚀 LAUNCH BALL');

        const physicsSandbox = this.gui.addFolder('Physics Sandbox').close();
        physicsSandbox.add(this.parameters, 'ballMass', 2.0, 7.5).name('Ball Mass (kg)');
        physicsSandbox.add(this.parameters, 'ballRadius', 0.5, 1.5).name('Ball Radius');
        physicsSandbox.add(this.parameters, 'oilDistance', 0.0, 18.28).name('Oil Distance (m)');
        physicsSandbox.add(this.parameters, 'muOil', 0.01, 0.1).name('μ Oil');
        physicsSandbox.add(this.parameters, 'muDry', 0.1, 0.5).name('μ Dry');
        physicsSandbox.add(this.parameters, 'restitution', 0.1, 1.0).name('Restitution');
        physicsSandbox.add(this.parameters, 'pinMass', 1.0, 2.5).name('Pin Mass (kg)');
        physicsSandbox.add(this.parameters, 'pinHeight', 2.0, 5.0).name('Pin Height');
    }

updateFromGame(x, y, force, angle) {
    // تحديث الإحداثيات
    this.parameters.xStart = parseFloat(x.toFixed(2));
    this.parameters.yStart = parseFloat(y.toFixed(2));
    
    // تحديث القوة إذا تم تمريرها
    if (force !== undefined) {
        this.parameters.pushForce = parseFloat(force.toFixed(2));
    }

    // 🚨 التعديل المطلوب: تحديث الزاوية إذا تم تمريرها
    if (angle !== undefined) {
        this.parameters.launchAngle = parseFloat(angle.toFixed(1));
    }
}
    setBall(ballMesh) {
        this.ball = ballMesh;
    }

    executeLaunch() {
        this.launchController.disable();
        
        console.log("📊 Physics Payload Sent:", this.parameters);
        if (this.onLaunch) {
            this.onLaunch(this.parameters);
        }

        setTimeout(() => {
            this.launchController.enable();
            console.log("✅ زر الإطلاق متاح الآن.");
        }, 20000);
    }
}