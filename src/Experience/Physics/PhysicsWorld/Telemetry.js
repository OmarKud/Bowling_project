// Telemetry: console logging + HUD updates for every computed physics
// quantity (forces, energy, velocity, friction, impacts, collisions).
//
// LOGGING STRATEGY:
// - EVENT logs print once when something discrete happens (launch, ground
//   impact, gutter entry, a pin falling, a strong collision) - never throttled.
// - SNAPSHOT logs print periodically (4x/sec, see _debugLogInterval in
//   PhysicsWorld.js) instead of every 120Hz physics step.
// - The HUD always shows the FULL, latest known value of every variable
//   (launch, kinematics, forces, energy, friction, last impact, last
//   collision, last pin fall) via _buildSections(). DebugHUD.update()
//   throttles its own DOM repaint (~6/sec), so calling it from any event
//   handler below is safe.
import DebugHUD from "../DebugHUD.js";

export default {
  _initTelemetry() {
    if (!this.debugHUD && typeof document !== "undefined") {
      this.debugHUD = new DebugHUD();
    }
    this._lastLaunch = null;
    this._lastImpact = null;
    this._lastCollision = null;
    this._lastPinFall = null;
  },

  _buildSections() {
    const body = this.ballBody;
    if (!body) return [];

    const speed = body.velocity.length();
    const KE = 0.5 * body.mass * speed * speed; // Ek = 1/2 m v^2
    const spinRpm = (body.angularVelocity.length() * 60) / (2 * Math.PI);

    const N = body.mass * Math.abs(this.gravity); // normal force N = m*g
    const mu = this._gutterAlerted || !this._getFriction ? null : this._getFriction(body);
    const frictionForce = mu !== null ? mu * N : null;

    const inOilZone =
      this.settings &&
      Math.abs(body.position.z - this._ballPhysicsOrigin.z) < this.settings.oilDistance;
    const zone = this._gutterAlerted ? "GUTTER" : inOilZone ? "OIL" : "DRY";
    const fallenCount = this.pinsBodies.filter((p) => p.isFallen).length;

    const sections = [];

    if (this._lastLaunch) {
      const l = this._lastLaunch;
      sections.push({
        title: "LAUNCH (this throw)",
        rows: [
          ["v0", `${l.v0.toFixed(2)} m/s`],
          ["angle", `${l.angle.toFixed(1)}°`],
          ["Ep -> Ek", `${l.Ep.toFixed(1)} J -> ${l.Ek.toFixed(1)} J`],
          ["spin", `${l.rpm.toFixed(0)} rpm`],
        ],
      });
    }

    sections.push({
      title: "KINEMATICS",
      rows: [
        ["position (m)", `${body.position.x.toFixed(2)}, ${body.position.y.toFixed(2)}, ${body.position.z.toFixed(2)}`],
        ["velocity (m/s)", `${body.velocity.x.toFixed(2)}, ${body.velocity.y.toFixed(2)}, ${body.velocity.z.toFixed(2)}`],
        ["speed", `${speed.toFixed(2)} m/s`],
        ["spin", `${spinRpm.toFixed(0)} rpm`],
      ],
    });

    sections.push({
      title: "FORCES",
      rows: [
        ["gravity force (m·g)", `${N.toFixed(1)} N`],
        ["normal force N", `${N.toFixed(1)} N`],
        ["friction force (μN)", frictionForce !== null ? `${frictionForce.toFixed(1)} N` : "n/a"],
      ],
    });

    sections.push({
      title: "ENERGY & FRICTION",
      rows: [
        ["kinetic energy", `${KE.toFixed(1)} J`],
        ["lane zone", zone],
        ["μ (friction coeff.)", mu !== null ? mu.toFixed(3) : "n/a"],
      ],
    });

    sections.push({
      title: "PINS",
      rows: [
        ["down / total", `${fallenCount} / ${this.pinsBodies.length}`],
        ["lane index", `${this.currentLaneIndex}`],
      ],
    });

    if (this._lastImpact) {
      const i = this._lastImpact;
      sections.push({
        title: "LAST GROUND IMPACT",
        rows: [
          ["drop height", `${i.dropHeightScene.toFixed(2)} scene units`],
          ["impact speed", `${i.impactSpeed.toFixed(2)} m/s`],
          ["impact force", `${i.impactForce.toFixed(0)} N`],
        ],
      });
    }

    if (this._lastCollision) {
      const c = this._lastCollision;
      sections.push({
        title: "LAST COLLISION",
        rows: [
          ["type", c.label],
          ["impulse", `${c.impulseMag.toFixed(2)} N·s`],
        ],
      });
    }

    if (this._lastPinFall) {
      const p = this._lastPinFall;
      sections.push({
        title: "LAST PIN FALL",
        rows: [
          ["impulse-Δv", `${p.deltaV.toFixed(2)} m/s`],
          ["fall axis", p.axis],
        ],
      });
    }

    return sections;
  },

  _logLaunchTelemetry({ mass, h, Ek, v0, vx, vz, angle, omega, rpm, spinAxis, radius }) {
    const Ep = mass * 9.81 * h;

    console.groupCollapsed("%c[LAUNCH] throw started", "color:#00ffff;font-weight:bold;");
    console.log(`Ball mass            : ${mass.toFixed(2)} kg`);
    console.log(`Ball radius          : ${radius.toFixed(3)} m`);
    console.log(`Start height (h)     : ${h.toFixed(3)} m`);
    console.log(`Potential energy Ep  : ${Ep.toFixed(2)} J    (Ep = m * g * h)`);
    console.log(`Kinetic energy Ek    : ${Ek.toFixed(2)} J    (from Ep, before arm push)`);
    console.log(`Launch speed v0      : ${v0.toFixed(2)} m/s`);
    console.log(`Launch angle         : ${angle.toFixed(1)} deg`);
    console.log(`Velocity components  : vx=${vx.toFixed(2)} m/s | vz=${vz.toFixed(2)} m/s`);
    console.log(`Spin                 : ${rpm.toFixed(0)} rpm  (omega=${omega.toFixed(2)} rad/s)`);
    console.log(`Spin axis (unit vec) : (${spinAxis.x.toFixed(2)}, ${spinAxis.y.toFixed(2)}, ${spinAxis.z.toFixed(2)})`);
    console.groupEnd();

    this._lastLaunch = { v0, angle, Ep, Ek, rpm };
    this.debugHUD?.setStatus("IN FLIGHT", "#00ffff");
    this.debugHUD?.update(this._buildSections());
  },

  _logFrameTelemetry() {
    if (!this.ballBody) return;
    const body = this.ballBody;
    const speed = body.velocity.length();
    const KE = 0.5 * body.mass * speed * speed;
    const spinRpm = (body.angularVelocity.length() * 60) / (2 * Math.PI);
    const mu = this._gutterAlerted || !this._getFriction ? null : this._getFriction(body);
    const inOilZone =
      this.settings &&
      Math.abs(body.position.z - this._ballPhysicsOrigin.z) < this.settings.oilDistance;
    const zone = this._gutterAlerted ? "GUTTER" : inOilZone ? "OIL" : "DRY";
    const fallenCount = this.pinsBodies.filter((p) => p.isFallen).length;

    console.log(
      `%c[SNAPSHOT] pos(${body.position.x.toFixed(2)}, ${body.position.y.toFixed(2)}, ${body.position.z.toFixed(2)}) m` +
        ` | v=${speed.toFixed(2)} m/s | spin=${spinRpm.toFixed(0)} rpm` +
        ` | zone=${zone}${mu !== null ? ` (mu=${mu.toFixed(3)})` : ""}` +
        ` | KE=${KE.toFixed(1)} J | pins down=${fallenCount}/${this.pinsBodies.length}`,
      "color:#00ffff",
    );

    this.debugHUD?.setStatus(this._gutterAlerted ? "GUTTER" : "IN FLIGHT", this._gutterAlerted ? "#ff5555" : "#00ffff");
    this.debugHUD?.update(this._buildSections());
  },

  _logImpactTelemetry({ dropHeightScene, impactSpeed, impactForce }) {
    console.log(
      `%c[IMPACT] ball landed | drop=${dropHeightScene.toFixed(2)} scene units | speed=${impactSpeed.toFixed(2)} m/s | force=${impactForce.toFixed(0)} N`,
      "color:#ffaa00;font-weight:bold;",
    );
    this._lastImpact = { dropHeightScene, impactSpeed, impactForce };
    this.debugHUD?.update(this._buildSections());
  },

 _logPinFallTelemetry(pin, deltaV) {
    if (!pin || !pin.fallAxis) return; // حماية لو انصدف نداء بدون axis جاهز
    console.log(
      `%c[PIN FALL] pin down | impulse-Δv≈${deltaV.toFixed(2)} m/s | fall axis=(${pin.fallAxis.x.toFixed(2)}, ${pin.fallAxis.y.toFixed(2)}, ${pin.fallAxis.z.toFixed(2)})`,
      "color:#ffaa00;font-weight:bold;",
    );
    this._lastPinFall = {
      deltaV,
      axis: `${pin.fallAxis.x.toFixed(2)}, ${pin.fallAxis.y.toFixed(2)}, ${pin.fallAxis.z.toFixed(2)}`,
    };
    this.debugHUD?.update(this._buildSections());
  },

  _logCollisionTelemetry(bodyA, bodyB, impulseMag) {
    const label = bodyA.isPin && bodyB.isPin ? "PIN-PIN" : "BALL-PIN";
    console.log(`[COLLISION:${label}] impulse = ${impulseMag.toFixed(2)} N*s`);
    this._lastCollision = { label, impulseMag };
    this.debugHUD?.update(this._buildSections());
  },

  _logResultTelemetry({ newlyFallen, totalFallen, isGutterBall }) {
    console.groupCollapsed("%c[RESULT] throw ended", "color:#00ffff;font-weight:bold;");
    console.log(`Newly fallen this throw : ${newlyFallen}`);
    console.log(`Total fallen            : ${totalFallen} / 10`);
    console.log(`Gutter ball             : ${isGutterBall}`);
    console.groupEnd();

    const status = isGutterBall ? "GUTTER" : totalFallen >= 10 ? "STRIKE" : "ENDED";
    this.debugHUD?.setStatus(status, "#ffffff");
    this.debugHUD?.update([
      {
        title: "RESULT",
        rows: [
          ["newly fallen", `${newlyFallen}`],
          ["total fallen", `${totalFallen} / 10`],
          ["gutter ball", isGutterBall ? "YES" : "NO"],
        ],
      },
    ]);
  },
};