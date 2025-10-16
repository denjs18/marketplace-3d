/**
 * STL 3D Viewer using Three.js
 */

let scene, camera, renderer, controls, model;
let viewerContainer;

/**
 * Initialize STL viewer
 * @param {string} containerId - ID of the container element
 * @param {ArrayBuffer} stlData - STL file data as ArrayBuffer
 */
function initSTLViewer(containerId, stlData) {
  viewerContainer = document.getElementById(containerId);
  if (!viewerContainer) {
    console.error('Viewer container not found');
    return;
  }

  // Clear previous content
  viewerContainer.innerHTML = '';

  const width = viewerContainer.clientWidth;
  const height = viewerContainer.clientHeight || 400;

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a1a);

  // Camera
  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10000);
  camera.position.set(100, 100, 100);
  camera.lookAt(0, 0, 0);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  renderer.shadowMap.enabled = true;
  viewerContainer.appendChild(renderer.domElement);

  // Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight1.position.set(100, 100, 100);
  scene.add(directionalLight1);

  const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
  directionalLight2.position.set(-100, 100, -100);
  scene.add(directionalLight2);

  // Grid
  const gridHelper = new THREE.GridHelper(200, 20, 0x888888, 0x444444);
  scene.add(gridHelper);

  // Axes helper
  const axesHelper = new THREE.AxesHelper(50);
  scene.add(axesHelper);

  // Load STL
  loadSTL(stlData);

  // Simple orbit controls (manual implementation)
  addOrbitControls();

  // Add control buttons
  addControlButtons();

  // Animation loop
  animate();

  // Handle window resize
  window.addEventListener('resize', onWindowResize, false);
}

/**
 * Load STL file
 */
function loadSTL(stlData) {
  try {
    const geometry = parseSTL(stlData);

    // Center geometry
    geometry.center();
    geometry.computeBoundingBox();
    geometry.computeVertexNormals();

    // Material
    const material = new THREE.MeshPhongMaterial({
      color: 0x2563eb,
      specular: 0x111111,
      shininess: 200,
      flatShading: false
    });

    // Mesh
    model = new THREE.Mesh(geometry, material);
    model.castShadow = true;
    model.receiveShadow = true;
    scene.add(model);

    // Calculate dimensions and volume
    const bbox = geometry.boundingBox;
    const dimensions = {
      x: (bbox.max.x - bbox.min.x).toFixed(2),
      y: (bbox.max.y - bbox.min.y).toFixed(2),
      z: (bbox.max.z - bbox.min.z).toFixed(2)
    };

    // Update UI
    updateModelInfo(dimensions, geometry);

    // Fit camera to model
    fitCameraToModel();

  } catch (error) {
    console.error('Error loading STL:', error);
    alert('Erreur lors du chargement du fichier STL');
  }
}

/**
 * Parse STL file (binary format)
 */
function parseSTL(data) {
  const view = new DataView(data);
  const isASCII = isASCIISTL(data);

  if (isASCII) {
    return parseASCIISTL(new TextDecoder().decode(data));
  } else {
    return parseBinarySTL(view);
  }
}

/**
 * Check if STL is ASCII format
 */
function isASCIISTL(data) {
  const header = new TextDecoder().decode(data.slice(0, 80));
  return header.toLowerCase().includes('solid');
}

/**
 * Parse binary STL
 */
function parseBinarySTL(view) {
  const geometry = new THREE.BufferGeometry();
  const triangleCount = view.getUint32(80, true);

  const vertices = [];
  const normals = [];

  let offset = 84;

  for (let i = 0; i < triangleCount; i++) {
    // Normal
    const nx = view.getFloat32(offset, true); offset += 4;
    const ny = view.getFloat32(offset, true); offset += 4;
    const nz = view.getFloat32(offset, true); offset += 4;

    // Vertices
    for (let j = 0; j < 3; j++) {
      const x = view.getFloat32(offset, true); offset += 4;
      const y = view.getFloat32(offset, true); offset += 4;
      const z = view.getFloat32(offset, true); offset += 4;

      vertices.push(x, y, z);
      normals.push(nx, ny, nz);
    }

    offset += 2; // Attribute byte count
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));

  return geometry;
}

/**
 * Parse ASCII STL (simplified)
 */
