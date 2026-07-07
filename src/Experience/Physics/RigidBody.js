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
    restitution,
    isPin = false,
    meshRef,
  ) {
    this.mass = mass;
    this.radius = radius;

    this.inertia = (2.0 / 5.0) * mass * (radius * radius); // moment of inertia of a homogeneous solid sphere  I = (2/5) m R²
    this.restitution = restitution; // (Coefficient of Restitution)
    this.position = position; //Position vector      r = x î + y ĵ + z k̂
    this.velocity = velocity; //Linear velocity vector  v = dx/dt î + dy/dt ĵ + dz/dt k̂
    this.orientation = orientation; //Quaternion orientation
    this.angularVelocity = angularVelocity; //Angular velocity vector   ω = ωx î + ωy ĵ + ωz k̂

    this.isPin = isPin;
    this.isFallen = false;
    this.isSleeping = false;
    this.meshRef = meshRef;
  }
}
