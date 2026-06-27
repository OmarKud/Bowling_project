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
        // 📂 1. عناصر التحكم بالرمية - [مفتوح]
        const playerControls = this.gui.addFolder('Player Controls (Throw)');
        
        playerControls.add(this.parameters, 'xStart', 6, 26).name('X Start (Position)').listen();
        playerControls.add(this.parameters, 'yStart', 0.5, 2.5).name('Y Start (Height)').listen();
        playerControls.add(this.parameters, 'launchAngle', -45, 45).name('Launch Angle (Theta)');
        playerControls.add(this.parameters, 'pushForce', 50, 600).name('Push Force (N)');
        playerControls.add(this.parameters, 'rpm', 100, 700).name('Spin (RPM)');
        playerControls.add(this.parameters, 'axisRotation', 0, 90).name('Axis Rotation');
        playerControls.add(this.parameters, 'axisTilt', 0, 90).name('Axis Tilt');
        
        this.launchController = playerControls.add(this.parameters, 'launch').name('🚀 LAUNCH BALL');

        // 📂 2. الخواص الفيزيائية - [مغلق]
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

    updateFromGame(x, y) {
        this.parameters.xStart = x;
        this.parameters.yStart = y;
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