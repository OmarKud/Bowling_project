import * as THREE from 'three';

export default class PhysicsWorld {
    constructor() {
        this.gravity = new THREE.Vector3(0, -9.81, 0);
        this.balls = [];
        this.pins = [];
        this.isSimulationActive = false;
    }

    initializeSimulation(settings) {
        this.settings = settings;
        this.isSimulationActive = true;

        this.balls.forEach((ball) => {
            ball.userData.isStatic = false;
            
            const mass = settings.ballMass || 5.5;
            const force = settings.pushForce || 250;
            const velocityZ = -(force / mass) * 0.5; 

            ball.userData.velocity = new THREE.Vector3(0, 0, velocityZ);
            
            const rpm = settings.rpm || 300;
            const omegaTotal = (rpm * 2 * Math.PI) / 60;
            const radRot = THREE.MathUtils.degToRad(settings.axisRotation || 45);
            const radTilt = THREE.MathUtils.degToRad(settings.axisTilt || 15);

            ball.userData.angularVelocity = new THREE.Vector3(
                omegaTotal * Math.cos(radTilt) * Math.sin(radRot),
                omegaTotal * Math.sin(radTilt),
                omegaTotal * Math.cos(radTilt) * Math.cos(radRot)
            );
        });
    }

    update(deltaTime) {
        if (!this.isSimulationActive) return;
        if (deltaTime > 0.1) deltaTime = 0.1;

        this.balls.forEach((ball) => {
            if (!ball.userData.isStatic) {
                ball.position.addScaledVector(ball.userData.velocity, deltaTime);
            }
        });

       ;
    }
}