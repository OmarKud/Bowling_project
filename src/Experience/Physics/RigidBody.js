import * as THREE from 'three';

export default class RigidBody {
    constructor(mass, radius, isPin = false) {
        this.mass = mass;
        this.radius = radius;
        this.inertia = 0.4 * mass * (radius * radius); // عزم القصور الذاتي
        this.restitution = 0.6; 
        
        this.position = new THREE.Vector3();
        this.velocity = new THREE.Vector3();
        this.orientation = new THREE.Quaternion();
        this.angularVelocity = new THREE.Vector3();
        
        this.isPin = isPin;
        this.isFallen = false;
        this.isSleeping = false;
    }
}