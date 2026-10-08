/* ============================================================
   3D-ПРЕВЬЮ ТОРТА — Three.js
   Меняется в реальном времени при выборе опций
   ============================================================ */


const cake3D = {
  scene: null,
  camera: null,
  renderer: null,
  cakeGroup: null,
  animationId: null,
  isReady: false,
  currentParams: {
    shape: 'round',
    filling: 'vanilla',
    decor: [],
    weight: 2
  },
  // ✅ Система анимаций
  animations: [],
  clock: null
};

// ============================================================
// 1. Инициализация сцены
// ============================================================
function init3DCake(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return false;

  // Проверяем поддержку WebGL
  if (!isWebGLAvailable()) {
    console.warn('WebGL не поддерживается');
    container.innerHTML = '<div style="color:#A89888;text-align:center;padding:40px;">3D-превью недоступно на вашем устройстве</div>';
    return false;
  }

  // Проверяем, что Three.js загружен
  if (typeof THREE === 'undefined') {
    console.warn('Three.js не загружен');
    return false;
  }

  // Сцена
  cake3D.scene = new THREE.Scene();
  cake3D.scene.background = null; // прозрачный фон

  // Камера
  const aspect = container.clientWidth / container.clientHeight;
  cake3D.camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 100);
  cake3D.camera.position.set(0, 3, 6.5);
  cake3D.camera.lookAt(0, 0.8, 0);

  // Renderer
  cake3D.renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  });
  cake3D.renderer.setSize(container.clientWidth, container.clientHeight);
  cake3D.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // ✅ Тени с высоким качеством
  cake3D.renderer.shadowMap.enabled = true;
  cake3D.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // ✅ Физически корректный цвет
  if ('outputColorSpace' in cake3D.renderer) {
    cake3D.renderer.outputColorSpace = THREE.SRGBColorSpace;
  } else if ('outputEncoding' in cake3D.renderer) {
    cake3D.renderer.outputEncoding = THREE.sRGBEncoding;
  }

  // ✅ Тонемаппинг — реалистичное освещение
  cake3D.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  cake3D.renderer.toneMappingExposure = 1.1;

  // Очищаем контейнер
  container.innerHTML = '';
  container.appendChild(cake3D.renderer.domElement);

  // Освещение
  setupLights();

  // Платформа (тарелка)
  setupPlatform();

  // Группа торта
  cake3D.cakeGroup = new THREE.Group();
  cake3D.scene.add(cake3D.cakeGroup);

  // Строим торт по умолчанию
  buildCake();

  // ✅ Часы для анимаций
  cake3D.clock = new THREE.Clock();

  // Вращение
  startAnimation();

  // Ресайз
  window.addEventListener('resize', () => {
    if (!cake3D.renderer) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    cake3D.camera.aspect = w / h;
    cake3D.camera.updateProjectionMatrix();
    cake3D.renderer.setSize(w, h);
  });

  // Mouse — вращение торта
  enableOrbit(container);

  cake3D.isReady = true;
  return true;
}

// ============================================================
// 2. Проверка WebGL
// ============================================================
function isWebGLAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
  } catch {
    return false;
  }
}

