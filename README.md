# Esnad Group Holding — Website

Static site (no build step) for Esnad Group Holding. The whole page scrolls
through a fixed, full-screen 3D flythrough of a low-poly skyline (built with
three.js): a scroll-driven camera glides through the scene while the real
content sections sit on top as translucent "frosted glass" panels, so the 3D
keeps showing through as you scroll.

## Structure

- `index.html` — all page content and sections
- `css/style.css` — styles, theme tokens, responsive layout, frosted-panel backgrounds
- `js/scene.js` — the three.js scene: skyline geometry, lighting, and the
  scroll-to-camera-position flight path
- `js/main.js` — everything else: preloader, scroll-reveal, mobile nav,
  work/project filters, counters, contact form, cursor and card tilt effects

## How the 3D backdrop works

`#webgl-bg` is a `position: fixed` canvas painted behind everything else
(see the z-index notes in `style.css`). `js/scene.js` builds a scene of
procedurally-placed buildings and lit windows, then maps the page's overall
scroll progress (0 at the top, 1 at the bottom) onto a smooth spline camera
path defined as a handful of waypoints in `scene.js` — one roughly per major
section. To change the flight, edit the `waypoints` array there.

The four full-height "chapter" sections at the top of the page
(`.chapter`) have a transparent background so the 3D scene is fully visible
behind them; every section further down (`.section`, `.work`, `.numbers`,
`.cta`) uses a translucent background + `backdrop-filter: blur(...)` so the
skyline still shows through, blurred, behind readable content.

**Graceful fallback:** if three.js fails to load (CDN blocked, offline, very
old browser) or WebGL isn't available, `js/scene.js` adds a `no-webgl` class
to `<html>` and returns early. CSS rules scoped to `html.no-webgl` swap the
canvas off and every panel back to a fully opaque background — the page is
complete and readable either way, just without the 3D backdrop.

## Running locally

Any static server works, e.g.:

```
python3 -m http.server 8000
```

Then open `http://localhost:8000`. Note the 3D backdrop needs internet
access (three.js loads from a CDN) — offline you'll see the `no-webgl`
fallback, which is expected.

## Notes for editors

- Project cards, subsidiary/company blurbs and figures in the "Numbers"
  section are drawn from current public company content. Update
  `index.html` directly to add/remove projects (each project card needs a
  `data-country` of `BH`, `AE`, or `SA` to work with the filter buttons).
- The contact form (`#contactForm`) is front-end only — it shows a
  confirmation message but does not send anywhere. Wire it to a form
  backend/service before relying on it.
- The 3D flight, scroll-reveal animations and the halo's idle spin all
  automatically disable/simplify for users with `prefers-reduced-motion`
  enabled.
- three.js is loaded from cdnjs pinned to r128 in `index.html` — bump that
  version deliberately, not incidentally, since newer three.js releases have
  dropped some of the older UMD globals this file relies on.
