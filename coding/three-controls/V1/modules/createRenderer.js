import * as THREE from 'three';

function loadRenderer(canvas) {
    const renderer = new THREE.WebGLRenderer({antialias: true, canvas});

    return renderer;
}

export default loadRenderer;