function parseASCIISTL(data) {
  const geometry = new THREE.BufferGeometry();
  const vertices = [];
  const normals = [];

  const vertexPattern = /vertex\s+([\d\.\-\+eE]+)\s+([\d\.\-\+eE]+)\s+([\d\.\-\+eE]+)/g;
  const normalPattern = /facet\s+normal\s+([\d\.\-\+eE]+)\s+([\d\.\-\+eE]+)\s+([\d\.\-\+eE]+)/g;

  let normalMatch;
  let vertexMatches = [];

  while ((normalMatch = normalPattern.exec(data)) !== null) {
    const nx = parseFloat(normalMatch[1]);
    const ny = parseFloat(normalMatch[2]);
    const nz = parseFloat(normalMatch[3]);

    let vertexMatch;
    let count = 0;
    while (count < 3 && (vertexMatch = vertexPattern.exec(data)) !== null) {
      vertices.push(
        parseFloat(vertexMatch[1]),
        parseFloat(vertexMatch[2]),
        parseFloat(vertexMatch[3])
      );
      normals.push(nx, ny, nz);
      count++;
    }
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));

  return geometry;
}

/**
 * Update model info display
 */
function updateModelInfo(dimensions, geometry) {
  const dimElement = document.getElementById('dimensions');
  const volElement = document.getElementById('volume');
  const weightElement = document.getElementById('weight');

  if (dimElement) {
    dimElement.textContent = `${dimensions.x} × ${dimensions.y} × ${dimensions.z} mm`;
  }

  if (volElement && geometry.boundingBox) {
    const bbox = geometry.boundingBox;
    const volume = ((bbox.max.x - bbox.min.x) *
                    (bbox.max.y - bbox.min.y) *
                    (bbox.max.z - bbox.min.z)) / 1000; // mm³ to cm³
    volElement.textContent = `${volume.toFixed(2)} cm³`;
  }

  if (weightElement && geometry.boundingBox) {
    // Estimate weight (assuming 20% infill and PLA density ~1.24g/cm³)
    const bbox = geometry.boundingBox;
    const volume = ((bbox.max.x - bbox.min.x) *
                    (bbox.max.y - bbox.min.y) *
                    (bbox.max.z - bbox.min.z)) / 1000;
    const weight = volume * 1.24 * 0.20; // volume * density * infill
    weightElement.textContent = `~${weight.toFixed(0)}g (PLA 20%)`;
  }
}

/**
 * Fit camera to model
 */
function fitCameraToModel() {
  if (!model) return;

  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = camera.fov * (Math.PI / 180);
  let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
  cameraZ *= 1.5; // Add some padding

  camera.position.set(center.x + cameraZ, center.y + cameraZ, center.z + cameraZ);
  camera.lookAt(center);
  camera.updateProjectionMatrix();
}

/**
 * Simple orbit controls
 */
function addOrbitControls() {
  let isMouseDown = false;
  let previousMousePosition = { x: 0, y: 0 };

  renderer.domElement.addEventListener('mousedown', () => {
    isMouseDown = true;
  });

  renderer.domElement.addEventListener('mouseup', () => {
    isMouseDown = false;
  });

  renderer.domElement.addEventListener('mousemove', (e) => {
    if (isMouseDown && model) {
      const deltaMove = {
        x: e.offsetX - previousMousePosition.x,
        y: e.offsetY - previousMousePosition.y
      };

      model.rotation.y += deltaMove.x * 0.01;
      model.rotation.x += deltaMove.y * 0.01;
    }

    previousMousePosition = {
      x: e.offsetX,
      y: e.offsetY
    };
  });

  // Zoom with mouse wheel
  renderer.domElement.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY;
    camera.position.z += delta * 0.1;
    camera.position.z = Math.max(10, Math.min(1000, camera.position.z));
  });
}

/**
 * Add control buttons
 */
function addControlButtons() {
  const controlsDiv = document.createElement('div');
  controlsDiv.style.position = 'absolute';
  controlsDiv.style.top = '10px';
  controlsDiv.style.right = '10px';
  controlsDiv.style.zIndex = '100';
  controlsDiv.style.display = 'flex';
  controlsDiv.style.gap = '8px';

  // Reset button
  const resetBtn = createButton('🔄 Reset', () => {
    if (model) {
      model.rotation.set(0, 0, 0);
      fitCameraToModel();
    }
  });

  // Fullscreen button
  const fullscreenBtn = createButton('⛶ Plein écran', () => {
    if (!document.fullscreenElement) {
      viewerContainer.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  });

  controlsDiv.appendChild(resetBtn);
  controlsDiv.appendChild(fullscreenBtn);
  viewerContainer.appendChild(controlsDiv);
}

/**
 * Create button helper
 */
function createButton(text, onClick) {
  const button = document.createElement('button');
  button.textContent = text;
  button.className = 'btn btn-outline';
  button.style.fontSize = '0.875rem';
  button.style.padding = '0.5rem 1rem';
  button.onclick = onClick;
  return button;
}

/**
 * Animation loop
 */
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

/**
 * Handle window resize
 */
function onWindowResize() {
  if (!viewerContainer || !camera || !renderer) return;

  const width = viewerContainer.clientWidth;
  const height = viewerContainer.clientHeight || 400;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.initSTLViewer = initSTLViewer;
}