// ============================================================
// 3. Освещение
// ============================================================
function setupLights() {
  // ============================================
  // 1. Основной заливной (мягкий)
  // ============================================
  const ambient = new THREE.AmbientLight(0xfff5e0, 0.35);
  cake3D.scene.add(ambient);

  // ============================================
  // 2. Тёплый Hemisphere — снизу/сверху
  // ============================================
  const hemi = new THREE.HemisphereLight(0xfff5e0, 0x1A1310, 0.4);
  hemi.position.set(0, 10, 0);
  cake3D.scene.add(hemi);

  // ============================================
  // 3. Главный (key light) — сверху
  // ============================================
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
  keyLight.position.set(5, 10, 5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 2048;
  keyLight.shadow.mapSize.height = 2048;
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 30;
  keyLight.shadow.camera.left = -5;
  keyLight.shadow.camera.right = 5;
  keyLight.shadow.camera.top = 5;
  keyLight.shadow.camera.bottom = -5;
  keyLight.shadow.bias = -0.0001;
  keyLight.shadow.radius = 4;
  cake3D.scene.add(keyLight);

  // ============================================
  // 4. Заполняющий (fill) — сзади слева
  // ============================================
  const fillLight = new THREE.DirectionalLight(0xffd6b0, 0.6);
  fillLight.position.set(-6, 5, -5);
  cake3D.scene.add(fillLight);

  // ============================================
  // 5. Тёплый акцент — спереди справа (золото)
  // ============================================
  const accentLight = new THREE.PointLight(0xE8A87C, 0.8, 12);
  accentLight.position.set(3, 2.5, 3);
  accentLight.castShadow = false;
  cake3D.scene.add(accentLight);

  // ============================================
  // 6. Холодный rim-light — сзади (контраст)
  // ============================================
  const rimLight = new THREE.PointLight(0x78A8D8, 0.4, 8);
  rimLight.position.set(-2, 3, -4);
  cake3D.scene.add(rimLight);

  // ============================================
  // 7. Микро-подсветка снизу (отражение от тарелки)
  // ============================================
  const bounceLight = new THREE.PointLight(0xC9A961, 0.3, 6);
  bounceLight.position.set(0, -1, 0);
  cake3D.scene.add(bounceLight);
}

// ============================================================
// 4. Платформа (тарелка под тортом)
// ============================================================
function setupPlatform() {
  // ============================================
  // 1. Основание тарелки (тёмное, с блеском)
  // ============================================
  const plateGeo = new THREE.CylinderGeometry(2.6, 2.55, 0.12, 64);
  const plateMat = new THREE.MeshStandardMaterial({
    color: 0x0E0A08,
    roughness: 0.25,
    metalness: 0.4
  });
  const plate = new THREE.Mesh(plateGeo, plateMat);
  plate.position.y = -0.06;
  plate.receiveShadow = true;
  plate.castShadow = true;
  cake3D.scene.add(plate);

  // ============================================
  // 2. Верхний слой тарелки (светлый, мягкий)
  // ============================================
  const topGeo = new THREE.CylinderGeometry(2.45, 2.45, 0.04, 64);
  const topMat = new THREE.MeshStandardMaterial({
    color: 0x2A1F19,
    roughness: 0.4,
    metalness: 0.2
  });
  const top = new THREE.Mesh(topGeo, topMat);
  top.position.y = 0;
  top.receiveShadow = true;
  cake3D.scene.add(top);

  // ============================================
  // 3. Золотой ободок (главный)
  // ============================================
  const rimGeo = new THREE.TorusGeometry(2.5, 0.04, 24, 96);
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xC9A961,
    roughness: 0.15,
    metalness: 0.95,
    emissive: 0x9C7E42,
    emissiveIntensity: 0.15
  });
  const rim = new THREE.Mesh(rimGeo, rimMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.02;
  cake3D.scene.add(rim);

  // ============================================
  // 4. Внутренний тонкий ободок (двойная линия)
  // ============================================
  const innerRimGeo = new THREE.TorusGeometry(2.35, 0.015, 16, 96);
  const innerRimMat = new THREE.MeshStandardMaterial({
    color: 0xE5C57A,
    roughness: 0.2,
    metalness: 0.9
  });
  const innerRim = new THREE.Mesh(innerRimGeo, innerRimMat);
  innerRim.rotation.x = Math.PI / 2;
  innerRim.position.y = 0.02;
  cake3D.scene.add(innerRim);

  // ============================================
  // 5. Гравировка — 8 маленьких «лучей»
  // ============================================
  const engravingMat = new THREE.MeshStandardMaterial({
    color: 0xC9A961,
    roughness: 0.3,
    metalness: 0.9,
    emissive: 0x9C7E42,
    emissiveIntensity: 0.2
  });

  const engravingCount = 8;
  for (let i = 0; i < engravingCount; i++) {
    const angle = (i / engravingCount) * Math.PI * 2;
    const distance = 2.25;

    const markGeo = new THREE.BoxGeometry(0.08, 0.01, 0.25);
    const mark = new THREE.Mesh(markGeo, engravingMat);
    mark.position.set(
      Math.cos(angle) * distance,
      0.025,
      Math.sin(angle) * distance
    );
    mark.rotation.y = angle;
    cake3D.scene.add(mark);
  }

  // ============================================
  // 6. Отражение (тонкое свечение снизу тарелки)
  // ============================================
  const glowGeo = new THREE.CircleGeometry(2.8, 64);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xE8A87C,
    transparent: true,
    opacity: 0.08,
    side: THREE.DoubleSide
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = -0.15;
  cake3D.scene.add(glow);
}

