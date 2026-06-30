import * as THREE from 'three';
import Experience from '../Experience.js';

export default class PlayerInteraction {
    constructor() {
        this.experience = new Experience();
        this.camera     = this.experience.camera;
        this.scene      = this.experience.scene;

        this.raycaster  = new THREE.Raycaster();
        this.center     = new THREE.Vector2(0, 0);
        this.direction  = new THREE.Vector3();
        this.yAxis      = new THREE.Vector3(0, 1, 0);

        this.state            = 'FREE_ROAM';
        this.heldBall         = null;
        this.currentLaunchAngle = 0;

        // المسار الثالث من اليمين:
        // المسارات عند X: -80, -48, -16, 16, 48, 80 (6 مسارات، laneComponentWidth=32)
        // من اليمين: 80(1st), 48(2nd), 16(3rd) ← هذا هو المسار المستهدف
        this.targetLaneX = 16;

        // سهم التصويب
        this.aimArrow = new THREE.ArrowHelper(
            new THREE.Vector3(0, 0, -1),
            new THREE.Vector3(0, 0, 0),
            20,
            0x6600ff,
            4,    // headLength
            2     // headWidth
        );

        this.keys = { q: false, e: false };
        this._setKeyboardListener();
    }

    // ─────────────────────────────────────────────────────────
    _setKeyboardListener() {
        window.addEventListener('keydown', (event) => {
            const key = event.key.toLowerCase();

            if (key === 'e' && this.state === 'FREE_ROAM') {
                this.tryPickupBall();
                return;
            }
            if (key === 'e' && this.state === 'HOLDING_BALL') {
                this.dropBall();
                return;
            }
            if (key === 'enter') {
                if (this.state === 'HOLDING_BALL') this.enterAimingMode();
                else if (this.state === 'AIMING')   this.exitAimingMode();
                return;
            }

            if (this.state === 'AIMING') {
                if (key === 'r') this._adjustHeight(0.1);
                if (key === 'f') this._adjustHeight(-0.1);
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

    // ─────────────────────────────────────────────────────────
    tryPickupBall() {
        const ballSystem = this.experience.world?.hall?.ballReturnSystem;
        if (!ballSystem?.interactiveBalls) return;

        this.raycaster.setFromCamera(this.center, this.camera.instance);
        const intersects = this.raycaster.intersectObjects(ballSystem.interactiveBalls, true);
        if (intersects.length === 0) return;

        let pickedMesh = intersects[0].object;
        while (pickedMesh.parent && !pickedMesh.userData.isPickable) {
            pickedMesh = pickedMesh.parent;
        }

        if (
            pickedMesh.userData.isPickable &&
            this.camera.instance.position.distanceTo(pickedMesh.position) < 45
        ) {
            this.state    = 'HOLDING_BALL';
            this.heldBall = pickedMesh;

            const idx = ballSystem.interactiveBalls.indexOf(this.heldBall);
            if (idx > -1) ballSystem.interactiveBalls.splice(idx, 1);

            if (this.heldBall.parent) this.heldBall.parent.remove(this.heldBall);
            this.camera.instance.add(this.heldBall);
            this.heldBall.position.set(2.5, -2, -6);
            this.heldBall.visible = true;
        }
    }

    // ─────────────────────────────────────────────────────────
    dropBall() {
        this.state = 'FREE_ROAM';
        this.camera.instance.remove(this.heldBall);
        this.scene.add(this.heldBall);
        this.heldBall.position.copy(this.camera.instance.position);
        this.heldBall.position.y  = 2.5;
        this.heldBall.position.z -= 8;

        const ballSystem = this.experience.world?.hall?.ballReturnSystem;
        if (ballSystem?.interactiveBalls) ballSystem.interactiveBalls.push(this.heldBall);
        this.heldBall = null;
    }

    // ─────────────────────────────────────────────────────────
    enterAimingMode() {
        this.state = 'AIMING';

        // فصل الكرة عن الكاميرا ووضعها في المشهد
        this.camera.instance.remove(this.heldBall);
        this.scene.add(this.heldBall);

        // إعادة ضبط دوران الكاميرا
        this.camera.rotation.set(0, 0, 0);
        this.camera.instance.quaternion.setFromEuler(this.camera.rotation);

        // وضع اللاعب خلف الكرة قليلاً (Z=130 بدلاً من 120 لرؤية أفضل)
        this.camera.instance.position.set(this.targetLaneX - 6, 15, 130);
        this.heldBall.position.set(this.targetLaneX, 2.5, 110);

        this.currentLaunchAngle = 0;
        this.scene.add(this.aimArrow);

        // ربط الكرة بالبانل
        if (this.experience.inputPanel) {
            this.experience.inputPanel.setBall(this.heldBall);
            this.experience.inputPanel.parameters.xStart    = this.targetLaneX;
            this.experience.inputPanel.parameters.yStart    = 2.5;
            this.experience.inputPanel.parameters.launchAngle = 0;
            this.experience.inputPanel.parameters.pushForce = 250;
        }
    }

    // ─────────────────────────────────────────────────────────
    exitAimingMode() {
        this.state = 'HOLDING_BALL';
        this.scene.remove(this.heldBall);
        this.camera.instance.add(this.heldBall);
        this.heldBall.position.set(2.5, -2, -6);
        this.scene.remove(this.aimArrow);
    }

    restoreAimArrow() {
        if (!this.heldBall || this.state !== 'AIMING') return;

        if (!this.aimArrow.parent) {
            this.scene.add(this.aimArrow);
        }

        this.aimArrow.position.set(
            this.heldBall.position.x,
            this.heldBall.position.y + 2,
            this.heldBall.position.z
        );

        // اتجاه السهم لازم يطابق بالضبط معادلة سرعة الكرة الفعلية عند
        // الإطلاق (vx = sin(angle), vz = -cos(angle))، بدل ما نعتمد على
        // applyAxisAngle حول yAxis لأنها بتعطي إشارة X معاكسة لمعادلة
        // الفيزياء وهيك كان السهم يأشر بعكس جهة حركة الكرة فعليًا
        const rad = THREE.MathUtils.degToRad(this.currentLaunchAngle);
        this.direction.set(Math.sin(rad), 0, -Math.cos(rad));
        this.aimArrow.setDirection(this.direction);
    }

    // ─────────────────────────────────────────────────────────
    _adjustHeight(delta) {
        if (!this.heldBall) return;
        this.heldBall.position.y = Math.max(1.9, Math.min(5.5, this.heldBall.position.y + delta));
        if (this.experience.inputPanel) {
            const force = this._calcForceFromZ(this.camera.instance.position.z);
            this.experience.inputPanel.updateFromGame(
                this.camera.instance.position.x,
                this.heldBall.position.y,
                force,
                this.currentLaunchAngle
            );
        }
    }

    // ─────────────────────────────────────────────────────────
    // حساب القوة من موقع Z (130 → 50N، 150 → 600N)
    _calcForceFromZ(z) {
        return 50 + ((z - 130) / 20) * 550;
    }

    // ─────────────────────────────────────────────────────────
    update() {
        if (this.state !== 'AIMING' || !this.heldBall) return;

        // إذا أُطلقت الكرة، أوقف تحديث اللاعب وأخفِ السهم
        if (this.experience.inputPanel?.isLaunched) {
            if (this.aimArrow.parent) this.scene.remove(this.aimArrow);
            return;
        }

        const speed = 0.5;

        // تحريك اللاعب
        if (this.camera.keys.right)    this.camera.instance.position.x += speed;
        if (this.camera.keys.left)     this.camera.instance.position.x -= speed;
        if (this.camera.keys.forward)  this.camera.instance.position.z -= speed;
        if (this.camera.keys.backward) this.camera.instance.position.z += speed;

        // تعديل زاوية التصويب (Q/E)
        const angleSpeed = 0.25;
        if (this.keys.q) this.currentLaunchAngle -= angleSpeed;
        if (this.keys.e) this.currentLaunchAngle += angleSpeed;
        this.currentLaunchAngle = Math.max(-45, Math.min(45, this.currentLaunchAngle));

        // قيود الحركة — ابقَ على المسار
        this.camera.instance.position.x = Math.max(
            this.targetLaneX - 12,
            Math.min(this.targetLaneX +13, this.camera.instance.position.x)
        );
        this.camera.instance.position.z = Math.max(130, Math.min(150, this.camera.instance.position.z));
        this.camera.instance.position.y = 15;

        // تحديث موقع الكرة
        this.heldBall.position.x = this.camera.instance.position.x;
        this.heldBall.position.z = this.camera.instance.position.z - 20;
        // Y يبقى كما هو (يتحكم فيه R/F)

        // تحديث السهم
        this.aimArrow.position.set(
            this.heldBall.position.x,
            this.heldBall.position.y + 2,
            this.heldBall.position.z
        );
        // اتجاه السهم لازم يطابق بالضبط معادلة سرعة الكرة الفعلية عند
        // الإطلاق (vx = sin(angle), vz = -cos(angle))، نفس المنطق
        // المستخدم بـ restoreAimArrow عشان السهم دايمًا يأشر بنفس
        // جهة حركة الكرة الحقيقية
        this.direction.set(
            Math.sin(THREE.MathUtils.degToRad(this.currentLaunchAngle)),
            0,
            -Math.cos(THREE.MathUtils.degToRad(this.currentLaunchAngle))
        );
        this.aimArrow.setDirection(this.direction);

        // مزامنة البانل
        if (this.experience.inputPanel) {
            const force = this._calcForceFromZ(this.camera.instance.position.z);
            this.experience.inputPanel.updateFromGame(
                this.camera.instance.position.x,
                this.heldBall.position.y,
                force,
                this.currentLaunchAngle
            );
        }
    }
}