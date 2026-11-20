/**
 * AlphaPulse IN — 3D WebGL Quant Terminal Engine
 * Powered by Three.js
 * Renders an interactive 3D spatial matrix of the 28 NSE F&O stocks with real-time elevation,
 * glowing volumetric status pillars, dynamic camera orbits, and particle flow.
 */

class Terminal3D {
  constructor(containerId, onStockSelect) {
    this.container = document.getElementById(containerId);
    this.onStockSelect = onStockSelect;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.pillars = new Map();
    this.particles = null;
    this.gridHelper = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.isDragging = false;
    this.previousMousePosition = { x: 0, y: 0 };
    this.targetRotation = { x: 0.45, y: -0.6 };
    this.currentRotation = { x: 0.45, y: -0.6 };
    this.cameraDistance = 55;
    this.selectedSymbol = 'RELIANCE';

    if (this.container) {
      this.init();
    }
  }

  init() {
    const width = this.container.clientWidth || 900;
    const height = this.container.clientHeight || 450;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050811);
    this.scene.fog = new THREE.FogExp2(0x050811, 0.015);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.updateCameraPosition();

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x06b6d4, 1.2);
    dirLight1.position.set(20, 40, 20);
    this.scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x8b5cf6, 0.8);
    dirLight2.position.set(-20, 30, -20);
    this.scene.add(dirLight2);

    // 5. Grid Surface
    const grid = new THREE.GridHelper(60, 30, 0x06b6d4, 0x1e293b);
    grid.position.y = -0.1;
    this.scene.add(grid);
    this.gridHelper = grid;

    // 6. Particle Field (Flowing ticks)
    this.createParticleField();

    // 7. Event Listeners
    this.setupControls();

    // 8. Handle Resize
    window.addEventListener('resize', () => this.onResize());

    // 9. Animation Loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  createParticleField() {
    const particleCount = 600;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 80;
      positions[i * 3 + 1] = Math.random() * 25;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 80;

      // Cyan to Emerald hues
      colors[i * 3] = 0.05 + Math.random() * 0.2;
      colors[i * 3 + 1] = 0.7 + Math.random() * 0.3;
      colors[i * 3 + 2] = 0.8 + Math.random() * 0.2;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.6,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    });

    this.particles = new THREE.Points(geometry, material);
    this.scene.add(this.particles);
  }

  updateStockGrid(stocks) {
    if (!this.scene) return;

    // Display top 35 most active / highest alpha stocks in 3D grid for optimal 60 FPS performance
    const displayStocks = stocks.slice(0, 35);
    const cols = 7;
    const spacing = 7.0;
    const offsetX = -((cols - 1) * spacing) / 2;
    const offsetZ = -((Math.ceil(displayStocks.length / cols) - 1) * spacing) / 2;

    displayStocks.forEach((stock, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const posX = offsetX + col * spacing;
      const posZ = offsetZ + row * spacing;

      let pillar = this.pillars.get(stock.symbol);

      // Height based on % change and volume surge
      const chg = stock.change_pct || 0;
      const height = Math.max(1.5, Math.min(14, Math.abs(chg) * 3.5 + 2.5));

      // Color based on signal / trend
      let colorHex = 0x3b82f6; // Blue neutral
      let emissiveHex = 0x1d4ed8;
      if (stock.is_top_pick) {
        colorHex = 0x10b981; // Vibrant Emerald
        emissiveHex = 0x059669;
      } else if (stock.signal && stock.signal.includes('BUY')) {
        colorHex = 0x06b6d4; // Cyan
        emissiveHex = 0x0891b2;
      } else if (stock.signal && stock.signal.includes('SELL')) {
        colorHex = 0xef4444; // Crimson Red
        emissiveHex = 0xb91c1c;
      }

      if (!pillar) {
        // Create new 3D Pillar
        const group = new THREE.Group();
        group.position.set(posX, 0, posZ);

        // Cylinder body
        const geom = new THREE.CylinderGeometry(1.6, 1.8, 1, 16);
        const mat = new THREE.MeshStandardMaterial({
          color: colorHex,
          emissive: emissiveHex,
          emissiveIntensity: stock.is_top_pick ? 0.75 : 0.35,
          roughness: 0.2,
          metalness: 0.8,
          transparent: true,
          opacity: 0.92
        });

        const mesh = new THREE.Mesh(geom, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);

        // Ground ring base
        const ringGeom = new THREE.RingGeometry(1.9, 2.3, 24);
        const ringMat = new THREE.MeshBasicMaterial({
          color: stock.is_top_pick ? 0xf59e0b : colorHex,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: stock.is_top_pick ? 0.9 : 0.5
        });
        const ring = new THREE.Mesh(ringGeom, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.05;
        group.add(ring);

        group.userData = { symbol: stock.symbol, data: stock, mesh: mesh, ring: ring };
        this.scene.add(group);
        pillar = group;
        this.pillars.set(stock.symbol, pillar);
      }

      // Update position & height
      pillar.position.set(posX, 0, posZ);
      const mesh = pillar.userData.mesh;
      mesh.scale.set(1, height, 1);
      mesh.position.y = height / 2;

      // Update material color
      mesh.material.color.setHex(colorHex);
      mesh.material.emissive.setHex(emissiveHex);
      pillar.userData.ring.material.color.setHex(stock.is_top_pick ? 0xf59e0b : colorHex);

      // Highlight selected stock
      if (stock.symbol === this.selectedSymbol) {
        mesh.material.emissiveIntensity = 0.95;
        pillar.userData.ring.material.opacity = 1.0;
        mesh.scale.set(1.2, height, 1.2);
      } else {
        mesh.material.emissiveIntensity = stock.is_top_pick ? 0.75 : 0.35;
        pillar.userData.ring.material.opacity = stock.is_top_pick ? 0.85 : 0.45;
      }

      pillar.userData.data = stock;
    });
  }


  setupControls() {
    const dom = this.renderer.domElement;

    dom.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    dom.addEventListener('mousemove', (e) => {
      const rect = dom.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / dom.clientWidth) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / dom.clientHeight) * 2 + 1;

      if (this.isDragging) {
        const deltaX = e.clientX - this.previousMousePosition.x;
        const deltaY = e.clientY - this.previousMousePosition.y;

        this.targetRotation.y += deltaX * 0.007;
        this.targetRotation.x = Math.max(0.15, Math.min(1.3, this.targetRotation.x + deltaY * 0.007));

        this.previousMousePosition = { x: e.clientX, y: e.clientY };
      }
    });

    dom.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.cameraDistance = Math.max(25, Math.min(95, this.cameraDistance + e.deltaY * 0.05));
    }, { passive: false });

    dom.addEventListener('click', (e) => {
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const meshes = [];
      this.pillars.forEach((p) => meshes.push(p.userData.mesh));

      const intersects = this.raycaster.intersectObjects(meshes);
      if (intersects.length > 0) {
        const hitPillar = intersects[0].object.parent;
        if (hitPillar && hitPillar.userData.symbol) {
          this.setSelectedSymbol(hitPillar.userData.symbol);
          if (this.onStockSelect) {
            this.onStockSelect(hitPillar.userData.data);
          }
        }
      }
    });
  }

  setSelectedSymbol(symbol) {
    this.selectedSymbol = symbol;
    this.pillars.forEach((pillar, sym) => {
      const isSel = (sym === symbol);
      const mesh = pillar.userData.mesh;
      mesh.material.emissiveIntensity = isSel ? 0.9 : 0.35;
      pillar.userData.ring.material.opacity = isSel ? 1.0 : 0.45;
    });
  }

  setCameraView(viewName) {
    if (viewName === 'iso') {
      this.targetRotation = { x: 0.5, y: -0.6 };
      this.cameraDistance = 55;
    } else if (viewName === 'top') {
      this.targetRotation = { x: 1.35, y: 0 };
      this.cameraDistance = 65;
    } else if (viewName === 'close') {
      this.targetRotation = { x: 0.3, y: -0.2 };
      this.cameraDistance = 35;
    }
  }

  updateCameraPosition() {
    this.currentRotation.x += (this.targetRotation.x - this.currentRotation.x) * 0.08;
    this.currentRotation.y += (this.targetRotation.y - this.currentRotation.y) * 0.08;

    const r = this.cameraDistance;
    const phi = this.currentRotation.x;
    const theta = this.currentRotation.y;

    this.camera.position.x = r * Math.cos(phi) * Math.sin(theta);
    this.camera.position.y = r * Math.sin(phi);
    this.camera.position.z = r * Math.cos(phi) * Math.cos(theta);
    this.camera.lookAt(0, 3, 0);
  }

  animate() {
    requestAnimationFrame(this.animate);

    this.updateCameraPosition();

    // Floating particles
    if (this.particles) {
      const positions = this.particles.geometry.attributes.position.array;
      for (let i = 1; i < positions.length; i += 3) {
        positions[i] += 0.04;
        if (positions[i] > 25) {
          positions[i] = 0;
        }
      }
      this.particles.geometry.attributes.position.needsUpdate = true;
    }

    // Subtle gentle pulse for strong signals
    this.pillars.forEach((pillar) => {
      const d = pillar.userData.data;
      if (d && d.signal && d.signal.includes('STRONG')) {
        const time = Date.now() * 0.005;
        const scale = 1.0 + Math.sin(time) * 0.08;
        pillar.userData.ring.scale.set(scale, scale, 1);
      }
    });

    this.renderer.render(this.scene, this.camera);
  }

  onResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth || 900;
    const height = this.container.clientHeight || 450;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
}

window.Terminal3D = Terminal3D;
