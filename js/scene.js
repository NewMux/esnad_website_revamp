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

    // Twin "sail" towers — modeled at the real Bahrain World Trade
    // Center's proportions (50 floors / 240m tall, 29m turbines spanning
    // the gap between them), standing where the single generic hero
    // tower used to be, so the skyline the flight opens on reads as
    // Manama rather than a generic anywhere-city.
    const METERS_TO_UNITS = 135 / 240; // scene scale, pinned to the tower height below
    const SAIL_HEIGHT = 240 * METERS_TO_UNITS; // 240m real height -> 135 scene units
    const SAIL_RADIUS = 15 * METERS_TO_UNITS; // ~15m base half-width
    const SAIL_FLATTEN = 0.42; // squashes the lathe's circular cross-section into an ellipse
    const TURBINE_RADIUS = (29 * METERS_TO_UNITS) / 2; // real 29m-diameter turbines
    const SAIL_GAP = TURBINE_RADIUS * 2 + SAIL_RADIUS * 1.6 + 4; // enough clearance for the turbines to spin between the towers
    const towerLightMat = new THREE.MeshBasicMaterial({ color: 0xf4d896, transparent: true, opacity: 0.9 });

    // A real photo of the towers (Wikimedia Commons, CC-BY-SA 4.0, B.alotaby)
    // mapped onto the geometry below, planar-projected front-on rather than
    // wrapped circumferentially, so it reads as one coherent facade instead
    // of a banded collage. Fails soft: if the image can't load, the mesh
    // just falls back to sailMat's flat color.
    const sailTexture = new THREE.TextureLoader().load('img/bwtc-facade.jpg');
    sailTexture.wrapS = THREE.ClampToEdgeWrapping;
    sailTexture.wrapT = THREE.ClampToEdgeWrapping;
    const sailMat = new THREE.MeshStandardMaterial({ map: sailTexture, color: 0x9fb2c9, roughness: 0.7, metalness: 0.05 });

    // The real tower's silhouette: a broad sail-shaped base that bulges
    // gently through the lower third, then tapers in a long continuous
    // curve to a slender point at the roofline — built as a lathed
    // profile (revolved around Y) rather than a simple tapered box.
    const SAIL_PROFILE = [
      [0.50, 0.000], [0.97, 0.035], [1.00, 0.130], [0.96, 0.320],
      [0.84, 0.520], [0.66, 0.700], [0.42, 0.860], [0.20, 0.955],
      [0.05, 0.995], [0.00, 1.000],
    ];

    function addSailTower(x, z, lean) {
      const points = SAIL_PROFILE.map(([r, f]) => new THREE.Vector2(r * SAIL_RADIUS, f * SAIL_HEIGHT));
      const geo = new THREE.LatheGeometry(points, 10);
      geo.scale(1, 1, SAIL_FLATTEN); // flatten the lathe into the elliptical "sail" cross-section

      // Re-map UVs to a simple front-on planar projection (u from local x,
      // v from height) instead of the lathe's default circumferential wrap,
      // so the photo lands as one recognizable image across the sail.
      const posAttr = geo.attributes.position;
      const uvAttr = geo.attributes.uv;
      for (let i = 0; i < posAttr.count; i++) {
        const px = posAttr.getX(i);
        const py = posAttr.getY(i);
        uvAttr.setXY(i, (px + SAIL_RADIUS) / (2 * SAIL_RADIUS), py / SAIL_HEIGHT);
      }
      uvAttr.needsUpdate = true;

      const mesh = new THREE.Mesh(geo, sailMat);
      mesh.position.set(x, 0, z);
      mesh.rotation.y = Math.PI / 8; // angle the flattened face toward the flight path
      mesh.rotation.z = lean; // slight lean toward its twin, sail-style
      scene.add(mesh);

      // A scatter of small lit accents up the curtain wall.
      for (let i = 0; i < 22; i++) {
        const angle = rand(0, Math.PI * 2);
        const f = rand(0.1, 0.92);
        const r = SAIL_RADIUS * (1 - Math.abs(f - 0.35)) * 0.65; // rough taper-aware radius
        const light = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.4, 0.5), towerLightMat);
        light.position.set(
          x + Math.cos(angle) * r,
          f * SAIL_HEIGHT,
          z + Math.sin(angle) * r * SAIL_FLATTEN
        );
        scene.add(light);
      }
      return mesh;
    }

    addSailTower(-SAIL_GAP / 2, -20, 0.05);
    addSailTower(SAIL_GAP / 2, -20, -0.05);

    // Three turbine sky-bridges spanning the gap between the sails —
    // the signature Bahrain WTC detail — each carrying a slow-spinning,
    // real-diameter (29m) wind turbine.
    const turbines = [];
    [0.42, 0.62, 0.82].forEach((frac) => {
      const y = SAIL_HEIGHT * frac;

      const bridge = new THREE.Mesh(new THREE.BoxGeometry(SAIL_GAP + 6, 2, 4), buildingMats[1]);
      bridge.position.set(0, y, -20);
      scene.add(bridge);

      const hubRadius = TURBINE_RADIUS * 0.12;
      const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(hubRadius, hubRadius, hubRadius * 2, 8),
        new THREE.MeshStandardMaterial({ color: 0xe8c07d, emissive: 0xe8c07d, emissiveIntensity: 0.4, roughness: 0.5 })
      );
      hub.rotation.x = Math.PI / 2;
      hub.position.set(0, y + hubRadius * 3.5, -20);
      scene.add(hub);

      const blades = new THREE.Group();
      for (let b = 0; b < 3; b++) {
        const spoke = new THREE.Group();
        spoke.rotation.z = (b / 3) * Math.PI * 2;
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.45, TURBINE_RADIUS, 0.9), buildingMats[3]);
        blade.position.y = TURBINE_RADIUS / 2; // push the blade out from the hub center
        spoke.add(blade);
        blades.add(spoke);
      }
      blades.position.copy(hub.position);
      scene.add(blades);
      turbines.push(blades);
    });

    // The rest of the skyline, thinning out toward the edges so the flight
    // corridor down the middle stays open — widened to clear the
    // real-proportioned sail towers' now-larger footprint and turbine span.
    const BUILDING_COUNT = isCoarse ? 45 : 75;
    const SKYLINE_MIN_X = SAIL_GAP / 2 + SAIL_RADIUS + 6;
    let mi = 1;
    for (let i = 0; i < BUILDING_COUNT; i++) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const x = side * rand(SKYLINE_MIN_X, 130);
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

    /* ---------- Camera flight path ----------
       One waypoint per story beat: the four hero chapters get the most
       dramatic movement (that's where the canvas is fully uncovered),
       then the path keeps drifting gently behind the translucent content
       panels for About → Contact, ending on a calm wide shot. */
    const waypoints = [
      { p: [0, 9, 46], l: [0, 60, -20] }, // ch.1 — street level, looking up at the twin sail towers
      { p: [26, 42, -10], l: [-10, 75, -70] }, // ch.2 — rising between towers
      { p: [-30, 88, -95], l: [40, 55, -180] }, // ch.3 — wide orbit reveal of the skyline
      { p: [45, 68, -170], l: [-25, 45, -260] }, // ch.4 — push toward the project cluster
      { p: [-35, 82, -220], l: [20, 50, -300] }, // about
      { p: [15, 105, -280], l: [-15, 60, -340] }, // numbers / work
      { p: [-25, 95, -310], l: [25, 42, -350] }, // projects
      { p: [30, 120, -330], l: [0, 80, -360] }, // cta — elevated dusk vista
      { p: [0, 55, -300], l: [0, 38, -340] }, // contact / footer — calm resting shot
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
          for (const turbine of turbines) turbine.rotation.z += dt * 1.8;
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
