import * as THREE from 'three';
import Experience from '../Experience.js';
import CustomBox from './CustomBox.js';
import HallLights from './HallLights.js'; 

export default class Hall {
    constructor() {
        this.experience = new Experience();
        this.scene = this.experience.scene;
        this.textureLoader = new THREE.TextureLoader();

        this.container = new THREE.Group();

        this.setMaterials();
        this.buildHallWalls();
        this.buildWallPillars(); 
        this.buildZigZagNeon();
        this.buildFourDroppedCeilings();
        
        this.lights = new HallLights(this.container, this.scene);
        
        this.scene.add(this.container);
    }

    setMaterials() {
        this.wallTexture = this.textureLoader.load('/textures/plastered_wall.jpg');
        this.wallTexture.wrapS = THREE.RepeatWrapping;
        this.wallTexture.wrapT = THREE.RepeatWrapping;
        this.wallTexture.repeat.set(12, 4);

        this.floorTexture = this.textureLoader.load('/textures/rectangular.jpg');
        this.floorTexture.wrapS = THREE.RepeatWrapping;
        this.floorTexture.wrapT = THREE.RepeatWrapping;
        this.floorTexture.repeat.set(16, 24);

        this.ceilingTexture = this.textureLoader.load('/textures/plastered.jpg');
        this.ceilingTexture.wrapS = THREE.RepeatWrapping;
        this.ceilingTexture.wrapT = THREE.RepeatWrapping;
        this.ceilingTexture.repeat.set(6, 20);

        this.floorMaterial = new THREE.MeshStandardMaterial({
            map: this.floorTexture,
            roughness: 0.05,
            metalness: 0.15
        });

        this.lightWallMaterial = new THREE.MeshStandardMaterial({
            map: this.wallTexture,
            color: 0x222222, 
            roughness: 0.8,
            metalness: 0.05
        });

        this.pillarMaterial = new THREE.MeshStandardMaterial({
            color: 0x111111,
            roughness: 0.5,
            metalness: 0.2
        });

        this.bottomCeilingMaterial = new THREE.MeshStandardMaterial({
            map: this.ceilingTexture,
            color: 0xffffff,
            roughness: 0.6,
            metalness: 0.1
        });

        this.edgeMaterial = new THREE.MeshStandardMaterial({
            color: 0x555555, 
            roughness: 0.8,
            metalness: 0.0
        });

        this.cyanNeonMaterial = new THREE.MeshStandardMaterial({
            color: 0x000000,
            emissive: 0x00ffff,
            emissiveIntensity: 6
        });

        this.magentaNeonMaterial = new THREE.MeshStandardMaterial({
            color: 0x000000,
            emissive: 0xff00ff,
            emissiveIntensity: 7
        });

        this.spotLightMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0xffffff,
            emissiveIntensity: 5
        });
    }

    buildHallWalls() {
        new CustomBox(this.container, 260, 0.2, 416, this.floorMaterial, new THREE.Vector3(0, 0.1, 0));
        new CustomBox(this.container, 0.2, 40, 416, this.lightWallMaterial, new THREE.Vector3(-130, 20, 0));
        new CustomBox(this.container, 0.2, 40, 416, this.lightWallMaterial, new THREE.Vector3(130, 20, 0));
        new CustomBox(this.container, 260, 40, 0.2, this.lightWallMaterial, new THREE.Vector3(0, 20, -208));
        new CustomBox(this.container, 260, 0.2, 416, this.lightWallMaterial, new THREE.Vector3(0, 40, 0));
    }

    buildWallPillars() {
        const totalPillars = 9; 
        const startZ = 180;     
        const spacingZ = 45;

        for (let i = 0; i < totalPillars; i++) {
            const zPos = startZ - (i * spacingZ);
            new CustomBox(this.container, 1.5, 40, 4, this.pillarMaterial, new THREE.Vector3(-129.2, 20, zPos));
            new CustomBox(this.container, 1.5, 40, 4, this.pillarMaterial, new THREE.Vector3(129.2, 20, zPos));
        }
    }

    buildZigZagNeon() {
        const segmentLength = 52;
        const totalSegments = 8; 
        const startZ = 208;      

        for (let i = 0; i < totalSegments; i++) {
            const currentZ = startZ - (i * segmentLength) - (segmentLength * 0.5);
            const isEven = i % 2 === 0;

            const rotLeft = new THREE.Euler(isEven ? Math.PI * 0.05 : -Math.PI * 0.05, 0, 0);
            const rotRight = new THREE.Euler(isEven ? -Math.PI * 0.05 : Math.PI * 0.05, 0, 0);

            new CustomBox(this.container, 0.25, 0.3, segmentLength, this.cyanNeonMaterial, new THREE.Vector3(-128.3, isEven ? 24 : 16, currentZ), rotLeft);
            new CustomBox(this.container, 0.25, 0.3, segmentLength, this.magentaNeonMaterial, new THREE.Vector3(-128.3, isEven ? 16 : 8, currentZ), rotLeft);
            new CustomBox(this.container, 0.25, 0.3, segmentLength, this.cyanNeonMaterial, new THREE.Vector3(128.3, isEven ? 24 : 16, currentZ), rotRight);
            new CustomBox(this.container, 0.25, 0.3, segmentLength, this.magentaNeonMaterial, new THREE.Vector3(128.3, isEven ? 16 : 8, currentZ), rotRight);
        }
    }

    buildFourDroppedCeilings() {
        const totalCeilings = 4;
        const ceilingWidth = 40;
        const spacingX = 48;
        const startX = -72; 
        const dropY = 38.5;

        const dropHeight = 8.5; 
        const dropDepth = 20;   
        const slantLength = Math.hypot(dropDepth, dropHeight); 
        const slantAngle = -Math.atan(dropHeight / dropDepth); 

        for (let i = 0; i < totalCeilings; i++) {
            const xPos = startX + (i * spacingX);

            new CustomBox(this.container, ceilingWidth, 0.2, 391, this.bottomCeilingMaterial, new THREE.Vector3(xPos, dropY, 12.5));
            new CustomBox(this.container, 0.2, 1.5, 391, this.edgeMaterial, new THREE.Vector3(xPos - (ceilingWidth * 0.5), dropY + 0.75, 12.5));
            new CustomBox(this.container, 0.2, 1.5, 391, this.edgeMaterial, new THREE.Vector3(xPos + (ceilingWidth * 0.5), dropY + 0.75, 12.5));
            new CustomBox(this.container, ceilingWidth, 1.5, 0.2, this.edgeMaterial, new THREE.Vector3(xPos, dropY + 0.75, 208));

            new CustomBox(this.container, 0.1, 0.1, 391, this.cyanNeonMaterial, new THREE.Vector3(xPos - (ceilingWidth * 0.5) - 0.1, dropY + 1.4, 12.5));
            new CustomBox(this.container, 0.1, 0.1, 391, this.cyanNeonMaterial, new THREE.Vector3(xPos + (ceilingWidth * 0.5) + 0.1, dropY + 1.4, 12.5));
            new CustomBox(this.container, ceilingWidth + 0.2, 0.1, 0.2, this.cyanNeonMaterial, new THREE.Vector3(xPos, dropY + 1.4, 208));

            for (let j = 0; j < 10; j++) {
                const zPos = 180 - (j * 40); 
                const spotGeometry = new THREE.CylinderGeometry(0.6, 0.6, 0.1, 16);
                const spotMesh = new THREE.Mesh(spotGeometry, this.spotLightMaterial);
                spotMesh.position.set(xPos, dropY - 0.05, zPos); 
                this.container.add(spotMesh);
            }

            const slantGroup = new THREE.Group();
            slantGroup.position.set(xPos, dropY, -183); 
            slantGroup.rotation.x = slantAngle; 

            const localZ = -slantLength * 0.5;

            new CustomBox(slantGroup, ceilingWidth, 0.2, slantLength, this.bottomCeilingMaterial, new THREE.Vector3(0, 0, localZ));
            new CustomBox(slantGroup, 0.2, 1.5, slantLength, this.edgeMaterial, new THREE.Vector3(-(ceilingWidth * 0.5), 0.75, localZ));
            new CustomBox(slantGroup, 0.2, 1.5, slantLength, this.edgeMaterial, new THREE.Vector3((ceilingWidth * 0.5), 0.75, localZ));
            new CustomBox(slantGroup, ceilingWidth, 1.5, 0.2, this.edgeMaterial, new THREE.Vector3(0, 0.75, -slantLength));

            new CustomBox(slantGroup, 0.1, 0.1, slantLength, this.cyanNeonMaterial, new THREE.Vector3(-(ceilingWidth * 0.5) - 0.1, 1.4, localZ));
            new CustomBox(slantGroup, 0.1, 0.1, slantLength, this.cyanNeonMaterial, new THREE.Vector3((ceilingWidth * 0.5) + 0.1, 1.4, localZ));
            new CustomBox(slantGroup, ceilingWidth + 0.2, 0.1, 0.2, this.cyanNeonMaterial, new THREE.Vector3(0, 1.4, -slantLength + 0.25));

            this.container.add(slantGroup);
        }
    }
}