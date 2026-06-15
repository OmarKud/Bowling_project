import * as THREE from 'three';
import CustomBox from './CustomBox.js';

export default class BowlingScreens {
    constructor(container, screenFrameMaterial) {
        this.container = container;
        this.screenFrameMaterial = screenFrameMaterial;
        this.laneXPositions = [-80, -48, -16, 16, 48, 80];
        this.screenZ = -80;
        this.screenY = 36;
        this.buildScreens();
    }

    buildScreens() {
        const pairCenters = [
            { x: -64, lanes: [0, 1] }, 
            { x: 0,   lanes: [2, 3] }, 
            { x: 64,  lanes: [4, 5] } 
        ];
        const slantAngle = Math.PI * 0.06; 

        pairCenters.forEach((pair) => {
            const pairGroup = new THREE.Group();
            pairGroup.position.set(pair.x, this.screenY, this.screenZ);
            this.container.add(pairGroup);
            new CustomBox(pairGroup, 0.6, 16, 0.6, this.screenFrameMaterial, new THREE.Vector3(-16.5, 8, 0));
            new CustomBox(pairGroup, 0.6, 16, 0.6, this.screenFrameMaterial, new THREE.Vector3(16.5, 8, 0));
            const tiltedGroup = new THREE.Group();
            tiltedGroup.rotation.x = slantAngle;
            pairGroup.add(tiltedGroup);
            new CustomBox(tiltedGroup, 33.5, 12, 0.8, this.screenFrameMaterial, new THREE.Vector3(0, 0, 0));
            pair.lanes.forEach((laneIndex, i) => {
                const localX = i === 0 ? -8.1 : 8.1;
                const canvas = document.createElement('canvas');
                canvas.width = 512;
                canvas.height = 256;
                const context = canvas.getContext('2d');
                context.fillStyle = '#050c1a';
                context.fillRect(0, 0, 512, 256);
                context.strokeStyle = '#00ffff';
                context.lineWidth = 6;
                context.strokeRect(10, 10, 492, 236);
                context.fillStyle = '#00ffff';
                context.font = 'Bold 44px Arial';
                context.fillText(`LANE 0${laneIndex + 1}`, 45, 70);
                context.fillStyle = '#ffffff';
                context.font = '32px Courier New';
                context.fillText('PLAYER 1 : 124', 45, 140);
                context.fillText('PLAYER 2 : 098', 45, 195);
                
                const canvasTexture = new THREE.CanvasTexture(canvas);
                const dynamicScreenMaterial = new THREE.MeshStandardMaterial({
                    map: canvasTexture,
                    emissive: 0xffffff,
                    emissiveMap: canvasTexture,
                    emissiveIntensity: 0.9, 
                    roughness: 0.1
                });
                new CustomBox(tiltedGroup, 15.8, 11.4, 0.1, dynamicScreenMaterial, new THREE.Vector3(localX, 0, 0.41));
            });
        });
    }
}