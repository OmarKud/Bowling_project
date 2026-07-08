// Throw lifecycle: init, visual sync, and result handling.
import * as THREE from "three";
export default {
  initializeSimulation(settings, _ballMesh, _pinsMeshes) {
    this.settings = settings;
    this.accumulator = 0.0;
    this.pinsBodies = [];
    this.gutterAlerted = false;
    this._gutterLockedX = null;
    this._gutterLockedFloorY = 0;
    this._isFalling = false;
    this._fallStartY = null;
    this.lastImpactInfo = null;
    this.ballMesh = this.experience.inputPanel.ball;

    if (!this.ballMesh) return;

    const mass = settings.ballMass;
    const scaleRatio = settings.ballRadius / 1.1;
    const radius = 0.108 * scaleRatio;
    const DEFAULT_BALL_SCALE = 2.7;
    const ballScale = DEFAULT_BALL_SCALE * scaleRatio;

    this.ballMesh.scale.set(ballScale, ballScale, ballScale);

    const scaledPhysicsRadius = 0.108 * this.SCALE;

    this.visualRadiusOffset =
      (DEFAULT_BALL_SCALE - scaledPhysicsRadius) * scaleRatio;

    const force = settings.pushForce;
    const angle = THREE.MathUtils.degToRad(settings.launchAngle);

    // Ep = m*g*h -> fully converted to kinetic energy.
   const restY = radius + this.LANE_SURFACE_OFFSET;
const h = Math.max(0, (settings.yStart / this.SCALE) - restY);
const Ek = mass * 9.81 * h;


    // delta_t = 0.05s player arm push (from spec).
    const delta_t = 0.05;
    const v0 = Math.sqrt((2 * Ek) / mass) + (force * delta_t) / mass;
    // Report launch values to the HUD.
    this.liveStats.v0 = v0;
    this.liveStats.pushForce = settings.pushForce;
   this.liveStats.Ep = Ek; // starting potential energy (Ek var here = m*g*h)
    this.liveStats.newlyFallen = 0;
    this.liveStats.isGutter = false;
    
    const MAX_DISPLAY_H = 0.05; 
const hForDisplay = Math.min(h, MAX_DISPLAY_H);
//this.liveStats.Ep = mass * 9.81 * hForDisplay;

    const vx = v0 * Math.sin(angle);
    const vz = -v0 * Math.cos(angle);
    const physicsVisualY = this.ballMesh.position.y - this.visualRadiusOffset;
    const minStartY = radius + this.LANE_SURFACE_OFFSET;
    const startPosPhysics = new THREE.Vector3(
      this.ballMesh.position.x / this.SCALE,
      Math.max(physicsVisualY / this.SCALE, minStartY),
      this.ballMesh.position.z / this.SCALE,
    );

    this.currentLaneIndex = this.getLaneIndexFromX(startPosPhysics.x);
    this.experience.world?.hall?.bowlingScreens?.resetLaneDisplay?.(
      this.currentLaneIndex,
    );
    this._ballScreenOrigin = this.ballMesh.position.clone();
    this._ballScreenOrigin.y = radius * this.SCALE;
    this._ballPhysicsOrigin = startPosPhysics.clone();

    const omega = (2 * Math.PI * settings.rpm) / 60.0;
    const axisRot = THREE.MathUtils.degToRad(settings.axisRotation);
    const axisTilt = THREE.MathUtils.degToRad(settings.axisTilt);
   const spinAxis = new THREE.Vector3(
  Math.cos(axisTilt) * Math.cos(axisRot),   // ωx
  Math.sin(axisTilt),                        // ωy
  Math.cos(axisTilt) * Math.sin(axisRot),   // ωz
);

    this.ballBody = this.createBody({
      position: startPosPhysics,
      velocity: new THREE.Vector3(vx, 0, vz),
      angularVelocity: spinAxis.multiplyScalar(omega),
      mass,
      radius,
      restitution: settings.restitution,
      meshRef: this.ballMesh,
    });
    console.log(
      `Ball Launch | v0: ${v0.toFixed(2)} m/s | angle: ${settings.launchAngle} deg | startY: ${startPosPhysics.y.toFixed(3)} m | radius: ${radius.toFixed(3)} m`,
    );

    // Spawn physics bodies only for pins on the same lane.
    const allPins = this.experience.world?.hall?.pins?.pinsArray;
    if (allPins) {
      const currentLaneX = this.ballMesh.position.x;
      const pinRadius = 0.095 * (this.PIN_HEIGHT / 3.8);
      allPins.forEach((mesh) => {
        if (Math.abs(mesh.position.x - currentLaneX) >= 16) return;
        if (mesh.userData.isFallen) return;

        const pinScale = 18 * (this.PIN_HEIGHT / 3.8);

        mesh.scale.set(pinScale, pinScale, pinScale);
        mesh.rotation.set(0, 0, 0);
        mesh.position.y = this.PIN_HEIGHT;

        const pinBody = this.createBody({
          position: new THREE.Vector3(
            mesh.position.x / this.SCALE,
            mesh.position.y / this.SCALE,
            mesh.position.z / this.SCALE,
          ),

          velocity: new THREE.Vector3(),
          mass: settings.pinMass,
          radius: pinRadius,
          restitution: settings.restitution * 0.25,
          isPin: true,
          meshRef: mesh,
        });
        pinBody.startPos = pinBody.position.clone();
        this.pinsBodies.push(pinBody);
      });
    }
    this.isSimulationActive = true;
    this.experience.inputPanel.isLaunched = true;
  },

  // Sync physics state to Three.js meshes.
  syncMeshes() {
    if (this.ballMesh && this.ballBody) {
      const dp = new THREE.Vector3().subVectors(
        this.ballBody.position,
        this._ballPhysicsOrigin,
      );

      this.ballMesh.position.x = this._ballScreenOrigin.x + dp.x * this.SCALE;
      this.ballMesh.position.y =
        this.ballBody.position.y * this.SCALE + this.visualRadiusOffset;
      this.ballMesh.position.z = this._ballScreenOrigin.z + dp.z * this.SCALE;

      if (!this.gutterAlerted) {
        const av = this.ballBody.angularVelocity;
        this.ballMesh.rotation.x += av.x * this.fixedDt * 0.5;
        this.ballMesh.rotation.y += av.y * this.fixedDt * 0.5;
        this.ballMesh.rotation.z += av.z * this.fixedDt * 0.5;
      }
    }

    this.pinsBodies.forEach((pin) => {
      if (!pin.meshRef) return;
      pin.meshRef.position.x = pin.position.x * this.SCALE;
      pin.meshRef.position.z = pin.position.z * this.SCALE;
//update position
      if (pin.isFallen) {
        // Slerp towards fall target quaternion (calculated from hit direction).
        if (!pin.meshRef.userData.fallTargetQuat) {
          const axis = pin.fallAxis || new THREE.Vector3(1, 0, 0);
          pin.meshRef.userData.fallTargetQuat = new THREE.Quaternion()
            .copy(pin.meshRef.quaternion)
            .premultiply(
              new THREE.Quaternion().setFromAxisAngle(axis, Math.PI / 2),
            );
          pin.meshRef.userData.fallRestY = pin.radius * this.SCALE;
        }
        pin.meshRef.quaternion.slerp(pin.meshRef.userData.fallTargetQuat, 0.18);
        const restY = pin.meshRef.userData.fallRestY;
        const yDiff = restY - pin.meshRef.position.y;
        if (Math.abs(yDiff) > 0.05) pin.meshRef.position.y += yDiff * 0.18;
        else pin.meshRef.position.y = restY;
      } else {
        pin.meshRef.userData.fallTargetQuat = null;
      }
    });
  },

  // Builds alert message based on result.
  buildResultAlertMessage({ newlyFallen, totalFallen, isGutterBall }) {
    if (isGutterBall && totalFallen === 0) {
      return "Gutter ball! No pins fell.";
    }
    if (totalFallen >= 10) {
      return "Strike! All pins down!";
    }
    if (newlyFallen >= 7) {
      return `Great throw: ${newlyFallen} down, total ${totalFallen}/10`;
    }
    return `${newlyFallen} pins fell this throw, total ${totalFallen}/10`;
  },

  // Ends simulation: counts fallen, updates UI, shows alert.
  endSimulation(isGutterBall = false) {
    this.isSimulationActive = false;
    this.gutterAlerted = false;
    this._gutterLockedX = null;
    this._startLane = null;
    this.experience.world?.ballTrail?.clear();

    if (this.experience.inputPanel) {
      this.experience.inputPanel.isLaunched = false;
      this.experience.inputPanel.enablePanel();
    }
    if (this.experience.world?.playerInteraction) {
      if (
        typeof this.experience.world.playerInteraction.restoreAimArrow ===
        "function"
      ) {
        this.experience.world.playerInteraction.restoreAimArrow();
      }
    }

    let newlyFallen = 0;
    // Sweep fallen pins to visual userData.
    this.pinsBodies.forEach((pin) => {
      if (pin.isFallen && pin.meshRef) {
        newlyFallen++;
        pin.meshRef.userData.isFallen = true;
        // pin.meshRef.visible = false;
      }
    });

    const allPins = this.experience.world?.hall?.pins?.pinsArray || [];
    const totalFallen = allPins.filter((m) => m.userData.isFallen).length;
    console.log(
      `Throw ended | Newly fallen: ${newlyFallen} | Total: ${totalFallen}/10 | Gutter: ${isGutterBall}`,
    );

    this.liveStats.isGutter = isGutterBall;

    if (totalFallen === 10) {
      this.experience.inputPanel.allPinsKnockedDown = true;
      this.experience.inputPanel.launchController.disable();
      console.log("All pins knocked down! Click 'Reset Pins' to play again.");
    }
    const resultPayload = { newlyFallen, totalFallen, isGutterBall };
    setTimeout(() => {
      this.experience.world?.hall?.bowlingScreens?.showResultForLane?.(
        this.currentLaneIndex,
        resultPayload,
      );
      window.alert(this.buildResultAlertMessage(resultPayload));
    }, 800);
  },
};
