import * as THREE from 'three';
import Experience from '../Experience.js';
import CustomBox from './CustomBox.js';
import HallLights from './HallLights.js'; 
import BowlingScreens from './BowlingScreens.js';
import BallReturnSystem from './BallReturnSystem.js';
import BowlingLanes from './BowlingLanes.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import MaskingWall from './MaskingWall.js'; 
import Pins from './Pins.js';

export default class Hall {
    constructor() {
        this.experience = new Experience();
        this.scene = this.experience.scene;
        this.camera = this.experience.camera.instance;
        this.textureLoader = new THREE.TextureLoader();
        this.gltfLoader = new GLTFLoader();

        this.container = new THREE.Group();

        this.doorZ = 270; 
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
        this.bowlingScreens = new BowlingScreens(this.container, this.screenFrameMaterial);
        this.ballReturnSystem = new BallReturnSystem(this.container, this.ballReturnMaterial, this.pillarMaterial);
        this.buildFrontGridPanels(); 
        this.buildSodaFridge();
        this.buildSecondSodaFridge(); 
        this.buildNeonSignOnBackWall(); 
        
        this.bowlingLanes = new BowlingLanes(this.container);
        this.maskingWall = new MaskingWall(this.container);

        this.gltfLoader.load('/models/bowling_pin.glb', (gltf) => {
            const pinModel = gltf.scene;
            this.pins = new Pins(this.container, pinModel);
        });

        this.lights = new HallLights(this.container, this.scene);
        
        this.container.traverse((child) => {
            if (child.isMesh && !child.userData.isDynamic) {
                child.matrixAutoUpdate = false;
                child.updateMatrix();
            }
        });

        this.scene.add(this.container);
    }

