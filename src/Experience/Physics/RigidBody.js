// Rigid body template (ball or pin).
import * as THREE from "three";

export default class RigidBody {
  constructor(
    position,
    velocity,
    angularVelocity,
    orientation,
    mass,
    radius,
    restitution = 0.6,
    isPin = false,
    meshRef = null,
  ) {
    // Position vector      r = x î + y ĵ + z k̂
    this.position = position ?? new THREE.Vector3();
    // Linear velocity vector  v = dx/dt î + dy/dt ĵ + dz/dt k̂
    this.velocity = velocity ?? new THREE.Vector3();
    // Angular velocity vector   ω = ωx î + ωy ĵ + ωz k̂
    this.angularVelocity = angularVelocity ?? new THREE.Vector3();
    // Quaternion orientation (زاوية ميلان الجسم)
    this.orientation = orientation ?? new THREE.Quaternion();

    this.mass = mass;
    this.radius = radius;
    // عزم القصور الذاتي لكرة متجانسة  I = (2/5) m R²
    this.inertia = (2.0 / 5.0) * mass * (radius * radius);
    // (Coefficient of Restitution)
    this.restitution = restitution;

    this.isPin = isPin;
    this.isFallen = false;
    this.isSleeping = false;
    this.meshRef = meshRef;
  }
}