// ============================================================
// 5. Построение торта
// ============================================================
function buildCake() {
  if (!cake3D.cakeGroup) return;

  // Очищаем группу
  while (cake3D.cakeGroup.children.length > 0) {
    cake3D.cakeGroup.remove(cake3D.cakeGroup.children[0]);
  }

  const { shape, filling, decor, weight = 2 } = cake3D.currentParams;

  // ✅ Масштаб от веса: 1кг → 0.85, 2кг → 1.0, 3кг → 1.15
  const weightScale = 0.7 + (weight * 0.15);

  // Цвет по начинке
  const colors = getFillingColors(filling);

  // ============================================
  // Основание (бисквит)
  // ============================================
  const cakeHeight = 1.4 * weightScale;
  const cakeWidth = (shape === 'square' ? 1.6 : 1.8) * weightScale;

  let baseGeometry;

  if (shape === 'square') {
    baseGeometry = new THREE.BoxGeometry(cakeWidth * 1.9, cakeHeight, cakeWidth * 1.9);
  } else if (shape === 'heart') {
    baseGeometry = createHeartShape(1.8, cakeHeight);
  } else if (shape === 'oval') {
    baseGeometry = new THREE.CylinderGeometry(cakeWidth, cakeWidth, cakeHeight, 64);
    baseGeometry.scale(1.3, 1, 0.8); // вытягиваем по X
  } else if (shape === 'hexagon') {
    baseGeometry = new THREE.CylinderGeometry(cakeWidth, cakeWidth, cakeHeight, 6);
  } else if (shape === 'flower') {
    baseGeometry = createFlowerShape(1.8, cakeHeight);
  } else {
    // round — по умолчанию
    baseGeometry = new THREE.CylinderGeometry(cakeWidth, cakeWidth, cakeHeight, 64);
  }

  const baseMat = new THREE.MeshPhysicalMaterial({
    color: colors.cake,
    roughness: 0.75,
    metalness: 0.02,
    sheen: 0.3,
    sheenColor: new THREE.Color(0xFFFFFF),
    sheenRoughness: 0.8
  });
  const base = new THREE.Mesh(baseGeometry, baseMat);

  // ✅ Правильное позиционирование: смотрим на тип формы
  if (shape === 'heart' || shape === 'flower') {
    // Для ExtrudeGeometry — уже прижаты к Y=0 в create*
    base.position.y = 0;
  } else {
    // Для остальных — поднимаем на высоту/2 (центр цилиндра)
    base.position.y = cakeHeight / 2;
  }
  base.castShadow = true;
  base.receiveShadow = true;
  cake3D.cakeGroup.add(base);

  // ============================================
  // Крем сверху
  // ============================================
  const creamHeight = 0.18;
  let creamGeometry;

  if (shape === 'square') {
    creamGeometry = new THREE.BoxGeometry(cakeWidth * 1.92, creamHeight, cakeWidth * 1.92);
  } else if (shape === 'heart') {
    creamGeometry = createHeartShape(1.82, creamHeight);
  } else if (shape === 'oval') {
    creamGeometry = new THREE.CylinderGeometry(cakeWidth * 1.01, cakeWidth * 1.01, creamHeight, 64);
    creamGeometry.scale(1.3, 1, 0.8);
  } else if (shape === 'hexagon') {
    creamGeometry = new THREE.CylinderGeometry(cakeWidth * 1.02, cakeWidth * 1.02, creamHeight, 6);
  } else if (shape === 'flower') {
    creamGeometry = createFlowerShape(1.82, creamHeight);
  } else {
    creamGeometry = new THREE.CylinderGeometry(cakeWidth * 1.01, cakeWidth * 1.01, creamHeight, 64);
  }

  const creamMat = new THREE.MeshPhysicalMaterial({
    color: colors.cream,
    roughness: 0.25,
    metalness: 0.05,
    clearcoat: 1.0,         // ✅ блеск как на глазури
    clearcoatRoughness: 0.1,
    sheen: 0.5,
    sheenColor: new THREE.Color(0xFFF5E0),
    emissive: new THREE.Color(colors.cream),
    emissiveIntensity: 0.05
  });
  const cream = new THREE.Mesh(creamGeometry, creamMat);

  if (shape === 'heart' || shape === 'flower') {
    // Для ExtrudeGeometry — крем должен быть поверх торта
    cream.position.y = cakeHeight + creamHeight;
  } else {
    cream.position.y = cakeHeight + creamHeight / 2;
  }
  cream.castShadow = true;
  cream.receiveShadow = true;
  cake3D.cakeGroup.add(cream);

  // ============================================
  // Боковая полоска (обводка)
  // ============================================
  if (shape === 'round') {
    const stripeGeo = new THREE.TorusGeometry(cakeWidth, 0.04, 16, 64);
    const stripeMat = new THREE.MeshStandardMaterial({
      color: colors.stripe,
      roughness: 0.4,
      metalness: 0.3
    });
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.rotation.x = Math.PI / 2;
    stripe.position.y = cakeHeight + 0.02;
    cake3D.cakeGroup.add(stripe);
  }

  // ============================================
  // Декор — с учётом масштаба
  // ============================================
  decor.forEach(decorKey => {
    addDecorItem(decorKey, cakeWidth, cakeHeight + creamHeight, weightScale);
  });
}

// ============================================================
// 6. Цвета по начинке
// ============================================================
function getFillingColors(filling) {
  const map = {
    vanilla: { cake: 0xE8C99B, cream: 0xF5EDE4, stripe: 0xC9A961 },
    chocolate: { cake: 0x5C3A2A, cream: 0x8B6F47, stripe: 0xC9A961 },
    fruits: { cake: 0xF0C9A8, cream: 0xFFD5B0, stripe: 0xE8A87C },
    nuts: { cake: 0xA67C4A, cream: 0xD4B36A, stripe: 0xC9A961 },
    caramel: { cake: 0xC88A4E, cream: 0xE5C57A, stripe: 0xE8A87C },
    redvelvet: { cake: 0x8B2020, cream: 0xF5EDE4, stripe: 0xC9A961 },
    tiramisu: { cake: 0xC8A87A, cream: 0xF0E0C8, stripe: 0x8B6F47 },
    lemon: { cake: 0xF5E5A0, cream: 0xFFF5B0, stripe: 0xC9A961 },
    coconut: { cake: 0xF0EDE4, cream: 0xFFFFFF, stripe: 0xC9A961 }
  };
  return map[filling] || map.vanilla;
}

// ============================================================
// 7. Добавление декора
// ============================================================
function addDecorItem(key, cakeWidth, topY, scale = 1) {
  const decorMap = {
    candles: () => addCandles(topY, cakeWidth, scale),
    berries: () => addBerries(cakeWidth, topY, scale),
    gold: () => addGold(topY, cakeWidth, scale),
    figurines: () => addFigurines(cakeWidth, topY, scale),
    marshmallows: () => addMarshmallows(cakeWidth, topY, scale),
    chocolate: () => addChocolateFigures(cakeWidth, topY, scale),
    flowers: () => addEdibleFlowers(cakeWidth, topY, scale),
    nuts: () => addNuts(cakeWidth, topY, scale)
  };

  if (decorMap[key]) {
    decorMap[key]();

    // ✅ Лёгкое свечение вокруг декора
    const glow = new THREE.PointLight(0xE8A87C, 1.5, 3);
    glow.position.set(0, topY + 0.5, 0);
    cake3D.cakeGroup.add(glow);

    // Затухание
    const startTime = performance.now();
    const duration = 600;

    function fadeGlow() {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      glow.intensity = 1.5 * (1 - progress);

      if (progress < 1) {
        requestAnimationFrame(fadeGlow);
      } else {
        cake3D.cakeGroup.remove(glow);
      }
    }

    fadeGlow();
  }
}

