import * as THREE from 'three';

export default class HallLights {
    constructor(container, scene) {
        this.container = container;
        this.scene = scene;

        this.setAmbientAndDirectional();
        this.setCeilingSpotlights();
        this.setWallPointLights();
        this.setFrontGridLights(); // استدعاء الإضاءة الساقطة الحادة للمقدمة باللون النهدي
    }

    setAmbientAndDirectional() {
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
        this.scene.add(this.ambientLight);

        this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
        this.directionalLight.position.set(0, 70, 40);
        this.scene.add(this.directionalLight);
    }

    setCeilingSpotlights() {
        const totalCeilings = 4;
        const spacingX = 48;
        const startX = -72;

        for (let i = 0; i < totalCeilings; i++) {
            const xPos = startX + (i * spacingX);

            for (let j = 3; j < 10; j++) {
                const zPos = 180 - (j * 40); 
                
                const spotLight = new THREE.SpotLight(0xffffff, 140, 180, Math.PI / 9, 0.4, 1);
                spotLight.position.set(xPos, 50.3, zPos); 
                spotLight.target.position.set(xPos, 0, zPos);
                
                this.scene.add(spotLight.target);
                this.scene.add(spotLight);
            }

            const backWallWash = new THREE.SpotLight(0xffffff, 50, 100, Math.PI / 3, 0.5, 1);
            backWallWash.position.set(xPos, 40, -225); 
            backWallWash.target.position.set(xPos, 0, -270); 
            
            this.scene.add(backWallWash.target);
            this.scene.add(backWallWash);
        }
    }

   setFrontGridLights() {
        const totalGridX = 4;
        const totalGridZ = 2;
        const spacingX = 65;
        const spacingZ = 45;
        const startX = -97.5;
        const startZ = 135;

        for (let i = 0; i < totalGridX; i++) {
            const xPos = startX + (i * spacingX);

            for (let j = 0; j < totalGridZ; j++) {
                const zPos = startZ + (j * spacingZ);

                // ================= تم التغيير للأبيض هنا =================
                const gridSpot = new THREE.SpotLight(0xffffff, 120, 160, Math.PI / 6, 0.5, 1);
                gridSpot.position.set(xPos, 51.5, zPos);
                gridSpot.target.position.set(xPos, 0, zPos);

                this.scene.add(gridSpot.target);
                this.scene.add(gridSpot);
            }
        }
    }

    setWallPointLights() {
        const totalCeilings = 4;
        const spacingX = 48;
        const startX = -72;
        const ceilingWidth = 40;
        const lightSpacingZ = 55;

        // 1. توزيع الإضاءة السماوية والنهدية العاكسة على السقف بالتبادل (دمج لوني احترافي)
        for (let i = 0; i < totalCeilings; i++) {
            const xPos = startX + (i * spacingX);

            for (let j = 2; j < 6; j++) {
                const zPos = 82.5 - (j * lightSpacingZ);
                
                // معادلة ذكية: جعل الألواح الفردية تضيء نهدي (0xff00ff) والألواح الزوجية تضيء سماوي (0x00ffff)
                const isEvenSegment = (i + j) % 2 === 0;
                const blendColor = isEvenSegment ? 0x00ffff : 0xff00ff;

                const leftPL = new THREE.PointLight(blendColor, 3.5, 80);
                leftPL.position.set(xPos - (ceilingWidth * 0.5) - 1, 51.5, zPos); 
                this.scene.add(leftPL);

                const rightPL = new THREE.PointLight(blendColor, 3.5, 80);
                rightPL.position.set(xPos + (ceilingWidth * 0.5) + 1, 51.5, zPos); 
                this.scene.add(rightPL);
            }

            // القسم المائل في الخلف مدمج ليعكس اللون السماوي والنهدي على الجدار الخلفي
            const slantLightLeft = new THREE.PointLight(0xff00ff, 3, 70); // يسار نهدي
            slantLightLeft.position.set(xPos - (ceilingWidth * 0.5) - 1, 45, -245); 
            this.scene.add(slantLightLeft);

            const slantLightRight = new THREE.PointLight(0x00ffff, 3, 70); // يمين سماوي
            slantLightRight.position.set(xPos + (ceilingWidth * 0.5) + 1, 45, -245); 
            this.scene.add(slantLightRight);
        }

        // 2. إضاءة الحوائط الجانبية للأعمدة البارزة (ثابتة ومتناسقة)
        const wallLightSpacing = 65;
        for (let i = 0; i < 5; i++) {
            const zPos = 97.5 - (i * wallLightSpacing);
            
            const leftCyanPL = new THREE.PointLight(0x00ffff, 12, 180);
            leftCyanPL.position.set(-90, 32, zPos);
            this.scene.add(leftCyanPL);
            
            const leftMagentaPL = new THREE.PointLight(0xff00ff, 12, 180);
            leftMagentaPL.position.set(-90, 18, zPos);
            this.scene.add(leftMagentaPL);
            
            const rightCyanPL = new THREE.PointLight(0x00ffff, 12, 180);
            rightCyanPL.position.set(90, 32, zPos);
            this.scene.add(rightCyanPL);
            
            const rightMagentaPL = new THREE.PointLight(0xff00ff, 12, 180);
            rightMagentaPL.position.set(90, 18, zPos);
            this.scene.add(rightMagentaPL);

            const leftMagentaLowerPL = new THREE.PointLight(0xff00ff, 10, 160);
            leftMagentaLowerPL.position.set(-90, 6, zPos);
            this.scene.add(leftMagentaLowerPL);

            const rightMagentaLowerPL = new THREE.PointLight(0xff00ff, 10, 160);
            rightMagentaLowerPL.position.set(90, 6, zPos);
            this.scene.add(rightMagentaLowerPL);
        }
    }
}