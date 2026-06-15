import * as THREE from 'three';
import Experience from '../Experience.js';

export default class BowlingLanes {
    constructor(container) {
        this.experience = new Experience();
        this.scene = this.experience.scene;
        this.textureLoader = new THREE.TextureLoader();
        this.container = container;

        this.totalLanes = 6;
        this.laneComponentWidth = 32; 
        this.laneLength = 330;
        this.centerZ = -65;

        this.setMaterials();
        this.buildLanes();
    }

    setMaterials() {
        this.laneTexture = this.textureLoader.load('/textures/bowling_wood_lane.jpg');
        this.laneTexture.wrapS = THREE.RepeatWrapping;
        this.laneTexture.wrapT = THREE.RepeatWrapping;
        this.laneTexture.repeat.set(3, 35);

        this.laneMaterial = new THREE.MeshStandardMaterial({
            map: this.laneTexture,
            color: 0xffffff,
            roughness: 0.04,
            metalness: 0.1
        });

        this.gutterTexture = this.textureLoader.load('/textures/purple3.jpg');
        this.gutterTexture.wrapS = THREE.RepeatWrapping;
        this.gutterTexture.wrapT = THREE.RepeatWrapping;
        this.gutterTexture.repeat.set(1, 25);

        this.gutterMaterial = new THREE.MeshStandardMaterial({
            map: this.gutterTexture,
            color: 0xffffff,
            roughness: 0.3,
            metalness: 0.2,
            emissive: 0x220044,
            emissiveIntensity: 1.0
        });

        this.dividerMaterial = new THREE.MeshStandardMaterial({
            color: 0x050505,
            roughness: 0.02,         
            metalness: 0.9,          
            clearcoat: 1.0,          
            clearcoatRoughness: 0.05
        });

        this.laneNeonMaterial = new THREE.MeshStandardMaterial({
            color: 0x6600ff,
            emissive: 0x6600ff, 
            emissiveIntensity: 3.5
        });
    }

    buildLanes() {
        const laneWidth = 21; 
        const gutterWidth = 3; 
        const cappingRadius = 2.5; 

        this.laneGeometry = new THREE.BoxGeometry(laneWidth, 0.2, this.laneLength);
        this.gutterGeometry = new THREE.BoxGeometry(gutterWidth, 0.1, this.laneLength);
        
        this.dividerGeometry = new THREE.CylinderGeometry(cappingRadius, cappingRadius, this.laneLength, 64);
        this.laneNeonGeometry = new THREE.BoxGeometry(0.3, 0.05, this.laneLength);

        const startX = -((this.totalLanes - 1) * this.laneComponentWidth) / 2;

        for (let i = 0; i < this.totalLanes; i++) {
            const xPos = startX + (i * this.laneComponentWidth);

            const laneMesh = new THREE.Mesh(this.laneGeometry, this.laneMaterial);
            laneMesh.position.set(xPos, 0.2, this.centerZ);
            this.container.add(laneMesh);

            const leftGutter = new THREE.Mesh(this.gutterGeometry, this.gutterMaterial);
            leftGutter.position.set(xPos - (laneWidth / 2) - (gutterWidth / 2), 0.22, this.centerZ);
            this.container.add(leftGutter);

            const rightGutter = new THREE.Mesh(this.gutterGeometry, this.gutterMaterial);
            rightGutter.position.set(xPos + (laneWidth / 2) + (gutterWidth / 2), 0.22, this.centerZ);
            this.container.add(rightGutter);

            if (i < this.totalLanes - 1) {
                const cappingX = xPos + (this.laneComponentWidth / 2);

                const dividerMesh = new THREE.Mesh(this.dividerGeometry, this.dividerMaterial);
                dividerMesh.position.set(cappingX, 0.2, this.centerZ);
                dividerMesh.rotation.x = Math.PI * 0.5;
                dividerMesh.scale.set(1, 1, 0.55); 
                this.container.add(dividerMesh);

                const laneNeon = new THREE.Mesh(this.laneNeonGeometry, this.laneNeonMaterial);
                laneNeon.position.set(cappingX, 1.6, this.centerZ); 
                this.container.add(laneNeon);
            }
        }

        const leftOuterX = startX - (this.laneComponentWidth / 2);
        const rightOuterX = startX + (this.totalLanes * this.laneComponentWidth) - (this.laneComponentWidth / 2);
        const outerPositions = [leftOuterX, rightOuterX];

        for (let i = 0; i < outerPositions.length; i++) {
            const outerDividerMesh = new THREE.Mesh(this.dividerGeometry, this.dividerMaterial);
            outerDividerMesh.position.set(outerPositions[i], 0.2, this.centerZ);
            outerDividerMesh.rotation.x = Math.PI * 0.5;
            outerDividerMesh.scale.set(1, 1, 0.55); 
            this.container.add(outerDividerMesh);

            const outerLaneNeon = new THREE.Mesh(this.laneNeonGeometry, this.laneNeonMaterial);
            outerLaneNeon.position.set(outerPositions[i], 1.6, this.centerZ); 
            this.container.add(outerLaneNeon);
        }
    }
}