/* ===================================================================
   Esnad Group Holding — scroll-driven 3D flythrough backdrop.

   Renders a low-poly navy/gold skyline on a fixed full-viewport canvas
   behind the page. Scroll position (0..1 across the whole document)
   drives a camera flight along a spline through the scene; every
   content section sits on top as a translucent "frosted glass" panel
   so the 3D keeps showing through as you scroll.

   Fails soft: if WebGL/three.js aren't available, or anything below
   throws while building or running the scene, `html` gets a `no-webgl`
   class and CSS (see style.css) swaps every panel back to a fully
   opaque background — the page is complete either way.
   =================================================================== */
(() => {
  'use strict';

  function fallback() {
    document.documentElement.classList.add('no-webgl');
  }

  const canvas = document.getElementById('webgl-bg');
  const hasThree = typeof THREE !== 'undefined';

  function supportsWebGL() {
    try {
      const test = document.createElement('canvas');
      return !!(window.WebGLRenderingContext &&
        (test.getContext('webgl') || test.getContext('experimental-webgl')));
    } catch (e) {
      return false;
    }
  }

  if (!canvas || !hasThree || !supportsWebGL()) {
    fallback();
    return;
  }

  try {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isCoarse = window.matchMedia('(pointer: coarse)').matches;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isCoarse, powerPreference: 'high-performance' });

    const INK = 0x0a1622;
    renderer.setClearColor(INK, 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isCoarse ? 1.5 : 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(INK, 70, 340);

    const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 700);

    /* ---------- Lights ---------- */
    scene.add(new THREE.HemisphereLight(0x2c4a6e, 0x05090f, 1.0));
    const sun = new THREE.DirectionalLight(0xe8c07d, 1.15);
    sun.position.set(-60, 140, 60);
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0x3a5a82, 0.5);
    rim.position.set(90, 50, -60);
    scene.add(rim);

    /* ---------- Ground ---------- */
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1600, 1600),
      new THREE.MeshStandardMaterial({ color: 0x081320, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    /* ---------- Buildings ---------- */
    const buildingColors = [0x12233a, 0x1a3350, 0x0d1a28, 0x162a44];
    const buildingMats = buildingColors.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.88, metalness: 0.08 }));
    const buildings = [];
    const rand = (a, b) => a + Math.random() * (b - a);

    function addBuilding(x, z, w, d, h, matIndex) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), buildingMats[matIndex % buildingMats.length]);
      mesh.position.set(x, h / 2, z);
      scene.add(mesh);
      buildings.push({ x, z, w, d, h });
    }

    // Hero tower — the tall centerpiece the flight starts beneath.
    addBuilding(0, -20, 15, 15, 135, 0);

    // The rest of the skyline, thinning out toward the edges so the flight
    // corridor down the middle stays open.
    const BUILDING_COUNT = isCoarse ? 45 : 75;
    let mi = 1;
    for (let i = 0; i < BUILDING_COUNT; i++) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const x = side * rand(16, 130);
      const z = rand(-330, 50);
      const w = rand(10, 22);
      const d = rand(10, 22);
      const edgeFalloff = 1 - Math.min(0.6, Math.abs(x) / 180);
      const h = rand(18, 165) * edgeFalloff;
      addBuilding(x, z, w, d, h, mi++);
    }

    // Lit windows — one instanced mesh of small emissive planes scattered
    // across every building face, for the "city at dusk" glow.
    const WIN_MAX = isCoarse ? 700 : 1500;
    const winGeo = new THREE.PlaneGeometry(0.9, 1.3);
    const winMat = new THREE.MeshBasicMaterial({ color: 0xf4d896, transparent: true, opacity: 0.9 });
    const windows = new THREE.InstancedMesh(winGeo, winMat, WIN_MAX);
    const dummy = new THREE.Object3D();
    let wi = 0;
    buildingLoop:
    for (const b of buildings) {
      const cols = Math.max(2, Math.floor(b.w / 2.4));
      const rows = Math.max(3, Math.floor(b.h / 6.5));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (Math.random() > 0.42) continue;
          if (wi >= WIN_MAX) break buildingLoop;
          const faceOnZ = Math.random() < 0.5;
          const faceSign = Math.random() < 0.5 ? 1 : -1;
          let px, pz, ry;
          if (faceOnZ) {
            px = b.x + (c / (cols - 1 || 1) - 0.5) * (b.w - 1.4);
            pz = b.z + faceSign * (b.d / 2 + 0.05);
            ry = faceSign > 0 ? 0 : Math.PI;
          } else {
            pz = b.z + (c / (cols - 1 || 1) - 0.5) * (b.d - 1.4);
            px = b.x + faceSign * (b.w / 2 + 0.05);
            ry = faceSign > 0 ? Math.PI / 2 : -Math.PI / 2;
          }
          const py = 2 + r * 6.5 + rand(-0.8, 0.8);
          dummy.position.set(px, py, pz);
          dummy.rotation.set(0, ry, 0);
          dummy.updateMatrix();
          windows.setMatrixAt(wi++, dummy.matrix);
        }
      }
    }
    windows.count = wi;
    scene.add(windows);

    // A slow-spinning gold halo beside the hero tower — a small flourish.
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(10, 0.14, 8, 48),
      new THREE.MeshStandardMaterial({ color: 0xe8c07d, emissive: 0xe8c07d, emissiveIntensity: 0.65, roughness: 0.4 })
    );
    halo.position.set(14, 118, -20);
    halo.rotation.x = Math.PI / 2.5;
    scene.add(halo);

    /* ---------- Camera flight path ----------
       One waypoint per story beat: the four hero chapters get the most
       dramatic movement (that's where the canvas is fully uncovered),
       then the path keeps drifting gently behind the translucent content
       panels for About → Contact, ending on a calm wide shot. */
    const waypoints = [
      { p: [0, 9, 46], l: [0, 60, -20] },          // ch.1 — street level, looking up at the hero tower
      { p: [26, 42, -10], l: [-10, 75, -70] },     // ch.2 — rising between towers
      { p: [-30, 88, -95], l: [40, 55, -180] },    // ch.3 — wide orbit reveal of the skyline
      { p: [45, 68, -170], l: [-25, 45, -260] },   // ch.4 — push toward the project cluster
      { p: [-35, 82, -220], l: [20, 50, -300] },   // about
      { p: [15, 105, -280], l: [-15, 60, -340] },  // numbers / work
      { p: [-25, 95, -310], l: [25, 42, -350] },   // projects
      { p: [30, 120, -330], l: [0, 80, -360] },    // cta — elevated dusk vista
      { p: [0, 55, -300], l: [0, 38, -340] },      // contact / footer — calm resting shot
    ];
    const posCurve = new THREE.CatmullRomCurve3(waypoints.map((w) => new THREE.Vector3(...w.p)), false, 'catmullrom', 0.4);
    const lookCurve = new THREE.CatmullRomCurve3(waypoints.map((w) => new THREE.Vector3(...w.l)), false, 'catmullrom', 0.4);

    function scrollProgress() {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      return max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    }

    let targetT = scrollProgress();
    let currentT = targetT;
    window.addEventListener('scroll', () => { targetT = scrollProgress(); }, { passive: true });

    function resize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener('resize', resize);

    let tabHidden = false;
    document.addEventListener('visibilitychange', () => { tabHidden = document.hidden; });

    const clock = new THREE.Clock();
    let stopped = false;

    function animate() {
      if (stopped) return;
      requestAnimationFrame(animate);
      if (tabHidden) return;

      try {
        const dt = clock.getDelta();

        // Ease toward the scroll target for a smooth, weighted glide
        // rather than snapping straight to the scrollbar position.
        currentT += (targetT - currentT) * (reduceMotion ? 1 : 0.07);

        const t = Math.min(0.999, Math.max(0, currentT));
        camera.position.copy(posCurve.getPointAt(t));
        camera.lookAt(lookCurve.getPointAt(t));

        if (!reduceMotion) {
          halo.rotation.z += dt * 0.15;
        }

        renderer.render(scene, camera);
      } catch (e) {
        // Something went wrong mid-flight (e.g. a lost WebGL context) —
        // stop trying to render and drop back to the flat, opaque theme
        // rather than leaving a frozen or corrupted frame on screen.
        stopped = true;
        fallback();
      }
    }
    animate();

    // Recompute the scrollable height reference once everything (fonts,
    // images) has settled, since layout shifts during load can otherwise
    // leave the flight slightly out of sync with the scrollbar.
    window.addEventListener('load', () => { targetT = scrollProgress(); });
  } catch (e) {
    fallback();
  }
})();