function addCandles(topY, cakeWidth = 1.8, scale = 1) {
  const candleCount = 5;
  const radius = cakeWidth * 0.5;

  for (let i = 0; i < candleCount; i++) {
    const angle = (i / candleCount) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    // Свечка
    const candleH = 0.6 * scale;
    const candleGeo = new THREE.CylinderGeometry(0.035 * scale, 0.035 * scale, candleH, 12);
    const candleMat = new THREE.MeshStandardMaterial({ color: 0xF5EDE4, roughness: 0.5 });
    const candle = new THREE.Mesh(candleGeo, candleMat);
    candle.position.set(x, topY + candleH / 2, z);
    candle.castShadow = true;
    cake3D.cakeGroup.add(candle);

    // ✅ Анимация появления свечки
    animateSpawn(candle, {
      fromY: 1.2,
      duration: 0.5,
      delay: i * 0.06,
      fromScale: 0.2
    });

    // Огонёк
    const flameGeo = new THREE.SphereGeometry(0.07 * scale, 16, 16);
    const flameMat = new THREE.MeshStandardMaterial({
      color: 0xFF8C42,
      emissive: 0xFFD166,
      emissiveIntensity: 3
    });
    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.set(x, topY + candleH + 0.06, z);
    flame.scale.set(0.8, 1.3, 0.8);
    cake3D.cakeGroup.add(flame);

    // ✅ Анимация огонька
    animateSpawn(flame, {
      fromY: 1.2,
      duration: 0.5,
      delay: i * 0.06 + 0.25,
      fromScale: 0.1
    });

    // Пульсация огонька
    const baseY = flame.position.y;
    const baseScaleX = 0.8;
    const baseScaleY = 1.3;

    cake3D.animations.push({
      update() {
        if (!flame.parent) return false;
        const time = performance.now() / 1000;
        const pulse = 1 + Math.sin(time * 8 + i) * 0.12;
        flame.scale.set(baseScaleX * pulse, baseScaleY * pulse, 0.8 * pulse);
        return true;
      }
    });

    // Точечный свет
    const flameLight = new THREE.PointLight(0xFFD166, 0.4, 1.5);
    flameLight.position.set(x, topY + candleH + 0.06, z);
    cake3D.cakeGroup.add(flameLight);

    // Пульсация света
    cake3D.animations.push({
      update() {
        if (!flameLight.parent) return false;
        const time = performance.now() / 1000;
        flameLight.intensity = 0.4 + Math.sin(time * 5 + i) * 0.15;
        return true;
      }
    });
  }
}

function addBerries(cakeWidth, topY, scale = 1) {
  // Разные ягоды с разными цветами и размерами
  const berries = [
    { color: 0xC84A4A, size: 0.10, name: 'малина' },      // малина
    { color: 0x8B2020, size: 0.09, name: 'вишня' },        // вишня
    { color: 0x3B5A8C, size: 0.08, name: 'черника' },      // черника
    { color: 0xE8A87C, size: 0.11, name: 'абрикос' },      // абрикос
    { color: 0xC84A4A, size: 0.10, name: 'клубника' }      // клубника
  ];

  const berryCount = 10;
  const radius = cakeWidth * 0.6;

  for (let i = 0; i < berryCount; i++) {
    const angle = (i / berryCount) * Math.PI * 2 + Math.random() * 0.5;
    const r = radius * (0.6 + Math.random() * 0.4);
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;

    const berry = berries[i % berries.length];
    const berryGeo = new THREE.SphereGeometry(berry.size * scale, 16, 16);
    const berryMat = new THREE.MeshStandardMaterial({
      color: berry.color,
      roughness: 0.5,
      metalness: 0.1
    });
    const mesh = new THREE.Mesh(berryGeo, berryMat);

    // Клубнику чуть сплющить
    if (berry.name === 'клубника') {
      mesh.scale.set(1.2, 0.9, 1.2);
    }

    mesh.position.set(x, topY + berry.size * scale * 0.8, z);
    mesh.castShadow = true;
    cake3D.cakeGroup.add(mesh);

        // ✅ Анимация падения ягоды
    animateSpawn(mesh, {
      fromY: 2,
      duration: 0.5,
      delay: i * 0.05,
      fromScale: 0.1
    });

    // Листик сверху
    const leafGeo = new THREE.ConeGeometry(0.03 * scale, 0.05 * scale, 3);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x3B6B3B, roughness: 0.6 });
    const leaf = new THREE.Mesh(leafGeo, leafMat);
    leaf.position.set(x, topY + berry.size * scale * 1.4, z);
    leaf.rotation.x = Math.PI;
    cake3D.cakeGroup.add(leaf);
  }
}

