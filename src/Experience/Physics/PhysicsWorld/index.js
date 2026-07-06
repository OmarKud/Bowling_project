import PhysicsWorldBase, { MainLoop } from './PhysicsWorld.js';
import Kinematics from './Kinematics.js';
import Collisions from './Collisions.js';
import Simulation from './Simulation.js';
import Telemetry from './Telemetry.js';

export default class PhysicsWorld extends PhysicsWorldBase {
    constructor() {
        super();
        this._initTelemetry();
    }
}

Object.assign(
    PhysicsWorld.prototype,
    Kinematics,
    Collisions,
    Simulation,
    Telemetry,
    MainLoop
);