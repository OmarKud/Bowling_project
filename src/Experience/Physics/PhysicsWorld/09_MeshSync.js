// ════════════════════════════════════════════════════════════
// 09_MeshSync.js
// مزامنة الحالة الفيزيائية مع نماذج Three.js المرئية (Ball + Pins)
// ════════════════════════════════════════════════════════════
import * as THREE from 'three';

export default {
    _syncMeshes() {
        if (this.ballMesh && this.ballBody) {
            const dp = new THREE.Vector3().subVectors(
                this.ballBody.position, this._ballPhysicsOrigin
            );

            this.ballMesh.position.x = this._ballScreenOrigin.x + dp.x * this.SCALE;

            // كان يسبب الغرق البصري
            this.ballMesh.position.y =
                (this.ballBody.position.y * this.SCALE) + this.visualRadiusOffset;

            this.ballMesh.position.z = this._ballScreenOrigin.z + dp.z * this.SCALE;

            if (!this._gutterAlerted) {
                const av = this.ballBody.angularVelocity;
                this.ballMesh.rotation.x += av.x * this.fixedDt * 0.5;
                this.ballMesh.rotation.y += av.y * this.fixedDt * 0.5;
                this.ballMesh.rotation.z += av.z * this.fixedDt * 0.5;
            }
        }
        // ...existing code...

        this.pinsBodies.forEach((pin) => {
            if (!pin.meshRef) return;
            pin.meshRef.position.x = pin.position.x * this.SCALE;
            pin.meshRef.position.z = pin.position.z * this.SCALE;

            if (pin.isFallen) {
                const targetRot = -Math.PI / 2;
                const diff      = targetRot - pin.meshRef.rotation.x;
                if (Math.abs(diff) > 0.01) pin.meshRef.rotation.x += diff * 0.18;
                else                        pin.meshRef.rotation.x  = targetRot;
                const yDiff = 0.0 - pin.meshRef.position.y;
                if (Math.abs(yDiff) > 0.05) pin.meshRef.position.y += yDiff * 0.18;
                else                         pin.meshRef.position.y  = 0.0;
            }
        });
    }
};
