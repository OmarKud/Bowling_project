import * as THREE from 'three';

export default class CustomBox {
    constructor(container, width, height, depth, material, position, rotation = null) {
        this.geometry = new THREE.BoxGeometry(width, height, depth);
        this.mesh = new THREE.Mesh(this.geometry, material);
        this.mesh.position.copy(position);
        
        if (rotation) {
            this.mesh.rotation.copy(rotation);
        }

        container.add(this.mesh);
    }
}