function addGold(topY, cakeWidth = 1.8, scale = 1) {
  const goldGeo = new THREE.SphereGeometry(0.04 * scale, 12, 12);
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xE5C57A,
    roughness: 0.15,
    metalness: 0.95,
    emissive: 0xC9A961,
    emissiveIntensity: 0.2
  });

  const count = 25;
  const radius = cakeWidth * 0.9;

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * radius;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;

    const dot = new THREE.Mesh(goldGeo, goldMat);
    dot.position.set(x, topY + 0.03 * scale, z);
    cake3D.cakeGroup.add(dot);
        animateSpawn(dot, {
      fromY: 2,
      duration: 0.6,
      delay: i * 0.02,
      fromScale: 0.1
    });
  }
}

function addFigurines(cakeWidth, topY) {
  // Простая фигурка — конус + сфера (условная)
  const positions = [
    { x: -0.7, z: -0.7 },
    { x: 0.7, z: 0.7 }
  ];

  positions.forEach(pos => {
    const coneGeo = new THREE.ConeGeometry(0.15, 0.5, 8);
    const coneMat = new THREE.MeshStandardMaterial({ color: 0xE8A87C, roughness: 0.6 });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.set(pos.x, topY + 0.25, pos.z);
    cone.castShadow = true;
    cake3D.cakeGroup.add(cone);

    const sphereGeo = new THREE.SphereGeometry(0.09, 12, 12);
    const sphereMat = new THREE.MeshStandardMaterial({ color: 0xF5EDE4, roughness: 0.5 });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    sphere.position.set(pos.x, topY + 0.55, pos.z);
    cake3D.cakeGroup.add(sphere);
  });
}

// ============================================================
// Маршмэллоу
// ============================================================
function addMarshmallows(cakeWidth, topY, scale = 1) {
  const colors = [0xFFE4E9, 0xFFF5E0, 0xFFC4C4];  // розовый, кремовый, коралловый
  const count = 8;
  const radius = cakeWidth * 0.55;

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
    const r = radius * (0.6 + Math.random() * 0.4);
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;

    const color = colors[i % colors.length];
    const marshmallowSize = (0.1 + Math.random() * 0.03) * scale;

    const geo = new THREE.CylinderGeometry(marshmallowSize, marshmallowSize, marshmallowSize * 1.2, 16);
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.6,
      metalness: 0.05
    });
    const marshmallow = new THREE.Mesh(geo, mat);
    marshmallow.position.set(x, topY + marshmallowSize * 0.6, z);
    marshmallow.rotation.z = (Math.random() - 0.5) * 0.4;
    marshmallow.rotation.y = Math.random() * Math.PI;
    marshmallow.castShadow = true;
    cake3D.cakeGroup.add(marshmallow);

        animateSpawn(marshmallow, {
      fromY: 1.5,
      duration: 0.6,
      delay: i * 0.06,
      fromScale: 0.2
    });
  }
}

// ============================================================
// Шоколадные фигурки (плиточки)
// ============================================================
function addChocolateFigures(cakeWidth, topY, scale = 1) {
  // Плиточки шоколада разных размеров
  const chocolates = [
    { color: 0x3D2419, w: 0.25, h: 0.08, d: 0.15 },   // тёмный
    { color: 0x5C3A2A, w: 0.20, h: 0.10, d: 0.12 },   // молочный
    { color: 0x8B6F47, w: 0.28, h: 0.06, d: 0.14 },   // белый
    { color: 0x3D2419, w: 0.22, h: 0.09, d: 0.13 }
  ];

  // Позиции — по кругу
  const positions = [
    { x: -0.7, z: -0.4, rot: 0.3 },
    { x: 0.6, z: -0.6, rot: -0.2 },
    { x: 0.8, z: 0.4, rot: 0.4 },
    { x: -0.5, z: 0.7, rot: -0.3 },
    { x: 0, z: 0.8, rot: 0.1 }
  ];

  positions.forEach((pos, i) => {
    const choco = chocolates[i % chocolates.length];
    const geo = new THREE.BoxGeometry(
      choco.w * scale,
      choco.h * scale,
      choco.d * scale
    );
    const mat = new THREE.MeshStandardMaterial({
      color: choco.color,
      roughness: 0.25,
      metalness: 0.15
    });
    const box = new THREE.Mesh(geo, mat);
    box.position.set(
      pos.x * scale,
      topY + choco.h * scale / 2,
      pos.z * scale
    );
    box.rotation.y = pos.rot;
    box.rotation.z = (Math.random() - 0.5) * 0.15;
    box.castShadow = true;
    cake3D.cakeGroup.add(box);

        animateSpawn(box, {
      fromY: 1.5,
      duration: 0.6,
      delay: i * 0.08,
      fromScale: 0.3
    });
  });
}
// ============================================================
// Съедобные цветы
// ============================================================
function addEdibleFlowers(cakeWidth, topY, scale = 1) {
  const flowers = [
    { color: 0xFFB6A3, petals: 5, size: 1.0 },   // розовый
    { color: 0xE8A87C, petals: 6, size: 1.1 },   // персиковый
    { color: 0xF5C2C2, petals: 5, size: 0.9 },   // бледно-розовый
    { color: 0xFFDAB9, petals: 6, size: 1.0 }    // кремовый
  ];

  const positions = [
    { x: -0.8, z: -0.3 },
    { x: 0.7, z: -0.5 },
    { x: 0.4, z: 0.7 },
    { x: -0.5, z: 0.6 },
    { x: 0, z: -0.8 }
  ];

  positions.forEach((pos, idx) => {
    const flower = flowers[idx % flowers.length];
    const petalSize = 0.07 * scale * flower.size;

    // Лепестки
    for (let i = 0; i < flower.petals; i++) {
      const angle = (i / flower.petals) * Math.PI * 2;

      const petalGeo = new THREE.SphereGeometry(petalSize, 16, 16);
      const petalMat = new THREE.MeshStandardMaterial({
        color: flower.color,
        roughness: 0.45
      });
      const petal = new THREE.Mesh(petalGeo, petalMat);

      const dist = petalSize * 0.9;
      petal.position.set(
        pos.x * scale + Math.cos(angle) * dist,
        topY + petalSize * 0.7,
        pos.z * scale + Math.sin(angle) * dist
      );
      petal.scale.set(1.2, 0.5, 0.9);
      petal.castShadow = true;
      cake3D.cakeGroup.add(petal);

            animateSpawn(petal, {
        fromY: 1.5,
        duration: 0.5,
        delay: idx * 0.1 + i * 0.03,
        fromScale: 0.1
      });
    }

    // Центр цветка (золотой)
    const centerGeo = new THREE.SphereGeometry(petalSize * 0.6, 16, 16);
    const centerMat = new THREE.MeshStandardMaterial({
      color: 0xFFD166,
      emissive: 0xFFD166,
      emissiveIntensity: 0.5,
      roughness: 0.3,
      metalness: 0.4
    });
    const center = new THREE.Mesh(centerGeo, centerMat);
    center.position.set(pos.x * scale, topY + petalSize * 1.1, pos.z * scale);
    cake3D.cakeGroup.add(center);

        animateSpawn(center, {
      fromY: 1.5,
      duration: 0.5,
      delay: idx * 0.1 + 0.2,
      fromScale: 0.2
    });
  });
}

