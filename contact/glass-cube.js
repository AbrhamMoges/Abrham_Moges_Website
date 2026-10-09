// Single consolidated WebGL renderer for all 5 glass cubes.
// Previously each cube ran its own WebGLRenderer + PMREM + transmission pass.
// Now one renderer, one scene, one env bake, one transmission pass per frame.
// With the cost paid only once we can afford antialias + pixelRatio=2 again.
(function () {
  var stage = document.getElementById("glass-stage");
  if (!stage || typeof THREE === "undefined") return;

  var reduced =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var renderer = new THREE.WebGLRenderer({
    canvas: stage,
    alpha: true,
    antialias: true,
    powerPreference: "high-performance"
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.6;
  renderer.physicallyCorrectLights = true;

  var scene = new THREE.Scene();
  // Camera far back + narrow FOV so cubes positioned away from center
  // don't skew visibly — stays close to the original per-cube look.
  var FOV = 22;
  var CAMERA_Z = 60;
  var camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 500);
  camera.position.z = CAMERA_Z;

  // Bake env map once
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
  var pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(envScene).texture;
  pmrem.dispose();

  // Shared lights
  var pt1 = new THREE.PointLight(0xffffff, 2.5, 40);
  pt1.position.set(6, 8, 10);
  scene.add(pt1);
  var pt2 = new THREE.PointLight(0xffffff, 2.0, 40);
  pt2.position.set(-8, -4, 6);
  scene.add(pt2);
  scene.add(new THREE.AmbientLight(0xffffff, 1.0));

  // Shared material + geometry
  var geom = new THREE.BoxGeometry(1, 1, 1);
  var mat = new THREE.MeshPhysicalMaterial({
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

  // Original cube filled ~23.55% of its 28vmin canvas (0.48 world / 2.038 world
  // at fov 40, camera z 2.8). Keep the same visual size here.
  var CUBE_FILL_RATIO = 0.2355;

  var slots = [
    { id: "glcanvas", rotX: 0.0015, rotY: 0.0025 },
    { id: "glcanvas2", rotX: -0.002, rotY: -0.0018 },
    { id: "glcanvas3", rotX: 0.0017, rotY: 0.0022 },
    { id: "glcanvas4", rotX: -0.0019, rotY: -0.0021 },
    { id: "glcanvas5", rotX: 0.0016, rotY: 0.002 }
  ]
    .map(function (cfg) {
      var ph = document.getElementById(cfg.id);
      if (!ph) return null;
      var mesh = new THREE.Mesh(geom, mat);
      mesh.scale.setScalar(0);
      scene.add(mesh);
      return {
        placeholder: ph,
        mesh: mesh,
        rotX: cfg.rotX,
        rotY: cfg.rotY,
        targetScale: 0
      };
    })
    .filter(Boolean);

  function layout() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    var vFov = (FOV * Math.PI) / 180;
    var worldH = 2 * Math.tan(vFov / 2) * CAMERA_Z;
    var pxToWorld = worldH / h;

    slots.forEach(function (s) {
      var r = s.placeholder.getBoundingClientRect();
      var cx = r.left + r.width / 2;
      var cy = r.top + r.height / 2;
      s.mesh.position.x = (cx - w / 2) * pxToWorld;
      s.mesh.position.y = -(cy - h / 2) * pxToWorld;
      s.targetScale = r.width * pxToWorld * CUBE_FILL_RATIO;
    });
  }
  window.addEventListener("resize", layout, { passive: true });
  // Defer first layout so CSS has applied
  requestAnimationFrame(layout);

  var visible = true;
  document.addEventListener("visibilitychange", function () {
    visible = !document.hidden;
  });

  var startTime = performance.now();
  var rafId = 0;
  function animate() {
    rafId = requestAnimationFrame(animate);
    if (!visible) return;
    var elapsed = (performance.now() - startTime) / 1200;
    var k =
      elapsed < 1 ? 1 - Math.pow(1 - Math.min(elapsed, 1), 3) : 1;
    slots.forEach(function (s) {
      if (!s.targetScale) return;
      s.mesh.scale.setScalar(s.targetScale * k);
      if (!reduced) {
        s.mesh.rotation.x += s.rotX;
        s.mesh.rotation.y += s.rotY;
      }
    });
    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener("pagehide", function () {
    try {
      cancelAnimationFrame(rafId);
      renderer.dispose();
      geom.dispose();
      mat.dispose();
    } catch (e) {}
  });
})();
