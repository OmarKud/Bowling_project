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

        // physicsWorld: المحرك الفيزيائي الرئيسي (RK4، تصادمات، إلخ)
        this.physicsWorld  = new PhysicsWorld();

        this.renderer = new Renderer();
        this.world    = new World();

        // physicsEngine: مُراقب الكاميرا والحدود فقط
        this.physicsEngine = new PhysicsEngine();

        // InputPanel: يأخذ callback يُشغَّل عند الضغط على Launch
        this.inputPanel = new InputPanel((settings) => {
            // الدبابيس تُحمَّل بشكل async عبر GLTFLoader — ننتظر حتى تكون جاهزة
            const pins = this.world?.hall?.pins?.pinsArray ?? [];

            if (pins.length === 0) {
                console.warn('⚠️ الدبابيس لم تُحمَّل بعد. حاول مرة أخرى بعد ثانية.');
                // أعد تفعيل الزر
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

        // تشغيل المحرك الفيزيائي فقط عندما تكون الكرة في الهواء
        if (this.inputPanel?.isLaunched) {
            this.physicsWorld.update(dt);
        }

        this.renderer.update();
    }
}
