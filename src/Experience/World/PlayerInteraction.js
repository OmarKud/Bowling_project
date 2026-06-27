import * as THREE from 'three';
import Experience from '../Experience.js';

export default class PlayerInteraction {
    constructor() {
        this.experience = new Experience();
        this.camera = this.experience.camera;
        this.scene = this.experience.scene;
        this.input = this.experience.inputPanel;
        
        this.raycaster = new THREE.Raycaster();
        this.center = new THREE.Vector2(0, 0); 

        this.state = 'FREE_ROAM'; // FREE_ROAM, HOLDING_BALL, AIMING
        this.heldBall = null;
        this.targetLaneX = 20; 

        this.setKeyboardListener();
    }

    setKeyboardListener() {
        window.addEventListener('keydown', (event) => {
            const key = event.key.toLowerCase();
            
            if (key === 'e') {
                if (this.state === 'FREE_ROAM') {
                    this.tryPickupBall();
                } else if (this.state === 'HOLDING_BALL') {
                    this.dropBall();
                }
            }
            
            if (key === 'enter') {
                if (this.state === 'HOLDING_BALL') {
                    this.enterAimingMode();
                } else if (this.state === 'AIMING') {
                    this.exitAimingMode();
                }
            }

            if (this.state === 'AIMING') {
                if (key === 'r') this.adjustHeight(1.0); 
                if (key === 'f') this.adjustHeight(-1.0); 
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
                    
                    // 🚨 التعديل السحري: نأخذ الكرة الأصلية بدلاً من الاستنساخ
                    this.heldBall = pickedMesh;
                    
                    // نزيلها من مصفوفة البحث كي لا نصطدم بها ونحن نحملها
                    const index = ballSystem.interactiveBalls.indexOf(this.heldBall);
                    if (index > -1) {
                        ballSystem.interactiveBalls.splice(index, 1);
                    }
                    
                    // نفصلها من الرف ونربطها بالكاميرا
                    if (this.heldBall.parent) this.heldBall.parent.remove(this.heldBall);
                    this.camera.instance.add(this.heldBall);
                    
                    this.heldBall.position.set(2.5, -2, -6);
                    this.heldBall.visible = true; // تأكيد الإظهار
                    
                    console.log("🏀 تم التقاط الكرة بنجاح! اضغط Enter للمسار.");
                }
            }
        }
    }

    dropBall() {
        this.state = 'FREE_ROAM';
        
        this.camera.instance.remove(this.heldBall);
        this.scene.add(this.heldBall);
        
        // وضعها على الأرض أمام اللاعب بقليل
        this.heldBall.position.copy(this.camera.instance.position);
        this.heldBall.position.y =2.5; 
        this.heldBall.position.z -= 8; // نرميها للأمام وليس تحت أقدامنا
        
        // 🚨 نعيد الكرة إلى مصفوفة البحث لكي نتمكن من التقاطها من الأرض!
        const ballSystem = this.experience.world.hall.ballReturnSystem;
        if (ballSystem && ballSystem.interactiveBalls) {
            ballSystem.interactiveBalls.push(this.heldBall);
        }

        this.heldBall = null;
        console.log("⬇️ تم رمي الكرة على الأرض. يمكنك النظر إليها والتقاطها مجدداً بـ E.");
    }

   enterAimingMode() {
        this.state = 'AIMING';
        
        this.camera.instance.remove(this.heldBall);
        this.scene.add(this.heldBall);

        this.camera.rotation.set(0, 0, 0); 
        this.camera.instance.quaternion.setFromEuler(this.camera.rotation);

        this.camera.instance.position.set(this.targetLaneX-6, 15, 120);
        
        this.heldBall.position.set(this.targetLaneX, 2.5, 100); 

        if (this.input) {
            this.input.setBall(this.heldBall);
            this.input.parameters.xStart = this.targetLaneX;
            this.input.parameters.yStart = 2.5; 
        }}

    exitAimingMode() {
        this.state = 'HOLDING_BALL';
        
        this.scene.remove(this.heldBall);
        this.camera.instance.add(this.heldBall);
        this.heldBall.position.set(2.5, -2, -6);
        
        console.log("🚶‍♂️ تم إلغاء التصويب. عدت لحمل الكرة.");
    }

    adjustHeight(delta) {
    // 1. تحديد الحد الأدنى الذي لا نريد للكرة النزول تحته
    const minY = 1.9; 
    
    // 2. حساب القيمة الجديدة
    let newY = this.heldBall.position.y + delta;
    
    // 3. منع النزول تحت minY باستخدام Math.max
    // نستخدم 0.5 كحد أقصى للنزول كما طلبت، لكن نطبق شرطك الخاص فوقه
    newY = Math.max(minY, Math.min(5.5, newY)); 
    
    // 4. التحديث
    this.heldBall.position.y = newY;
    
    if (this.input) {
        this.input.parameters.yStart = newY;
    }
    
    console.log("↕️ ارتفاع الكرة الجديد:", newY);
}

 // داخل PlayerInteraction.js
update() {
    if (this.state === 'AIMING' && this.heldBall) {
        const speed = 0.5;
        if (this.camera.keys.right) this.camera.instance.position.x += speed;
        if (this.camera.keys.left) this.camera.instance.position.x -= speed;
        
        const minX = this.targetLaneX - 14;
        const maxX = this.targetLaneX + 9;
        this.camera.instance.position.x = Math.max(minX, Math.min(maxX, this.camera.instance.position.x));
        
        // تثبيت باقي المحاور
        this.camera.instance.position.z = 120;
        this.camera.instance.position.y = 15;
        
        // الكرة تتبع اللاعب
        this.heldBall.position.x = this.camera.instance.position.x;
        this.heldBall.position.z = 100;
        
        // المزامنة مع البانل
        if (this.input) {
            this.input.updateFromGame(this.camera.instance.position.x, this.heldBall.position.y);
        }
    }
}
}