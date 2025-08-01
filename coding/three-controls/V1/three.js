import * as THREE from 'three';
import { OrbitControls } from 'OrbitControls';
import { render } from './modules/render.js';

// === Main Entry Point ===
function main() {
	const scene = new THREE.Scene();
	const camera = setupCamera();
	const renderer = setupRenderer('#bg');
	const controls = setupControls(camera, renderer.domElement);
	addLighting(scene);
	addGridHelper(scene);

	// Load and render LandXML surface
	const fileName = 'Wilsonville_Ramp.xml';
	const rawXML = loadTextFileSync('./geometry/' + fileName);
	const centeredXML = moveLandXMLDataToOrigin(rawXML);
	const landXMLMesh = buildMeshFromLandXML(centeredXML);
	const transformedMesh = convertLandXMLMeshToThreeJS(landXMLMesh);
	scene.add(transformedMesh);

	// Start rendering
	animate(scene, camera, renderer);
}

main();


// === Setup Functions ===

function setupRenderer(canvasSelector) {
	const canvas = document.querySelector(canvasSelector);
	const renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
	return renderer;
}

function setupCamera() {
	const fov = 75;
	const aspect = 2;
	const near = 0.1;
	const far = 200;
	const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
	camera.position.set(1, 2, 2);
	return camera;
}

function setupControls(camera, domElement) {
	const controls = new OrbitControls(camera, domElement);
	controls.target.set(0, 0, 0);
	controls.update();
	return controls;
}

function addLighting(scene) {
	const light = new THREE.DirectionalLight(0xffffff, 3);
	light.position.set(-1, 2, 4);
	scene.add(light);
	scene.add(new THREE.AmbientLight(0x404040));
}

function addGridHelper(scene) {
	const grid = new THREE.GridHelper(10, 10);
	scene.add(grid);
}

function animate(scene, camera, renderer) {
	function renderFrame(time) {
		time *= 0.001;
		resizeRendererToDisplaySize(renderer);
		renderer.render(scene, camera);
		requestAnimationFrame(renderFrame);
	}
	requestAnimationFrame(renderFrame);
}

function resizeRendererToDisplaySize(renderer) {
	const canvas = renderer.domElement;
	const pixelRatio = window.devicePixelRatio;
	const width = Math.floor(canvas.clientWidth * pixelRatio);
	const height = Math.floor(canvas.clientHeight * pixelRatio);
	const needsResize = canvas.width !== width || canvas.height !== height;
	if (needsResize) {
		renderer.setSize(width, height, false);
	}
	return needsResize;
}


// === Mesh & LandXML Logic ===

function loadTextFileSync(filePath) {
	let result = null;
	const request = new XMLHttpRequest();
	request.open("GET", filePath, false);
	request.send();
	if (request.status === 200) {
		result = request.responseText;
	}
	return result;
}

function moveLandXMLDataToOrigin(xmlString) {
	const parser = new DOMParser();
	const xmlDoc = parser.parseFromString(xmlString, "application/xml");

	const pointElements = [...xmlDoc.getElementsByTagName("P")];
	const allCoords = pointElements.map(p => parseCoords(p.textContent));

	if (allCoords.length === 0) return xmlString;

	const [minX, minY, minZ] = [
		Math.min(...allCoords.map(c => c[0])),
		Math.min(...allCoords.map(c => c[1])),
		Math.min(...allCoords.map(c => c[2])),
	];

	for (const p of pointElements) {
		const original = parseCoords(p.textContent);
		const shifted = [
			original[0] - minX,
			original[1] - minY,
			original[2] - minZ,
		];
		p.textContent = formatCoords(shifted);
	}

	return new XMLSerializer().serializeToString(xmlDoc);
}

function parseCoords(text) {
	const parts = text.trim().split(/\s+/).map(parseFloat);
	if (parts.length === 2) parts.push(0);
	return parts;
}

function formatCoords(coords) {
	return coords.map(c => c.toFixed(6)).join(" ");
}

function buildMeshFromLandXML(xmlString) {
	const parser = new DOMParser();
	const xmlDoc = parser.parseFromString(xmlString, "application/xml");
	const nsResolver = (prefix) => (prefix === 'l' ? 'http://www.landxml.org/schema/LandXML-1.2' : null);

	const pointsMap = new Map();
	const pointNodes = xmlDoc.evaluate('//l:P', xmlDoc, nsResolver, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
	for (let i = 0; i < pointNodes.snapshotLength; i++) {
		const node = pointNodes.snapshotItem(i);
		pointsMap.set(node.getAttribute('id'), parseCoords(node.textContent));
	}

	const faceNodes = xmlDoc.evaluate('//l:F', xmlDoc, nsResolver, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
	const vertexArray = [];

	for (let i = 0; i < faceNodes.snapshotLength; i++) {
		const node = faceNodes.snapshotItem(i);
		const ids = node.textContent.trim().split(/\s+/);
		ids.forEach(id => {
			const coord = pointsMap.get(id);
			if (!coord) throw new Error(`Missing point ID: ${id}`);
			vertexArray.push(...coord);
		});
	}

	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertexArray), 3));
	geometry.computeVertexNormals();

	// === Concrete Texture ===
	const textureLoader = new THREE.TextureLoader();
	const concreteTexture = textureLoader.load('./textures/concrete.jpg');
	concreteTexture.wrapS = THREE.RepeatWrapping;
	concreteTexture.wrapT = THREE.RepeatWrapping;
	concreteTexture.repeat.set(4, 4); // adjust tiling as needed

	// UV Mapping
	const uvs = [];
	const positions = geometry.attributes.position;
	for (let i = 0; i < positions.count; i++) {
		const x = positions.getX(i);
		const z = positions.getZ(i); // we use x and z for ground UVs
		uvs.push(x * 0.1, z * 0.1);  // scale UVs
	}
	geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

	const concreteMaterial = new THREE.MeshStandardMaterial({
		map: concreteTexture,
		roughness: 1.0,
		metalness: 0.1,
		side: THREE.DoubleSide
	});

	return new THREE.Mesh(geometry, concreteMaterial);
}


function convertLandXMLMeshToThreeJS(inputMesh) {
	if (!inputMesh?.isMesh) throw new Error("Expected THREE.Mesh");

	const originalGeometry = inputMesh.geometry;
	if (!originalGeometry?.attributes?.position) {
		throw new Error("Geometry lacks position attribute.");
	}

	const newGeometry = originalGeometry.clone();
	const position = newGeometry.attributes.position;

	for (let i = 0; i < position.count; i++) {
		const x = position.getX(i);
		const y = position.getY(i);
		const z = position.getZ(i);
		position.setXYZ(i, x, z, -y); // Map [X, Y, Z] → [X, Z, -Y]
	}

	position.needsUpdate = true;
	newGeometry.computeVertexNormals?.();

	return new THREE.Mesh(newGeometry, inputMesh.material);
}