// ============================================================
// Орехи
// ============================================================
function addNuts(cakeWidth, topY, scale = 1) {
  const count = 14;
  const radius = cakeWidth * 0.6;

  const nutColors = [
    { color: 0xA67C4A, name: 'миндаль', size: 1.3, y: 0.8 },
    { color: 0x8B6F47, name: 'фундук', size: 1.0, y: 1.0 },
    { color: 0x5C3A2A, name: 'грецкий', size: 1.5, y: 0.7 }
  ];

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
    const r = radius * (0.5 + Math.random() * 0.5);
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;

    const nut = nutColors[i % nutColors.length];
    const nutSize = 0.05 * scale;

    const geo = new THREE.SphereGeometry(nutSize, 12, 12);
    const mat = new THREE.MeshStandardMaterial({
      color: nut.color,
      roughness: 0.85
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.scale.set(nut.size, nut.y, 1);
    mesh.rotation.y = Math.random() * Math.PI;
    mesh.position.set(x, topY + nutSize * 0.5, z);
    mesh.castShadow = true;
    cake3D.cakeGroup.add(mesh);

        animateSpawn(mesh, {
      fromY: 1.8,
      duration: 0.5,
      delay: i * 0.04,
      fromScale: 0.15
    });
  }
}

// ============================================================
// Форма «Сердце» — красивая, плоская, на тарелке
// ============================================================
function createHeartShape(radius, height) {
  const shape = new THREE.Shape();

  // Размеры сердца в локальных координатах
  const s = radius / 5;

  // Начинаем сверху в центре (впадина между половинками)
  shape.moveTo(0, 5 * s);

  // Левая половинка
  shape.bezierCurveTo(
    -3 * s, 7 * s,
    -5 * s, 5 * s,
    -5 * s, 2 * s
  );
  shape.bezierCurveTo(
    -5 * s, -1 * s,
    -3 * s, -4 * s,
    0, -6 * s
  );

  // Правая половинка
  shape.bezierCurveTo(
    3 * s, -4 * s,
    5 * s, -1 * s,
    5 * s, 2 * s
  );
  shape.bezierCurveTo(
    5 * s, 5 * s,
    3 * s, 7 * s,
    0, 5 * s
  );

  const extrudeSettings = {
    steps: 1,
    depth: height,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.05,
    bevelSegments: 4,
    curveSegments: 64
  };

  const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);

  // ✅ ПОВОРОТ: экструзия идёт по Z → встанет по Y
  geo.rotateX(Math.PI / 2);

  // ✅ ЦЕНТРИРОВАНИЕ только по X и Z
  geo.computeBoundingBox();
  const bb = geo.boundingBox;

  const centerX = (bb.min.x + bb.max.x) / 2;
  const centerZ = (bb.min.z + bb.max.z) / 2;

  geo.translate(-centerX, 0, -centerZ);

  // ✅ СТАВИМ на Y = 0 (дно на тарелке)
  geo.computeBoundingBox();
  const minY = geo.boundingBox.min.y;
  geo.translate(0, -minY, 0);

  geo.computeVertexNormals();
  return geo;
}

