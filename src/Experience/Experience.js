import * as THREE from 'three';
import Sizes from './Utils/Sizes.js';
import Time from './Utils/Time.js';
import Camera from './Camera.js';
import Renderer from './Renderer.js';
import World from './World/World.js';
import PhysicsEngine from './Physics/PhysicsEngine.js';

let instance = null;

export default class Experience {
    constructor(canvas) {
        if (instance) {
            return instance;
        }
        instance = this;

        window.experience = this;

        this.canvas = canvas;
        this.sizes = new Sizes();
        this.time = new Time();
        this.scene = new THREE.Scene();
        this.camera = new Camera();
        this.physics = new PhysicsEngine();
        this.renderer = new Renderer();
        this.world = new World();

        this.sizes.on(() => {
            this.resize();
        });

        this.time.on(() => {
            this.update();
        });
    }

    resize() {
        this.camera.resize();
        this.renderer.resize();
    }

    update() {
        this.camera.update();
        this.physics.update();
        this.world.update();
        this.renderer.update();
    }
}