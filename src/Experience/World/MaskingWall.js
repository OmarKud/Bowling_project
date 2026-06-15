import * as THREE from 'three';
import CustomBox from './CustomBox.js';

export default class MaskingWall {
    constructor(container) {
        this.container = container;
        this.textureLoader = new THREE.TextureLoader();

        this.totalLanes = 6;
        this.laneComponentWidth = 32;
        this.hallWidth = 260; 

        this.setMaterials();
        this.build();
    }

    setMaterials() {
        this.wallTexture = this.textureLoader.load('/textures/plastered_wall.jpg');
        this.wallTexture.wrapS = THREE.RepeatWrapping;
        this.wallTexture.wrapT = THREE.RepeatWrapping;
        this.wallTexture.repeat.set(6, 2);

        this.maskWallMaterial = new THREE.MeshStandardMaterial({
            map: this.wallTexture,
            color: 0x222222, 
            roughness: 0.8,
            metalness: 0.05
        });

        this.partitionMaterial = new THREE.MeshStandardMaterial({
            color: 0x111111,
            roughness: 0.5,
            metalness: 0.2
        });
    }

    build() {
        const lanesClusterWidth = this.totalLanes * this.laneComponentWidth; 
        const wallHeight = 38; 
        const wallY = 52 - (wallHeight / 2); 
        
        new CustomBox(this.container, lanesClusterWidth, wallHeight, 1.5, this.maskWallMaterial, new THREE.Vector3(0, wallY, -230));

        const pitDepth = 40;
        const pitCenterZ = -250;
        const fullHeight = 52;
        const fullHeightY = fullHeight / 2;

        new CustomBox(this.container, 1.5, fullHeight, pitDepth, this.maskWallMaterial, new THREE.Vector3(-(lanesClusterWidth / 2), fullHeightY, pitCenterZ));
        new CustomBox(this.container, 1.5, fullHeight, pitDepth, this.maskWallMaterial, new THREE.Vector3((lanesClusterWidth / 2), fullHeightY, pitCenterZ));

        const startX = -((this.totalLanes - 1) * this.laneComponentWidth) / 2; 

        for (let i = 1; i < this.totalLanes; i++) {
            const xDividerPos = (startX - (this.laneComponentWidth / 2)) + (i * this.laneComponentWidth);
            new CustomBox(this.container, 1.0, 14, pitDepth, this.partitionMaterial, new THREE.Vector3(xDividerPos, 7, pitCenterZ));
        }
    }
}