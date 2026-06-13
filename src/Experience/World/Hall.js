import * as THREE from 'three';
import Experience from '../Experience.js';
import CustomBox from './CustomBox.js';
import HallLights from './HallLights.js'; 

export default class Hall {
    constructor() {
        this.experience = new Experience();
        this.scene = this.experience.scene;
        this.camera = this.experience.camera.instance;
        this.textureLoader = new THREE.TextureLoader();

        this.container = new THREE.Group();

        this.doorZ = 208; 
        this.doorWidth = 40; 
        this.doorHeight = 25;
        this.maxOpenDistance = 16; 
        
        this.leftDoorTargetX = -10; 
        this.rightDoorTargetX = 10;  
        this.leftDoorCurrentX = -10;
        this.rightDoorCurrentX = 10;

        this.setMaterials();
        this.buildHallWalls();
        this.buildWallPillars(); 
        this.buildZigZagNeon();
        this.buildFourDroppedCeilings();
        this.buildFrontWallAndGlassDoor();
        
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

        this.glassMaterial = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.3,
            roughness: 0.1,
            metalness: 0.1,
            transmission: 0.9, 
            ior: 1.5,
            thickness: 0.5
        });

        this.doorFrameMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            roughness: 0.4,
            metalness: 0.8
        });
    }

    buildHallWalls() {
        new CustomBox(this.container, 260, 0.2, 416, this.floorMaterial, new THREE.Vector3(0, 0.1, 0));
        new CustomBox(this.container, 0.2, 40, 416, this.lightWallMaterial, new THREE.Vector3(-130, 20, 0));
        new CustomBox(this.container, 0.2, 40, 416, this.lightWallMaterial, new THREE.Vector3(130, 20, 0));
        new CustomBox(this.container, 260, 40, 0.2, this.lightWallMaterial, new THREE.Vector3(0, 20, -208));
        new CustomBox(this.container, 260, 0.2, 416, this.lightWallMaterial, new THREE.Vector3(0, 40, 0));
    }

buildFrontWallAndGlassDoor() {
        const wallZ = this.doorZ;
        const wallHeight = 40;
        const sideWallWidth = 110; 
        const leftWallX = -130 + (sideWallWidth / 2);
        const rightWallX = 130 - (sideWallWidth / 2); 

        new CustomBox(this.container, sideWallWidth, wallHeight, 0.2, this.lightWallMaterial, new THREE.Vector3(leftWallX, wallHeight / 2, wallZ));
        new CustomBox(this.container, sideWallWidth, wallHeight, 0.2, this.lightWallMaterial, new THREE.Vector3(rightWallX, wallHeight / 2, wallZ));
        const topWallHeight = wallHeight - this.doorHeight; 
        const topWallY = this.doorHeight + (topWallHeight / 2); 
        new CustomBox(this.container, this.doorWidth, topWallHeight, 0.2, this.lightWallMaterial, new THREE.Vector3(0, topWallY, wallZ));
        new CustomBox(this.container, this.doorWidth, 0.4, 0.6, this.doorFrameMaterial, new THREE.Vector3(0, this.doorHeight, wallZ));
        new CustomBox(this.container, 0.4, this.doorHeight, 0.6, this.doorFrameMaterial, new THREE.Vector3(-(this.doorWidth / 2), this.doorHeight / 2, wallZ));
        new CustomBox(this.container, 0.4, this.doorHeight, 0.6, this.doorFrameMaterial, new THREE.Vector3((this.doorWidth / 2), this.doorHeight / 2, wallZ));
        const leafWidth = (this.doorWidth / 2) - 0.2; 
        const leafHeight = this.doorHeight - 0.2;

        this.leftDoorGroup = new THREE.Group();
        this.leftDoorGroup.position.set(-leafWidth / 2, leafHeight / 2, wallZ); 
        new CustomBox(this.leftDoorGroup, leafWidth, leafHeight, 0.3, this.glassMaterial, new THREE.Vector3(0, 0, 0));
        new CustomBox(this.leftDoorGroup, leafWidth, 0.3, 0.4, this.doorFrameMaterial, new THREE.Vector3(0, leafHeight/2, 0));
        new CustomBox(this.leftDoorGroup, leafWidth, 0.3, 0.4, this.doorFrameMaterial, new THREE.Vector3(0, -leafHeight/2, 0));
        new CustomBox(this.leftDoorGroup, 0.3, leafHeight, 0.4, this.doorFrameMaterial, new THREE.Vector3(-leafWidth/2, 0, 0));
        new CustomBox(this.leftDoorGroup, 0.3, leafHeight, 0.4, this.doorFrameMaterial, new THREE.Vector3(leafWidth/2, 0, 0));
        
        this.container.add(this.leftDoorGroup);
        this.rightDoorGroup = new THREE.Group();
        this.rightDoorGroup.position.set(leafWidth / 2, leafHeight / 2, wallZ); 
        new CustomBox(this.rightDoorGroup, leafWidth, leafHeight, 0.3, this.glassMaterial, new THREE.Vector3(0, 0, 0));
        new CustomBox(this.rightDoorGroup, leafWidth, 0.3, 0.4, this.doorFrameMaterial, new THREE.Vector3(0, leafHeight/2, 0));
        new CustomBox(this.rightDoorGroup, leafWidth, 0.3, 0.4, this.doorFrameMaterial, new THREE.Vector3(0, -leafHeight/2, 0));
        new CustomBox(this.rightDoorGroup, 0.3, leafHeight, 0.4, this.doorFrameMaterial, new THREE.Vector3(-leafWidth/2, 0, 0));
        new CustomBox(this.rightDoorGroup, 0.3, leafHeight, 0.4, this.doorFrameMaterial, new THREE.Vector3(leafWidth/2, 0, 0));

        this.container.add(this.rightDoorGroup);
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

update() {
        if (!this.camera || !this.leftDoorGroup || !this.rightDoorGroup) return;

        const cameraZ = this.camera.position.z;
        const distanceX = Math.abs(this.camera.position.x);
        const isNearFromInside = (cameraZ <= this.doorZ && (this.doorZ - cameraZ) < 60);
        const isNearFromOutside = (cameraZ > this.doorZ && (cameraZ - this.doorZ) < 60);

        if ((isNearFromInside || isNearFromOutside) && distanceX < 35) {
            this.leftDoorTargetX = -10 - this.maxOpenDistance;
            this.rightDoorTargetX = 10 + this.maxOpenDistance;
            this.isDoorOpen = true; 
        } else {
            this.leftDoorTargetX = -10;
            this.rightDoorTargetX = 10;
            this.isDoorOpen = false;
        }
        this.leftDoorCurrentX += (this.leftDoorTargetX - this.leftDoorCurrentX) * 0.12;
        this.rightDoorCurrentX += (this.rightDoorTargetX - this.rightDoorCurrentX) * 0.12;
        this.leftDoorGroup.position.x = this.leftDoorCurrentX;
        this.rightDoorGroup.position.x = this.rightDoorCurrentX;
    }
}