    setMaterials() {
        this.wallTexture = this.textureLoader.load('/textures/plastered_wall.jpg');
        this.wallTexture.wrapS = THREE.RepeatWrapping;
        this.wallTexture.wrapT = THREE.RepeatWrapping;
        this.wallTexture.repeat.set(12, 4);

        this.floorTexture = this.textureLoader.load('/textures/bowling_wood_lane.jpg');
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

        this.gridNeonMaterial = new THREE.MeshStandardMaterial({
            color: 0x000000,
            emissive: 0xffffff,
            emissiveIntensity: 5
        });

        this.glassMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.2,
            roughness: 0.1,
            metalness: 0.9
        });

        this.doorFrameMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            roughness: 0.4,
            metalness: 0.8
        });

        this.screenFrameMaterial = new THREE.MeshStandardMaterial({
            color: 0x0a0a0a,
            roughness: 0.3,
            metalness: 0.7
        });

        this.ballReturnMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a1a1a,
            roughness: 0.2,
            metalness: 0.6
        });
    }

    buildHallWalls() {
        new CustomBox(this.container, 260, 0.2, 540, this.floorMaterial, new THREE.Vector3(0, 0.1, 0));
        new CustomBox(this.container, 0.2, 52, 540, this.lightWallMaterial, new THREE.Vector3(-130, 26, 0));
        new CustomBox(this.container, 0.2, 52, 540, this.lightWallMaterial, new THREE.Vector3(130, 26, 0));
        new CustomBox(this.container, 260, 52, 0.2, this.lightWallMaterial, new THREE.Vector3(0, 26, -270));
        new CustomBox(this.container, 260, 0.2, 540, this.lightWallMaterial, new THREE.Vector3(0, 52, 0));
    }

    buildFrontWallAndGlassDoor() {
        const wallZ = this.doorZ;
        const wallHeight = 52; 
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
        this.leftDoorGroup.userData.isDynamic = true;
        this.leftDoorGroup.position.set(this.leftDoorCurrentX, leafHeight / 2, wallZ); 
        new CustomBox(this.leftDoorGroup, leafWidth, leafHeight, 0.3, this.glassMaterial, new THREE.Vector3(0, 0, 0));
        new CustomBox(this.leftDoorGroup, leafWidth, 0.3, 0.4, this.doorFrameMaterial, new THREE.Vector3(0, leafHeight/2, 0));
        new CustomBox(this.leftDoorGroup, leafWidth, 0.3, 0.4, this.doorFrameMaterial, new THREE.Vector3(0, -leafHeight/2, 0));
        new CustomBox(this.leftDoorGroup, 0.3, leafHeight, 0.4, this.doorFrameMaterial, new THREE.Vector3(-leafWidth/2, 0, 0));
        new CustomBox(this.leftDoorGroup, 0.3, leafHeight, 0.4, this.doorFrameMaterial, new THREE.Vector3(leafWidth/2, 0, 0));
        this.container.add(this.leftDoorGroup);
        
        this.rightDoorGroup = new THREE.Group();
        this.rightDoorGroup.userData.isDynamic = true;
        this.rightDoorGroup.position.set(this.rightDoorCurrentX, leafHeight / 2, wallZ); 
        new CustomBox(this.rightDoorGroup, leafWidth, leafHeight, 0.3, this.glassMaterial, new THREE.Vector3(0, 0, 0));
        new CustomBox(this.rightDoorGroup, leafWidth, 0.3, 0.4, this.doorFrameMaterial, new THREE.Vector3(0, leafHeight/2, 0));
        new CustomBox(this.rightDoorGroup, leafWidth, 0.3, 0.4, this.doorFrameMaterial, new THREE.Vector3(0, -leafHeight/2, 0));
        new CustomBox(this.rightDoorGroup, 0.3, leafHeight, 0.4, this.doorFrameMaterial, new THREE.Vector3(-leafWidth/2, 0, 0));
        new CustomBox(this.rightDoorGroup, 0.3, leafHeight, 0.4, this.doorFrameMaterial, new THREE.Vector3(leafWidth/2, 0, 0));
        this.container.add(this.rightDoorGroup);
    }

    buildWallPillars() {
        const totalPillars = 12; 
        const startZ = 240;      
        const spacingZ = 45;

        for (let i = 0; i < totalPillars; i++) {
            const zPos = startZ - (i * spacingZ);
            new CustomBox(this.container, 1.5, 52, 4, this.pillarMaterial, new THREE.Vector3(-129.2, 26, zPos));
            new CustomBox(this.container, 1.5, 52, 4, this.pillarMaterial, new THREE.Vector3(129.2, 26, zPos));
        }
    }

    buildZigZagNeon() {
        const segmentLength = 54;
        const totalSegments = 10; 
        const startZ = 270;      

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
        const dropY = 50.5;

        const ceilingDepth = 330;
        const centerZ = -65; 
        const frontEdgeZ = 100; 

        this.spotGeometry = new THREE.CylinderGeometry(0.6, 0.6, 0.1, 16);

        const dropHeight = 8.5; 
        const dropDepth = 40;   
        const slantLength = Math.hypot(dropDepth, dropHeight); 
        const slantAngle = -Math.atan(dropHeight / dropDepth); 

        for (let i = 0; i < totalCeilings; i++) {
            const xPos = startX + (i * spacingX);

            new CustomBox(this.container, ceilingWidth, 0.2, ceilingDepth, this.bottomCeilingMaterial, new THREE.Vector3(xPos, dropY, centerZ));
            new CustomBox(this.container, 0.2, 1.5, ceilingDepth, this.edgeMaterial, new THREE.Vector3(xPos - (ceilingWidth * 0.5), dropY + 0.75, centerZ));
            new CustomBox(this.container, 0.2, 1.5, ceilingDepth, this.edgeMaterial, new THREE.Vector3(xPos + (ceilingWidth * 0.5), dropY + 0.75, centerZ));
            new CustomBox(this.container, ceilingWidth, 1.5, 0.2, this.edgeMaterial, new THREE.Vector3(xPos, dropY + 0.75, frontEdgeZ));

            const blockNeonMaterial = i % 2 === 0 ? this.cyanNeonMaterial : this.magentaNeonMaterial;

            new CustomBox(this.container, 0.1, 0.1, ceilingDepth, blockNeonMaterial, new THREE.Vector3(xPos - (ceilingWidth * 0.5) - 0.1, dropY + 1.4, centerZ));
            new CustomBox(this.container, 0.1, 0.1, ceilingDepth, blockNeonMaterial, new THREE.Vector3(xPos + (ceilingWidth * 0.5) + 0.1, dropY + 1.4, centerZ));
            new CustomBox(this.container, ceilingWidth + 0.2, 0.1, 0.2, blockNeonMaterial, new THREE.Vector3(xPos, dropY + 1.4, frontEdgeZ));

            for (let j = 3; j < 10; j++) {
                const zPos = 180 - (j * 40); 
                const spotMesh = new THREE.Mesh(this.spotGeometry, this.spotLightMaterial);
                spotMesh.position.set(xPos, dropY - 0.05, zPos); 
                this.container.add(spotMesh);
            }

            const slantGroup = new THREE.Group();
            slantGroup.position.set(xPos, dropY, -230); 
            slantGroup.rotation.x = slantAngle; 

            const localZ = -slantLength * 0.5;

            new CustomBox(slantGroup, ceilingWidth, 0.2, slantLength, this.bottomCeilingMaterial, new THREE.Vector3(0, 0, localZ));
            new CustomBox(slantGroup, 0.2, 1.5, slantLength, this.edgeMaterial, new THREE.Vector3(-(ceilingWidth * 0.5), 0.75, localZ));
            new CustomBox(slantGroup, 0.2, 1.5, slantLength, this.edgeMaterial, new THREE.Vector3((ceilingWidth * 0.5), 0.75, localZ));
            new CustomBox(slantGroup, ceilingWidth, 1.5, 0.2, this.edgeMaterial, new THREE.Vector3(0, 0.75, -slantLength));

            new CustomBox(slantGroup, 0.1, 0.1, slantLength, blockNeonMaterial, new THREE.Vector3(-(ceilingWidth * 0.5) - 0.1, 1.4, localZ));
            new CustomBox(slantGroup, 0.1, 0.1, slantLength, blockNeonMaterial, new THREE.Vector3((ceilingWidth * 0.5) + 0.1, 1.4, localZ));
            new CustomBox(slantGroup, ceilingWidth + 0.2, 0.1, 0.2, blockNeonMaterial, new THREE.Vector3(0, 1.4, -slantLength + 0.25));

            this.container.add(slantGroup);
        }
    }

    buildFrontGridPanels() {
        const totalGridX = 4;
        const totalGridZ = 2;
        const spacingX = 65;
        const spacingZ = 45;
        const startX = -97.5;
        const startZ = 135;

        for (let i = 0; i < totalGridX; i++) {
            const xPos = startX + (i * spacingX);

            for (let j = 0; j < totalGridZ; j++) {
                const zPos = startZ + (j * spacingZ);

                new CustomBox(this.container, 12, 0.1, 12, this.edgeMaterial, new THREE.Vector3(xPos, 51.9, zPos));
                new CustomBox(this.container, 10, 0.12, 10, this.gridNeonMaterial, new THREE.Vector3(xPos, 51.88, zPos));
            }
        }
    }

    buildNeonSignOnBackWall() {
        const neonTexture = this.textureLoader.load('/textures/bowling_sign1.png');
        neonTexture.generateMipmaps = false; 
        neonTexture.minFilter = THREE.LinearFilter;
        neonTexture.magFilter = THREE.LinearFilter;

        const signMaterial = new THREE.MeshBasicMaterial({
            map: neonTexture,          
            transparent: true,        
            alphaTest: 0.1,          
            side: THREE.DoubleSide 
        });

        const signGeometry = new THREE.PlaneGeometry(140, 60);
        const neonMesh = new THREE.Mesh(signGeometry, signMaterial);
       
        neonMesh.position.set(0, 33, -229.1);
        neonMesh.rotation.y = 0; 

        this.container.add(neonMesh);
    }

    buildSodaFridge() {
        const fridgeGroup = new THREE.Group();
        fridgeGroup.position.set(-110, 0.1, -260); 
        this.container.add(fridgeGroup);

        this.gltfLoader.load('/models/soda_fridge1.glb', (gltf) => {
            const model = gltf.scene;
            model.scale.set(20, 20, 20); 
            model.rotation.y = 0; 
            fridgeGroup.add(model);
        });
    }

   buildSecondSodaFridge() {
        const fridgeGroup = new THREE.Group();
        fridgeGroup.position.set(88, 0.1, -260); 
        this.container.add(fridgeGroup);

        this.gltfLoader.load('/models/soda_fridge.glb', (gltf) => {
            const model = gltf.scene;
            model.scale.set(0.040, 0.040, 0.040); 
            model.rotation.y = -Math.PI / 2; 
            fridgeGroup.add(model);
        });
    }

    update() {
        if (!this.camera || !this.leftDoorGroup || !this.rightDoorGroup) return;

        const cameraZ = this.camera.position.z;
        const distanceX = Math.abs(this.camera.position.x);
        
        const isNearFromInside = (cameraZ <= this.doorZ && (this.doorZ - cameraZ) < 40);
        const isNearFromOutside = (cameraZ > this.doorZ && (cameraZ - this.doorZ) < 40);

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