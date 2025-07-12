import * as THREE from 'three';

function resizeRendererToDisplaySize( renderer ) {

    const canvas = renderer.domElement;
    const pixelRatio = window.devicePixelRatio;
    const width = Math.floor( canvas.clientWidth * pixelRatio );
    const height = Math.floor( canvas.clientHeight * pixelRatio );
    const needResize = canvas.width !== width || canvas.height !== height;
    if ( needResize ) {

        renderer.setSize( width, height, false );

    }

    return needResize;

}

export function render( time ) {

    time *= 0.001;

    if ( resizeRendererToDisplaySize( renderer ) ) {

        const canvas = renderer.domElement;
        camera.aspect = canvas.clientWidth / canvas.clientHeight;
        camera.updateProjectionMatrix();

    }

    cubes.forEach( ( sphere, ndx ) => {

        const speed = 1 + ndx * .5;
        const rot = time * speed;
        // sphere.rotation.x = rot;
        // sphere.rotation.y = rot;
        sphere.position.y = Math.sin(rot)*.2;

    } );
}

