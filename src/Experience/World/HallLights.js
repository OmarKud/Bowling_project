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
        // زيادة الإضاءة المحيطية العامة للكشف عن تفاصيل خامات الحوائط والأرضيات الفخمة
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

            // كشافات السبوتات البيضاء الحادة الموجهة للأرضية
            // تبدأ من 3 لتتطابق بالمليمتر مع تراجع السقف المستعار ولا تسبح في الهواء
            for (let j = 3; j < 10; j++) {
                const zPos = 180 - (j * 40); 
                
                const spotLight = new THREE.SpotLight(0xffffff, 140, 180, Math.PI / 9, 0.4, 1);
                spotLight.position.set(xPos, 50.3, zPos); // الارتفاع ملتصق ببطن السقف المستعار الجديد
                spotLight.target.position.set(xPos, 0, zPos);
                
                this.scene.add(spotLight.target);
                this.scene.add(spotLight);
            }

            // كشافات غسيل الحائط الخلفي القوية (منطقة القوارير Pins Area)
            const backWallWash = new THREE.SpotLight(0xffffff, 50, 100, Math.PI / 3, 0.5, 1);
            backWallWash.position.set(xPos, 40, -225); // موضع علوي لفرش درامي ينحدر على الجدار الخلفي
            backWallWash.target.position.set(xPos, 0, -270); // موجه بالكامل إلى أسفل الحائط الخلفي
            
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

        // 1. إعادة توزيع الإضاءة السماوية المخفية لتنعكس للأعلى على السقف الأساسي الأسود
        for (let i = 0; i < totalCeilings; i++) {
            const xPos = startX + (i * spacingX);

            // الـ Loop يبدأ من j = 2 لمنع خروج الضوء إلى الفراغ الأمامي المكشوف
            // الأضواء مخفية فوق الألواح وتعمل من الإحداثية Z = -27.5 فما دون لتوهج سينمائي مذهل
            for (let j = 2; j < 6; j++) {
                const zPos = 82.5 - (j * lightSpacingZ);
                const leftPL = new THREE.PointLight(0x00ffff, 3.5, 80);
                leftPL.position.set(xPos - (ceilingWidth * 0.5) - 1, 51.5, zPos); // بارتفاع أعلى من لوح الجبس بقليل لضرب السقف الأسود
                this.scene.add(leftPL);

                const rightPL = new THREE.PointLight(0x00ffff, 3.5, 80);
                rightPL.position.set(xPos + (ceilingWidth * 0.5) + 1, 51.5, zPos); 
                this.scene.add(rightPL);
            }

            // الإضاءة السماوية العاكسة المرافقة للقسم المائل المتصل بالحيط الخلفي
            const slantLightLeft = new THREE.PointLight(0x00ffff, 3, 70);
            slantLightLeft.position.set(xPos - (ceilingWidth * 0.5) - 1, 45, -245); 
            this.scene.add(slantLightLeft);

            const slantLightRight = new THREE.PointLight(0x00ffff, 3, 70);
            slantLightRight.position.set(xPos + (ceilingWidth * 0.5) + 1, 45, -245); 
            this.scene.add(slantLightRight);
        }

        // 2. ترحيل وتقوية إضاءة الحوائط الجانبية الطولية (النيون الملون للأعمدة البارزة)
        const wallLightSpacing = 65;
        for (let i = 0; i < 5; i++) {
            const zPos = 97.5 - (i * wallLightSpacing);
            
            const leftCyanPL = new THREE.PointLight(0x00ffff, 14, 190);
            leftCyanPL.position.set(-90, 34, zPos); // رُفعت لأعلى لتغطية النصف العلوي من الجدار والأعمدة
            this.scene.add(leftCyanPL);
            
            const leftMagentaPL = new THREE.PointLight(0xff00ff, 14, 190);
            leftMagentaPL.position.set(-90, 18, zPos); // تغطي المنطقة الوسطى من العمود
            this.scene.add(leftMagentaPL);
            
            const rightCyanPL = new THREE.PointLight(0x00ffff, 14, 190);
            rightCyanPL.position.set(90, 34, zPos);
            this.scene.add(rightCyanPL);
            
            const rightMagentaPL = new THREE.PointLight(0xff00ff, 14, 190);
            rightMagentaPL.position.set(90, 18, zPos);
            this.scene.add(rightMagentaPL);

            // النيون السفلي الغامر الموجه لإضاءة قاعدة الأعمدة على الأرضية
            const leftMagentaLowerPL = new THREE.PointLight(0xff00ff, 10, 160);
            leftMagentaLowerPL.position.set(-90, 6, zPos);
            this.scene.add(leftMagentaLowerPL);

            const rightMagentaLowerPL = new THREE.PointLight(0xff00ff, 10, 160);
            rightMagentaLowerPL.position.set(90, 6, zPos);
            this.scene.add(rightMagentaLowerPL);
        }
    }
}