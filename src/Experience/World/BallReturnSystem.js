import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import Experience from '../Experience.js';

export default class BallReturnSystem {
    constructor(container, ballReturnMaterial, pillarMaterial) {
        this.experience = new Experience();
        this.scene = this.experience.scene;
        this.container = container; 
        this.ballReturnMaterial = ballReturnMaterial;
        this.pillarMaterial = pillarMaterial;
        this.gltfLoader = new GLTFLoader();
        this.interactiveBalls = []; 
        this.positionsX = [-45, 0, 45]; 
        this.posZ = 200; 
        this.ballColors = ['#ff5e5e', '#5eb1ff', '#61ff80', '#ffc45e'];
        this.loadModels();
    }

    loadModels() {
        this.gltfLoader.load(
            '/models/bowling_return.glb', 
            (gltf) => {
                const baseModel = gltf.scene;
                const box = new THREE.Box3().setFromObject(baseModel);
                const center = new THREE.Vector3();
                box.getCenter(center);
                baseModel.position.sub(center); 
                const wrapper = new THREE.Group();
                wrapper.add(baseModel);
                baseModel.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        if (child.material) {
                            child.material.roughness = 0.3;
                            child.material.metalness = 0.5;
                        }
                    }
                });
                this.positionsX.forEach((xPosition) => {
                    const modelClone = wrapper.clone();
                    modelClone.scale.set(18, 18, 13); 
                    modelClone.rotation.y = Math.PI;
                    modelClone.position.set(xPosition, 0, this.posZ);
                    
                    this.container.add(modelClone);
                });
                this.loadBalls();
            },
            null,
        );
    }

    loadBalls() {
        this.gltfLoader.load(
            '/models/bowling_ball.glb',
            (gltf) => {
                const baseBall = gltf.scene;
                const box = new THREE.Box3().setFromObject(baseBall);
                const center = new THREE.Vector3();
                box.getCenter(center);
                baseBall.position.sub(center);
                this.positionsX.forEach((xPosition) => {
                    for (let i = 0; i < 4; i++) {
                        const ballClone = baseBall.clone();
                        ballClone.scale.set(2.7, 2.7, 2.7);
                        ballClone.traverse((child) => {
                            if (child.isMesh && child.material) {
                                child.castShadow = true;
                                child.receiveShadow = true;
                                child.material = child.material.clone();
                                child.material.color.set(this.ballColors[i]);
                                child.material.roughness = 0.2;
                                child.material.metalness = 0.2;
                                if (child.material.emissive) {
            child.material.emissive.set(this.ballColors[i]);
            child.material.emissiveIntensity = 0.01; 
        }
                            }
                        });
                        const ballX = xPosition; 
                        const ballY = 3.5; 
                        const ballZ = this.posZ + (i * 5.7) - 5; 

                        ballClone.position.set(ballX, ballY, ballZ);
                        ballClone.userData = {
                            isPickable: true,
                            originalPosition: ballClone.position.clone(),
                            ballIndex: i,
                            color: this.ballColors[i]
                        };
                        this.interactiveBalls.push(ballClone);
                        this.container.add(ballClone);
                    }
                });
            },
            null,
        );
    }
}