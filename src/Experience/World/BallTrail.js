import * as THREE from 'three';

// رمية بولينغ كاملة بـ 120fps ≈ 4 ثواني = ~480 نقطة
// 1000 هامش كافي بدون أي حذف خلال الرمية
const MAX_POINTS  = 1000;
const TRAIL_COLOR = 0xff0000;

export default class BallTrail {

    constructor(scene) {
        this.scene   = scene;
        this._points = [];

        this._positions = new Float32Array(MAX_POINTS * 3);

        this._geometry = new THREE.BufferGeometry();
        this._geometry.setAttribute(
            'position',
            new THREE.BufferAttribute(this._positions, 3)
        );
        this._geometry.setDrawRange(0, 1);

        this._material = new THREE.LineBasicMaterial({
            color     : TRAIL_COLOR,
            depthWrite: false,
        });

        this._line = new THREE.Line(this._geometry, this._material);
        this._line.frustumCulled = false;
        this._line.visible = false;
        this.scene.add(this._line);
    }

    update(ballPosition, isActive) {
        // نضيف نقطة بس لو في رمية نشطة ولم نتجاوز الحد
        if (isActive && ballPosition && this._points.length < MAX_POINTS) {
            this._points.push(ballPosition.clone());
        }

        if (this._points.length < 2) {
            this._line.visible = false;
            return;
        }

        this._line.visible = true;

        const count = this._points.length;
        for (let i = 0; i < count; i++) {
            const p   = this._points[i];
            const idx = i * 3;
            this._positions[idx]     = p.x;
            this._positions[idx + 1] = p.y;
            this._positions[idx + 2] = p.z;
        }

        this._geometry.attributes.position.needsUpdate = true;
        this._geometry.setDrawRange(0, count);
    }

    // بتنادى من _endSimulation فقط
    clear() {
        this._points = [];
        this._line.visible = false;
    }

    dispose() {
        this._geometry.dispose();
        this._material.dispose();
        this.scene.remove(this._line);
    }
}