import * as THREE from 'three';
import Experience from './Experience.js';

export default class Camera {
    constructor() {
        this.experience = new Experience();
        this.sizes = this.experience.sizes;
        this.scene = this.experience.scene;
        this.canvas = this.experience.canvas;
        this.time = this.experience.time;

        this.keys = { forward: false, backward: false, left: false, right: false };
        this.rotation = new THREE.Euler(0, 0, 0, 'YXZ');

        // 🔥 تعريف المتجهات هنا مرة واحدة فقط لتجنب تدمير الذاكرة
        this.movement = new THREE.Vector3();
        this.forward = new THREE.Vector3();
        this.right = new THREE.Vector3();

        this.setInstance();
        this.setMouseListener();
        this.setKeyboardListeners();
    }

    setInstance() {
        this.instance = new THREE.PerspectiveCamera(45, this.sizes.width / this.sizes.height, 0.1, 2000);
        this.instance.position.set(0, 15, 250);
        this.scene.add(this.instance);
    }

    setMouseListener() {
        this.canvas.addEventListener('click', () => {
            this.canvas.requestPointerLock();
        });

        window.addEventListener('mousemove', (event) => {
            if (document.pointerLockElement === this.canvas) {
                const sensitivity = 0.005;
                this.rotation.y -= event.movementX * sensitivity;
                this.rotation.x -= event.movementY * sensitivity;
                this.rotation.x = Math.max(-Math.PI * 0.45, Math.min(Math.PI * 0.45, this.rotation.x));
            }
        });
    }

    setKeyboardListeners() {
        window.addEventListener('keydown', (event) => {
            if (['w', 'W', 'ArrowUp'].includes(event.key)) this.keys.forward = true;
            if (['s', 'S', 'ArrowDown'].includes(event.key)) this.keys.backward = true;
            if (['a', 'A', 'ArrowLeft'].includes(event.key)) this.keys.left = true;
            if (['d', 'D', 'ArrowRight'].includes(event.key)) this.keys.right = true;
        });

        window.addEventListener('keyup', (event) => {
            if (['w', 'W', 'ArrowUp'].includes(event.key)) this.keys.forward = false;
            if (['s', 'S', 'ArrowDown'].includes(event.key)) this.keys.backward = false;
            if (['a', 'A', 'ArrowLeft'].includes(event.key)) this.keys.left = false;
            if (['d', 'D', 'ArrowRight'].includes(event.key)) this.keys.right = false;
        });
    }

    resize() {
        this.instance.aspect = this.sizes.width / this.sizes.height;
        this.instance.updateProjectionMatrix();
    }

   update() {
    this.instance.quaternion.setFromEuler(this.rotation);
    this.move();

    const isAiming = this.experience.world.playerInteraction && 
                     this.experience.world.playerInteraction.state === 'AIMING';

    // if (this.experience.physics && !isAiming) {
    //     this.experience.physics.checkCameraBounds(this.instance.position);
    // }
}

    move() {
    
        const speed = 0.05 * this.time.delta;
        
        // 🔥 تصفير القيم بدلاً من إنشاء كائنات جديدة
        this.movement.set(0, 0, 0);
        this.forward.set(0, 0, 0);
        this.right.set(0, 0, 0);
        
        this.instance.getWorldDirection(this.forward);
        this.forward.y = 0;
        this.forward.normalize();

        this.right.crossVectors(this.forward, this.instance.up).normalize();

        if (this.keys.forward) this.movement.add(this.forward);
        if (this.keys.backward) this.movement.sub(this.forward);
        if (this.keys.right) this.movement.add(this.right);
        if (this.keys.left) this.movement.sub(this.right);

        if (this.movement.lengthSq() > 0) {
            this.movement.normalize().multiplyScalar(speed);
            this.instance.position.add(this.movement);
        }
      
    }
}