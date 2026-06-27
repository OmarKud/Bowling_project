import * as THREE from 'three';
import Experience from '../Experience.js';

export default class PlayerInteraction {
    constructor() {
        this.experience = new Experience();
        this.camera = this.experience.camera;
        this.scene = this.experience.scene;
        
        this.raycaster = new THREE.Raycaster();
        this.center = new THREE.Vector2(0, 0); 
        this.direction = new THREE.Vector3();
        this.yAxis = new THREE.Vector3(0, 1, 0);
        
        this.state = 'FREE_ROAM'; 
        this.heldBall = null;
        this.targetLaneX = 20; 
        this.currentLaunchAngle = 0;

        // السهم البنفسجي
        this.aimArrow = new THREE.ArrowHelper(
            new THREE.Vector3(0, 0, -1),
            new THREE.Vector3(0, 0, 0),
            15,
            0x6600ff 
        );
        
        this.keys = { q: false, e: false };
        this.setKeyboardListener();
    }

    setKeyboardListener() {
        window.addEventListener('keydown', (event) => {
            const key = event.key.toLowerCase();
            if (key === 'e' && this.state !== 'AIMING') {
                if (this.state === 'FREE_ROAM') this.tryPickupBall();
                else if (this.state === 'HOLDING_BALL') this.dropBall();
            }
            if (key === 'enter') {
                if (this.state === 'HOLDING_BALL') this.enterAimingMode();
                else if (this.state === 'AIMING') this.exitAimingMode();
            }
            if (this.state === 'AIMING') {
                if (key === 'r') this.adjustHeight(0.1); 
                if (key === 'f') this.adjustHeight(-0.1);
                if (key === 'q') this.keys.q = true;
                if (key === 'e') this.keys.e = true;
            }
        });
        window.addEventListener('keyup', (event) => {
            const key = event.key.toLowerCase();
            if (key === 'q') this.keys.q = false;
            if (key === 'e') this.keys.e = false;
        });
    }

    tryPickupBall() {
        const ballSystem = this.experience.world.hall.ballReturnSystem;
        if (!ballSystem || !ballSystem.interactiveBalls) return;

        this.raycaster.setFromCamera(this.center, this.camera.instance);
        const intersects = this.raycaster.intersectObjects(ballSystem.interactiveBalls, true);

        if (intersects.length > 0) {
            let pickedMesh = intersects[0].object;
            while (pickedMesh.parent && !pickedMesh.userData.isPickable) pickedMesh = pickedMesh.parent;

            if (pickedMesh.userData.isPickable && this.camera.instance.position.distanceTo(pickedMesh.position) < 45) {
                this.state = 'HOLDING_BALL';
                this.heldBall = pickedMesh;
                const index = ballSystem.interactiveBalls.indexOf(this.heldBall);
                if (index > -1) ballSystem.interactiveBalls.splice(index, 1);
                
                if (this.heldBall.parent) this.heldBall.parent.remove(this.heldBall);
                this.camera.instance.add(this.heldBall);
                this.heldBall.position.set(2.5, -2, -6);
                this.heldBall.visible = true;
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
        if (ballSystem && ballSystem.interactiveBalls) ballSystem.interactiveBalls.push(this.heldBall);
        this.heldBall = null;
    }

    enterAimingMode() {
        this.state = 'AIMING';
        this.camera.instance.remove(this.heldBall);
        this.scene.add(this.heldBall);
        this.camera.rotation.set(0, 0, 0); 
        this.camera.instance.quaternion.setFromEuler(this.camera.rotation);
        
        // ضبط الموقع
        this.camera.instance.position.set(this.targetLaneX - 6, 15, 120);
        this.heldBall.position.set(this.targetLaneX, 2.5, 100); 
        
        this.currentLaunchAngle = 0;
        this.scene.add(this.aimArrow);
        
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
        this.scene.remove(this.aimArrow);
    }

    adjustHeight(delta) {
        let newY = Math.max(1.9, Math.min(5.5, this.heldBall.position.y + delta));
        this.heldBall.position.y = newY;
        if (this.experience.inputPanel) {
            this.experience.inputPanel.updateFromGame(this.camera.instance.position.x, newY);
        }
    }

    update() {
        if (this.state === 'AIMING' && this.heldBall) {

            if (this.experience.inputPanel && this.experience.inputPanel.isLaunched) {
                if (this.aimArrow.parent) {
                    this.scene.remove(this.aimArrow); // إخفاء السهم أثناء دحرجة الكرة
                }
                return; // 🛑 إيقاف دالة اللاعب تماماً وترك السيطرة للفيزياء!
            }
            const speed = 0.5;
            // الحركة
            if (this.camera.keys.right) this.camera.instance.position.x += speed;
            if (this.camera.keys.left) this.camera.instance.position.x -= speed;
            if (this.camera.keys.forward) this.camera.instance.position.z -= speed;
            if (this.camera.keys.backward) this.camera.instance.position.z += speed;

           // 2. تحديث الزاوية (بسرعة أخف وأكثر دقة)
        const angleSpeed = 0.2; // 🚨 قمنا بتخفيف السرعة من 1.5 إلى 0.2
        if (this.keys.q) { this.currentLaunchAngle -= angleSpeed }
        if (this.keys.e) { this.currentLaunchAngle += angleSpeed }
        this.currentLaunchAngle = Math.max(-45, Math.min(45, this.currentLaunchAngle));
            // القيود
            this.camera.instance.position.x = Math.max(this.targetLaneX - 14, Math.min(this.targetLaneX + 7, this.camera.instance.position.x));
            this.camera.instance.position.z = Math.max(120, Math.min(140, this.camera.instance.position.z));
            this.camera.instance.position.y = 15;

            // تحديث مكان الكرة (نحافظ على الـ Y الحالي)
            this.heldBall.position.x = this.camera.instance.position.x;
            this.heldBall.position.z = this.camera.instance.position.z - 20;

            // تحديث السهم
            this.aimArrow.position.set(this.heldBall.position.x, this.heldBall.position.y + 2, this.heldBall.position.z);
            this.direction.set(0, 0, -1).applyAxisAngle(this.yAxis, THREE.MathUtils.degToRad(this.currentLaunchAngle));
            this.aimArrow.setDirection(this.direction);

            // تحديث البانل لحظياً
            if (this.experience.inputPanel) {
                const force = 50 + ((this.camera.instance.position.z - 120) / 20) * 550;
                this.experience.inputPanel.updateFromGame(this.camera.instance.position.x, this.heldBall.position.y, force, this.currentLaunchAngle);
            }
        }
    }
}