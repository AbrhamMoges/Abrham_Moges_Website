// Shared heavy resources — one PMREM bake / material / geometry for all cubes.
var _sharedEnvScene = null;
var _sharedGeometry = null;
var _sharedMaterial = null;
var _sharedEnvTexture = null;
var _reduced =
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function _buildEnvScene() {
  if (_sharedEnvScene) return _sharedEnvScene;
  var envScene = new THREE.Scene();
  envScene.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(50, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.BackSide })
    )
  );
  [
    { c: 0xffffff, p: [0, 15, 0], r: 5 },
    { c: 0xffffff, p: [-15, 0, 5], r: 6 },
    { c: 0xffffff, p: [15, 0, -5], r: 5 },
    { c: 0xffffff, p: [0, -12, 8], r: 4 },
    { c: 0xaaaaaa, p: [8, 8, -10], r: 3 }
  ].forEach(function (s) {
    var m = new THREE.Mesh(
      new THREE.SphereGeometry(s.r, 12, 12),
      new THREE.MeshBasicMaterial({ color: s.c })
    );
    m.position.set(s.p[0], s.p[1], s.p[2]);
    envScene.add(m);
  });
  _sharedEnvScene = envScene;
  return envScene;
}

function _getSharedGeometry(boxSize) {
  if (!_sharedGeometry) {
    _sharedGeometry = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
  }
  return _sharedGeometry;
}

function _getSharedMaterial() {
  if (!_sharedMaterial) {
    _sharedMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.03,
      metalness: 0,
      transmission: 0.92,
      opacity: 1.0,
      transparent: true,
      ior: 1.8,
      thickness: 2.5,
      envMapIntensity: 3.0,
      side: THREE.DoubleSide
    });
  }
  return _sharedMaterial;
}

function makeGlassCube(canvasId, boxSize, rotX, rotY) {
  var canvas = document.getElementById(canvasId);
  if (!canvas) return;

  // antialias off + pixelRatio clamped to 1: these are small decorative cubes;
  // MSAA on 5 separate contexts was the single biggest fragment-shader cost.
  var renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    alpha: true,
    antialias: false,
    powerPreference: "low-power"
  });
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x000000, 0);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.6;
  renderer.physicallyCorrectLights = true;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
  camera.position.z = 2.8;

  // Bake the PMREM env map once across all cubes. The texture is tied to the
  // renderer that baked it, but Three uploads it lazily per renderer so sharing
  // the result is fine — we just avoid repeating 5× the expensive bake.
  if (!_sharedEnvTexture) {
    var pmrem = new THREE.PMREMGenerator(renderer);
    _sharedEnvTexture = pmrem.fromScene(_buildEnvScene()).texture;
    pmrem.dispose();
  }
  scene.environment = _sharedEnvTexture;

  var pt1 = new THREE.PointLight(0xffffff, 2.5, 20);
  pt1.position.set(3, 4, 5);
  scene.add(pt1);

  var pt2 = new THREE.PointLight(0xffffff, 2.0, 20);
  pt2.position.set(-4, -2, 3);
  scene.add(pt2);

  scene.add(new THREE.AmbientLight(0xffffff, 1.0));

  var cube = new THREE.Mesh(_getSharedGeometry(boxSize), _getSharedMaterial());
  scene.add(cube);
  cube.scale.setScalar(0);
  var startTime = performance.now();

  function resize() {
    var w = canvas.offsetWidth || canvas.clientWidth || 300;
    var h = canvas.offsetHeight || canvas.clientHeight || 300;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  var resizeHandler = function () {
    resize();
  };
  window.addEventListener("resize", resizeHandler, { passive: true });
  requestAnimationFrame(resize);

  // Pause the render loop when the canvas is off-screen or the tab is hidden.
  var visible = true;
  if (typeof IntersectionObserver === "function") {
    var io = new IntersectionObserver(
      function (entries) {
        visible = entries[0].isIntersecting;
      },
      { rootMargin: "100px" }
    );
    io.observe(canvas);
  }

  var rafId = 0;
  function animate() {
    rafId = requestAnimationFrame(animate);
    if (!visible || document.hidden) return;
    var elapsed = (performance.now() - startTime) / 1200;
    if (elapsed < 1) {
      cube.scale.setScalar(1 - Math.pow(1 - Math.min(elapsed, 1), 3));
    } else if (cube.scale.x < 1) {
      cube.scale.setScalar(1);
    }
    if (!_reduced) {
      cube.rotation.x += rotX;
      cube.rotation.y += rotY;
    }
    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener("pagehide", function () {
    try {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resizeHandler);
      renderer.dispose();
    } catch (e) {}
  });
}

// Stagger construction so 5 WebGL contexts don't initialize on the same frame.
(function initCubes() {
  var configs = [
    ["glcanvas", 0.48, 0.0015, 0.0025],
    ["glcanvas2", 0.48, -0.002, -0.0018],
    ["glcanvas3", 0.48, 0.0017, 0.0022],
    ["glcanvas4", 0.48, -0.0019, -0.0021],
    ["glcanvas5", 0.48, 0.0016, 0.002]
  ];
  var i = 0;
  function next() {
    if (i >= configs.length) return;
    var cfg = configs[i++];
    makeGlassCube(cfg[0], cfg[1], cfg[2], cfg[3]);
    // ~60ms gap gives each context a frame to initialize before the next.
    setTimeout(next, 60);
  }
  next();
})();
