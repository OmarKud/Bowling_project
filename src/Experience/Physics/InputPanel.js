import * as dat from "lil-gui";

export default class InputPanel {
  constructor(onLaunchCallback) {
    this.onLaunch = onLaunchCallback;
    this.ball = null;
    this.isLaunched = false;
    this.gui = new dat.GUI({ title: "Bowling Physics Simulator" });
    this.parameters = {
      // Player Controls
      xStart: 16,
      yStart: 2.5,
      launchAngle: 0,
      pushForce: 250,
      rpm: 300, // Round per minute
      axisRotation: 45,
      axisTilt: 15,

      // Physics Sandbox
      ballMass: 6.8,
      ballRadius: 1.1,
      oilDistance: 12.19,
      muOil: 0.04,
      muDry: 0.2,
      restitution: 0.6,
      pinMass: 1.5,

      launch: () => this._executeLaunch(),
      resetPins: () => this._resetPins(),
    };

    this._buildPanel();
  }
  _buildPanel() {
    // ── Player Controls ──────────────────────────────────────
    const player = this.gui.addFolder("Player Controls (Throw)");

    player
      .add(this.parameters, "xStart", 6, 26)
      .name("X Start (Position)")
      .listen()
      .onChange((value) => {
        const interact = window.experience?.world?.playerInteraction;
        if (interact?.state === "AIMING") {
          interact.camera.instance.position.x = value;
          if (interact.heldBall) interact.heldBall.position.x = value;
        }
      });

    player
      .add(this.parameters, "yStart", 1.9, 5.5)
      .name("Y Start (Height)")
      .listen()
      .onChange((value) => {
        const interact = window.experience?.world?.playerInteraction;
        if (interact?.state === "AIMING" && interact.heldBall) {
          interact.heldBall.position.y = value;
        }
      });

    player
      .add(this.parameters, "launchAngle", -45, 45)
      .name("Launch Angle (°)")
      .listen()
      .onChange((value) => {
        const interact = window.experience?.world?.playerInteraction;
        if (interact?.state === "AIMING") {
          interact.currentLaunchAngle = value;
        }
      });

    player
      .add(this.parameters, "pushForce", 50, 600)
      .name("Push Force (N)")
      .listen()
      .onChange((value) => {
        const interact = window.experience?.world?.playerInteraction;
        if (interact?.state === "AIMING") {
          const newZ = 130 + ((value - 50) / 550) * 20;
          interact.camera.instance.position.z = newZ;
          if (interact.heldBall) interact.heldBall.position.z = newZ - 20;
        }
      });

    player.add(this.parameters, "rpm", 0, 600).name("Spin RPM");

    player
      .add(this.parameters, "axisRotation", 0, 90)
      .name("Axis Rotation (°)");

    player.add(this.parameters, "axisTilt", 0, 45).name("Axis Tilt (°)");

    this._launchController = player
      .add(this.parameters, "launch")
      .name("Launch Ball");

    player.add(this.parameters, "resetPins").name(" Reset Pins");
    const sandbox = this.gui.addFolder("Physics Sandbox").close();
    sandbox.add(this.parameters, "ballMass", 2.0, 7.5).name("Ball Mass (kg)");
    const DEFAULT_BALL_SCALE = 2.7;
    const DEFAULT_RADIUS = 1.1;
    sandbox
      .add(this.parameters, "ballRadius", 0.5, 1.5)
      .name("Ball Radius")
      .onChange((value) => {
        if (!this.ball) return;
        const scaleRatio = value / DEFAULT_RADIUS;
        const newScale = DEFAULT_BALL_SCALE * scaleRatio;
        this.ball.scale.set(newScale, newScale, newScale);
        const currentVisualRadius = 2.7 * scaleRatio;
        const newY = Math.max(this.ball.position.y, currentVisualRadius);
        this.ball.position.y = newY;
        this.parameters.yStart = parseFloat(newY.toFixed(2));
        const interact = window.experience?.world?.playerInteraction;
        if (interact?.state === "AIMING") {
          if (interact.heldBall) interact.heldBall.position.y = newY;
        }
      });
    sandbox
      .add(this.parameters, "oilDistance", 0.0, 18.28)
      .name("Oil Distance (m)");
    sandbox.add(this.parameters, "muOil", 0.01, 0.1).name("μ Oil");
    sandbox.add(this.parameters, "muDry", 0.1, 0.5).name("μ Dry");
    sandbox.add(this.parameters, "restitution", 0.1, 1.0).name("Restitution");
    sandbox.add(this.parameters, "pinMass", 1.0, 2.5).name("Pin Mass (kg)");
  }

  updateFromGame(x, y, force, angle) {
    this.parameters.xStart = parseFloat(x.toFixed(2));
    this.parameters.yStart = parseFloat(y.toFixed(2));
    if (force !== undefined)
      this.parameters.pushForce = parseFloat(force.toFixed(1));
    if (angle !== undefined)
      this.parameters.launchAngle = parseFloat(angle.toFixed(1));
  }

  setBall(ballMesh) {
    this.ball = ballMesh;
  }

  _executeLaunch() {
    this.parameters.yStart = Math.max(
      this.parameters.yStart,
      2.7 * (this.parameters.ballRadius / 1.1),
    );
    if (!this.ball) {
      console.warn("Ball not linked. Enter aiming mode (ENTER) first.");
      return;
    }

    if (this.isLaunched) {
      console.warn("Simulation already running.");
      return;
    }

    this._launchController.disable();
    console.log("Launch settings:", { ...this.parameters, launch: "[fn]" });
    if (this.onLaunch) {
      this.onLaunch({ ...this.parameters });
    }

    const reEnable = () => {
      if (!this.isLaunched) {
        this._launchController.enable();
        console.log("Ready for next throw.");
      } else {
        setTimeout(reEnable, 1000);
      }
    };
    setTimeout(reEnable, 3000);
  }

  _resetPins() {
    const pinsObj = window.experience?.world?.hall?.pins;
    if (!pinsObj) {
      console.warn("Pins not available yet.");
      return;
    }
    pinsObj.resetPins();
    const interact = window.experience?.world?.playerInteraction;
    interact?.restoreAimArrow?.();
    console.log("Pins reset to initial positions.");
  }
}
