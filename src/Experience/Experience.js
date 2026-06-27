import * as THREE from 'three';
import Sizes from './Utils/Sizes.js';
import Time from './Utils/Time.js';
import Camera from './Camera.js';
import Renderer from './Renderer.js';
import World from './World/World.js';
import PhysicsWorld from './Physics/PhysicsWorld.js';
import PhysicsEngine from './Physics/PhysicsEngine.js';
import InputPanel from './Physics/InputPanel.js';

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
        this.physic = new PhysicsWorld();
        this.renderer = new Renderer();
        this.world = new World();
        this.physics = new PhysicsEngine();

        this.sizes.on(() => {
            this.resize();
        });

        this.time.on(() => {
            this.update();
        });
        
        this.inputPanel = new InputPanel((settings) => {
            if (this.world && this.world.ball) {
                this.physic.balls = [this.world.ball];
            }
            if (this.world && this.world.hall && this.world.hall.pins) {
                this.physic.pins = this.world.hall.pins.pinsArray;
            }
            if (typeof this.physic.initializeSimulation === 'function') {
                this.physic.initializeSimulation(settings);
            }
        });
    }

    resize() {
        this.camera.resize();
        this.renderer.resize();
    }

    update() {
        this.camera.update();
       
        this.world.update();
        // في Experience.js داخل دالة update()
 if (this.inputPanel && this.inputPanel.isLaunched) {
            this.physic.update(this.time.deltaTime * 0.001);
        }
        this.renderer.update();

    }
}