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
        // Target lane (third from right, X=16)
        this.targetLaneX = 16;
        // Aiming arrow
        this.aimArrow = new THREE.ArrowHelper(
            new THREE.Vector3(0, 0, -1),
            new THREE.Vector3(0, 0, 0),
            20,
            0x6600ff,
            4,    // headLength
            2     // headWidth
        );

        this.keys = { q: false, e: false };
        this.setKeyboardListener();
    }

    setKeyboardListener() {
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

    enterAimingMode() {
        this.state = 'AIMING';
        this.camera.instance.remove(this.heldBall);
        this.scene.add(this.heldBall);
        this.camera.rotation.set(0, 0, 0);
        this.camera.instance.quaternion.setFromEuler(this.camera.rotation);
        this.camera.instance.position.set(this.targetLaneX - 6, 15, 130);
        this.heldBall.position.set(this.targetLaneX, 2.5, 110);
        this.currentLaunchAngle = 0;
        this.scene.add(this.aimArrow);


        if (this.experience.inputPanel) {
            this.experience.inputPanel.setBall(this.heldBall);
            this.experience.inputPanel.parameters.xStart    = this.targetLaneX;
            this.experience.inputPanel.parameters.yStart    = 2.5;
            this.experience.inputPanel.parameters.launchAngle = 0;
            this.experience.inputPanel.parameters.pushForce = 250;
            this.experience.inputPanel.enablePanel();
        }
    }

    // ─────────────────────────────────────────────────────────
    exitAimingMode() {
        this.state = 'HOLDING_BALL';
        this.scene.remove(this.heldBall);
        this.camera.instance.add(this.heldBall);
        this.heldBall.position.set(2.5, -2, -6);
        this.scene.remove(this.aimArrow);
          if (this.experience.inputPanel) {
            this.experience.inputPanel.disablePanel();
        }
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

        const rad = THREE.MathUtils.degToRad(this.currentLaunchAngle);
        this.direction.set(Math.sin(rad), 0, -Math.cos(rad));
        this.aimArrow.setDirection(this.direction);
    }

    adjustHeight(delta) {
        if (!this.heldBall) return;
        this.heldBall.position.y = Math.max(1.9, Math.min(5.5, this.heldBall.position.y + delta));
        if (this.experience.inputPanel) {
            const force = this.calcForceFromZ(this.camera.instance.position.z);
            this.experience.inputPanel.updateFromGame(
                this.camera.instance.position.x,
                this.heldBall.position.y,
                force,
                this.currentLaunchAngle
            );
        }
    }

    // Map camera Z position to push force (130→50N, 150→600N)
    calcForceFromZ(z) {
        return 50 + ((z - 130) / 20) * 550;
    }

    update() {
        if (this.state !== 'AIMING' || !this.heldBall) return;
        if (this.experience.inputPanel?.isLaunched) {
            if (this.aimArrow.parent) this.scene.remove(this.aimArrow);
            return;
        }

        const speed = 0.5;

        // Move player
        if (this.camera.keys.right)    this.camera.instance.position.x += speed;
        if (this.camera.keys.left)     this.camera.instance.position.x -= speed;
        if (this.camera.keys.forward)  this.camera.instance.position.z -= speed;
        if (this.camera.keys.backward) this.camera.instance.position.z += speed;

        // Adjust launch angle (Q/E)
        const angleSpeed = 0.25;
        if (this.keys.q) this.currentLaunchAngle -= angleSpeed;
        if (this.keys.e) this.currentLaunchAngle += angleSpeed;
        this.currentLaunchAngle = Math.max(-45, Math.min(45, this.currentLaunchAngle));

        // Clamp movement to stay on lane
        this.camera.instance.position.x = Math.max(
            this.targetLaneX - 12,
            Math.min(this.targetLaneX +13, this.camera.instance.position.x)
        );
        this.camera.instance.position.z = Math.max(130, Math.min(150, this.camera.instance.position.z));
        this.camera.instance.position.y = 15;

        // Update ball position
        this.heldBall.position.x = this.camera.instance.position.x;
        this.heldBall.position.z = this.camera.instance.position.z - 20;

        // Update arrow
        this.aimArrow.position.set(
            this.heldBall.position.x,
            this.heldBall.position.y + 2,
            this.heldBall.position.z
        );
        this.direction.set(
            Math.sin(THREE.MathUtils.degToRad(this.currentLaunchAngle)),
            0,
            -Math.cos(THREE.MathUtils.degToRad(this.currentLaunchAngle))
        );
        this.aimArrow.setDirection(this.direction);

       // Sync panel
        if (this.experience.inputPanel) {
            const force = this.calcForceFromZ(this.camera.instance.position.z);
            this.experience.inputPanel.updateFromGame(
                this.camera.instance.position.x,
                this.heldBall.position.y,
                force,
                this.currentLaunchAngle
            );
        }
    }
}