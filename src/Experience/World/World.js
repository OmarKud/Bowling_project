import * as THREE from 'three';
import Experience from '../Experience.js';

export default class World {
    constructor() {
        this.experience = new Experience();
        this.scene = this.experience.scene;
        this.textureLoader = new THREE.TextureLoader();

        this.isNight = false;

        this.setSky();
        this.setFloor();
        this.setKeyboardListener();
    }

    setSky() {
        this.daySky = this.textureLoader.load('/textures/sky.jpg', (texture) => {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            texture.colorSpace = THREE.SRGBColorSpace;
            if (!this.isNight) this.scene.background = texture;
        });

        this.nightSky = this.textureLoader.load('/textures/night.jpg', (texture) => {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            texture.colorSpace = THREE.SRGBColorSpace;
            if (this.isNight) this.scene.background = texture;
        });
    }

    setFloor() {
        this.geometry = new THREE.PlaneGeometry(10000, 10000);

        this.texture = this.textureLoader.load('/textures/ground_texture.png');
        this.texture.wrapS = THREE.RepeatWrapping;
        this.texture.wrapT = THREE.RepeatWrapping;
        this.texture.repeat.set(1000, 1000);
        this.texture.colorSpace = THREE.SRGBColorSpace;

        this.material = new THREE.MeshBasicMaterial({
            map: this.texture
        });

        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.rotation.x = - Math.PI * 0.5;
        this.scene.add(this.mesh);
    }

    setKeyboardListener() {
        window.addEventListener('keydown', (event) => {
            if (event.key === 'n' || event.key === 'N') {
                this.isNight = !this.isNight;

                // const floorColor = this.isNight ? '#111111' : '#ffffff';
                // this.material.color.set(floorColor);

                if (this.isNight) {
                    if (this.nightSky) this.scene.background = this.nightSky;
                } else {
                    if (this.daySky) this.scene.background = this.daySky;
                }
            }
        });
    }

    update() {

    }
}