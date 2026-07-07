import Experience from '../Experience.js';

export default class PhysicsEngine {
    constructor() {
        this.experience = new Experience();
        this.bounds = {
            minX: -130,
            maxX: 130,
            minZ: -270, 
            maxZ: 270,  
            floorY: 0.1
        };
    }

    checkCameraBounds(cameraPosition) {
        if (!cameraPosition) return;
        const padding = 2.0;
        if (cameraPosition.x < this.bounds.minX + padding) cameraPosition.x = this.bounds.minX + padding;
        if (cameraPosition.x > this.bounds.maxX - padding) cameraPosition.x = this.bounds.maxX - padding;
        if (cameraPosition.z < this.bounds.minZ + padding) cameraPosition.z = this.bounds.minZ + padding;
        const doorCenterX = 0;
        const doorAllowanceX = 35; 
        const doorZ = 270;        
        if (cameraPosition.z > doorZ - padding) {
            if (Math.abs(cameraPosition.x - doorCenterX) > doorAllowanceX) {
                cameraPosition.z = doorZ - padding;
            }
        }
    }

    update() {
        if (this.experience.camera && this.experience.camera.instance) {
            this.checkCameraBounds(this.experience.camera.instance.position);
        }
    }
}