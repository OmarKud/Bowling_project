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
            this.canvas.requestPointerLock();//hide mouse
        });

        window.addEventListener('mousemove', (event) => {
            if (document.pointerLockElement === this.canvas) {
                const sensitivity = 0.002;
                this.rotation.y -= event.movementX * sensitivity;
                this.rotation.x -= event.movementY * sensitivity;
                this.rotation.x = Math.max(-Math.PI * 0.45, Math.min(Math.PI * 0.45, this.rotation.x));
            }
        });
    }

    setKeyboardListeners() {
        window.addEventListener('keydown', (event) => {
            if (event.key === 'w' || event.key === 'W' || event.key === 'ArrowUp') this.keys.forward = true;
            if (event.key === 's' || event.key === 'S' || event.key === 'ArrowDown') this.keys.backward = true;
            if (event.key === 'a' || event.key === 'A' || event.key === 'ArrowLeft') this.keys.left = true;
            if (event.key === 'd' || event.key === 'D' || event.key === 'ArrowRight') this.keys.right = true;
        });

        window.addEventListener('keyup', (event) => {
            if (event.key === 'w' || event.key === 'W' || event.key === 'ArrowUp') this.keys.forward = false;
            if (event.key === 's' || event.key === 'S' || event.key === 'ArrowDown') this.keys.backward = false;
            if (event.key === 'a' || event.key === 'A' || event.key === 'ArrowLeft') this.keys.left = false;
            if (event.key === 'd' || event.key === 'D' || event.key === 'ArrowRight') this.keys.right = false;
        });
    }

    resize() {
        this.instance.aspect = this.sizes.width / this.sizes.height;
        this.instance.updateProjectionMatrix();
    }

    update() {
        this.instance.quaternion.setFromEuler(this.rotation);
        this.move();
    }

    move() {
        const speed = 0.02 * this.time.delta;
        const movement = new THREE.Vector3();
        const forward = new THREE.Vector3();
        
        this.instance.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();

        const right = new THREE.Vector3();
        right.crossVectors(forward, this.instance.up).normalize();

        if (this.keys.forward) movement.add(forward);
        if (this.keys.backward) movement.sub(forward);
        if (this.keys.right) movement.add(right);
        if (this.keys.left) movement.sub(right);

        if (movement.lengthSq() > 0) {
            movement.normalize().multiplyScalar(speed);
            this.instance.position.add(movement);
        }
    }
}