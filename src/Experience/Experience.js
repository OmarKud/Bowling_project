import * as THREE from 'three';
import Sizes       from './Utils/Sizes.js';
import Time        from './Utils/Time.js';
import Camera      from './Camera.js';
import Renderer    from './Renderer.js';
import World       from './World/World.js';
 import PhysicsWorld from './Physics/PhysicsWorld/index.js';
 import PhysicsEngine from './Physics/PhysicsEngine.js';
import InputPanel    from './Physics/InputPanel.js';

let instance = null;

export default class Experience {
    constructor(canvas) {
        if (instance) return instance;
        instance = this;
        window.experience = this;

        this.canvas   = canvas;
        this.sizes    = new Sizes();
        this.time     = new Time();
        this.scene    = new THREE.Scene();
        this.camera   = new Camera();
        // Main physics engine
        this.physicsWorld  = new PhysicsWorld();
        this.renderer = new Renderer();
        this.world    = new World();

        // Camera bounds monitor
        this.physicsEngine = new PhysicsEngine();

        // Input panel – triggers launch callback
        this.inputPanel = new InputPanel((settings) => {
            const pins = this.world?.hall?.pins?.pinsArray ?? [];
            if (pins.length === 0) {
                console.warn('Pins not loaded yet. Try again.');
                setTimeout(() => { this.inputPanel.isLaunched = false; }, 500);
                return;
            }
            this.physicsWorld.initializeSimulation(settings, null, pins);
        });
        this.sizes.on(() => this._resize());
        this.time.on(()  => this._update());
    }

    _resize() {
        this.camera.resize();
        this.renderer.resize();
    }

    _update() {
        const dt = this.time.delta * 0.001; // ms → s
        this.camera.update();
        this.world.update();
        this.physicsEngine.update();
    // Run physics only while the ball is in flight
        if (this.inputPanel?.isLaunched) {
            this.physicsWorld.update(dt);
        }
        this.renderer.update();
    }
}
