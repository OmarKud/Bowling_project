import GUI from 'lil-gui';

export default class InputPanel {
    constructor(onThrowCallback) {
        this.gui = new GUI();
        this.settings = {
            // القسم المفتوح
            startX: 20, launchAngle: 0, pushForce: 60, rpm: 300, 
            axisRotation: 45, axisTilt: 15,
            
            // القسم المغلق
            ballMass: 7.25, ballRadius: 0.108, oilDistance: 12.19,
            muOil: 0.04, muDry: 0.20, ballRestitution: 0.6,
            pinMass: 1.5, pinHeight: 0.38,
            
            throwBall: () => onThrowCallback(this.settings)
        };
        this.initPanel();
    }

    initPanel() {
        const throwFolder = this.gui.addFolder('التحكم بالرمية');
        throwFolder.add(this.settings, 'startX', 1, 39).step(1);
        throwFolder.add(this.settings, 'launchAngle', -15, 15);
        throwFolder.add(this.settings, 'pushForce', 10, 150);
        throwFolder.add(this.settings, 'rpm', 100, 600);
        throwFolder.add(this.settings, 'axisRotation', 0, 90);
        throwFolder.add(this.settings, 'axisTilt', 0, 90);

        const physFolder = this.gui.addFolder('الفيزياء (مغلق)');
        physFolder.close();
        physFolder.add(this.settings, 'ballMass', 2, 8);
        physFolder.add(this.settings, 'oilDistance', 5, 20);
        // أضف البقية هنا بنفس الطريقة...
        
        this.gui.add(this.settings, 'throwBall').name('🎳 ارمِ الكرة!');
    }
}