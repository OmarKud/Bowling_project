// Aggregates physics modules into one prototype.

import PhysicsWorldBase, { MainLoop } from './PhysicsWorld.js';
import Kinematics from './Kinematics.js';
import Collisions from './Collisions.js';
import Simulation from './Simulation.js';

export default class PhysicsWorld extends PhysicsWorldBase {}

Object.assign(
    PhysicsWorld.prototype,
    Kinematics,
    Collisions,
    Simulation,
    MainLoop
);