// ============================================================
// Форма «Цветок» — плоская ромашка на тарелке
// ============================================================
function createFlowerShape(radius, height) {
  const shape = new THREE.Shape();

  const petals = 8;         // 8 лепестков
  const points = 256;       // больше точек = плавнее

  // Рисуем контур
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * Math.PI * 2;

    // Формула лепестков: базовая окружность + синусоида
    const r = radius * (0.7 + 0.3 * Math.abs(Math.cos(petals * angle / 2)));

    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;

    if (i === 0) {
      shape.moveTo(x, y);
    } else {
      shape.lineTo(x, y);
    }
  }

  shape.closePath();

  const extrudeSettings = {
    steps: 1,
    depth: height,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.05,
    bevelSegments: 4,
    curveSegments: 64
  };

  const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);

  // ✅ ПОВОРОТ: экструзия идёт по Z → встанет по Y
  geo.rotateX(Math.PI / 2);

  // ✅ ЦЕНТРИРОВАНИЕ только по X и Z
  geo.computeBoundingBox();
  const bb = geo.boundingBox;

  const centerX = (bb.min.x + bb.max.x) / 2;
  const centerZ = (bb.min.z + bb.max.z) / 2;

  geo.translate(-centerX, 0, -centerZ);

  // ✅ Ставим на Y = 0
  geo.computeBoundingBox();
  const minY = geo.boundingBox.min.y;
  geo.translate(0, -minY, 0);

  geo.computeVertexNormals();
  return geo;
}

// ============================================================
// 9. Анимация вращения
// ============================================================
let autoRotate = true;

function startAnimation() {
  function animate() {
    cake3D.animationId = requestAnimationFrame(animate);

    const delta = cake3D.clock ? cake3D.clock.getDelta() : 0.016;

    // ✅ Обрабатываем активные анимации
    cake3D.animations = cake3D.animations.filter(anim => {
      const alive = anim.update(delta);
      return alive;
    });

    if (autoRotate && cake3D.cakeGroup) {
      cake3D.cakeGroup.rotation.y += 0.003;
    }

    cake3D.renderer.render(cake3D.scene, cake3D.camera);
  }
  animate();
}

// ============================================================
// 10. Управление мышью (вращение + зум)
// ============================================================
function enableOrbit(container) {
  let isDragging = false;
  let prevMouseX = 0;
  let prevMouseY = 0;
  let targetRotationY = 0;
  let targetRotationX = 0;

  const canvas = cake3D.renderer.domElement;

  canvas.style.cursor = 'grab';

  canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    autoRotate = false;
    prevMouseX = e.clientX;
    prevMouseY = e.clientY;
    canvas.style.cursor = 'grabbing';
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
    canvas.style.cursor = 'grab';
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging || !cake3D.cakeGroup) return;

    const deltaX = e.clientX - prevMouseX;
    const deltaY = e.clientY - prevMouseY;

    targetRotationY += deltaX * 0.01;
    targetRotationX += deltaY * 0.005;

    // Ограничиваем наклон
    targetRotationX = Math.max(-0.4, Math.min(0.4, targetRotationX));

    cake3D.cakeGroup.rotation.y = targetRotationY;
    cake3D.cakeGroup.rotation.x = targetRotationX;

    prevMouseX = e.clientX;
    prevMouseY = e.clientY;
  });

  // Зум колёсиком
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (!cake3D.camera) return;

    const zoomSpeed = 0.15;
    const direction = e.deltaY > 0 ? 1 : -1;

    cake3D.camera.position.z = Math.max(4, Math.min(10, cake3D.camera.position.z + direction * zoomSpeed));
    cake3D.camera.lookAt(0, 0.8, 0);
  }, { passive: false });

  // Touch — вращение
  let touchStartX = 0;
  let touchStartY = 0;

  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      autoRotate = false;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  }, { passive: true });

  canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 1 || !cake3D.cakeGroup) return;

    const deltaX = e.touches[0].clientX - touchStartX;
    const deltaY = e.touches[0].clientY - touchStartY;

    cake3D.cakeGroup.rotation.y += deltaX * 0.01;
    cake3D.cakeGroup.rotation.x = Math.max(-0.4, Math.min(0.4, cake3D.cakeGroup.rotation.x + deltaY * 0.005));

    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });
}

// ============================================================
// Плавное обновление с анимацией
// ============================================================
function update3DCake(params) {
  if (!cake3D.isReady) return;

  const shapeChanged = params.shape && params.shape !== cake3D.currentParams.shape;
  const fillingChanged = params.filling && params.filling !== cake3D.currentParams.filling;
  const weightChanged = params.weight && params.weight !== cake3D.currentParams.weight;
  const decorChanged = params.decor && JSON.stringify(params.decor) !== JSON.stringify(cake3D.currentParams.decor);

  Object.assign(cake3D.currentParams, params);

  // ✅ Плавный морфинг — сжимаем, меняем, разжимаем
  if (shapeChanged || weightChanged) {
    animateCakeMorph(() => {
      buildCake();
    }, shapeChanged ? 'shape' : 'weight');
  } else {
    // Начинка и декор — без морфинга, просто пересобираем
    if (fillingChanged) animateCakeChange('filling');
    if (decorChanged) animateCakeChange('decor');
    buildCake();
  }
}

