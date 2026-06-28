import * as THREE from 'three';

export default class Pins {
    constructor(container, pinModel) {
        this.container = container;
        this.pinModel = pinModel;
        this.totalLanes = 6;
        this.laneComponentWidth = 32;
        this.pinsArray = [];
        
        const box = new THREE.Box3().setFromObject(this.pinModel);
        const center = new THREE.Vector3();
        box.getCenter(center);
        
        this.cleanPinGroup = new THREE.Group();
        this.pinModel.position.sub(center);
        this.cleanPinGroup.add(this.pinModel);

        this.build();
    }

    build() {
        if (!this.pinModel) return;

        const startX = -((this.totalLanes - 1) * this.laneComponentWidth) / 2;
        
        const rowSpacing = 4.5;
        const pinSpacing = 5.2;
        const startZ = -234;
        const pinY = 3.8; 

        const pinLayout = [
            { x: 0, z: 0 },
            { x: -pinSpacing / 2, z: -rowSpacing },
            { x: pinSpacing / 2, z: -rowSpacing },
            { x: -pinSpacing, z: -rowSpacing * 2 },
            { x: 0, z: -rowSpacing * 2 },
            { x: pinSpacing, z: -rowSpacing * 2 },
            { x: -pinSpacing * 1.5, z: -rowSpacing * 3 },
            { x: -pinSpacing / 2, z: -rowSpacing * 3 },
            { x: pinSpacing / 2, z: -rowSpacing * 3 },
            { x: pinSpacing * 1.5, z: -rowSpacing * 3 }
        ];

        for (let i = 0; i < this.totalLanes; i++) {
            const laneX = startX + (i * this.laneComponentWidth);

            pinLayout.forEach((pos, index) => {
                const pinClone = this.cleanPinGroup.clone();
                
                pinClone.scale.set(18, 18, 18);
                pinClone.position.set(laneX + pos.x, pinY, startZ + pos.z);
                
                pinClone.userData = {
                    laneIndex: i,
                    pinIndex: index,
                    initialPosition: pinClone.position.clone(),
                    initialRotation: pinClone.rotation.clone(),
                    velocity: new THREE.Vector3(0, 0, 0),
                    angularVelocity: new THREE.Vector3(0, 0, 0),
                    isFallen: false
                };

                this.container.add(pinClone);
                this.pinsArray.push(pinClone);
            });
        }
    }

    // ─── إعادة جميع الدبابيس لمواضعها وحالتها الأصلية ───────
    resetPins() {
        this.pinsArray.forEach((mesh) => {
            mesh.position.copy(mesh.userData.initialPosition);
            mesh.rotation.copy(mesh.userData.initialRotation);
            mesh.userData.isFallen = false;
            mesh.visible = true;
        });
    }
}