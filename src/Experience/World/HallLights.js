import * as THREE from 'three';

export default class HallLights {
    constructor(container, scene) {
        this.container = container;
        this.scene = scene;

        this.setAmbientAndDirectional();
        this.setCeilingSpotlights();
        this.setWallPointLights();
    }

    setAmbientAndDirectional() {
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.25);
        this.scene.add(this.ambientLight);

        this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.3);
        this.directionalLight.position.set(0, 50, 20);
        this.scene.add(this.directionalLight);
    }

    setCeilingSpotlights() {
        const totalCeilings = 4;
        const spacingX = 48;
        const startX = -72;

        for (let i = 0; i < totalCeilings; i++) {
            const xPos = startX + (i * spacingX);

            // كشافات السبوتات المخروطية القوية الموجهة للأرضية
            for (let j = 0; j < 6; j++) {
                const zPos = 90 - (j * 36);
                const spotLight = new THREE.SpotLight(0xffffff, 120, 160, Math.PI / 9, 0.4, 1);
                spotLight.position.set(xPos, 38.3, zPos); 
                spotLight.target.position.set(xPos, 0, zPos);
                
                this.scene.add(spotLight.target);
                this.scene.add(spotLight);
            }

            // (Pins Area)
            const backWallWash = new THREE.SpotLight(0xffffff, 40, 80, Math.PI / 3, 0.6, 1);
            backWallWash.position.set(xPos, 28, -125);
            backWallWash.target.position.set(xPos, 0, -130); 
            
            this.scene.add(backWallWash.target);
            this.scene.add(backWallWash);
        }
    }

    setWallPointLights() {
        const totalCeilings = 4;
        const spacingX = 48;
        const startX = -72;
        const ceilingWidth = 40;
        const lightSpacingZ = 55;

        // 1. الإضاءة السماوية العاكسة على السقف الأساسي من حواف الأسقف المعلقة
        for (let i = 0; i < totalCeilings; i++) {
            const xPos = startX + (i * spacingX);

            // القسم المسطح
            for (let j = 0; j < 4; j++) {
                const zPos = 82.5 - (j * lightSpacingZ);
                const leftPL = new THREE.PointLight(0x00ffff, 2.5, 70);
                leftPL.position.set(xPos - (ceilingWidth * 0.5) - 1, 39.5, zPos);
                this.scene.add(leftPL);

                const rightPL = new THREE.PointLight(0x00ffff, 2.5, 70);
                rightPL.position.set(xPos + (ceilingWidth * 0.5) + 1, 39.5, zPos);
                this.scene.add(rightPL);
            }

            // القسم المائل
            const slantLightLeft = new THREE.PointLight(0x00ffff, 2, 60);
            slantLightLeft.position.set(xPos - (ceilingWidth * 0.5) - 1, 34, -120);
            this.scene.add(slantLightLeft);

            const slantLightRight = new THREE.PointLight(0x00ffff, 2, 60);
            slantLightRight.position.set(xPos + (ceilingWidth * 0.5) + 1, 34, -120);
            this.scene.add(slantLightRight);
        }

        // 2. إضاءة الحوائط الجانبية القوية 
        const wallLightSpacing = 65;
        for (let i = 0; i < 4; i++) {
            const zPos = 97.5 - (i * wallLightSpacing);
            
            const leftCyanPL = new THREE.PointLight(0x00ffff, 12, 180);
            leftCyanPL.position.set(-90, 24, zPos);
            this.scene.add(leftCyanPL);
            
            const leftMagentaPL = new THREE.PointLight(0xff00ff, 12, 180);
            leftMagentaPL.position.set(-90, 14, zPos);
            this.scene.add(leftMagentaPL);
            
            const rightCyanPL = new THREE.PointLight(0x00ffff, 12, 180);
            rightCyanPL.position.set(90, 24, zPos);
            this.scene.add(rightCyanPL);
            
            const rightMagentaPL = new THREE.PointLight(0xff00ff, 12, 180);
            rightMagentaPL.position.set(90, 14, zPos);
            this.scene.add(rightMagentaPL);

            // النيون السفلي لقاعدة الأعمدة
            const leftMagentaLowerPL = new THREE.PointLight(0xff00ff, 8, 160);
            leftMagentaLowerPL.position.set(-90, 4, zPos);
            this.scene.add(leftMagentaLowerPL);

            const rightMagentaLowerPL = new THREE.PointLight(0xff00ff, 8, 160);
            rightMagentaLowerPL.position.set(90, 4, zPos);
            this.scene.add(rightMagentaLowerPL);
        }
    }
}