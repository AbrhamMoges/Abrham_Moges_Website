function makeGlassCube(canvasId, boxSize, rotX, rotY) {
  var canvas = document.getElementById(canvasId);
  if (!canvas) return;

  var reduced = typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.6;
  renderer.physicallyCorrectLights = true;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
  camera.position.z = 2.8;

  var pmrem = new THREE.PMREMGenerator(renderer);
  var envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(
    new THREE.SphereGeometry(50, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.BackSide })
  ));
  [
    { c: 0xffffff, p: [0,   15,  0],  r: 5 },
    { c: 0xffffff, p: [-15,  0,  5],  r: 6 },
    { c: 0xffffff, p: [15,   0, -5],  r: 5 },
    { c: 0xffffff, p: [0,  -12,  8],  r: 4 },
    { c: 0xaaaaaa, p: [8,    8, -10], r: 3 }
  ].forEach(function (s) {
    var m = new THREE.Mesh(new THREE.SphereGeometry(s.r, 12, 12),
      new THREE.MeshBasicMaterial({ color: s.c }));
    m.position.set(s.p[0], s.p[1], s.p[2]);
    envScene.add(m);
  });
  scene.environment = pmrem.fromScene(envScene).texture;
  pmrem.dispose();

  var pt1 = new THREE.PointLight(0xffffff, 2.5, 20);
  pt1.position.set(3, 4, 5);
  scene.add(pt1);

  var pt2 = new THREE.PointLight(0xffffff, 2.0, 20);
  pt2.position.set(-4, -2, 3);
  scene.add(pt2);

  scene.add(new THREE.AmbientLight(0xffffff, 1.0));

  var mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.03, metalness: 0,
    transmission: 0.92, opacity: 1.0, transparent: true,
    ior: 1.8, thickness: 2.5, envMapIntensity: 3.0, side: THREE.DoubleSide
  });

  var cube = new THREE.Mesh(new THREE.BoxGeometry(boxSize, boxSize, boxSize), mat);
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
  window.addEventListener("resize", resize);
  // Defer first resize so CSS layout has applied
  requestAnimationFrame(resize);

  (function animate() {
    requestAnimationFrame(animate);
    var elapsed = (performance.now() - startTime) / 1200;
    if (elapsed < 1) {
      cube.scale.setScalar(1 - Math.pow(1 - Math.min(elapsed, 1), 3));
    } else if (cube.scale.x < 1) {
      cube.scale.setScalar(1);
    }
    if (!reduced) {
      cube.rotation.x += rotX;
      cube.rotation.y += rotY;
    }
    renderer.render(scene, camera);
  })();
}

makeGlassCube("glcanvas",  0.48,  0.0015,  0.0025);
makeGlassCube("glcanvas2", 0.48, -0.002,  -0.0018);
makeGlassCube("glcanvas3", 0.48,  0.0017,  0.0022);
makeGlassCube("glcanvas4", 0.48, -0.0019, -0.0021);
makeGlassCube("glcanvas5", 0.48,  0.0016,  0.002);
