import * as THREE from 'three';
import Experience from '../Experience.js';

export default class PlayerInteraction {
    constructor() {
        this.experience = new Experience();
        this.camera = this.experience.camera;
        this.scene = this.experience.scene;
        
        this.raycaster = new THREE.Raycaster();
        this.center = new THREE.Vector2(0, 0); 

        this.state = 'FREE_ROAM'; 
        this.heldBall = null;
        this.targetLaneX = 20; 

        this.setKeyboardListener();
    }
    adjustHeight(delta) {

        let newY = this.heldBall.position.y + delta;

       

        // 🚨 التقييد الصحيح لـ 5.5

        newY = Math.max(1.9, Math.min(5.5, newY));

        this.heldBall.position.y = newY;

       

        // تحديث البانل لحظياً

    // 🚨 التحديث اللحظي للارتفاع

        if (this.experience.inputPanel) {

            this.experience.inputPanel.updateFromGame(this.camera.instance.position.x, newY);

        }

    }

   setKeyboardListener() {
        window.addEventListener('keydown', (event) => {
            const key = event.key.toLowerCase();
            
            if (key === 'e') {
                if (this.state === 'FREE_ROAM') this.tryPickupBall();
                else if (this.state === 'HOLDING_BALL') this.dropBall();
            }
            
            if (key === 'enter') {
                if (this.state === 'HOLDING_BALL') this.enterAimingMode();
                else if (this.state === 'AIMING') this.exitAimingMode();
            }

            // 🚨 أزرار الارتفاع المنفصلة (لأن W و S أصبحت للقوة)
            if (this.state === 'AIMING') {
                if (key === 'r') this.adjustHeight(0.1); // R للرفع
                if (key === 'f') this.adjustHeight(-0.1); // F للتنزيل
            }
        });
    }

    tryPickupBall() {
        const ballSystem = this.experience.world.hall.ballReturnSystem;
        if (!ballSystem || !ballSystem.interactiveBalls) return;

        this.raycaster.setFromCamera(this.center, this.camera.instance);
        const intersects = this.raycaster.intersectObjects(ballSystem.interactiveBalls, true);

        if (intersects.length > 0) {
            let pickedMesh = intersects[0].object;
            while (pickedMesh.parent && !pickedMesh.userData.isPickable) {
                pickedMesh = pickedMesh.parent;
            }

            if (pickedMesh.userData.isPickable) {
                if (this.camera.instance.position.distanceTo(pickedMesh.position) < 45) { 
                    this.state = 'HOLDING_BALL';
                    this.heldBall = pickedMesh;
                    
                    const index = ballSystem.interactiveBalls.indexOf(this.heldBall);
                    if (index > -1) {
                        ballSystem.interactiveBalls.splice(index, 1);
                    }
                    
                    if (this.heldBall.parent) this.heldBall.parent.remove(this.heldBall);
                    this.camera.instance.add(this.heldBall);
                    
                    this.heldBall.position.set(2.5, -2, -6);
                    this.heldBall.visible = true;
                    
                    console.log("🏀 تم التقاط الكرة بنجاح! اضغط Enter للمسار.");
                }
            }
        }
    }

    dropBall() {
        this.state = 'FREE_ROAM';
        
        this.camera.instance.remove(this.heldBall);
        this.scene.add(this.heldBall);
        
        this.heldBall.position.copy(this.camera.instance.position);
        this.heldBall.position.y = 2.5; 
        this.heldBall.position.z -= 8; 
        
        const ballSystem = this.experience.world.hall.ballReturnSystem;
        if (ballSystem && ballSystem.interactiveBalls) {
            ballSystem.interactiveBalls.push(this.heldBall);
        }

        this.heldBall = null;
        console.log("⬇️ تم رمي الكرة على الأرض.");
    }

    enterAimingMode() {
        this.state = 'AIMING';
        
        this.camera.instance.remove(this.heldBall);
        this.scene.add(this.heldBall);

        this.camera.rotation.set(0, 0, 0); 
        this.camera.instance.quaternion.setFromEuler(this.camera.rotation);

        this.camera.instance.position.set(this.targetLaneX - 6, 15, 120);
        this.heldBall.position.set(this.targetLaneX, 2.5, 100); 

        if (this.experience.inputPanel) {
            this.experience.inputPanel.setBall(this.heldBall);
            this.experience.inputPanel.parameters.xStart = this.targetLaneX;
            this.experience.inputPanel.parameters.yStart = 2.5; 
        }
    }

    exitAimingMode() {
        this.state = 'HOLDING_BALL';
        
        this.scene.remove(this.heldBall);
        this.camera.instance.add(this.heldBall);
        this.heldBall.position.set(2.5, -2, -6);
        
        console.log("🚶‍♂️ تم إلغاء التصويب.");
    }

    // 🚨 تم حذف دالة adjustHeight بالكامل لأننا سنعالج الارتفاع في الـ Update بذكاء

 update() {
        if (this.state === 'AIMING' && this.heldBall) {
            const speed = 0.5;
            let moved = false; 

            // 1. الحركة اليمين واليسار (محور X)
            if (this.camera.keys.right) { this.camera.instance.position.x += speed; moved = true; }
            if (this.camera.keys.left) { this.camera.instance.position.x -= speed; moved = true; }
            
            // 2. الحركة للأمام والخلف (محور Z - للتحكم بالقوة!)
            if (this.camera.keys.forward) { this.camera.instance.position.z -= speed; moved = true; } // تقدم لتقليل القوة
            if (this.camera.keys.backward) { this.camera.instance.position.z += speed; moved = true; } // تراجع لزيادة القوة

            // 🛡️ 3. القيود (Clamps)
            // قيد عرض المسار
            const minX = this.targetLaneX - 14; 
            const maxX = this.targetLaneX + 7; 
            this.camera.instance.position.x = Math.max(minX, Math.min(maxX, this.camera.instance.position.x));
            
            // قيد التقدم والتراجع (طول ممر الجري)
            const minZ = 120; // خط الرمي (أضعف قوة)
            const maxZ = 140; // أقصى نقطة للخلف (أقوى رمية)
            this.camera.instance.position.z = Math.max(minZ, Math.min(maxZ, this.camera.instance.position.z));
            //
            this.camera.instance.position.y = 15; 
            
            // 4. الكرة تتبع اللاعب (تبقى أمامه بـ 20 وحدة دائماً)
            this.heldBall.position.x = this.camera.instance.position.x;
            this.heldBall.position.z = this.camera.instance.position.z - 20; 
            
            // 🧮 5. العملية الرياضية: تحويل مسافة التراجع إلى قوة (Push Force)
            // إذا كان Z = 120 -> القوة 50
            // إذا كان Z = 160 -> القوة 600
            const forceRange = 600 - 50; // 550
            const distanceMovedBack = this.camera.instance.position.z - minZ; // القيمة من 0 إلى 40
            const calculatedForce = 50 + (distanceMovedBack / (maxZ - minZ)) * forceRange;

            // 6. التحديث اللحظي للبانل (X, Y, PushForce)
            if (moved && this.experience.inputPanel) {
                this.experience.inputPanel.updateFromGame(
                    this.camera.instance.position.x, 
                    this.heldBall.position.y,
                    calculatedForce // 🔥 إرسال القوة المحسوبة ديناميكياً
                );
            }
        }
    }
}