(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Preloader ----------
     Hidden shortly after this script runs (DOM is already parsed at this
     point, since the tag sits at the end of body) rather than on
     window.load — load only fires once every image on the page has
     finished loading or failed, which can hang the whole page behind the
     preloader for a long time on a slow connection or a single dead image. */
  const preloader = document.getElementById('preloader');
  setTimeout(() => preloader && preloader.classList.add('is-done'), 500);

  /* ---------- Footer year ---------- */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Generate window grids on SVG buildings ---------- */
  function addWindows(groupEl, rects, opts = {}) {
    if (!groupEl) return;
    const { cols = 4, rows = 8, pad = 8, litChance = 0.55 } = opts;
    const frag = document.createDocumentFragment();
    rects.forEach(({ x, y, w, h }) => {
      const cw = (w - pad * 2) / cols;
      const ch = (h - pad * 2) / rows;
      const size = Math.min(cw, ch) * 0.5;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (Math.random() > litChance) continue;
          const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          rect.setAttribute('x', x + pad + c * cw + (cw - size) / 2);
          rect.setAttribute('y', y + pad + r * ch + (ch - size) / 2);
          rect.setAttribute('width', size);
          rect.setAttribute('height', size);
          frag.appendChild(rect);
        }
      }
    });
    groupEl.appendChild(frag);
  }

  addWindows(document.querySelector('.mid-windows'), [
    { x: 40, y: 260, w: 140, h: 340 },
    { x: 220, y: 180, w: 90, h: 420 },
    { x: 350, y: 320, w: 180, h: 280 },
    { x: 580, y: 140, w: 110, h: 460 },
    { x: 740, y: 240, w: 160, h: 360 },
    { x: 950, y: 200, w: 100, h: 400 },
    { x: 1090, y: 300, w: 200, h: 300 },
    { x: 1330, y: 170, w: 120, h: 430 },
    { x: 1490, y: 260, w: 150, h: 340 },
  ], { cols: 5, rows: 10, litChance: 0.45 });

  addWindows(document.querySelector('.tower-windows'), [
    { x: 200, y: 380, w: 90, h: 520 },
    { x: 470, y: 440, w: 110, h: 460 },
  ], { cols: 4, rows: 12, litChance: 0.6 });

  addWindows(document.querySelector('.about-windows'), [
    { x: 40, y: 120, w: 80, h: 360 },
    { x: 140, y: 60, w: 100, h: 420 },
    { x: 260, y: 180, w: 90, h: 300 },
  ], { cols: 3, rows: 9, litChance: 0.5 });

  /* ---------- Header scroll state ---------- */
  const header = document.getElementById('siteHeader');
  const onHeaderScroll = () => {
    if (!header) return;
    header.classList.toggle('is-scrolled', window.scrollY > 40);
  };
  document.addEventListener('scroll', onHeaderScroll, { passive: true });
  onHeaderScroll();

  /* ---------- Mobile nav ---------- */
  const menuToggle = document.getElementById('menuToggle');
  const mobileNav = document.getElementById('mobileNav');
  if (menuToggle && mobileNav) {
    const closeMenu = () => {
      menuToggle.setAttribute('aria-expanded', 'false');
      mobileNav.classList.remove('is-open');
      mobileNav.setAttribute('aria-hidden', 'true');
    };
    menuToggle.addEventListener('click', () => {
      const open = menuToggle.getAttribute('aria-expanded') === 'true';
      menuToggle.setAttribute('aria-expanded', String(!open));
      mobileNav.classList.toggle('is-open', !open);
      mobileNav.setAttribute('aria-hidden', String(open));
    });
    mobileNav.querySelectorAll('a').forEach((a) => a.addEventListener('click', closeMenu));
  }

  /* ---------- Custom cursor (desktop / fine pointer only) ---------- */
  const cursor = document.getElementById('cursor');
  if (cursor && window.matchMedia('(pointer: fine)').matches) {
    cursor.classList.add('is-active');
    let cx = 0, cy = 0, tx = 0, ty = 0;
    window.addEventListener('mousemove', (e) => { tx = e.clientX; ty = e.clientY; });
    (function raf() {
      cx += (tx - cx) * 0.2;
      cy += (ty - cy) * 0.2;
      cursor.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
      requestAnimationFrame(raf);
    })();
    document.querySelectorAll('a, button, .project-card').forEach((el) => {
      el.addEventListener('mouseenter', () => cursor.classList.add('is-hover'));
      el.addEventListener('mouseleave', () => cursor.classList.remove('is-hover'));
    });
  }

  /* ---------- Hero: true 3D parallax (perspective depth + scroll + tilt) ---------- */
  const heroScene = document.getElementById('heroScene');
  const heroStage = document.getElementById('heroStage');
  if (heroScene && !reduceMotion) {
    const layers = Array.from(heroScene.querySelectorAll('[data-speed]'));
    let ticking = false;

    // Scroll drives each depth plane's own translateY, on top of its
    // static translateZ/scale (set in CSS on the .depth wrapper) — nearer
    // planes (small |speed|... larger speed) sweep further per pixel scrolled.
    const applyScroll = () => {
      const scrollY = window.scrollY;
      layers.forEach((layer) => {
        const speed = parseFloat(layer.dataset.speed) || 0;
        layer.style.transform = `translateY(${scrollY * speed}px)`;
      });
      ticking = false;
    };
    const requestScroll = () => {
      if (!ticking && window.scrollY < window.innerHeight * 1.2) {
        ticking = true;
        requestAnimationFrame(applyScroll);
      }
    };
    window.addEventListener('scroll', requestScroll, { passive: true });
    window.addEventListener('resize', requestScroll);
    applyScroll();

    // Mouse-driven 3D tilt of the whole stage — because each plane sits at
    // a different translateZ, rotating the shared parent makes near and far
    // buildings swing past each other exactly like looking into a real
    // diorama, instead of a flat image sliding around.
    if (heroStage && window.matchMedia('(pointer: fine)').matches) {
      let targetX = 0, targetY = 0, curX = 0, curY = 0;
      heroScene.addEventListener('mousemove', (e) => {
        const rect = heroScene.getBoundingClientRect();
        const mx = (e.clientX - rect.left) / rect.width - 0.5;
        const my = (e.clientY - rect.top) / rect.height - 0.5;
        targetY = mx * 9;
        targetX = -my * 6;
      });
      heroScene.addEventListener('mouseleave', () => { targetX = 0; targetY = 0; });
      (function tiltLoop() {
        curX += (targetX - curX) * 0.06;
        curY += (targetY - curY) * 0.06;
        heroStage.style.transform = `rotateX(${curX.toFixed(3)}deg) rotateY(${curY.toFixed(3)}deg)`;
        requestAnimationFrame(tiltLoop);
      })();
    }
  }

  /* ---------- 3D tilt-on-hover cards ----------
     The tilt transform is applied to an inner wrapper, never to the card
     element that owns the mousemove/mouseleave listeners — transforming
     the hit-tested element itself shifts its own hit-box under the cursor
     (translateY + rotation nudge it out from under a pointer near an edge)
     and causes hover to flicker on and off mid-gesture. */
  if (!reduceMotion && window.matchMedia('(pointer: fine)').matches) {
    document.querySelectorAll('.project-card, .sector-card').forEach((card) => {
      const inner = document.createElement('div');
      inner.className = 'tilt-inner';
      while (card.firstChild) inner.appendChild(card.firstChild);
      card.appendChild(inner);

      const glare = document.createElement('span');
      glare.className = 'tilt-glare';
      inner.appendChild(glare);

      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width;
        const py = (e.clientY - rect.top) / rect.height;
        const rx = (0.5 - py) * 10;
        const ry = (px - 0.5) * 10;
        inner.style.transform = `perspective(700px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateY(-4px)`;
        glare.style.setProperty('--mx', `${px * 100}%`);
        glare.style.setProperty('--my', `${py * 100}%`);
      });
      card.addEventListener('mouseleave', () => { inner.style.transform = ''; });
    });
  }

  /* ---------- Scroll-reveal ---------- */
  const revealEls = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('in-view'));
  }

  /* ---------- Animated counters ---------- */
  const counters = document.querySelectorAll('.stat__num');
  if (counters.length) {
    const animateCount = (el) => {
      const target = parseInt(el.dataset.count, 10) || 0;
      const duration = 1400;
      const start = performance.now();
      const step = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(eased * target);
        if (progress < 1) requestAnimationFrame(step);
      };
      if (reduceMotion) { el.textContent = target; return; }
      requestAnimationFrame(step);
    };
    if ('IntersectionObserver' in window) {
      const io2 = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCount(entry.target);
            io2.unobserve(entry.target);
          }
        });
      }, { threshold: 0.5 });
      counters.forEach((el) => io2.observe(el));
    } else {
      counters.forEach(animateCount);
    }
  }

  /* ---------- Project filters ---------- */
  const filterBtns = document.querySelectorAll('.filter-btn');
  const projectCards = document.querySelectorAll('#projectGrid .project-card');
  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterBtns.forEach((b) => { b.classList.remove('is-active'); b.setAttribute('aria-selected', 'false'); });
      btn.classList.add('is-active');
      btn.setAttribute('aria-selected', 'true');
      const filter = btn.dataset.filter;
      projectCards.forEach((card) => {
        const match = filter === 'all' || card.dataset.country === filter;
        card.classList.toggle('is-hidden', !match);
      });
    });
  });

  /* ---------- Contact form (static — no backend wired up) ---------- */
  const form = document.getElementById('contactForm');
  const formNote = document.getElementById('formNote');
  if (form && formNote) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      formNote.textContent = 'Thanks — this form is not yet connected to an inbox. Please email info@esnadmanagement.com directly for now.';
    });
  }
})();