// ============================================================
// Плавный морфинг: сжатие → замена → разжатие
// ============================================================
function animateCakeMorph(callback, type = 'shape') {
  if (!cake3D.cakeGroup) {
    callback();
    return;
  }

  playClickSound(type);

  const originalGroup = cake3D.cakeGroup;
  const startTime = performance.now();
  const totalDuration = 400;

  // ✅ Фаза 1 — уменьшение старого
  function shrinkPhase() {
    const elapsed = performance.now() - startTime;
    const t = Math.min(elapsed / (totalDuration / 2), 1);
    const eased = 1 - Math.pow(1 - t, 2);

    originalGroup.scale.setScalar(1 - eased * 0.9);
    originalGroup.rotation.y += 0.08;

    if (t < 1) {
      requestAnimationFrame(shrinkPhase);
    } else {
      // ✅ В середине — заменяем
      callback();

      // ✅ Фаза 2 — рост нового
      if (cake3D.cakeGroup) {
        cake3D.cakeGroup.scale.setScalar(0.1);

        const newGroup = cake3D.cakeGroup;
        const growStart = performance.now();

        function growPhase() {
          const e = performance.now() - growStart;
          const g = Math.min(e / (totalDuration / 2), 1);
          const easedG = 1 - Math.pow(1 - g, 3);

          // ✅ Пружинный эффект
          const overshoot = Math.sin(g * Math.PI) * 0.1;
          newGroup.scale.setScalar(0.1 + easedG * 0.9 + overshoot);

          if (g < 1) {
            requestAnimationFrame(growPhase);
          } else {
            newGroup.scale.setScalar(1);
          }
        }

        growPhase();
      }
    }
  }

  shrinkPhase();
}

// Анимация изменения
function animateCakeChange(type) {
  if (!cake3D.cakeGroup) return;

  // ✅ Звук
  playClickSound(type);

  // Flash + scale
  const originalScale = 1;
  const flashDuration = 400;
  const startTime = performance.now();

  // Свечение вокруг торта
  const glowColor = type === 'shape' ? 0xE8A87C :
                    type === 'filling' ? 0xC9A961 :
                    0x6BBF87;

  const flashLight = new THREE.PointLight(glowColor, 3, 10);
  flashLight.position.set(0, 2, 0);
  cake3D.scene.add(flashLight);

  function animate() {
    const elapsed = performance.now() - startTime;
    const progress = Math.min(elapsed / flashDuration, 1);

    // Затухание света
    flashLight.intensity = 3 * (1 - progress);

    // Лёгкое покачивание торта
    const wobble = Math.sin(progress * Math.PI * 3) * 0.05;
    if (cake3D.cakeGroup) {
      cake3D.cakeGroup.scale.setScalar(1 + wobble);
    }

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      // Возвращаем к норме
      if (cake3D.cakeGroup) {
        cake3D.cakeGroup.scale.setScalar(1);
      }
      cake3D.scene.remove(flashLight);
    }
  }

  animate();
}

// ============================================================
// Звук при взаимодействии (лёгкий «клик»)
// ============================================================
function playClickSound(type = 'default') {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();

    const frequencies = {
      default: 800,
      shape: 600,
      filling: 900,
      decor: 1200
    };

    const freq = frequencies[type] || frequencies.default;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = freq;

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch (err) {
    // Игнорируем ошибки звука
  }
}

// ============================================================
// ✅ Анимации появления декора
// ============================================================
function animateSpawn(object, options = {}) {
  const {
    fromY = 1.5,        // откуда падает (высота)
    duration = 0.6,     // длительность
    delay = 0,          // задержка
    fromScale = 0.3     // начальный размер
  } = options;

  const startY = object.position.y;
  const finalY = startY;
  const finalScale = object.scale.clone ? object.scale.clone() : new THREE.Vector3(1, 1, 1);

  // Ставим в стартовое положение
  object.position.y = startY + fromY;
  object.scale.set(
    finalScale.x * fromScale,
    finalScale.y * fromScale,
    finalScale.z * fromScale
  );

  // Немного прозрачности
  const materials = [];
  object.traverse(child => {
    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach(m => materials.push({ m, origOpacity: m.opacity ?? 1 }));
      } else {
        materials.push({ m: child.material, origOpacity: child.material.opacity ?? 1 });
        child.material.transparent = true;
        child.material.opacity = 0;
      }
    }
  });

  let elapsed = -delay;

  cake3D.animations.push({
    update(delta) {
      elapsed += delta;

      if (elapsed < 0) {
        // Ждём задержку
        return true;
      }

      const t = Math.min(elapsed / duration, 1);

      // Easing: easeOutBack (лёгкий отскок)
      const eased = 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);

      // Позиция
      object.position.y = finalY + fromY * (1 - eased);

      // Масштаб
      const scale = fromScale + (1 - fromScale) * eased;
      object.scale.set(
        finalScale.x * scale,
        finalScale.y * scale,
        finalScale.z * scale
      );

      // Прозрачность
      materials.forEach(({ m, origOpacity }) => {
        m.opacity = origOpacity * Math.min(t * 2, 1);
      });

      // Всё готово
      if (t >= 1) {
        object.position.y = finalY;
        object.scale.copy(finalScale);
        materials.forEach(({ m, origOpacity }) => {
          m.opacity = origOpacity;
          m.transparent = origOpacity < 1;
        });
        return false;
      }

      return true;
    }
  });

  return object;
}

// ============================================================
// 12. Экспорт
// ============================================================
window.Cake3D = {
  init: init3DCake,
  update: update3DCake,
  isReady: () => cake3D.isReady,
  stop: () => {
    if (cake3D.animationId) cancelAnimationFrame(cake3D.animationId);
    if (cake3D.renderer) {
      cake3D.renderer.dispose();
      cake3D.renderer = null;
    }
    cake3D.isReady = false;
  }
};