// Rigid body template (ball or pin).
import * as THREE from 'three';
export default class RigidBody {
    constructor(mass, radius, isPin = false) {
        this.mass   = mass;
        this.radius = radius;

        this.inertia = (2.0 / 5.0) * mass * (radius * radius);           // moment of inertia of a homogeneous solid sphere  I = (2/5) m R²
        this.restitution = 0.6;                                          // (Coefficient of Restitution)
        this.position = new THREE.Vector3();                             //Position vector      r = x î + y ĵ + z k̂
        this.velocity = new THREE.Vector3();                             //Linear velocity vector  v = dx/dt î + dy/dt ĵ + dz/dt k̂
        this.orientation = new THREE.Quaternion();                       //Quaternion orientation 
        this.angularVelocity = new THREE.Vector3();                      //Angular velocity vector   ω = ωx î + ωy ĵ + ωz k̂


        this.isPin     = isPin;
        this.isFallen  = false;
        this.isSleeping = false; 
    }
}