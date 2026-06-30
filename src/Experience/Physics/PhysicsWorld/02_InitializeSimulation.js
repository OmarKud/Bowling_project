// ════════════════════════════════════════════════════════════
// 02_InitializeSimulation.js
// تهيئة المحاكاة عند لحظة الإطلاق (Release Phase)
// يقابل: FUNCTION initializeSimulation(...) في الوثيقة
// يحسب: السرعة الابتدائية v0، السرعة الزاوية ω0، مواقع الكرة والدبابيس
// ════════════════════════════════════════════════════════════
import * as THREE from 'three';

export default {
    initializeSimulation(settings, _ballMesh, _pinsMeshes) {
        this.settings    = settings;
        this.accumulator = 0.0;
        this.pinsBodies  = [];

        this._gutterAlerted      = false;
        this._gutterLockedX      = null;
        this._gutterLockedFloorY = 0;

        // ريسيت تتبع الهبوط لكل رمية جديدة
        this._isFalling     = false;
        this._fallStartY    = null;
        this.lastImpactInfo = null;

        this.ballMesh = this.experience.inputPanel.ball;
        if (!this.ballMesh) return;

        const mass       = settings.ballMass;
        const scaleRatio = settings.ballRadius / 1.1;
        const radius     = 0.108 * scaleRatio; // نصف القطر الفيزيائي

        const DEFAULT_BALL_SCALE = 2.7;
        const ballScale = DEFAULT_BALL_SCALE * scaleRatio;
        this.ballMesh.scale.set(ballScale, ballScale, ballScale);

        // 🌟 إرجاع الأوفسيت الإجباري لمنع الغرق!
        // يحسب الفرق بين الحجم الرسومي (2.7) والحجم الفيزيائي (2.16)
        const scaledPhysicsRadius = 0.108 * this.SCALE; // 2.16
        this.visualRadiusOffset = (DEFAULT_BALL_SCALE - scaledPhysicsRadius) * scaleRatio;

        const force   = settings.pushForce;
        const angle   = THREE.MathUtils.degToRad(settings.launchAngle);

        const Ek      = 40.0;
        const delta_t = 0.15;
        const v0      = Math.sqrt((2 * Ek) / mass) + ((force * delta_t) / mass);
        const vx      = v0 * Math.sin(angle);
        const vz      = -v0 * Math.cos(angle);

        // خصم الإزاحة الرسومية لتبدأ الفيزياء من النقطة الصحيحة
        const physicsVisualY = this.ballMesh.position.y - this.visualRadiusOffset;

        // 🌟 الحد الأدنى لارتفاع البداية الآن radius + LANE_SURFACE_OFFSET
        // (مرجع الأرضية الفيزيائي الصحيح) بدل radius فقط، عشان ما تبلش الكرة وهي غاطسة بالخشب
        const minStartY = radius + this.LANE_SURFACE_OFFSET;

        const startPosPhysics = new THREE.Vector3(
            this.ballMesh.position.x / this.SCALE,
            Math.max(physicsVisualY / this.SCALE, minStartY), 
            this.ballMesh.position.z / this.SCALE
        );

        this.currentLaneIndex = this._getLaneIndexFromX(startPosPhysics.x);
        this.experience.world?.hall?.bowlingScreens?.resetLaneDisplay?.(this.currentLaneIndex);

        this._ballScreenOrigin   = this.ballMesh.position.clone();
        this._ballScreenOrigin.y = radius * this.SCALE;
        this._ballPhysicsOrigin  = startPosPhysics.clone();

        const omega    = (2 * Math.PI * settings.rpm) / 60.0;
        const axisRot  = THREE.MathUtils.degToRad(settings.axisRotation);
        const axisTilt = THREE.MathUtils.degToRad(settings.axisTilt);
        const spinAxis = new THREE.Vector3(
            Math.sin(axisRot) * Math.cos(axisTilt),
            Math.sin(axisTilt),
            Math.cos(axisRot) * Math.cos(axisTilt)
        ).normalize();

        this.ballBody = this._createBody({
            position       : startPosPhysics,
            velocity       : new THREE.Vector3(vx, 0, vz),
            angularVelocity: spinAxis.multiplyScalar(omega),
            mass,
            radius,
            restitution    : settings.restitution,
            meshRef        : this.ballMesh
        });

        console.log(`🎳 Ball Launch | v0: ${v0.toFixed(2)} m/s | angle: ${settings.launchAngle}° | startY: ${startPosPhysics.y.toFixed(3)} m | radius: ${radius.toFixed(3)} m`);

        const allPins = this.experience.world?.hall?.pins?.pinsArray;
        if (allPins) {
            const currentLaneX = this.ballMesh.position.x;
            const pinRadius    = 0.110 * (this.PIN_HEIGHT / 3.8);

            allPins.forEach((mesh) => {
                if (Math.abs(mesh.position.x - currentLaneX) >= 16) return;
                if (mesh.userData.isFallen) return;

                const pinScale = 18 * (this.PIN_HEIGHT / 3.8);
                mesh.scale.set(pinScale, pinScale, pinScale);
                mesh.rotation.set(0, 0, 0);
                mesh.position.y = this.PIN_HEIGHT;

                const pinBody = this._createBody({
                    position   : new THREE.Vector3(
                        mesh.position.x / this.SCALE,
                        mesh.position.y / this.SCALE,
                        mesh.position.z / this.SCALE
                    ),
                    velocity   : new THREE.Vector3(),
                    mass       : settings.pinMass,
                    radius     : pinRadius,
                    restitution: settings.restitution * 0.5,
                    isPin      : true,
                    meshRef    : mesh
                });
                pinBody.startPos = pinBody.position.clone();
                this.pinsBodies.push(pinBody);
            });
        }

        this.isSimulationActive          = true;
        this.experience.inputPanel.isLaunched = true;
    }
};
