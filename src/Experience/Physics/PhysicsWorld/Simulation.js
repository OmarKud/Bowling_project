// ════════════════════════════════════════════════════════════
// Simulation.js
// دورة حياة الرمية الكاملة: تهيئتها لحظة الإطلاق، مزامنة النماذج
// الرسومية مع الحالة الفيزيائية كل فريم، وإنهاؤها مع حساب النتيجة
// وعرضها للاعب (شاشة + تنبيه منبثق).
// ════════════════════════════════════════════════════════════
import * as THREE from "three";

export default {
  // بتنحسب هون كل قيم البداية للرمية: السرعة الابتدائية v0، السرعة
  // الزاوية حسب الـ RPM، ومواقع الكرة والدبابيس الفعلية بوحدات الفيزياء
  initializeSimulation(settings, _ballMesh, _pinsMeshes) {
    this.settings = settings;
    this.accumulator = 0.0;
    this.pinsBodies = [];

    this._gutterAlerted = false;
    this._gutterLockedX = null;
    this._gutterLockedFloorY = 0;

    // ريسيت تتبع الهبوط لكل رمية جديدة
    this._isFalling = false;
    this._fallStartY = null;
    this.lastImpactInfo = null;

    this.ballMesh = this.experience.inputPanel.ball;
    if (!this.ballMesh) return;

    const mass = settings.ballMass;
    const scaleRatio = settings.ballRadius / 1.1;
    const radius = 0.108 * scaleRatio; // نصف القطر الفيزيائي

    const DEFAULT_BALL_SCALE = 2.7;
    const ballScale = DEFAULT_BALL_SCALE * scaleRatio;
    this.ballMesh.scale.set(ballScale, ballScale, ballScale);

    // أوفسيت إجباري لمنع غرق الكرة بصريًا داخل المسار: الفرق بين
    // الحجم الرسومي (2.7) والحجم الفيزيائي المقابل له
    const scaledPhysicsRadius = 0.108 * this.SCALE; // 2.16
    this.visualRadiusOffset =
      (DEFAULT_BALL_SCALE - scaledPhysicsRadius) * scaleRatio;

    const force = settings.pushForce;
    const angle = THREE.MathUtils.degToRad(settings.launchAngle);

    // Ek هون = الطاقة الكامنة المختزنة (Ep = m·g·h) المتحولة بالكامل لحركية
    // h = ارتفاع إمساك الكرة فعلياً (yStart) محوّل لوحدة فيزيائية (متر)
    // طبقاً للملف ص23: "تتحول تلك الطاقة الكامنة Ep بالكامل إلى طاقة حركية Ek"
    const h = settings.yStart / this.SCALE;
    const Ek = mass * 9.81 * h;

    // delta_t = زمن دفعة ذراع اللاعب (غير وارد كمدخل صريح بالملف، فنثبته
    // كقيمة واقعية لحركة بندولية لذراع بشري - تقريباً 0.1-0.15 ثانية)
    const delta_t = 0.12;

    const v0 = Math.sqrt((2 * Ek) / mass) + (force * delta_t) / mass;
    const vx = v0 * Math.sin(angle);
    const vz = -v0 * Math.cos(angle);

    // خصم الإزاحة الرسومية عشان الفيزياء تبلش من النقطة الصحيحة
    const physicsVisualY = this.ballMesh.position.y - this.visualRadiusOffset;

    // الحد الأدنى لارتفاع البداية هو radius + LANE_SURFACE_OFFSET
    // (مرجع الأرضية الفيزيائي الصحيح)، مش نصف القطر لحاله، عشان
    // الكرة ما تبلش وهي غاطسة بالخشب
    const minStartY = radius + this.LANE_SURFACE_OFFSET;

    const startPosPhysics = new THREE.Vector3(
      this.ballMesh.position.x / this.SCALE,
      Math.max(physicsVisualY / this.SCALE, minStartY),
      this.ballMesh.position.z / this.SCALE,
    );

    this.currentLaneIndex = this._getLaneIndexFromX(startPosPhysics.x);
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
    Math.cos(axisTilt) * Math.sin(axisRot),  // مشهد.x = ملف.y (جانبي)
    Math.sin(axisTilt),                       // مشهد.y = ملف.z (رأسي)
    Math.cos(axisTilt) * Math.cos(axisRot)   // مشهد.z = ملف.x (طولي)
);

    this.ballBody = this._createBody({
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

    // بنحط جسم فيزيائي بس للدبابيس يلي عالمسار الحالي وما وقعت من قبل،
    // عشان نوفر حسابات على الدبابيس يلي مالها علاقة بالرمية
    const allPins = this.experience.world?.hall?.pins?.pinsArray;
    if (allPins) {
      const currentLaneX = this.ballMesh.position.x;
      const pinRadius = 0.11 * (this.PIN_HEIGHT / 3.8);

      allPins.forEach((mesh) => {
        if (Math.abs(mesh.position.x - currentLaneX) >= 16) return;
        if (mesh.userData.isFallen) return;

        const pinScale = 18 * (this.PIN_HEIGHT / 3.8);
        mesh.scale.set(pinScale, pinScale, pinScale);
        mesh.rotation.set(0, 0, 0);
        mesh.position.y = this.PIN_HEIGHT;

        const pinBody = this._createBody({
          position: new THREE.Vector3(
            mesh.position.x / this.SCALE,
            mesh.position.y / this.SCALE,
            mesh.position.z / this.SCALE,
          ),
          velocity: new THREE.Vector3(),
          mass: settings.pinMass,
          radius: pinRadius,
          restitution: settings.restitution * 0.5,
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

  // مزامنة الحالة الفيزيائية (Vector3 بوحدات المتر) مع مواقع
  // وتدوير النماذج الرسومية الفعلية بمشهد Three.js (وحدات المشهد)
  _syncMeshes() {
    if (this.ballMesh && this.ballBody) {
      const dp = new THREE.Vector3().subVectors(
        this.ballBody.position,
        this._ballPhysicsOrigin,
      );

      this.ballMesh.position.x = this._ballScreenOrigin.x + dp.x * this.SCALE;

      this.ballMesh.position.y =
        this.ballBody.position.y * this.SCALE + this.visualRadiusOffset;

      this.ballMesh.position.z = this._ballScreenOrigin.z + dp.z * this.SCALE;

      if (!this._gutterAlerted) {
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

      if (pin.isFallen) {
        const targetRot = -Math.PI / 2;
        const diff = targetRot - pin.meshRef.rotation.x;
        if (Math.abs(diff) > 0.01) pin.meshRef.rotation.x += diff * 0.18;
        else pin.meshRef.rotation.x = targetRot;
        const yDiff = 0.0 - pin.meshRef.position.y;
        if (Math.abs(yDiff) > 0.05) pin.meshRef.position.y += yDiff * 0.18;
        else pin.meshRef.position.y = 0.0;
      }
    });
  },

  // بناء نص التنبيه المنبثق حسب نتيجة الرمية، بنفس منطق الحالات
  // المعروضة عالشاشة بالقاعة (BowlingScreens.showResultForLane)
  _buildResultAlertMessage({ newlyFallen, totalFallen, isGutterBall }) {
    if (isGutterBall) {
      return "الكرة طاحت بالحفرة ولم يسقط أي دبوس";
    }
    if (totalFallen >= 10) {
      return "سترايك! كل الدبابيس وقعت";
    }
    if (newlyFallen >= 7) {
      return `رمية ممتازة: وقع ${newlyFallen} دبوس، الإجمالي ${totalFallen}/10`;
    }
    return `وقع ${newlyFallen} دبوس بهالرمية، الإجمالي ${totalFallen}/10`;
  },

  // إنهاء المحاكاة: تكنيس الدبابيس الواقعة، احتساب النتيجة، عرضها
  // عالشاشة وبتنبيه منبثق، وإعادة تجهيز لوحة التحكم للرمية الجاية
  _endSimulation(isGutterBall = false) {
    this.isSimulationActive = false;
    this._gutterAlerted = false;
    this._gutterLockedX = null;
    this._startLane = null; // ريسيت للرمية الجاية

    if (this.experience.inputPanel) {
      this.experience.inputPanel.isLaunched = false;
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

    // التكنيس الآلي: نقل حالة السقوط من الفيزياء للموديل الرسومي
    // عشان نخفي الدبوس الواقع بالرمية الجاية متل ما بتعمل ماكينة حقيقية
    this.pinsBodies.forEach((pin) => {
      if (pin.isFallen && pin.meshRef) {
        newlyFallen++;
        pin.meshRef.userData.isFallen = true;
        pin.meshRef.visible = false;
      }
    });

    const allPins = this.experience.world?.hall?.pins?.pinsArray || [];
    const totalFallen = allPins.filter((m) => m.userData.isFallen).length;

    console.log(
      `انتهت الرمية | سقط الآن: ${newlyFallen} | الإجمالي: ${totalFallen}/10 | Gutter: ${isGutterBall}`,
    );

    const resultPayload = { newlyFallen, totalFallen, isGutterBall };

    setTimeout(() => {
      this.experience.world?.hall?.bowlingScreens?.showResultForLane?.(
        this.currentLaneIndex,
        resultPayload,
      );

      // تنبيه منبثق بنتيجة الرمية، بكل الحالات: حفرة، سترايك، رمية
      // قوية، أو نتيجة عادية. نفس المعلومات المعروضة عالشاشة بالضبط
      window.alert(this._buildResultAlertMessage(resultPayload));
    }, 800);
  },
};
