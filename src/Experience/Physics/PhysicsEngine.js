import Experience from '../Experience.js';

export default class PhysicsEngine {
    constructor() {
        this.experience = new Experience();

        this.bounds = {
            minX: -130,
            maxX: 130,
            minZ: -208,
            maxZ: 208,
            floorY: 0.1
        };
        this.restitution = 0.6;

    }

checkCameraBounds(cameraPosition) {
        if (!cameraPosition) return;
        const padding = 2.0;
        if (cameraPosition.x < this.bounds.minX + padding) {
            cameraPosition.x = this.bounds.minX + padding;
        } else if (cameraPosition.x > this.bounds.maxX - padding) {
            cameraPosition.x = this.bounds.maxX - padding;
        }
        if (cameraPosition.z < this.bounds.minZ + padding) {
            cameraPosition.z = this.bounds.minZ + padding;
        }
        const world = this.experience.world;
        const hall = world ? world.hall : null;

        if (hall) {
            const doorWidthHalf = hall.doorWidth / 2; 
            const isExactlyInFrontOfDoor = Math.abs(cameraPosition.x) < (doorWidthHalf - padding);
            if (!isExactlyInFrontOfDoor) {
                if (cameraPosition.z > this.bounds.maxZ - padding && cameraPosition.z < this.bounds.maxZ + 10) {
                    cameraPosition.z = this.bounds.maxZ - padding;
                }
            } 
            else {
                if (cameraPosition.z > this.bounds.maxZ) {
                    if (!hall.isDoorOpen) {
                        if (cameraPosition.z < this.bounds.maxZ + padding) {
                            cameraPosition.z = this.bounds.maxZ + padding; 
                        }
                    }
                    if (cameraPosition.z > 500) {
                        cameraPosition.z = 500;
                    }
                } 
                else {
                    if (!hall.isDoorOpen) {
                        if (cameraPosition.z > this.bounds.maxZ - padding) {
                            cameraPosition.z = this.bounds.maxZ - padding;
                        }
                    }
                }
            }
        } else {
            if (cameraPosition.z > this.bounds.maxZ - padding) {
                cameraPosition.z = this.bounds.maxZ - padding;
            }
        }
    }


    checkBallCollisions(ballInstance) {
        if (!ballInstance || !ballInstance.position || !ballInstance.velocity) return;

        const radius = ballInstance.radius || 1.0; 
        if (ballInstance.position.x - radius < this.bounds.minX) {
            ballInstance.position.x = this.bounds.minX + radius;
            ballInstance.velocity.x = -ballInstance.velocity.x * this.restitution; 
        } else if (ballInstance.position.x + radius > this.bounds.maxX) {
            ballInstance.position.x = this.bounds.maxX - radius;
            ballInstance.velocity.x = -ballInstance.velocity.x * this.restitution;
        }
        if (ballInstance.position.z - radius < this.bounds.minZ) {
            ballInstance.position.z = this.bounds.minZ + radius;
            ballInstance.velocity.z = -ballInstance.velocity.z * this.restitution;
        }
        if (ballInstance.position.z + radius > this.bounds.maxZ) {
            ballInstance.position.z = this.bounds.maxZ - radius;
            ballInstance.velocity.z = -ballInstance.velocity.z * this.restitution;
        }

        if (ballInstance.position.y - radius < this.bounds.floorY) {
            ballInstance.position.y = this.bounds.floorY + radius;
            ballInstance.velocity.y = -ballInstance.velocity.y * this.restitution;
        }
    }
    update() {
     if (this.experience.world && this.experience.world.ball) {
            this.checkBallCollisions(this.experience.world.ball);
        }
        if (this.experience.camera && this.experience.camera.instance) {
            this.checkCameraBounds(this.experience.camera.instance.position);
        }
        
    }
}